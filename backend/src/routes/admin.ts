import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import os from 'os';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { deleteFromR2, r2Enabled } from '../services/r2';
import { config } from '../config';

// ── Simple in-process API request counter ────────────────────────────────────
let _apiRequestsTotal = 0;
let _apiRequestsLast  = 0;  // snapshot at last /system/info call
let _apiRequestsRate  = 0;  // req/s since last call
let _lastInfoCallAt   = Date.now();
export function countRequest() { _apiRequestsTotal++; }

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

// ── Audit log helper ──────────────────────────────────────────────────
async function auditLog(req: AuthRequest, action: string, targetType: string | null, targetId: string | null, details: object = {}) {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
      || (req.socket as any)?.remoteAddress || null;
    await query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user!.id, action, targetType, targetId, JSON.stringify(details), ip]
    );
  } catch {}
}

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

// ── GET /api/admin/overview ───────────────────────────────────────
router.get('/overview', async (_req, res: Response) => {
  try {
    const [users, servers, messages, dms, channels, registrations, onlineUsers, messages7d, topServers] = await Promise.all([
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
      query(
        `SELECT DATE(created_at) as date, COUNT(*)::int as count
         FROM messages WHERE created_at > NOW()-INTERVAL '7 days'
         GROUP BY DATE(created_at) ORDER BY date`
      ),
      query(
        `SELECT s.id, s.name, s.icon_url, COUNT(sm.user_id)::int as member_count
         FROM servers s
         LEFT JOIN server_members sm ON sm.server_id = s.id
         GROUP BY s.id ORDER BY member_count DESC LIMIT 5`
      ),
    ]);
    const mem = process.memoryUsage();
    return res.json({
      total_users:      users.rows[0].n,
      total_servers:    servers.rows[0].n,
      total_messages:   messages.rows[0].n,
      total_dms:        dms.rows[0].n,
      total_channels:   channels.rows[0].n,
      online_users:     onlineUsers.rows[0].n,
      registrations_7d: registrations.rows,
      messages_7d:      messages7d.rows,
      top_servers:      topServers.rows,
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
      auditLog(req, 'create_badge', 'badge', rows[0].id, { name, label });
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
      auditLog(req, 'update_badge', 'badge', req.params.id, { label, color });
      return res.json(rows[0]);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── DELETE /api/admin/badges/:id ──────────────────────────────────────
router.delete('/badges/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('SELECT name, label FROM global_badges WHERE id=$1', [req.params.id]);
    const { rowCount } = await query('DELETE FROM global_badges WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Badge not found' });
    auditLog(req, 'delete_badge', 'badge', req.params.id, { name: rows[0]?.name, label: rows[0]?.label });
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
      const io = req.app.get('io');
      if (io) {
        const { rows: [updatedUser] } = await query(
          `SELECT id, username, COALESCE(
            (SELECT json_agg(json_build_object('id', gb.id, 'name', gb.name, 'label', gb.label, 'color', gb.color, 'icon', gb.icon) ORDER BY gb.position)
             FROM user_badges ub INNER JOIN global_badges gb ON gb.id = ub.badge_id WHERE ub.user_id = u.id),
            '[]'::json) as badges FROM users u WHERE u.id=$1`, [user_id]
        );
        if (updatedUser) io.to(`user:${user_id}`).emit('badges_updated', { badges: updatedUser.badges });
      }
      auditLog(req, 'assign_badge', 'user', user_id, { badge_id });
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
      if (updatedUser) io.to(`user:${req.params.userId}`).emit('badges_updated', { badges: updatedUser.badges });
    }
    auditLog(req, 'remove_badge', 'user', req.params.userId, { badge_id: req.params.badgeId });
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

// ── GET /api/admin/users/:userId/detail ───────────────────────────────
router.get('/users/:userId/detail', async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  try {
    const [userRes, serversRes, bansRes, sessionsRes] = await Promise.all([
      query(
        `SELECT u.id, u.username, u.email, u.avatar_url, u.status, u.is_admin, u.created_at,
                u.bio, u.custom_status, u.is_premium, u.storage_used_bytes,
                (SELECT COUNT(*)::int FROM messages WHERE sender_id=u.id) as message_count,
                (SELECT COUNT(*)::int FROM dm_messages WHERE sender_id=u.id) as dm_count,
                COALESCE(
                  (SELECT json_agg(json_build_object('id',gb.id,'name',gb.name,'label',gb.label,'color',gb.color,'icon',gb.icon) ORDER BY gb.position)
                   FROM user_badges ub JOIN global_badges gb ON gb.id=ub.badge_id WHERE ub.user_id=u.id),
                  '[]'::json
                ) as badges
         FROM users u WHERE u.id=$1`, [userId]
      ),
      query(
        `SELECT s.id, s.name, s.icon_url, sm.role_name, sm.joined_at
         FROM server_members sm
         JOIN servers s ON s.id = sm.server_id
         WHERE sm.user_id = $1
         ORDER BY sm.joined_at DESC LIMIT 20`, [userId]
      ),
      query(
        `SELECT ub.*, u.username as banned_by_username
         FROM user_bans ub LEFT JOIN users u ON u.id=ub.banned_by
         WHERE ub.user_id=$1 ORDER BY ub.created_at DESC LIMIT 10`, [userId]
      ),
      query(
        `SELECT ip_address, user_agent, created_at, last_seen_at
         FROM user_sessions WHERE user_id=$1
         ORDER BY last_seen_at DESC LIMIT 8`, [userId]
      ).catch(() => ({ rows: [] })),
    ]);
    if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({
      user:     userRes.rows[0],
      servers:  serversRes.rows,
      bans:     bansRes.rows,
      sessions: sessionsRes.rows,
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── PUT /api/admin/users/:userId/edit ────────────────────────────────
router.put('/users/:userId/edit',
  [
    body('username').optional().trim().isLength({ min: 2, max: 32 }).matches(/^[a-zA-Z0-9_.\-]+$/),
    body('email').optional().isEmail().normalizeEmail(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, email } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (username !== undefined) { updates.push(`username=$${idx++}`); values.push(username); }
    if (email    !== undefined) { updates.push(`email=$${idx++}`);    values.push(email); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    values.push(req.params.userId);
    try {
      const { rows: [u] } = await query(
        `UPDATE users SET ${updates.join(',')} WHERE id=$${idx} RETURNING id, username, email`,
        values
      );
      if (!u) return res.status(404).json({ error: 'User not found' });
      auditLog(req, 'edit_user', 'user', req.params.userId, { username, email });
      return res.json(u);
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ error: 'Nazwa użytkownika lub email jest już zajęty' });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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

// ── GET /api/admin/servers/:serverId — server details ────────────
router.get('/servers/:serverId', async (req: AuthRequest, res: Response) => {
  const { serverId } = req.params;
  try {
    const [serverRes, membersRes, channelsRes] = await Promise.all([
      query(
        `SELECT s.*, u.username as owner_name,
                COUNT(DISTINCT sm.user_id)::int as member_count,
                COUNT(DISTINCT c.id)::int as channel_count
         FROM servers s
         JOIN users u ON u.id = s.owner_id
         LEFT JOIN server_members sm ON sm.server_id = s.id
         LEFT JOIN channels c ON c.server_id = s.id
         WHERE s.id = $1
         GROUP BY s.id, u.username`, [serverId]
      ),
      query(
        `SELECT sm.user_id, sm.role_name, sm.joined_at,
                u.username, u.avatar_url, u.status
         FROM server_members sm
         JOIN users u ON u.id = sm.user_id
         WHERE sm.server_id = $1
         ORDER BY sm.joined_at`, [serverId]
      ),
      query(
        `SELECT id, name, type, position
         FROM channels WHERE server_id = $1
         ORDER BY position`, [serverId]
      ),
    ]);
    if (!serverRes.rows[0]) return res.status(404).json({ error: 'Server not found' });
    return res.json({
      server:   serverRes.rows[0],
      members:  membersRes.rows,
      channels: channelsRes.rows,
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── DELETE /api/admin/servers/:serverId — delete server ──────────
router.delete('/servers/:serverId', async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [s] } = await query('SELECT name FROM servers WHERE id=$1', [req.params.serverId]);
    if (!s) return res.status(404).json({ error: 'Server not found' });
    const io = req.app.get('io');
    if (io) io.to(`server:${req.params.serverId}`).emit('server_deleted', { server_id: req.params.serverId });
    await query('DELETE FROM servers WHERE id=$1', [req.params.serverId]);
    auditLog(req, 'delete_server', 'server', req.params.serverId, { name: s.name });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── DELETE /api/admin/servers/:serverId/members/:userId — kick ───
router.delete('/servers/:serverId/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM server_members WHERE server_id=$1 AND user_id=$2',
      [req.params.serverId, req.params.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Member not found' });
    const io = req.app.get('io');
    if (io) io.to(`user:${req.params.userId}`).emit('kicked_from_server', { server_id: req.params.serverId });
    auditLog(req, 'kick_member', 'user', req.params.userId, { server_id: req.params.serverId });
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
      auditLog(req, req.body.is_admin ? 'grant_admin' : 'revoke_admin', 'user', req.params.userId, {});
      return res.json({ ok: true });
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── GET /api/admin/admins — list all users with admin access ──────────
router.get('/admins', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.status, u.created_at, u.last_active_at,
              u.is_admin,
              COALESCE(json_agg(DISTINCT jsonb_build_object('name', gb.name, 'label', gb.label, 'color', gb.color)) FILTER (WHERE gb.id IS NOT NULL), '[]') AS badges
       FROM users u
       LEFT JOIN user_badges ub ON ub.user_id = u.id
       LEFT JOIN global_badges gb ON gb.id = ub.badge_id
       WHERE u.is_admin = true OR EXISTS (
         SELECT 1 FROM user_badges ub2 JOIN global_badges gb2 ON gb2.id=ub2.badge_id
         WHERE ub2.user_id=u.id AND gb2.name='developer'
       )
       GROUP BY u.id
       ORDER BY u.is_admin DESC, u.created_at ASC`
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

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
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.params.userId}`).emit('force_logout', { reason: reason || 'Zostałeś zbanowany' });
        setTimeout(async () => {
          const sockets = await io.in(`user:${req.params.userId}`).fetchSockets();
          for (const s of sockets) s.disconnect(true);
        }, 800);
      }
      auditLog(req, 'ban_user', 'user', req.params.userId, { ban_type, reason, duration_hours });
      return res.json(ban);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── DELETE /api/admin/users/:userId/ban ───────────────────────────────
router.delete('/users/:userId/ban', async (req: AuthRequest, res: Response) => {
  try {
    await query(`UPDATE user_bans SET is_active=FALSE WHERE user_id=$1 AND is_active=TRUE`, [req.params.userId]);
    auditLog(req, 'unban_user', 'user', req.params.userId, {});
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/audit-log?page=1 ──────────────────────────────────
router.get('/audit-log', async (req: AuthRequest, res: Response) => {
  const page   = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit  = 50;
  const offset = (page - 1) * limit;
  try {
    const [logsRes, totalRes] = await Promise.all([
      query(
        `SELECT al.*, u.username as admin_username, u.avatar_url as admin_avatar
         FROM admin_audit_log al
         JOIN users u ON u.id = al.admin_id
         ORDER BY al.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query('SELECT COUNT(*)::int as n FROM admin_audit_log'),
    ]);
    return res.json({ logs: logsRes.rows, total: totalRes.rows[0].n });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── POST /api/admin/broadcast ─────────────────────────────────────────
router.post('/broadcast',
  [
    body('message').trim().isLength({ min: 1, max: 1000 }),
    body('server_id').optional().isUUID(),
    body('type').optional().isIn(['info', 'warning', 'success']),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { message, server_id, type = 'info' } = req.body;
    const io = req.app.get('io');
    if (!io) return res.status(500).json({ error: 'Socket.IO not available' });
    const payload = {
      message,
      type,
      from: 'Cordyn Admin',
      timestamp: new Date().toISOString(),
    };
    if (server_id) {
      io.to(`server:${server_id}`).emit('admin_broadcast', payload);
    } else {
      io.emit('admin_broadcast', payload);
    }
    auditLog(req, 'broadcast', server_id ? 'server' : null, server_id || null, {
      message: message.substring(0, 100),
      type,
      global: !server_id,
    });
    return res.json({ ok: true });
  }
);

// ── GET /api/admin/system/info ─────────────────────────────────────────
router.get('/system/info', async (_req, res: Response) => {
  try {
    const mem = process.memoryUsage();

    // CPU load (os.loadavg = 1/5/15 min; normalise by core count → %)
    const cpus = os.cpus();
    const loadAvg1 = os.loadavg()[0];
    const cpuLoadPercent = Math.min(99, Math.round((loadAvg1 / Math.max(1, cpus.length)) * 100));

    // OS RAM
    const osTotalMb = Math.round(os.totalmem() / 1024 / 1024);
    const osFreeMb  = Math.round(os.freemem()  / 1024 / 1024);
    const osUsedMb  = osTotalMb - osFreeMb;

    // API request rate since last call
    const now = Date.now();
    const elapsed = (now - _lastInfoCallAt) / 1000 || 1;
    _apiRequestsRate = Math.round((_apiRequestsTotal - _apiRequestsLast) / elapsed * 10) / 10;
    _apiRequestsLast = _apiRequestsTotal;
    _lastInfoCallAt  = now;

    const [dbRes, redisRes, usersRes, voiceRes] = await Promise.allSettled([
      query(`SELECT
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT COUNT(*)::int FROM pg_stat_activity WHERE state='active') as active_connections,
        version() as pg_version
      `),
      (async () => {
        const { redis } = await import('../redis/client');
        const info = await redis.info();
        const lines = info.split('\r\n');
        const get = (k: string) => lines.find(l => l.startsWith(k + ':'))?.split(':').slice(1).join(':').trim() || null;
        // Also get connected socket count from Redis keyspace
        const socketKeys = await redis.keys('socket:*');
        return {
          version:                   get('redis_version'),
          uptime_seconds:            parseInt(get('uptime_in_seconds') || '0'),
          connected_clients:         parseInt(get('connected_clients') || '0'),
          used_memory_human:         get('used_memory_human'),
          used_memory_bytes:         parseInt(get('used_memory') || '0'),
          total_commands_processed:  parseInt(get('total_commands_processed') || '0'),
          keyspace_hits:             parseInt(get('keyspace_hits') || '0'),
          keyspace_misses:           parseInt(get('keyspace_misses') || '0'),
          socket_count:              socketKeys.length,
        };
      })(),
      query(`SELECT
        COUNT(*)::int                                         AS total,
        COUNT(CASE WHEN status NOT IN ('offline') THEN 1 END)::int AS online,
        COUNT(CASE WHEN status = 'offline'        THEN 1 END)::int AS offline,
        COUNT(CASE WHEN status = 'dnd'            THEN 1 END)::int AS dnd,
        COUNT(CASE WHEN status = 'idle'           THEN 1 END)::int AS idle
      FROM users`),
      // Count users currently in any voice channel via Redis
      (async () => {
        const { redis } = await import('../redis/client');
        const keys = await redis.keys('voice:channel:*');
        let total = 0;
        for (const k of keys) {
          const count = await redis.scard(k);
          total += count;
        }
        return { total };
      })(),
    ]);

    const userStats = usersRes.status === 'fulfilled' ? usersRes.value.rows[0] : null;
    const voiceStats = voiceRes.status === 'fulfilled' ? voiceRes.value : { total: 0 };

    return res.json({
      node: {
        version:        process.version,
        uptime_seconds: Math.round(process.uptime()),
        memory: {
          rss:       Math.round(mem.rss       / 1024 / 1024),
          heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          external:  Math.round(mem.external  / 1024 / 1024),
        },
      },
      os: {
        platform:        os.platform(),
        arch:            os.arch(),
        cpu_model:       cpus[0]?.model ?? 'Unknown',
        cpu_cores:       cpus.length,
        cpu_load_percent: cpuLoadPercent,
        total_mem_mb:    osTotalMb,
        free_mem_mb:     osFreeMb,
        used_mem_mb:     osUsedMb,
        mem_percent:     Math.round((osUsedMb / osTotalMb) * 100),
        load_avg:        os.loadavg().map(v => Math.round(v * 100) / 100),
      },
      api: {
        requests_total:  _apiRequestsTotal,
        requests_per_sec: _apiRequestsRate,
      },
      users: userStats
        ? { total: userStats.total, online: userStats.online, offline: userStats.offline, dnd: userStats.dnd, idle: userStats.idle }
        : null,
      voice: { active_users: voiceStats.total },
      postgres: dbRes.status === 'fulfilled' ? dbRes.value.rows[0] : null,
      redis:    redisRes.status === 'fulfilled' ? redisRes.value : null,
    });
  } catch (e) {
    console.error('[system/info]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/storage — overall stats ────────────────────────────
router.get('/storage', async (_req, res: Response) => {
  try {
    const [totals, byMime, topUsers, recent] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int                                         AS total_files,
          COALESCE(SUM(file_size),0)::bigint                   AS total_bytes,
          COALESCE(SUM(CASE WHEN mime_type LIKE 'image/%' THEN file_size ELSE 0 END),0)::bigint AS image_bytes,
          COALESCE(SUM(CASE WHEN mime_type LIKE 'video/%' THEN file_size ELSE 0 END),0)::bigint AS video_bytes,
          COALESCE(SUM(CASE WHEN mime_type LIKE 'audio/%' THEN file_size ELSE 0 END),0)::bigint AS audio_bytes,
          COALESCE(SUM(CASE WHEN mime_type NOT LIKE 'image/%'
                             AND mime_type NOT LIKE 'video/%'
                             AND mime_type NOT LIKE 'audio/%'
                             THEN file_size ELSE 0 END),0)::bigint AS other_bytes,
          COUNT(DISTINCT user_id)::int                         AS unique_uploaders
        FROM attachments
      `),
      query(`
        SELECT
          CASE
            WHEN mime_type LIKE 'image/%' THEN 'Obrazy'
            WHEN mime_type LIKE 'video/%' THEN 'Wideo'
            WHEN mime_type LIKE 'audio/%' THEN 'Audio'
            WHEN mime_type LIKE 'application/pdf' THEN 'PDF'
            WHEN mime_type IN ('application/zip','application/x-zip-compressed','application/x-zip',
                               'application/x-rar-compressed','application/vnd.rar',
                               'application/x-7z-compressed') THEN 'Archiwa'
            ELSE 'Inne'
          END AS category,
          COUNT(*)::int AS count,
          COALESCE(SUM(file_size),0)::bigint AS bytes
        FROM attachments
        GROUP BY 1 ORDER BY bytes DESC
      `),
      query(`
        SELECT u.id, u.username, u.avatar_url, u.is_premium,
               u.storage_used_bytes::bigint,
               u.storage_quota_bytes::bigint,
               COUNT(a.id)::int AS file_count
        FROM users u
        LEFT JOIN attachments a ON a.user_id = u.id
        WHERE u.storage_used_bytes > 0
        GROUP BY u.id, u.username, u.avatar_url, u.is_premium, u.storage_used_bytes, u.storage_quota_bytes
        ORDER BY u.storage_used_bytes DESC
        LIMIT 20
      `),
      query(`
        SELECT a.id, a.r2_key, a.url, a.file_size, a.mime_type, a.original_name, a.created_at,
               u.username, u.avatar_url
        FROM attachments a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT 30
      `),
    ]);
    return res.json({
      r2_enabled: r2Enabled,
      totals:     totals.rows[0],
      by_mime:    byMime.rows,
      top_users:  topUsers.rows,
      recent:     recent.rows,
    });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/storage/users — paginated user storage ────────────
router.get('/storage/users', async (req, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  || 1)));
    const limit = Math.min(50, parseInt(String(req.query.limit || 50)));
    const q     = (req.query.q as string || '').trim();
    const off   = (page - 1) * limit;

    const where = q ? `WHERE u.username ILIKE $3` : '';
    const params: any[] = q ? [limit, off, `%${q}%`] : [limit, off];

    const { rows } = await query(`
      SELECT u.id, u.username, u.avatar_url, u.is_premium,
             u.storage_used_bytes::bigint,
             u.storage_quota_bytes::bigint,
             COUNT(a.id)::int AS file_count,
             COALESCE(SUM(a.file_size),0)::bigint AS real_bytes
      FROM users u
      LEFT JOIN attachments a ON a.user_id = u.id
      ${where}
      GROUP BY u.id, u.username, u.avatar_url, u.is_premium, u.storage_used_bytes, u.storage_quota_bytes
      ORDER BY u.storage_used_bytes DESC
      LIMIT $1 OFFSET $2
    `, params);

    const { rows: [cnt] } = await query(`SELECT COUNT(*)::int AS n FROM users ${q ? 'WHERE username ILIKE $1' : ''}`, q ? [`%${q}%`] : []);
    return res.json({ users: rows, total: cnt.n });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── DELETE /api/admin/storage/attachment/:id ──────────────────────────
router.delete('/storage/attachment/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [att] } = await query('SELECT * FROM attachments WHERE id=$1', [req.params.id]);
    if (!att) return res.status(404).json({ error: 'Nie znaleziono' });
    if (att.r2_key) await deleteFromR2(att.r2_key);
    await query(
      'UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE id=$2',
      [att.file_size, att.user_id]
    );
    await query('DELETE FROM attachments WHERE id=$1', [req.params.id]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── POST /api/admin/storage/users/:userId/quota ─── set user quota ───
router.post('/storage/users/:userId/quota', async (req: AuthRequest, res: Response) => {
  try {
    const { quota_mb, is_premium } = req.body;
    const updates: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (quota_mb   !== undefined) { updates.push(`storage_quota_bytes=$${idx++}`); vals.push(Math.round(Number(quota_mb) * 1024 * 1024)); }
    if (is_premium !== undefined) { updates.push(`is_premium=$${idx++}`);          vals.push(Boolean(is_premium)); }
    if (!updates.length) return res.status(400).json({ error: 'Brak danych' });
    vals.push(req.params.userId);
    await query(`UPDATE users SET ${updates.join(',')} WHERE id=$${idx}`, vals);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── POST /api/admin/storage/recalc ─── recalculate all user quotas ────
router.post('/storage/recalc', async (_req, res: Response) => {
  try {
    await query(`
      UPDATE users u SET storage_used_bytes = COALESCE((
        SELECT SUM(a.file_size) FROM attachments a
        WHERE a.user_id = u.id
      ), 0)
    `);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/r2/debug — lista obiektów w R2 (max 30) ───────────
router.get('/r2/debug', async (_req, res: Response) => {
  try {
    const { r2Client, r2Enabled } = await import('../services/r2');
    const { config } = await import('../config');
    if (!r2Client || !r2Enabled) return res.json({ error: 'R2 not configured', r2Enabled: false });
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const result = await r2Client.send(new ListObjectsV2Command({
      Bucket: config.r2.bucket,
      MaxKeys: 30,
    }));
    return res.json({
      bucket:    config.r2.bucket,
      endpoint:  config.r2.endpoint,
      key_count: result.KeyCount,
      keys: (result.Contents || []).map(o => ({ key: o.Key, size: o.Size })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, name: err.name, http_status: err.$metadata?.httpStatusCode });
  }
});

// ── POST /api/admin/perf/token — exchange admin JWT for a one-time SSE token ──
// EventSource cannot send Authorization headers, so we issue a short-lived UUID
// stored in Redis (60 s TTL, single-use). The SSE endpoint validates it.
import crypto from 'crypto';
router.post('/perf/token', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { redis } = await import('../redis/client');
    const token = crypto.randomUUID();
    await redis.setex(`perf:token:${token}`, 60, req.user!.id);
    return res.json({ token });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── GET /api/admin/perf/stream — built-in SSE load tester ──────────────────
router.get('/perf/stream', async (req: AuthRequest, res: Response) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  // Validate one-time token from Redis
  try {
    const { redis } = await import('../redis/client');
    const userId = await redis.get(`perf:token:${token}`);
    if (!userId) return res.status(401).json({ error: 'Token invalid or expired' });
    await redis.del(`perf:token:${token}`); // single-use
  } catch (err: any) {
    console.error('[perf/stream] token check error:', err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  const vus      = Math.min(500, Math.max(1,  parseInt(String(req.query.vus      || '50'))));
  const duration = Math.min(300, Math.max(5,  parseInt(String(req.query.duration || '30'))));
  const port     = parseInt(process.env.PORT || '4000');

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: any) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  // Auto-detect first available text channel
  let channelId = String(req.query.channel_id || '');
  let serverId  = String(req.query.server_id  || '');
  try {
    if (!channelId || !serverId) {
      const { rows } = await query(
        `SELECT c.id as cid, c.server_id as sid FROM channels c WHERE c.type='text' ORDER BY c.created_at LIMIT 1`
      );
      if (rows[0]) { channelId = channelId || rows[0].cid; serverId = serverId || rows[0].sid; }
    }
  } catch {}

  send('log', { msg: `🚀 Start: ${vus} VU × ${duration}s | kanał: ${channelId?'✓':'–'} | serwer: ${serverId?'✓':'–'}`, level: 'info' });
  send('log', { msg: `Endpointy: GET /messages, /servers/:id, /notifications/unread-count, /users/me`, level: 'info' });
  send('log', { msg: `─────────────────────────────────────────────────────────────────`, level: 'info' });

  const winLat: number[] = [];
  let totalReqs = 0;
  let errorCount = 0;
  let running = true;

  // Single HTTP request helper (uses require to avoid TS import issues)
  const doReq = (method: string, path: string): Promise<{latency: number; ok: boolean}> =>
    new Promise((resolve) => {
      const start = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const http = require('http');
      const r = http.request(
        { hostname: '127.0.0.1', port, path, method, timeout: 5000,
          headers: { Authorization: `Bearer ${jwtToken}` } },
        (resp: any) => { resp.resume(); resolve({ latency: Date.now() - start, ok: resp.statusCode < 400 }); }
      );
      r.on('error',   () => resolve({ latency: Date.now() - start, ok: false }));
      r.on('timeout', () => { r.destroy(); resolve({ latency: 5000, ok: false }); });
      r.end();
    });

  // Virtual user loop
  const vuLoop = async () => {
    while (running) {
      const r = Math.random();
      let result: {latency: number; ok: boolean};
      if      (r < 0.35 && channelId) result = await doReq('GET', `/api/messages/channel/${channelId}`);
      else if (r < 0.55 && serverId)  result = await doReq('GET', `/api/servers/${serverId}`);
      else if (r < 0.75)               result = await doReq('GET', `/api/notifications/unread-count`);
      else                             result = await doReq('GET', `/api/users/me`);
      totalReqs++;
      winLat.push(result.latency);
      if (!result.ok) errorCount++;
      await new Promise(r2 => setTimeout(r2, 100 + Math.random() * 400));
    }
  };

  // Stagger VU starts by 10 ms each
  for (let i = 0; i < vus; i++) setTimeout(vuLoop, i * 10);

  let elapsed = 0;
  const tick = setInterval(() => {
    elapsed++;
    const window = winLat.splice(0).sort((a, b) => a - b);
    const len    = window.length;
    const p50    = window[Math.floor(len * 0.50)] ?? 0;
    const p95    = window[Math.floor(len * 0.95)] ?? 0;
    const p99    = window[Math.floor(len * 0.99)] ?? 0;
    const errRate = totalReqs > 0 ? Math.round(errorCount / totalReqs * 1000) / 10 : 0;
    const level   = errRate > 5 ? 'error' : errRate > 1 ? 'warn' : 'ok';

    send('tick', { elapsed, duration, rps: len, p50, p95, p99, error_rate: errRate, total_reqs: totalReqs, errors: errorCount });
    send('log',  { msg: `[${String(elapsed).padStart(3)}s] ${String(len).padStart(4)} req/s  p50:${String(p50).padStart(5)}ms  p95:${String(p95).padStart(5)}ms  p99:${String(p99).padStart(5)}ms  err:${errRate}%`, level });

    if (elapsed >= duration) {
      running = false;
      clearInterval(tick);
      send('log',  { msg: `─────────────────────────────────────────────────────────────────`, level: 'info' });
      send('log',  { msg: `✅ Gotowe — łącznie: ${totalReqs} req, błędy: ${errorCount} (${errRate}%)`, level: 'info' });
      send('done', { total_reqs: totalReqs, errors: errorCount, error_rate: errRate });
      res.end();
    }
  }, 1000);

  req.on('close', () => { running = false; clearInterval(tick); });
});

export default router;
