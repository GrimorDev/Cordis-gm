import { Router, Request, Response } from 'express';
import { assertBotInGuild, requireScope } from '../../middleware/botAuth';
import { query, getClient } from '../../db/pool';
import crypto from 'crypto';

const router = Router();

// ── Embed validation ──────────────────────────────────────────────────────────
interface Embed {
  title?: string;
  description?: string;
  color?: number;
  url?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
}

function validateEmbed(embed: any): string | null {
  if (typeof embed !== 'object' || Array.isArray(embed)) return 'embed must be an object';
  if (embed.title && embed.title.length > 256)       return 'embed.title max 256 chars';
  if (embed.description && embed.description.length > 4096) return 'embed.description max 4096 chars';
  if (embed.footer && embed.footer.length > 2048)    return 'embed.footer max 2048 chars';
  if (embed.color !== undefined && (typeof embed.color !== 'number' || embed.color < 0 || embed.color > 0xFFFFFF))
    return 'embed.color must be integer 0–16777215';
  if (embed.fields) {
    if (!Array.isArray(embed.fields))            return 'embed.fields must be array';
    if (embed.fields.length > 25)                return 'embed.fields max 25';
    for (const f of embed.fields) {
      if (!f.name || f.name.length > 256)        return 'embed field name required, max 256';
      if (!f.value || f.value.length > 1024)     return 'embed field value required, max 1024';
    }
  }
  return null;
}

// ── Webhook delivery helper ───────────────────────────────────────────────────
async function deliverWebhook(serverId: string, event: string, data: any, excludeAppId?: string) {
  const { rows: bots } = await query(
    `SELECT da.id, da.webhook_url, da.webhook_secret
     FROM bot_server_installations bsi
     JOIN developer_applications da ON da.id = bsi.application_id
     WHERE bsi.server_id = $1
       AND da.webhook_url IS NOT NULL AND da.webhook_url <> ''
       ${excludeAppId ? 'AND da.id <> $2' : ''}`,
    excludeAppId ? [serverId, excludeAppId] : [serverId]
  );
  if (!bots.length) return;
  const payload = JSON.stringify({ event, data });
  await Promise.allSettled(
    bots.map(({ webhook_url, webhook_secret }: any) => {
      const sig = 'sha256=' + crypto
        .createHmac('sha256', webhook_secret || '')
        .update(payload).digest('hex');
      return fetch(webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cordyn-Signature-256': sig,
          'X-Cordyn-Event': event,
        },
        body: payload,
        signal: AbortSignal.timeout(4000),
      });
    })
  );
}

// ── Channel access check ──────────────────────────────────────────────────────
async function checkChannelAccess(
  req: Request, res: Response, channelId: string
): Promise<{ channel: any; actorId: string; appId: string } | null> {
  const p = req.v1Principal!;
  const actorId = p.type === 'bot' ? p.botUserId : p.userId;
  const appId   = p.type === 'bot' ? p.applicationId : '';

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
  return { channel, actorId, appId };
}

// ── Rate-limit headers middleware (per-bot, 50 req/s already enforced) ────────
// Attaches informational headers — actual limiting is in v1/index.ts
router.use((_req, res, next) => {
  res.setHeader('X-RateLimit-Limit', '50');
  res.setHeader('X-RateLimit-Window', '1000');
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/channels/:channelId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:channelId', async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  res.json(result.channel);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/channels/:channelId/messages
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:channelId/messages', requireScope('messages.read'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const before = req.query.before as string | undefined;
  const after  = req.query.after  as string | undefined;

  try {
    let whereExtra = '';
    const params: any[] = [req.params.channelId, limit];
    if (before) { whereExtra = 'AND m.id < $3'; params.push(before); }
    if (after)  { whereExtra = 'AND m.id > $3'; params.push(after); }

    const { rows } = await query(
      `SELECT m.id, m.content, m.embed, m.created_at, m.edited, m.is_automated,
              m.attachment_url, m.reply_to_id,
              json_build_object('id', u.id, 'username', u.username,
                'avatar_url', u.avatar_url, 'is_bot', u.is_bot) AS author
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.channel_id = $1 ${whereExtra}
       ORDER BY m.created_at DESC LIMIT $2`,
      params
    );
    res.json(rows.reverse());
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/channels/:channelId/messages  (send message, supports embed)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:channelId/messages', requireScope('messages.send'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { channel, actorId, appId } = result;

  const { content, embed } = req.body;
  if (!content && !embed)
    return res.status(400).json({ error: 'content or embed is required', code: 50006 });
  if (content && (typeof content !== 'string' || content.length > 2000))
    return res.status(400).json({ error: 'content max 2000 chars', code: 50035 });

  let embedJson: object | null = null;
  if (embed) {
    const err = validateEmbed(embed);
    if (err) return res.status(400).json({ error: err, code: 50035 });
    embedJson = embed;
  }

  try {
    const { rows: [msg] } = await query(
      `INSERT INTO messages (channel_id, sender_id, content, embed)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [channel.id, actorId, (content || '').trim(), embedJson ? JSON.stringify(embedJson) : null]
    );

    const { rows: [full] } = await query(
      `SELECT m.*, json_build_object('id', u.id, 'username', u.username,
         'avatar_url', u.avatar_url, 'is_bot', u.is_bot) AS author
       FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1`,
      [msg.id]
    );

    const io = req.app.get('io');
    if (io) io.to(`channel:${channel.id}`).emit('new_message', full);

    // Bot analytics
    const p = req.v1Principal!;
    if (p.type === 'bot') {
      query(
        `INSERT INTO bot_analytics (app_id, date, messages_processed)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (app_id, date) DO UPDATE
           SET messages_processed = bot_analytics.messages_processed + 1`,
        [appId]
      ).catch(() => {});
    }

    // Deliver MESSAGE_CREATE to all other bots in the guild
    if (channel.server_id) {
      deliverWebhook(channel.server_id, 'MESSAGE_CREATE', full, appId).catch(() => {});
    }

    res.status(201).json(full);
  } catch (err) {
    console.error('POST /v1/channels/messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/channels/:channelId/messages/:messageId  (edit own message)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:channelId/messages/:messageId', requireScope('messages.send'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { actorId, appId, channel } = result;

  const { content, embed } = req.body;
  if (!content && !embed)
    return res.status(400).json({ error: 'content or embed is required', code: 50006 });
  if (content && content.length > 2000)
    return res.status(400).json({ error: 'content max 2000 chars', code: 50035 });

  let embedJson: object | null | undefined;
  if (embed !== undefined) {
    if (embed === null) {
      embedJson = null; // explicitly clear embed
    } else {
      const err = validateEmbed(embed);
      if (err) return res.status(400).json({ error: err, code: 50035 });
      embedJson = embed;
    }
  }

  try {
    const { rows: [msg] } = await query(
      'SELECT * FROM messages WHERE id = $1 AND channel_id = $2',
      [req.params.messageId, req.params.channelId]
    );
    if (!msg) return res.status(404).json({ error: 'Unknown Message', code: 10008 });
    if (msg.sender_id !== actorId)
      return res.status(403).json({ error: 'Cannot edit this message', code: 50013 });

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (content !== undefined) {
      updates.push(`content = $${idx++}`, `edited = true`);
      params.push(content.trim());
    }
    if (embedJson !== undefined) {
      updates.push(`embed = $${idx++}`);
      params.push(embedJson ? JSON.stringify(embedJson) : null);
    }
    params.push(req.params.messageId);

    const { rows: [updated] } = await query(
      `UPDATE messages SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params
    );

    const { rows: [full] } = await query(
      `SELECT m.*, json_build_object('id', u.id, 'username', u.username,
         'avatar_url', u.avatar_url, 'is_bot', u.is_bot) AS author
       FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1`,
      [updated.id]
    );

    const io = req.app.get('io');
    if (io) io.to(`channel:${msg.channel_id}`).emit('message_updated', {
      id: full.id, content: full.content, embed: full.embed, edited: full.edited,
    });

    // Deliver MESSAGE_UPDATE webhook
    if (channel.server_id) {
      deliverWebhook(channel.server_id, 'MESSAGE_UPDATE', full, appId).catch(() => {});
    }

    res.json(full);
  } catch (err) {
    console.error('PATCH /v1/channels/messages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/channels/:channelId/messages/:messageId
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:channelId/messages/:messageId', async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { actorId, channel } = result;

  try {
    const { rows: [msg] } = await query(
      'SELECT * FROM messages WHERE id = $1',
      [req.params.messageId]
    );
    if (!msg) return res.status(404).json({ error: 'Unknown Message', code: 10008 });
    if (msg.sender_id !== actorId)
      return res.status(403).json({ error: 'Cannot delete this message', code: 50013 });

    await query('DELETE FROM messages WHERE id = $1', [msg.id]);

    const io = req.app.get('io');
    if (io) io.to(`channel:${msg.channel_id}`).emit('message_deleted', {
      message_id: msg.id, channel_id: msg.channel_id,
    });

    // Deliver MESSAGE_DELETE webhook
    if (channel.server_id) {
      deliverWebhook(channel.server_id, 'MESSAGE_DELETE', {
        id: msg.id, channel_id: msg.channel_id, server_id: channel.server_id,
      }).catch(() => {});
    }

    res.status(204).end();
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/channels/:channelId/typing  (send typing indicator)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:channelId/typing', requireScope('messages.send'), async (req: Request, res: Response) => {
  const result = await checkChannelAccess(req, res, req.params.channelId);
  if (!result) return;
  const { channel, actorId } = result;

  try {
    // Fetch bot user info for the typing event
    const { rows: [user] } = await query(
      'SELECT id, username, avatar_url FROM users WHERE id = $1',
      [actorId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channel.id}`).emit('user_typing', {
        user_id: actorId,
        username: user?.username || 'Bot',
        channel_id: channel.id,
      });
    }

    res.status(204).end();
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Reactions
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:channelId/messages/:messageId/reactions/:emoji/@me',
  requireScope('reactions'), async (req: Request, res: Response) => {
    const result = await checkChannelAccess(req, res, req.params.channelId);
    if (!result) return;
    const { actorId, channel } = result;

    const emoji = decodeURIComponent(req.params.emoji);
    if (emoji.length > 12)
      return res.status(400).json({ error: 'Emoji too long', code: 50035 });

    try {
      await query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [req.params.messageId, actorId, emoji]
      );

      const io = req.app.get('io');
      if (io) {
        const { rows: [countRow] } = await query(
          'SELECT COUNT(*)::int AS count FROM message_reactions WHERE message_id=$1 AND emoji=$2',
          [req.params.messageId, emoji]
        );
        io.to(`channel:${channel.id}`).emit('reaction_update' as any, {
          message_id: req.params.messageId,
          emoji,
          count: countRow?.count ?? 1,
          me: true,
        });
      }

      // Deliver REACTION_ADD webhook
      if (channel.server_id) {
        deliverWebhook(channel.server_id, 'REACTION_ADD', {
          message_id: req.params.messageId,
          channel_id: channel.id,
          emoji,
          user_id: actorId,
        }).catch(() => {});
      }

      res.status(204).end();
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  }
);

router.delete('/:channelId/messages/:messageId/reactions/:emoji/@me',
  requireScope('reactions'), async (req: Request, res: Response) => {
    const result = await checkChannelAccess(req, res, req.params.channelId);
    if (!result) return;
    const { actorId } = result;

    const emoji = decodeURIComponent(req.params.emoji);
    try {
      await query(
        'DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3',
        [req.params.messageId, actorId, emoji]
      );
      res.status(204).end();
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/channels/:channelId/messages/:messageId/reactions
// Returns all reactions with counts for a message
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:channelId/messages/:messageId/reactions',
  requireScope('messages.read'), async (req: Request, res: Response) => {
    const result = await checkChannelAccess(req, res, req.params.channelId);
    if (!result) return;
    try {
      const { rows } = await query(
        `SELECT emoji, COUNT(*)::int AS count
         FROM message_reactions WHERE message_id = $1
         GROUP BY emoji ORDER BY emoji`,
        [req.params.messageId]
      );
      res.json(rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  }
);

export default router;
