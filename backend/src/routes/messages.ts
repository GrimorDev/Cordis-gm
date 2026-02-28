import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/messages/channel/:channelId?before=<id>&limit=50
router.get('/channel/:channelId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
  const before = req.query.before as string | undefined;

  try {
    // Verify access
    const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [req.params.channelId]);
    if (!ch) return res.status(404).json({ error: 'Channel not found' });

    const access = await query(
      `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
      [ch.server_id, req.user!.id]
    );
    if (!access.rowCount) return res.status(403).json({ error: 'No access' });

    let sql = `
      SELECT m.id, m.channel_id, m.content, m.edited, m.created_at, m.updated_at,
             u.id as sender_id, u.username as sender_username,
             u.avatar_url as sender_avatar, u.status as sender_status,
             sm.role_name as sender_role
      FROM messages m
      INNER JOIN users u ON u.id = m.sender_id
      LEFT JOIN server_members sm ON sm.server_id = $1 AND sm.user_id = m.sender_id
      WHERE m.channel_id = $2
    `;
    const params: any[] = [ch.server_id, req.params.channelId];

    if (before) {
      params.push(before);
      sql += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
    }
    sql += ` ORDER BY m.created_at DESC LIMIT ${limit}`;

    const { rows } = await query(sql, params);
    // Return in ascending order
    return res.json(rows.reverse());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/channel/:channelId
router.post(
  '/channel/:channelId',
  authMiddleware,
  [body('content').trim().isLength({ min: 1, max: 4000 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [req.params.channelId]);
      if (!ch) return res.status(404).json({ error: 'Channel not found' });

      const access = await query(
        `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
        [ch.server_id, req.user!.id]
      );
      if (!access.rowCount) return res.status(403).json({ error: 'No access' });

      const { rows: [msg] } = await query(
        `INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
        [req.params.channelId, req.user!.id, req.body.content]
      );

      // Fetch with sender info for socket broadcast
      const { rows: [full] } = await query(
        `SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar,
                sm.role_name as sender_role
         FROM messages m
         INNER JOIN users u ON u.id = m.sender_id
         LEFT JOIN server_members sm ON sm.server_id = $1 AND sm.user_id = m.sender_id
         WHERE m.id = $2`,
        [ch.server_id, msg.id]
      );

      // Emit via Socket.IO (attached in index.ts)
      const io = req.app.get('io');
      if (io) {
        io.to(`channel:${req.params.channelId}`).emit('new_message', full);
      }

      return res.status(201).json(full);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/messages/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  try {
    const { rows: [msg] } = await query(`SELECT * FROM messages WHERE id = $1`, [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    if (msg.sender_id !== req.user!.id) return res.status(403).json({ error: 'Not your message' });

    const { rows: [updated] } = await query(
      `UPDATE messages SET content = $1, edited = true, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [content.trim(), req.params.id]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${msg.channel_id}`).emit('message_updated', {
        id: updated.id,
        content: updated.content,
        edited: updated.edited,
      });
    }
    return res.json(updated);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query(`SELECT * FROM messages WHERE id = $1`, [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });

    // Allow sender or server admin/owner to delete
    if (msg.sender_id !== req.user!.id) {
      const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [msg.channel_id]);
      const { rows: [member] } = await query(
        `SELECT role_name FROM server_members WHERE server_id = $1 AND user_id = $2`,
        [ch.server_id, req.user!.id]
      );
      if (!member || !['Owner', 'Admin'].includes(member.role_name)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    await query(`DELETE FROM messages WHERE id = $1`, [req.params.id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${msg.channel_id}`).emit('message_deleted', {
        id: msg.id,
        channel_id: msg.channel_id,
      });
    }
    return res.json({ message: 'Deleted' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/:id/reactions
router.post('/:id/reactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  try {
    await query(
      `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.user!.id, emoji]
    );
    return res.json({ message: 'Reaction added' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/messages/:id/reactions/:emoji
router.delete('/:id/reactions/:emoji', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [req.params.id, req.user!.id, req.params.emoji]
    );
    return res.json({ message: 'Reaction removed' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
