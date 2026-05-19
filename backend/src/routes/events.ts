import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router({ mergeParams: true });

// GET /api/servers/:serverId/events
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const { serverId } = req.params;
  const userId = req.user!.id;
  try {
    const result = await query(
      `SELECT e.*,
              u.username AS creator_username,
              c.name     AS channel_name,
              (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.type = 'going')      AS going_count,
              (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id AND r.type = 'interested') AS interested_count,
              (SELECT r.type   FROM event_rsvps r WHERE r.event_id = e.id AND r.user_id = $2 LIMIT 1) AS my_rsvp,
              (SELECT json_agg(json_build_object('id', ru.id, 'username', ru.username, 'avatar_url', ru.avatar_url))
               FROM event_rsvps er
               JOIN users ru ON ru.id = er.user_id
               WHERE er.event_id = e.id AND er.type = 'going'
               LIMIT 8) AS going_users
       FROM server_events e
       LEFT JOIN users u ON u.id = e.creator_id
       LEFT JOIN channels c ON c.id = e.channel_id
       WHERE e.server_id = $1
       ORDER BY e.starts_at ASC`,
      [serverId, userId]
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
      const ev = { ...result.rows[0], going_count: 0, interested_count: 0, my_rsvp: null, going_users: [] };

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
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        starts_at   = COALESCE($3, starts_at),
        ends_at     = COALESCE($4, ends_at),
        channel_id  = COALESCE($5, channel_id),
        status      = COALESCE($6, status)
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

// POST /api/servers/:serverId/events/:id/rsvp  { type: 'going' | 'interested' }
router.post('/:id/rsvp', authMiddleware, async (req: AuthRequest, res) => {
  const { serverId, id } = req.params;
  const userId = req.user!.id;
  const { type } = req.body;

  if (!['going', 'interested'].includes(type)) {
    return res.status(400).json({ error: 'type must be going or interested' });
  }

  try {
    const ev = await query(`SELECT id FROM server_events WHERE id = $1 AND server_id = $2`, [id, serverId]);
    if (!ev.rows.length) return res.status(404).json({ error: 'Event not found' });

    await query(
      `INSERT INTO event_rsvps (event_id, user_id, type)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id) DO UPDATE SET type = $3`,
      [id, userId, type]
    );

    const counts = await query(
      `SELECT
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND type = 'going')::int      AS going_count,
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND type = 'interested')::int AS interested_count,
        (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url))
         FROM event_rsvps er JOIN users u ON u.id = er.user_id
         WHERE er.event_id = $1 AND er.type = 'going' LIMIT 8) AS going_users`,
      [id]
    );

    const payload = { event_id: id, server_id: serverId, user_id: userId, type, ...counts.rows[0] };
    const io = req.app.get('io');
    if (io) io.to(`server:${serverId}`).emit('event_rsvp_updated', payload);

    res.json(payload);
  } catch (err) {
    console.error('[events] rsvp error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/servers/:serverId/events/:id/rsvp  (remove RSVP)
router.delete('/:id/rsvp', authMiddleware, async (req: AuthRequest, res) => {
  const { serverId, id } = req.params;
  const userId = req.user!.id;

  try {
    await query(`DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2`, [id, userId]);

    const counts = await query(
      `SELECT
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND type = 'going')::int      AS going_count,
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND type = 'interested')::int AS interested_count,
        (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'avatar_url', u.avatar_url))
         FROM event_rsvps er JOIN users u ON u.id = er.user_id
         WHERE er.event_id = $1 AND er.type = 'going' LIMIT 8) AS going_users`,
      [id]
    );

    const payload = { event_id: id, server_id: serverId, user_id: userId, type: null, ...counts.rows[0] };
    const io = req.app.get('io');
    if (io) io.to(`server:${serverId}`).emit('event_rsvp_updated', payload);

    res.json(payload);
  } catch (err) {
    console.error('[events] unresvp error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
