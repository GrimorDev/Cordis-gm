import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// ── Admin-only middleware ─────────────────────────────────────────────
async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rows } = await query('SELECT is_admin FROM users WHERE id=$1', [req.user!.id]);
    if (rows[0]?.is_admin) return next();
    const { rowCount } = await query(
      `SELECT 1 FROM user_badges ub JOIN global_badges gb ON gb.id=ub.badge_id
       WHERE ub.user_id=$1 AND gb.name='developer' LIMIT 1`,
      [req.user!.id]
    );
    if (!rowCount) return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

// All routes require auth + admin
router.use(authMiddleware as any);
router.use(adminMiddleware as any);

// ── GET /api/admin/stats ──────────────────────────────────────────────
router.get('/stats', async (_req, res: Response) => {
  try {
    const [users, servers, messages, dms, badges, badge_assignments] = await Promise.all([
      query('SELECT COUNT(*)::int as n FROM users'),
      query('SELECT COUNT(*)::int as n FROM servers'),
      query('SELECT COUNT(*)::int as n FROM messages'),
      query('SELECT COUNT(*)::int as n FROM dm_messages'),
      query('SELECT COUNT(*)::int as n FROM global_badges'),
      query('SELECT COUNT(*)::int as n FROM user_badges'),
    ]);
    const mem = process.memoryUsage();
    return res.json({
      users: users.rows[0].n,
      servers: servers.rows[0].n,
      messages: messages.rows[0].n,
      dm_messages: dms.rows[0].n,
      badges: badges.rows[0].n,
      badge_assignments: badge_assignments.rows[0].n,
      memory: {
        rss:       Math.round(mem.rss       / 1024 / 1024),
        heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        external:  Math.round(mem.external  / 1024 / 1024),
      },
      node_version: process.version,
      uptime_seconds: Math.round(process.uptime()),
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/badges ─────────────────────────────────────────────
router.get('/badges', async (_req, res: Response) => {
  try {
    const { rows } = await query('SELECT * FROM global_badges ORDER BY position, created_at');
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── POST /api/admin/badges ────────────────────────────────────────────
router.post('/badges',
  [
    body('name').trim().isLength({ min: 1, max: 50 }).matches(/^[a-z0-9_]+$/),
    body('label').trim().isLength({ min: 1, max: 100 }),
    body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
    body('icon').optional().isLength({ max: 10 }),
    body('description').optional().isLength({ max: 500 }),
    body('position').optional().isInt({ min: 0, max: 9999 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, label, color = '#6366f1', icon = '🔵', description, position = 0 } = req.body;
    try {
      const { rows } = await query(
        'INSERT INTO global_badges (name,label,color,icon,description,position) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [name, label, color, icon, description || null, position]
      );
      return res.status(201).json(rows[0]);
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Badge name already exists' });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── PUT /api/admin/badges/:id ─────────────────────────────────────────
router.put('/badges/:id',
  [
    body('label').optional().trim().isLength({ min: 1, max: 100 }),
    body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
    body('icon').optional().isLength({ max: 10 }),
    body('description').optional().isLength({ max: 500 }),
    body('position').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { label, color, icon, description, position } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (label       !== undefined) { updates.push(`label=$${idx++}`);       values.push(label); }
    if (color       !== undefined) { updates.push(`color=$${idx++}`);       values.push(color); }
    if (icon        !== undefined) { updates.push(`icon=$${idx++}`);        values.push(icon); }
    if (description !== undefined) { updates.push(`description=$${idx++}`); values.push(description); }
    if (position    !== undefined) { updates.push(`position=$${idx++}`);    values.push(position); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.id);
    try {
      const { rows } = await query(`UPDATE global_badges SET ${updates.join(',')} WHERE id=$${idx} RETURNING *`, values);
      if (!rows[0]) return res.status(404).json({ error: 'Badge not found' });
      return res.json(rows[0]);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── DELETE /api/admin/badges/:id ──────────────────────────────────────
router.delete('/badges/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query('DELETE FROM global_badges WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Badge not found' });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/users/search?q= ───────────────────────────────────
router.get('/users/search', async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string || '').trim();
  if (!q) return res.json([]);
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.avatar_url, u.status, u.is_admin, u.created_at,
              COALESCE(
                (SELECT json_agg(json_build_object('id', gb.id, 'name', gb.name, 'label', gb.label, 'color', gb.color, 'icon', gb.icon) ORDER BY gb.position)
                 FROM user_badges ub INNER JOIN global_badges gb ON gb.id = ub.badge_id WHERE ub.user_id = u.id),
                '[]'::json
              ) as badges
       FROM users u WHERE u.username ILIKE $1 LIMIT 20`,
      [`${q}%`]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── POST /api/admin/badges/assign ────────────────────────────────────
router.post('/badges/assign',
  [body('user_id').isUUID(), body('badge_id').isUUID()],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { user_id, badge_id } = req.body;
    try {
      await query(
        'INSERT INTO user_badges (user_id, badge_id, assigned_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [user_id, badge_id, req.user!.id]
      );
      // Notify the user via socket
      const io = req.app.get('io');
      if (io) {
        const { rows: [updatedUser] } = await query(
          `SELECT id, username, COALESCE(
            (SELECT json_agg(json_build_object('id', gb.id, 'name', gb.name, 'label', gb.label, 'color', gb.color, 'icon', gb.icon) ORDER BY gb.position)
             FROM user_badges ub INNER JOIN global_badges gb ON gb.id = ub.badge_id WHERE ub.user_id = u.id),
            '[]'::json) as badges FROM users u WHERE u.id=$1`, [user_id]
        );
        if (updatedUser) {
          io.to(`user:${user_id}`).emit('badges_updated', { badges: updatedUser.badges });
        }
      }
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── DELETE /api/admin/users/:userId/badges/:badgeId ───────────────────
router.delete('/users/:userId/badges/:badgeId', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM user_badges WHERE user_id=$1 AND badge_id=$2', [req.params.userId, req.params.badgeId]);
    const io = req.app.get('io');
    if (io) {
      const { rows: [updatedUser] } = await query(
        `SELECT id, COALESCE(
          (SELECT json_agg(json_build_object('id', gb.id, 'name', gb.name, 'label', gb.label, 'color', gb.color, 'icon', gb.icon) ORDER BY gb.position)
           FROM user_badges ub INNER JOIN global_badges gb ON gb.id = ub.badge_id WHERE ub.user_id = u.id),
          '[]'::json) as badges FROM users u WHERE u.id=$1`, [req.params.userId]
      );
      if (updatedUser) {
        io.to(`user:${req.params.userId}`).emit('badges_updated', { badges: updatedUser.badges });
      }
    }
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/users?page=1&limit=50 ─────────────────────────
router.get('/users', async (req: AuthRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;
  try {
    const [usersRes, totalRes] = await Promise.all([
      query(
        `SELECT u.id, u.username, u.avatar_url, u.status, u.is_admin, u.created_at,
                COUNT(DISTINCT sm.server_id)::int as server_count,
                (SELECT COUNT(*)::int FROM messages WHERE sender_id=u.id) as message_count,
                COALESCE(
                  (SELECT json_agg(json_build_object('id',gb.id,'name',gb.name,'label',gb.label,'color',gb.color,'icon',gb.icon) ORDER BY gb.position)
                   FROM user_badges ub2 JOIN global_badges gb ON gb.id=ub2.badge_id WHERE ub2.user_id=u.id),
                  '[]'::json
                ) as badges
         FROM users u LEFT JOIN server_members sm ON sm.user_id=u.id
         GROUP BY u.id ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query('SELECT COUNT(*)::int as n FROM users'),
    ]);
    return res.json({ users: usersRes.rows, total: totalRes.rows[0].n });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/servers ────────────────────────────────────────
router.get('/servers', async (_req, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.icon_url, s.owner_id, u.username as owner_name,
              COUNT(DISTINCT sm.user_id)::int as member_count,
              COUNT(DISTINCT c.id)::int as channel_count, s.created_at
       FROM servers s
       JOIN users u ON u.id=s.owner_id
       LEFT JOIN server_members sm ON sm.server_id=s.id
       LEFT JOIN channels c ON c.server_id=s.id
       GROUP BY s.id, u.username ORDER BY member_count DESC`
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/overview ───────────────────────────────────────
router.get('/overview', async (_req, res: Response) => {
  try {
    const [users, servers, messages, dms, channels, registrations, onlineUsers] = await Promise.all([
      query('SELECT COUNT(*)::int as n FROM users'),
      query('SELECT COUNT(*)::int as n FROM servers'),
      query('SELECT COUNT(*)::int as n FROM messages'),
      query('SELECT COUNT(*)::int as n FROM dm_messages'),
      query('SELECT COUNT(*)::int as n FROM channels'),
      query(
        `SELECT DATE(created_at) as date, COUNT(*)::int as count
         FROM users WHERE created_at > NOW()-INTERVAL '7 days'
         GROUP BY DATE(created_at) ORDER BY date`
      ),
      query(`SELECT COUNT(*)::int as n FROM users WHERE status='online'`),
    ]);
    const mem = process.memoryUsage();
    return res.json({
      total_users:    users.rows[0].n,
      total_servers:  servers.rows[0].n,
      total_messages: messages.rows[0].n,
      total_dms:      dms.rows[0].n,
      total_channels: channels.rows[0].n,
      online_users:   onlineUsers.rows[0].n,
      registrations_7d: registrations.rows,
      memory: {
        rss:       Math.round(mem.rss       / 1024 / 1024),
        heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      node_version:    process.version,
      uptime_seconds:  Math.round(process.uptime()),
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── POST /api/admin/users/:userId/set-admin ───────────────────────────
router.post('/users/:userId/set-admin',
  [body('is_admin').isBoolean()],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      await query('UPDATE users SET is_admin=$1 WHERE id=$2', [req.body.is_admin, req.params.userId]);
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── GET /api/admin/users/:userId/bans ─────────────────────────────────
router.get('/users/:userId/bans', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT ub.*, u.username as banned_by_username
       FROM user_bans ub LEFT JOIN users u ON u.id=ub.banned_by
       WHERE ub.user_id=$1 ORDER BY ub.created_at DESC`,
      [req.params.userId]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── POST /api/admin/users/:userId/ban ─────────────────────────────────
router.post('/users/:userId/ban',
  [
    body('ban_type').isIn(['permanent', 'temporary', 'ip']),
    body('reason').optional().isString().isLength({ max: 500 }),
    body('duration_hours').optional().isInt({ min: 1 }),
    body('ip_address').optional().isString(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (req.params.userId === req.user!.id)
      return res.status(400).json({ error: 'Cannot ban yourself' });

    const { ban_type, reason, duration_hours, ip_address } = req.body;
    const banned_until = (ban_type === 'temporary' && duration_hours)
      ? new Date(Date.now() + duration_hours * 3_600_000)
      : null;
    try {
      await query(`UPDATE user_bans SET is_active=FALSE WHERE user_id=$1 AND is_active=TRUE`, [req.params.userId]);
      const { rows: [ban] } = await query(
        `INSERT INTO user_bans (user_id, banned_by, reason, ban_type, banned_until, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.userId, req.user!.id, reason || null, ban_type, banned_until, ip_address || null]
      );
      // Force-disconnect the banned user
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.params.userId}`).emit('force_logout', { reason: reason || 'Zostałeś zbanowany' });
        const sockets = await io.in(`user:${req.params.userId}`).fetchSockets();
        for (const s of sockets) s.disconnect(true);
      }
      return res.json(ban);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── DELETE /api/admin/users/:userId/ban ───────────────────────────────
router.delete('/users/:userId/ban', async (req: AuthRequest, res: Response) => {
  try {
    await query(`UPDATE user_bans SET is_active=FALSE WHERE user_id=$1 AND is_active=TRUE`, [req.params.userId]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
