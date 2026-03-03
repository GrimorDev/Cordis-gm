import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, getClient } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import crypto from 'crypto';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function isAdminOrOwner(serverId: string, userId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT role_name FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  return rows[0] && ['Owner', 'Admin'].includes(rows[0].role_name);
}

async function isMember(serverId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  return !!rowCount;
}

// ── Server CRUD ───────────────────────────────────────────────────────────────

// GET /api/servers
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.icon_url, s.banner_url, s.description, s.owner_id, s.created_at
       FROM servers s INNER JOIN server_members sm ON sm.server_id = s.id
       WHERE sm.user_id = $1 ORDER BY s.created_at`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers
router.post('/', authMiddleware,
  [body('name').trim().isLength({ min: 1, max: 100 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name } = req.body;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows: [server] } = await client.query(
        `INSERT INTO servers (name, owner_id) VALUES ($1, $2) RETURNING *`, [name, req.user!.id]
      );
      await client.query(
        `INSERT INTO server_members (server_id, user_id, role_name) VALUES ($1, $2, 'Owner')`,
        [server.id, req.user!.id]
      );
      // Create default roles: Owner + Member
      const { rows: [ownerRole] } = await client.query(
        `INSERT INTO server_roles (server_id, name, color, permissions, is_default, position)
         VALUES ($1, 'Owner', '#f59e0b', ARRAY['administrator']::TEXT[], TRUE, 100) RETURNING id`,
        [server.id]
      );
      await client.query(
        `INSERT INTO server_roles (server_id, name, color, permissions, is_default, position)
         VALUES ($1, 'Member', '#5865f2', ARRAY[]::TEXT[], TRUE, 0) RETURNING id`,
        [server.id]
      );
      // Assign creator to Owner role via member_roles
      await client.query(
        `INSERT INTO member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [server.id, req.user!.id, ownerRole.id]
      );
      const { rows: [gc] } = await client.query(
        `INSERT INTO channel_categories (server_id, name, position) VALUES ($1, 'General', 0) RETURNING id`,
        [server.id]
      );
      const { rows: [vc] } = await client.query(
        `INSERT INTO channel_categories (server_id, name, position) VALUES ($1, 'Voice Rooms', 1) RETURNING id`,
        [server.id]
      );
      await client.query(
        `INSERT INTO channels (server_id, category_id, name, type, position) VALUES ($1, $2, 'general', 'text', 0)`,
        [server.id, gc.id]
      );
      await client.query(
        `INSERT INTO channels (server_id, category_id, name, type, position) VALUES ($1, $2, 'General', 'voice', 0)`,
        [server.id, vc.id]
      );
      await client.query('COMMIT');
      return res.status(201).json(server);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally { client.release(); }
  }
);

// GET /api/servers/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [server] } = await query(
      `SELECT s.*, sm.role_name as my_role
       FROM servers s INNER JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $2
       WHERE s.id = $1`,
      [req.params.id, req.user!.id]
    );
    if (!server) return res.status(404).json({ error: 'Server not found or no access' });

    const { rows: categories } = await query(
      `SELECT id, name, position FROM channel_categories WHERE server_id = $1 ORDER BY position`,
      [req.params.id]
    );
    const { rows: channels } = await query(
      `SELECT id, category_id, name, type, description, is_private, position FROM channels
       WHERE server_id = $1 ORDER BY position`,
      [req.params.id]
    );
    // Attach allowed role IDs per private channel
    const { rows: cra } = await query(
      `SELECT cra.channel_id, cra.role_id, sr.name as role_name, sr.color
       FROM channel_role_access cra
       INNER JOIN server_roles sr ON sr.id = cra.role_id
       WHERE sr.server_id = $1`,
      [req.params.id]
    );

    server.categories = categories.map((cat: any) => ({
      ...cat,
      channels: channels
        .filter((ch: any) => ch.category_id === cat.id)
        .map((ch: any) => ({
          ...ch,
          allowed_roles: cra.filter((r: any) => r.channel_id === ch.id),
        })),
    }));

    return res.json(server);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/servers/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdminOrOwner(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { name, description, icon_url, banner_url } = req.body;
    const { rows: [server] } = await query(
      `UPDATE servers SET
         name        = COALESCE($1, name),
         description = COALESCE($2, description),
         icon_url    = COALESCE($3, icon_url),
         banner_url  = COALESCE($4, banner_url)
       WHERE id = $5 RETURNING *`,
      [name || null, description !== undefined ? description : null,
       icon_url || null, banner_url || null, req.params.id]
    );
    const io = req.app.get('io');
    if (io) io.to(`server:${req.params.id}`).emit('server_updated', server);
    return res.json(server);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/servers/:id/activity
router.get('/:id/activity', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!await isMember(req.params.id, req.user!.id)) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await query(
      `SELECT id, type, icon, text, created_at as time FROM server_activity WHERE server_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );
    return res.json(rows.reverse());
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/:id/leave
router.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [server] } = await query(`SELECT owner_id, name FROM servers WHERE id = $1`, [req.params.id]);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (server.owner_id === req.user!.id) return res.status(400).json({ error: 'Owner cannot leave – delete the server instead' });
    const { rows: [u] } = await query('SELECT username FROM users WHERE id=$1', [req.user!.id]);
    await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    const { rows: [act] } = await query(
      `INSERT INTO server_activity (server_id, type, username, icon, text) VALUES ($1,'member_leave',$2,'🚪',$3) RETURNING id, type, icon, text, created_at as time`,
      [req.params.id, u?.username, `${u?.username} opuścił/a serwer`]
    );
    const io = req.app.get('io');
    if (io) {
      if (act) io.to(`server:${req.params.id}`).emit('server_activity', { ...act, server_id: req.params.id });
      // Notify all members that this user left
      io.to(`server:${req.params.id}`).emit('member_left', { server_id: req.params.id, user_id: req.user!.id });
      // Remove leaving user's socket from server room
      const sockets = await io.in(`user:${req.user!.id}`).fetchSockets();
      for (const s of sockets) { s.leave(`server:${req.params.id}`); }
    }
    return res.json({ message: 'Left server' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/servers/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [server] } = await query(`SELECT owner_id FROM servers WHERE id = $1`, [req.params.id]);
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (server.owner_id !== req.user!.id) return res.status(403).json({ error: 'Only owner can delete' });
    await query('DELETE FROM servers WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Server deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Members ───────────────────────────────────────────────────────────────────

// GET /api/servers/:id/members
router.get('/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isMember(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'No access' });
    }
    const { rows } = await query(
      `SELECT u.id, u.username, u.avatar_url, u.status, u.custom_status,
              sm.role_name, sm.joined_at
       FROM server_members sm INNER JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = $1 ORDER BY sm.role_name, u.username`,
      [req.params.id]
    );
    // Attach custom roles for each member
    const { rows: mr } = await query(
      `SELECT mr.user_id, sr.id as role_id, sr.name, sr.color
       FROM member_roles mr INNER JOIN server_roles sr ON sr.id = mr.role_id
       WHERE mr.server_id = $1`,
      [req.params.id]
    );
    const result = rows.map((m: any) => ({
      ...m,
      roles: mr.filter((r: any) => r.user_id === m.id),
    }));
    return res.json(result);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/servers/:id/members/:userId/roles
router.put('/:id/members/:userId/roles', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdminOrOwner(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { role_ids, role_name } = req.body;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      if (role_name !== undefined) {
        await client.query(
          `UPDATE server_members SET role_name = $1 WHERE server_id = $2 AND user_id = $3`,
          [role_name, req.params.id, req.params.userId]
        );
        // Sync member_roles: find the named role in server_roles and update the member's primary role
        if (!Array.isArray(role_ids)) {
          const { rows: [sr] } = await client.query(
            `SELECT id FROM server_roles WHERE server_id = $1 AND name = $2 LIMIT 1`,
            [req.params.id, role_name]
          );
          if (sr) {
            await client.query(
              `DELETE FROM member_roles WHERE server_id = $1 AND user_id = $2`,
              [req.params.id, req.params.userId]
            );
            await client.query(
              `INSERT INTO member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [req.params.id, req.params.userId, sr.id]
            );
          }
        }
      }
      if (Array.isArray(role_ids)) {
        await client.query(
          `DELETE FROM member_roles WHERE server_id = $1 AND user_id = $2`,
          [req.params.id, req.params.userId]
        );
        for (const roleId of role_ids) {
          await client.query(
            `INSERT INTO member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [req.params.id, req.params.userId, roleId]
          );
        }
      }
      await client.query('COMMIT');
      return res.json({ message: 'Roles updated' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/servers/:id/members/:userId (kick)
router.delete('/:id/members/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdminOrOwner(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await query(
      `DELETE FROM server_members WHERE server_id = $1 AND user_id = $2`,
      [req.params.id, req.params.userId]
    );
    const io = req.app.get('io');
    if (io) {
      io.to(`server:${req.params.id}`).emit('member_left', { server_id: req.params.id, user_id: req.params.userId });
      const sockets = await io.in(`user:${req.params.userId}`).fetchSockets();
      for (const s of sockets) { s.leave(`server:${req.params.id}`); }
    }
    return res.json({ message: 'Member kicked' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Roles ─────────────────────────────────────────────────────────────────────

// GET /api/servers/:id/roles
router.get('/:id/roles', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isMember(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'No access' });
    }
    const { rows } = await query(
      `SELECT * FROM server_roles WHERE server_id = $1 ORDER BY position, created_at`,
      [req.params.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/:id/roles
router.post('/:id/roles', authMiddleware,
  [body('name').trim().isLength({ min: 1, max: 50 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      if (!(await isAdminOrOwner(req.params.id, req.user!.id))) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const { name, color = '#5865f2', permissions = [] } = req.body;
      const { rows: [role] } = await query(
        `INSERT INTO server_roles (server_id, name, color, permissions)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.params.id, name, color, permissions]
      );
      return res.status(201).json(role);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// PUT /api/servers/:id/roles/:roleId
router.put('/:id/roles/:roleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdminOrOwner(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { name, color, permissions } = req.body;
    const { rows: [role] } = await query(
      `UPDATE server_roles SET
         name        = COALESCE($1, name),
         color       = COALESCE($2, color),
         permissions = COALESCE($3, permissions)
       WHERE id = $4 AND server_id = $5 RETURNING *`,
      [name || null, color || null, permissions || null, req.params.roleId, req.params.id]
    );
    if (!role) return res.status(404).json({ error: 'Role not found' });
    return res.json(role);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/servers/:id/roles/:roleId
router.delete('/:id/roles/:roleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdminOrOwner(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { rows: [existing] } = await query(
      `SELECT is_default FROM server_roles WHERE id = $1 AND server_id = $2`,
      [req.params.roleId, req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    if (existing.is_default) return res.status(400).json({ error: 'Nie można usunąć domyślnej roli' });
    await query(
      `DELETE FROM server_roles WHERE id = $1 AND server_id = $2`,
      [req.params.roleId, req.params.id]
    );
    return res.json({ message: 'Role deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Invites ───────────────────────────────────────────────────────────────────

// POST /api/servers/invite/create
router.post('/invite/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { server_id, expires_in } = req.body;
  try {
    if (!(await isMember(server_id, req.user!.id))) {
      return res.status(403).json({ error: 'No access' });
    }
    const code = crypto.randomBytes(5).toString('hex');
    let expiresAt: Date | null = null;
    if (expires_in && expires_in !== 'never') {
      expiresAt = new Date(Date.now() + parseInt(expires_in) * 1000);
    }
    await query(
      `INSERT INTO server_invites (code, server_id, creator_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [code, server_id, req.user!.id, expiresAt]
    );
    return res.json({ code, expires_at: expiresAt });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/join/:code
router.post('/join/:code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [invite] } = await query(
      `SELECT * FROM server_invites WHERE code = $1`, [req.params.code]
    );
    if (!invite) return res.status(404).json({ error: 'Invalid invite' });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite expired' });
    }
    const existing = await query(
      `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
      [invite.server_id, req.user!.id]
    );
    if (existing.rowCount) return res.status(409).json({ error: 'Already a member' });
    await query(
      `INSERT INTO server_members (server_id, user_id, role_name) VALUES ($1, $2, 'Member')`,
      [invite.server_id, req.user!.id]
    );
    // Assign to default Member role in member_roles if it exists
    const { rows: [memberRole] } = await query(
      `SELECT id FROM server_roles WHERE server_id = $1 AND is_default = TRUE AND name = 'Member' LIMIT 1`,
      [invite.server_id]
    );
    if (memberRole) {
      await query(
        `INSERT INTO member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [invite.server_id, req.user!.id, memberRole.id]
      );
    }
    const [{ rows: [server] }, { rows: [u] }] = await Promise.all([
      query(`SELECT * FROM servers WHERE id = $1`, [invite.server_id]),
      query(`SELECT id, username, avatar_url, status FROM users WHERE id=$1`, [req.user!.id]),
    ]);
    const { rows: [act] } = await query(
      `INSERT INTO server_activity (server_id, type, username, icon, text) VALUES ($1,'member_join',$2,'👋',$3) RETURNING id, type, icon, text, created_at as time`,
      [invite.server_id, u?.username, `${u?.username} dołączył/a do serwera`]
    );
    const io = req.app.get('io');
    if (io) {
      // Add the new member's socket to the server room immediately (no reconnect needed)
      const sockets = await io.in(`user:${req.user!.id}`).fetchSockets();
      for (const s of sockets) { s.join(`server:${invite.server_id}`); }
      if (act) io.to(`server:${invite.server_id}`).emit('server_activity', { ...act, server_id: invite.server_id });
      // Notify all members of the new member
      io.to(`server:${invite.server_id}`).emit('member_joined', {
        server_id: invite.server_id,
        user: { ...u, role_name: 'Member', roles: [] },
      });
    }
    return res.json(server);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
