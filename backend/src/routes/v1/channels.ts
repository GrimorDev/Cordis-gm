import { Router, Request, Response } from 'express';
import { assertBotInGuild, requireScope } from '../../middleware/botAuth';
import { query } from '../../db/pool';
import crypto from 'crypto';
import { query as dbQuery } from '../../db/pool';

const router = Router();

async function checkChannelAccess(req: Request, res: Response, channelId: string): Promise<{ channel: any; actorId: string } | null> {
  const p = req.v1Principal!;
  const actorId = p.type === 'bot' ? p.botUserId : p.userId;

  const { rows } = await query(
    'SELECT id, server_id, name, type FROM channels WHERE id = $1',
    [channelId]
  );
  if (!rows.length) {
    res.status(404).json({ error: 'Unknown Channel', code: 10003 });
    return null;
  }
  const channel = rows[0];
  if (channel.server_id) {
    const inGuild = await assertBotInGuild(actorId, channel.server_id);
    if (!inGuild) {
      res.status(403).json({ error: 'Missing Access', code: 50001 });
      return null;
    }
  }
  return { channel, actorId };
}

// GET /api/v1/channels/:channelId
router.get('/:channelId', async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  res.json(result.channel);
});

// GET /api/v1/channels/:channelId/messages
router.get('/:channelId/messages', requireScope('messages.read'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const before = req.query.before as string | undefined;
  const after = req.query.after as string | undefined;

  try {
    let whereExtra = '';
    const params: any[] = [req.params.channelId, limit];
    if (before) { whereExtra = `AND m.id < $3`; params.push(before); }
    if (after)  { whereExtra = `AND m.id > $3`; params.push(after); }

    const { rows } = await query(
      `SELECT m.id, m.content, m.created_at, m.edited, m.is_automated,
              json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url, 'is_bot', u.is_bot) AS author
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.channel_id = $1 ${whereExtra}
       ORDER BY m.created_at DESC LIMIT $2`,
      params
    );
    res.json(rows.reverse());
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/v1/channels/:channelId/messages
router.post('/:channelId/messages', requireScope('messages.send'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { channel, actorId } = result;

  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content is required', code: 50006 });
  }
  if (content.length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000)', code: 50035 });
  }

  try {
    const { rows: [msg] } = await query(
      `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [channel.id, actorId, content.trim()]
    );

    const { rows: [full] } = await query(
      `SELECT m.*, json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url, 'is_bot', u.is_bot) AS author
       FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1`,
      [msg.id]
    );

    const io = req.app.get('io');
    if (io) io.to(`channel:${channel.id}`).emit('new_message', full);

    // Bot analytics: increment messages_processed
    const p = req.v1Principal!;
    if (p.type === 'bot') {
      dbQuery(
        `INSERT INTO bot_analytics (app_id, date, messages_processed)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (app_id, date) DO UPDATE
           SET messages_processed = bot_analytics.messages_processed + 1`,
        [p.applicationId]
      ).catch(() => {});

      // Webhook delivery with HMAC-SHA256 signature
      dbQuery(
        `SELECT webhook_url, webhook_secret FROM developer_applications WHERE id = $1`,
        [p.applicationId]
      ).then(({ rows }) => {
        if (!rows.length || !rows[0].webhook_url) return;
        const { webhook_url, webhook_secret } = rows[0];
        const payload = JSON.stringify({ event: 'MESSAGE_CREATE', data: full });
        const sig = crypto.createHmac('sha256', webhook_secret || '')
          .update(payload).digest('hex');
        fetch(webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cordyn-Signature-256': `sha256=${sig}`,
            'X-Cordyn-Event': 'MESSAGE_CREATE',
          },
          body: payload,
          signal: AbortSignal.timeout(5000),
        }).catch(() => {}); // fire-and-forget
      }).catch(() => {});
    }

    res.status(201).json(full);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/v1/channels/:channelId/messages/:messageId
router.delete('/:channelId/messages/:messageId', async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { actorId } = result;

  try {
    const { rows: [msg] } = await query('SELECT * FROM messages WHERE id = $1', [req.params.messageId]);
    if (!msg) return res.status(404).json({ error: 'Unknown Message', code: 10008 });
    if (msg.sender_id !== actorId) return res.status(403).json({ error: 'Cannot delete this message', code: 50013 });

    await query('DELETE FROM messages WHERE id = $1', [msg.id]);
    const io = req.app.get('io');
    if (io) io.to(`channel:${msg.channel_id}`).emit('message_deleted', { message_id: msg.id, channel_id: msg.channel_id });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/v1/channels/:channelId/messages/:messageId/reactions/:emoji/@me
router.put('/:channelId/messages/:messageId/reactions/:emoji/@me', requireScope('reactions'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { actorId } = result;
  try {
    await query(
      'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.messageId, actorId, req.params.emoji]
    );
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/v1/channels/:channelId/messages/:messageId/reactions/:emoji/@me
router.delete('/:channelId/messages/:messageId/reactions/:emoji/@me', requireScope('reactions'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { actorId } = result;
  try {
    await query('DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3', [req.params.messageId, actorId, req.params.emoji]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
