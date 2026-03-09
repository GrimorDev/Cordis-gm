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
    if (!rows[0]?.is_admin) return res.status(403).json({ error: 'Forbidden' });
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

export default router;
