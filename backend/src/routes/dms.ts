import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, getClient } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { msgLimiter } from '../middleware/messageLimiter';
import { AuthRequest } from '../types';
import { sendPushToUser } from '../services/push';

const router = Router();

async function getOrCreateConversation(userId1: string, userId2: string): Promise<string> {
  const { rows } = await query(
    `SELECT dp1.conversation_id FROM dm_participants dp1
     INNER JOIN dm_participants dp2 ON dp2.conversation_id = dp1.conversation_id AND dp2.user_id = $2
     WHERE dp1.user_id = $1`,
    [userId1, userId2]
  );
  if (rows[0]) return rows[0].conversation_id;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: [conv] } = await client.query('INSERT INTO dm_conversations DEFAULT VALUES RETURNING id');
    await client.query(
      'INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)',
      [conv.id, userId1, userId2]
    );
    await client.query('COMMIT');
    return conv.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

// GET /api/dms/conversations
router.get('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT dc.id, dc.created_at,
              u.id as other_user_id, u.username as other_username,
              u.avatar_url as other_avatar, u.status as other_status,
              u.avatar_effect as other_avatar_effect, u.custom_status as other_custom_status,
              st.tag as other_tag, st.color as other_tag_color, st.icon as other_tag_icon, u.active_tag_server_id as other_tag_server_id,
              CASE WHEN u.privacy_read_receipts = FALSE THEN NULL ELSE dp2.last_read_at END as other_last_read_at,
              (SELECT content FROM dm_messages WHERE conversation_id=dc.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM dm_messages WHERE conversation_id=dc.id ORDER BY created_at DESC LIMIT 1) as last_message_at
       FROM dm_conversations dc
       INNER JOIN dm_participants dp  ON dp.conversation_id=dc.id  AND dp.user_id=$1
       INNER JOIN dm_participants dp2 ON dp2.conversation_id=dc.id AND dp2.user_id!=$1
       INNER JOIN users u ON u.id=dp2.user_id
       LEFT JOIN server_tags st ON st.server_id = u.active_tag_server_id
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/dms/:userId/messages
router.get('/:userId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
  const before = req.query.before as string | undefined;
  try {
    // Find existing conversation WITHOUT creating one — prevents ghost empty conversations
    const { rows: existing } = await query(
      `SELECT dp1.conversation_id FROM dm_participants dp1
       INNER JOIN dm_participants dp2 ON dp2.conversation_id=dp1.conversation_id AND dp2.user_id=$2
       WHERE dp1.user_id=$1 LIMIT 1`,
      [req.user!.id, req.params.userId]
    );
    if (!existing[0]) return res.json([]); // No conversation yet — return empty, don't create
    const conversationId = existing[0].conversation_id;
    let sql = `
      SELECT dm.id, dm.conversation_id, dm.content, dm.edited, dm.created_at,
             dm.attachment_url, dm.reply_to_id, dm.is_system,
             u.id as sender_id, u.username as sender_username, u.avatar_url as sender_avatar, u.avatar_effect as sender_avatar_effect,
             st.tag as sender_tag, st.color as sender_tag_color, st.icon as sender_tag_icon, u.active_tag_server_id as sender_tag_server_id,
             rm.content as reply_content, ru.username as reply_username
      FROM dm_messages dm
      INNER JOIN users u ON u.id=dm.sender_id
      LEFT JOIN server_tags st ON st.server_id = u.active_tag_server_id
      LEFT JOIN dm_messages rm ON rm.id=dm.reply_to_id
      LEFT JOIN users ru ON ru.id=rm.sender_id
      WHERE dm.conversation_id=$1
    `;
    const params: any[] = [conversationId];
    if (before) {
      params.push(before);
      sql += ` AND dm.created_at < (SELECT created_at FROM dm_messages WHERE id=$${params.length})`;
    }
    sql += ` ORDER BY dm.created_at DESC LIMIT ${limit}`;
    const { rows } = await query(sql, params);
    const result = rows.map((r: any) =>
      r.is_system ? { ...r, sender_id: '__system__', sender_username: 'System', sender_avatar: null } : r
    );
    return res.json(result.reverse());
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/dms/:userId/messages
router.post('/:userId/messages', authMiddleware, msgLimiter,
  [body('content').trim().isLength({ min: 0, max: 4000 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reply_to_id, attachment_url } = req.body;
    if (!req.body.content?.trim() && !attachment_url) {
      return res.status(400).json({ error: 'Message must have content or attachment' });
    }

    try {
      // Only friends can exchange DMs
      const { rows: [friendship] } = await query(
        `SELECT id FROM friends WHERE ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)) AND status='accepted'`,
        [req.user!.id, req.params.userId]
      );
      if (!friendship) return res.status(403).json({ error: 'Możesz pisać tylko do znajomych' });

      const conversationId = await getOrCreateConversation(req.user!.id, req.params.userId);
      const { rows: [msg] } = await query(
        'INSERT INTO dm_messages (conversation_id,sender_id,content,reply_to_id,attachment_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [conversationId, req.user!.id, req.body.content, reply_to_id || null, attachment_url || null]
      );
      const { rows: [full] } = await query(
        `SELECT dm.*,u.username as sender_username,u.avatar_url as sender_avatar,
                rm.content as reply_content, ru.username as reply_username
         FROM dm_messages dm INNER JOIN users u ON u.id=dm.sender_id
         LEFT JOIN dm_messages rm ON rm.id=dm.reply_to_id
         LEFT JOIN users ru ON ru.id=rm.sender_id
         WHERE dm.id=$1`,
        [msg.id]
      );
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.params.userId}`).emit('new_dm', full);
        io.to(`user:${req.user!.id}`).emit('new_dm', full);
      }
      sendPushToUser(parseInt(req.params.userId), {
        title: `Nowa wiadomość od ${req.user!.username}`,
        body: (req.body.content || '').slice(0, 100) || '📎 Załącznik',
        icon: full.sender_avatar || '/cordyn_logo.png',
        url: `/dm/${req.user!.id}`,
        tag: `dm-${req.user!.id}`,
      }).catch(() => {});
      return res.status(201).json(full);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// PUT /api/dms/:userId/read — mark conversation as read by current user
router.put('/:userId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = await getOrCreateConversation(req.user!.id, req.params.userId);
    // Always update last_read_at for unread count purposes
    await query(
      'UPDATE dm_participants SET last_read_at = NOW() WHERE conversation_id=$1 AND user_id=$2',
      [conversationId, req.user!.id]
    );
    // Only emit dm_read event if the reader allows read receipts
    const { rows: [reader] } = await query(
      'SELECT privacy_read_receipts FROM users WHERE id=$1',
      [req.user!.id]
    );
    const io = req.app.get('io');
    if (io && reader?.privacy_read_receipts === true) {
      io.to(`user:${req.params.userId}`).emit('dm_read', {
        conversation_id: conversationId,
        reader_id: req.user!.id,
        read_at: new Date().toISOString(),
      });
    }
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/dms/:userId/system-message  (call ended, etc.)
router.post('/:userId/system-message', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    const conversationId = await getOrCreateConversation(req.user!.id, req.params.userId);
    const { rows: [msg] } = await query(
      'INSERT INTO dm_messages (conversation_id,sender_id,content,is_system) VALUES ($1,$2,$3,true) RETURNING *',
      [conversationId, req.user!.id, content.trim()]
    );
    const full = { ...msg, sender_id: '__system__', sender_username: 'System', sender_avatar: null };
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.params.userId}`).emit('new_dm', full);
      io.to(`user:${req.user!.id}`).emit('new_dm', full);
    }
    return res.status(201).json(full);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/dms/messages/:id
router.put('/messages/:id', authMiddleware,
  [body('content').trim().isLength({ min: 1, max: 4000 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { rows: [msg] } = await query('SELECT * FROM dm_messages WHERE id=$1', [req.params.id]);
      if (!msg) return res.status(404).json({ error: 'Not found' });
      if (msg.sender_id !== req.user!.id) return res.status(403).json({ error: 'Not your message' });
      const { rows: [updated] } = await query(
        'UPDATE dm_messages SET content=$1, edited=true, updated_at=NOW() WHERE id=$2 RETURNING *',
        [req.body.content, req.params.id]
      );
      const io = req.app.get('io');
      if (io) {
        // Notify both participants
        const { rows: participants } = await query(
          'SELECT user_id FROM dm_participants WHERE conversation_id=$1', [msg.conversation_id]
        );
        participants.forEach((p: any) => {
          io.to(`user:${p.user_id}`).emit('dm_message_updated', { id: updated.id, content: updated.content, edited: true });
        });
      }
      return res.json(updated);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// DELETE /api/dms/messages/:id
router.delete('/messages/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query('SELECT * FROM dm_messages WHERE id=$1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    if (msg.sender_id !== req.user!.id) return res.status(403).json({ error: 'Not your message' });
    await query('DELETE FROM dm_messages WHERE id=$1', [req.params.id]);
    // Notify both participants in real-time
    const io = req.app.get('io');
    if (io) {
      const { rows: participants } = await query(
        'SELECT user_id FROM dm_participants WHERE conversation_id=$1', [msg.conversation_id]
      );
      participants.forEach((p: any) => {
        io.to(`user:${p.user_id}`).emit('dm_message_deleted', { id: msg.id, conversation_id: msg.conversation_id });
      });
    }
    return res.json({ message: 'Deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/dms/messages/:id/pin  — toggle pin
router.put('/messages/:id/pin', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query('SELECT * FROM dm_messages WHERE id=$1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    // Only participants can pin
    const { rows: [part] } = await query(
      'SELECT 1 FROM dm_participants WHERE conversation_id=$1 AND user_id=$2',
      [msg.conversation_id, req.user!.id]
    );
    if (!part) return res.status(403).json({ error: 'Not a participant' });
    const newPinned = !msg.pinned;
    await query('UPDATE dm_messages SET pinned=$1 WHERE id=$2', [newPinned, msg.id]);
    const io = req.app.get('io');
    if (io) {
      const { rows: participants } = await query(
        'SELECT user_id FROM dm_participants WHERE conversation_id=$1', [msg.conversation_id]
      );
      participants.forEach((p: any) => {
        io.to(`user:${p.user_id}`).emit('dm_message_pinned', { id: msg.id, conversation_id: msg.conversation_id, pinned: newPinned });
      });
    }
    return res.json({ pinned: newPinned });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/dms/:userId/pinned
router.get('/:userId/pinned', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const myId = req.user!.id;
    const { rows: [conv] } = await query(
      `SELECT c.id FROM dm_conversations c
       JOIN dm_participants p1 ON p1.conversation_id=c.id AND p1.user_id=$1
       JOIN dm_participants p2 ON p2.conversation_id=c.id AND p2.user_id=$2`,
      [myId, req.params.userId]
    );
    if (!conv) return res.json([]);
    const { rows } = await query(
      `SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
       FROM dm_messages m JOIN users u ON u.id=m.sender_id
       WHERE m.conversation_id=$1 AND m.pinned=true
       ORDER BY m.created_at DESC LIMIT 50`,
      [conv.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
