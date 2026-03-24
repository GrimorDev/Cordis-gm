import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/bookmarks
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT
         b.id, b.message_id, b.dm_message_id, b.created_at,
         CASE
           WHEN b.message_id IS NOT NULL THEN json_build_object(
             'id', m.id, 'content', m.content, 'created_at', m.created_at,
             'attachment_url', m.attachment_url,
             'author', json_build_object('id', mu.id, 'username', mu.username, 'avatar_url', mu.avatar_url),
             'channel_id', m.channel_id
           )
           ELSE json_build_object(
             'id', dm.id, 'content', dm.content, 'created_at', dm.created_at,
             'attachment_url', dm.attachment_url,
             'author', json_build_object('id', dmu.id, 'username', dmu.username, 'avatar_url', dmu.avatar_url),
             'dm_id', dm.dm_id
           )
         END as message
       FROM message_bookmarks b
       LEFT JOIN messages m ON m.id = b.message_id
       LEFT JOIN users mu ON mu.id = m.user_id
       LEFT JOIN dm_messages dm ON dm.id = b.dm_message_id
       LEFT JOIN users dmu ON dmu.id = dm.sender_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT 100`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('bookmarks GET error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bookmarks
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { message_id, dm_message_id } = req.body;
  if (!message_id && !dm_message_id)
    return res.status(400).json({ error: 'Podaj message_id lub dm_message_id' });
  try {
    const { rows } = await query(
      `INSERT INTO message_bookmarks (user_id, message_id, dm_message_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [req.user!.id, message_id || null, dm_message_id || null]
    );
    return res.status(201).json(rows[0] || { ok: true });
  } catch (err) {
    console.error('bookmarks POST error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bookmarks
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { message_id, dm_message_id } = req.body;
  if (!message_id && !dm_message_id)
    return res.status(400).json({ error: 'Podaj message_id lub dm_message_id' });
  try {
    if (message_id) {
      await query('DELETE FROM message_bookmarks WHERE user_id=$1 AND message_id=$2', [req.user!.id, message_id]);
    } else {
      await query('DELETE FROM message_bookmarks WHERE user_id=$1 AND dm_message_id=$2', [req.user!.id, dm_message_id]);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('bookmarks DELETE error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
