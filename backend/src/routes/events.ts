import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router({ mergeParams: true });

// GET /api/servers/:serverId/events
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const { serverId } = req.params;
  try {
    const result = await query(
      `SELECT e.*, u.username AS creator_username, c.name AS channel_name
       FROM server_events e
       LEFT JOIN users u ON u.id = e.creator_id
       LEFT JOIN channels c ON c.id = e.channel_id
       WHERE e.server_id = $1
       ORDER BY e.starts_at ASC`,
      [serverId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[events] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers/:serverId/events
router.post('/', authMiddleware,
  body('title').isLength({ min: 1, max: 200 }),
  body('starts_at').isISO8601(),
  async (req: AuthRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { serverId } = req.params;
    const { title, description, starts_at, ends_at, channel_id } = req.body;
    const userId = req.user!.id;

    try {
    // Check member — note: server_members has no is_owner; ownership lives in servers.owner_id
    const member = await query(
      `SELECT 1 FROM server_members sm WHERE sm.server_id = $1 AND sm.user_id = $2`,
      [serverId, userId]
    );
    if (!member.rows.length) return res.status(403).json({ error: 'Not a member' });
      const result = await query(
        `INSERT INTO server_events (server_id, creator_id, title, description, starts_at, ends_at, channel_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *, (SELECT username FROM users WHERE id = $2) AS creator_username`,
        [serverId, userId, title, description || null, starts_at, ends_at || null, channel_id || null]
      );
      const ev = result.rows[0];

      // Broadcast to server room
      const io = req.app.get('io');
      if (io) io.to(`server:${serverId}`).emit('server_event_created', ev);

      res.status(201).json(ev);
    } catch (err) {
      console.error('[events] create error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/servers/:serverId/events/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { serverId, id } = req.params;
  const userId = req.user!.id;
  const { title, description, starts_at, ends_at, channel_id, status } = req.body;

  try {
    const existing = await query(`SELECT * FROM server_events WHERE id = $1 AND server_id = $2`, [id, serverId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Event not found' });
    if (existing.rows[0].creator_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    const result = await query(
      `UPDATE server_events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        starts_at = COALESCE($3, starts_at),
        ends_at = COALESCE($4, ends_at),
        channel_id = COALESCE($5, channel_id),
        status = COALESCE($6, status)
       WHERE id = $7 AND server_id = $8 RETURNING *`,
      [title, description, starts_at, ends_at, channel_id, status, id, serverId]
    );
    const ev = result.rows[0];
    const io = req.app.get('io');
    if (io) io.to(`server:${serverId}`).emit('server_event_updated', ev);
    res.json(ev);
  } catch (err) {
    console.error('[events] update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/servers/:serverId/events/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { serverId, id } = req.params;
  const userId = req.user!.id;

  try {
    const existing = await query(`SELECT * FROM server_events WHERE id = $1 AND server_id = $2`, [id, serverId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Event not found' });

    // Allow creator or server admin to delete
    const memberCheck = await query(
      `SELECT s.owner_id FROM server_members sm
       JOIN servers s ON s.id = sm.server_id
       WHERE sm.server_id = $1 AND sm.user_id = $2`,
      [serverId, userId]
    );
    if (!memberCheck.rows.length) return res.status(403).json({ error: 'Not a member' });
    const isAdmin = memberCheck.rows[0].owner_id === userId || existing.rows[0].creator_id === userId;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    await query(`DELETE FROM server_events WHERE id = $1`, [id]);
    const io = req.app.get('io');
    if (io) io.to(`server:${serverId}`).emit('server_event_deleted', { id });
    res.json({ ok: true });
  } catch (err) {
    console.error('[events] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
