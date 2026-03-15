import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/notifications — latest 50, unread first
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT n.id, n.type, n.message_id, n.channel_id, n.server_id,
              n.from_user_id, n.content, n.is_read, n.created_at,
              u.username AS from_username, u.avatar_url AS from_avatar,
              c.name AS channel_name, s.name AS server_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.from_user_id
       LEFT JOIN channels c ON c.id = n.channel_id
       LEFT JOIN servers s ON s.id = n.server_id
       WHERE n.user_id = $1
       ORDER BY n.is_read ASC, n.created_at DESC
       LIMIT 50`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/notifications/unread-count — badge counter
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [row] } = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user!.id]
    );
    return res.json({ count: row.count });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/notifications/read — mark ALL as read
router.put('/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
      [req.user!.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
