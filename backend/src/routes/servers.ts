import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, getClient } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { joinLimiter, inviteCreateLimiter } from '../middleware/userRateLimits';
import { AuthRequest } from '../types';
import crypto from 'crypto';
import { runAutomations } from '../services/automations';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function isMember(serverId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  return !!rowCount;
}

/**
 * Restrictive: Owner/Admin always pass; custom roles must explicitly grant the permission.
 * Used for admin actions (manage_roles, kick_members, ban_members, manage_server, etc.)
 */
async function isAuthorized(serverId: string, userId: string, permission: string): Promise<boolean> {
  const { rows: [member] } = await query(
    `SELECT role_name FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  if (!member) return false;
  if (['Owner', 'Admin'].includes(member.role_name)) return true;
  const { rowCount } = await query(
    `SELECT 1 FROM member_roles mr
     INNER JOIN server_roles sr ON sr.id = mr.role_id
     WHERE mr.server_id = $1 AND mr.user_id = $2
       AND ($3 = ANY(sr.permissions) OR 'administrator' = ANY(sr.permissions))
     LIMIT 1`,
    [serverId, userId, permission]
  );
  return !!rowCount;
}

/**
 * Permissive: Owner/Admin always pass; members with NO custom roles pass (default allow);
 * members WITH custom roles need an explicit grant.
 * Used for member actions (create_invites, etc.)
 */
async function hasMemberPermission(serverId: string, userId: string, permission: string): Promise<boolean> {
  const { rows: [member] } = await query(
    `SELECT role_name FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  if (!member) return false;
  if (['Owner', 'Admin'].includes(member.role_name)) return true;
  const { rows } = await query(
    `SELECT sr.permissions FROM member_roles mr
     INNER JOIN server_roles sr ON sr.id = mr.role_id
     WHERE mr.server_id = $1 AND mr.user_id = $2`,
    [serverId, userId]
  );
  if (rows.length === 0) return true; // No custom roles → allow by default
  return rows.some((r: any) =>
    Array.isArray(r.permissions) &&
    (r.permissions.includes('administrator') || r.permissions.includes(permission))
  );
}

/**
 * Returns the effective role position for hierarchy checks.
 * Owner = Infinity, Admin = 9999, otherwise max position from custom roles.
 */
async function getRolePosition(serverId: string, userId: string): Promise<number> {
  const { rows: [srv] } = await query(`SELECT owner_id FROM servers WHERE id=$1`, [serverId]);
  if (srv?.owner_id === userId) return Infinity;
  const { rows: [member] } = await query(
    `SELECT role_name FROM server_members WHERE server_id=$1 AND user_id=$2`,
    [serverId, userId]
  );
  if (member?.role_name === 'Admin') return 9999;
  const { rows: [pos] } = await query(
    `SELECT COALESCE(MAX(sr.position),0) as maxpos
     FROM member_roles mr INNER JOIN server_roles sr ON sr.id = mr.role_id
     WHERE mr.server_id=$1 AND mr.user_id=$2`,
    [serverId, userId]
  );
  return pos?.maxpos ?? 0;
}

// ── Server CRUD ───────────────────────────────────────────────────────────────

// GET /api/servers
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.icon_url, s.banner_url, s.description, s.owner_id, s.is_official, s.created_at
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
      `SELECT s.*,
              sm.role_name as my_role,
              (SELECT COUNT(*)::int FROM server_members WHERE server_id = s.id) as member_count
       FROM servers s INNER JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $2
       WHERE s.id = $1`,
      [req.params.id, req.user!.id]
    );
    if (!server) return res.status(404).json({ error: 'Server not found or no access' });

    const { rows: categories } = await query(
      `SELECT id, name, position, COALESCE(is_private, false) as is_private FROM channel_categories WHERE server_id = $1 ORDER BY position`,
      [req.params.id]
    );
    const { rows: channels } = await query(
      `SELECT id, category_id, name, type, description, is_private, position,
              slowmode_seconds, background_url, background_gradient,
              user_limit, bitrate FROM channels
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
    // Attach allowed role IDs per private category
    const { rows: catCra } = await query(
      `SELECT cra.category_id, cra.role_id, sr.name as role_name, sr.color
       FROM category_role_access cra
       INNER JOIN server_roles sr ON sr.id = cra.role_id
       WHERE sr.server_id = $1`,
      [req.params.id]
    ).catch(() => ({ rows: [] as any[] }));

    // User's custom role IDs (for private channel/category visibility check)
    const isAdminOrOwnerUser = ['Owner', 'Admin'].includes(server.my_role);
    const { rows: userRoles } = await query(
      `SELECT role_id FROM member_roles WHERE server_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    const userRoleIds = new Set(userRoles.map((r: any) => r.role_id));

    // Compute combined permissions from all custom roles
    if (isAdminOrOwnerUser) {
      server.my_permissions = ['administrator'];
    } else {
      const { rows: permRows } = await query(
        `SELECT DISTINCT unnest(sr.permissions) as perm
         FROM member_roles mr
         INNER JOIN server_roles sr ON sr.id = mr.role_id
         WHERE mr.server_id = $1 AND mr.user_id = $2`,
        [req.params.id, req.user!.id]
      );
      server.my_permissions = permRows.map((r: any) => r.perm);
    }

    const visibleChannels = channels.filter((ch: any) => {
      if (!ch.is_private) return true;
      if (isAdminOrOwnerUser) return true;
      const allowedRoleIds = cra.filter((r: any) => r.channel_id === ch.id).map((r: any) => r.role_id);
      return allowedRoleIds.some((rid: string) => userRoleIds.has(rid));
    });

    // Filter visible categories (private categories need matching role)
    const visibleCategories = categories.filter((cat: any) => {
      if (!cat.is_private) return true;
      if (isAdminOrOwnerUser) return true;
      const allowedRoleIds = catCra.filter((r: any) => r.category_id === cat.id).map((r: any) => r.role_id);
      return allowedRoleIds.some((rid: string) => userRoleIds.has(rid));
    });

    // Build categorized channels
    const categorized = visibleCategories.map((cat: any) => ({
      ...cat,
      allowed_roles: catCra.filter((r: any) => r.category_id === cat.id),
      channels: visibleChannels
        .filter((ch: any) => ch.category_id === cat.id)
        .map((ch: any) => ({
          ...ch,
          allowed_roles: cra.filter((r: any) => r.channel_id === ch.id),
        })),
    }));

    // Include uncategorized channels (category_id = NULL) as __uncat__ pseudo-category
    const uncatChannels = visibleChannels
      .filter((ch: any) => !ch.category_id)
      .map((ch: any) => ({
        ...ch,
        allowed_roles: cra.filter((r: any) => r.channel_id === ch.id),
      }));

    server.categories = uncatChannels.length > 0
      ? [{ id: '__uncat__', name: '', position: -1, channels: uncatChannels }, ...categorized]
      : categorized;

    return res.json(server);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/servers/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_server'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { name, description, icon_url, banner_url, accent_color, banner_color } = req.body;
    const { rows: [server] } = await query(
      `UPDATE servers SET
         name         = COALESCE($1, name),
         description  = COALESCE($2, description),
         icon_url     = COALESCE($3, icon_url),
         banner_url   = COALESCE($4, banner_url),
         accent_color = COALESCE($5, accent_color),
         banner_color = COALESCE($6, banner_color)
       WHERE id = $7 RETURNING *`,
      [name || null, description !== undefined ? description : null,
       icon_url || null, banner_url || null,
       accent_color || null, banner_color || null,
       req.params.id]
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
      [req.params.id, u?.username, `**${u?.username}** opuścił/a serwer`]
    );
    const io = req.app.get('io');
    if (io) {
      if (act) io.to(`server:${req.params.id}`).emit('server_activity', { ...act, server_id: req.params.id });
      // Notify all members that this user left
      io.to(`server:${req.params.id}`).emit('member_left', { server_id: req.params.id, user_id: req.user!.id });
      // Remove leaving user's socket from server room
      const sockets = await io.in(`user:${req.user!.id}`).fetchSockets();
      for (const s of sockets) { s.leave(`server:${req.params.id}`); }
      // Run member_leave automations
      runAutomations(req.params.id, 'member_leave', { userId: req.user!.id, io }).catch(console.error);
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
      `SELECT u.id, u.username, u.avatar_url, u.status, u.custom_status, u.avatar_effect, u.banner_preset,
              u.is_bot, u.active_tag_server_id, st.tag as active_tag, st.color as active_tag_color, st.icon as active_tag_icon,
              sm.role_name, sm.joined_at,
              COALESCE(
                (SELECT json_agg(json_build_object('id', gb.id, 'name', gb.name, 'label', gb.label, 'color', gb.color, 'icon', gb.icon) ORDER BY gb.position)
                 FROM user_badges ub INNER JOIN global_badges gb ON gb.id = ub.badge_id WHERE ub.user_id = u.id),
                '[]'::json
              ) as badges
       FROM server_members sm
       INNER JOIN users u ON u.id = sm.user_id
       LEFT JOIN server_tags st ON st.server_id = u.active_tag_server_id
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
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_roles'))) {
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
      // Notify the affected user their permissions may have changed
      const io = req.app.get('io');
      if (io) io.to(`user:${req.params.userId}`).emit('permissions_updated', { server_id: req.params.id });
      // Broadcast updated member info to everyone in the server (realtime role display)
      if (io) {
        const { rows: [updatedMember] } = await query(
          `SELECT u.id, u.username, u.avatar_url, u.status, sm.role_name,
                  (SELECT json_agg(json_build_object('id', sr.id, 'name', sr.name, 'color', sr.color))
                   FROM member_roles mr2 INNER JOIN server_roles sr ON sr.id = mr2.role_id
                   WHERE mr2.server_id = sm.server_id AND mr2.user_id = u.id) AS roles
           FROM users u INNER JOIN server_members sm ON sm.user_id = u.id
           WHERE sm.server_id=$1 AND u.id=$2`,
          [req.params.id, req.params.userId]
        );
        if (updatedMember) {
          io.to(`server:${req.params.id}`).emit('member_role_changed', {
            server_id: req.params.id,
            user_id:   req.params.userId,
            role_name: updatedMember.role_name,
            roles:     updatedMember.roles || [],
          });
        }
      }
      // Run role_assigned / role_removed automations
      const assignedRoles = Array.isArray(role_ids) ? role_ids : [];
      for (const roleId of assignedRoles) {
        runAutomations(req.params.id, 'role_assigned', { userId: req.params.userId, roleId, io }).catch(console.error);
      }
      // role_removed: detect removed roles (previous vs current)
      if (role_ids !== undefined) {
        const { rows: currentRoles } = await query(
          'SELECT role_id FROM member_roles WHERE server_id=$1 AND user_id=$2',
          [req.params.id, req.params.userId]
        );
        const currentIds = new Set(currentRoles.map((r: any) => r.role_id));
        const prevIds = new Set(assignedRoles);
        for (const roleId of prevIds) {
          if (!currentIds.has(roleId)) {
            runAutomations(req.params.id, 'role_removed', { userId: req.params.userId, roleId, io }).catch(console.error);
          }
        }
      }
      // Log role change to server activity
      try {
        const [{ rows: [admin] }, { rows: [target] }] = await Promise.all([
          query(`SELECT username FROM users WHERE id=$1`, [req.user!.id]),
          query(`SELECT username FROM users WHERE id=$1`, [req.params.userId]),
        ]);
        const roleName = role_name ?? (Array.isArray(role_ids) ? 'nowe role' : null);
        if (roleName && admin && target) {
          const text = `**${admin.username}** zmienił/a rolę **${target.username}** na **${roleName}**`;
          const { rows: [act] } = await query(
            `INSERT INTO server_activity (server_id, type, username, icon, text) VALUES ($1,'role_change',$2,'🔑',$3) RETURNING id, type, icon, text, created_at as time`,
            [req.params.id, admin.username, text]
          );
          if (act && io) io.to(`server:${req.params.id}`).emit('server_activity', { ...act, server_id: req.params.id });
        }
      } catch {}
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
    if (!(await isAuthorized(req.params.id, req.user!.id, 'kick_members'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    // Role hierarchy: can't kick equal/higher role
    const myPos = await getRolePosition(req.params.id, req.user!.id);
    const targetPos = await getRolePosition(req.params.id, req.params.userId);
    if (myPos !== Infinity && targetPos >= myPos) {
      return res.status(403).json({ error: 'Nie możesz wyrzucić osoby z wyższą lub równą rolą' });
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

// ── Bans ─────────────────────────────────────────────────────────────────────

// GET /api/servers/:id/bans
router.get('/:id/bans', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'ban_members'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { rows } = await query(
      `SELECT sb.user_id, sb.reason, sb.created_at,
              u.username, u.avatar_url,
              bu.username as banned_by_username
       FROM server_bans sb
       INNER JOIN users u  ON u.id  = sb.user_id
       LEFT  JOIN users bu ON bu.id = sb.banned_by
       WHERE sb.server_id = $1 ORDER BY sb.created_at DESC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/:id/bans/:userId
router.post('/:id/bans/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'ban_members'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    // Role hierarchy: can't ban equal/higher role
    const myPos = await getRolePosition(req.params.id, req.user!.id);
    const targetPos = await getRolePosition(req.params.id, req.params.userId);
    if (myPos !== Infinity && targetPos >= myPos) {
      return res.status(403).json({ error: 'Nie możesz zbanować osoby z wyższą lub równą rolą' });
    }
    const { reason } = req.body;
    // Remove from server first (if member)
    await query(`DELETE FROM server_members WHERE server_id=$1 AND user_id=$2`, [req.params.id, req.params.userId]);
    // Also remove from member_roles
    await query(`DELETE FROM member_roles WHERE server_id=$1 AND user_id=$2`, [req.params.id, req.params.userId]);
    // Add ban
    await query(
      `INSERT INTO server_bans (server_id, user_id, banned_by, reason) VALUES ($1,$2,$3,$4)
       ON CONFLICT (server_id, user_id) DO UPDATE SET reason=EXCLUDED.reason, banned_by=EXCLUDED.banned_by, created_at=NOW()`,
      [req.params.id, req.params.userId, req.user!.id, reason || null]
    );
    const io = req.app.get('io');
    if (io) {
      io.to(`server:${req.params.id}`).emit('member_left', { server_id: req.params.id, user_id: req.params.userId });
      const sockets = await io.in(`user:${req.params.userId}`).fetchSockets();
      for (const s of sockets) {
        s.leave(`server:${req.params.id}`);
        s.emit('banned_from_server', { server_id: req.params.id });
      }
    }
    // ── member_banned automation trigger ─────────────────────────────────
    runAutomations(req.params.id, 'member_banned', { userId: req.params.userId, io }).catch(console.error);
    return res.json({ message: 'User banned' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/servers/:id/bans/:userId (unban)
router.delete('/:id/bans/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'ban_members'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await query(`DELETE FROM server_bans WHERE server_id=$1 AND user_id=$2`, [req.params.id, req.params.userId]);
    return res.json({ message: 'User unbanned' });
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
      if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_roles'))) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const { name, color = '#5865f2', permissions = [] } = req.body;
      const { rows: [role] } = await query(
        `INSERT INTO server_roles (server_id, name, color, permissions)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.params.id, name, color, permissions]
      );
      const io = req.app.get('io');
      if (io) {
        const { rows: updatedRoles } = await query(
          `SELECT * FROM server_roles WHERE server_id = $1 ORDER BY position`,
          [req.params.id]
        );
        io.to(`server:${req.params.id}`).emit('roles_updated', { server_id: req.params.id, roles: updatedRoles });
      }
      return res.status(201).json(role);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// PUT /api/servers/:id/roles/:roleId
router.put('/:id/roles/:roleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_roles'))) {
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
    const io = req.app.get('io');
    if (io) {
      const { rows: updatedRoles } = await query(
        `SELECT * FROM server_roles WHERE server_id = $1 ORDER BY position`,
        [req.params.id]
      );
      io.to(`server:${req.params.id}`).emit('roles_updated', { server_id: req.params.id, roles: updatedRoles });
    }
    return res.json(role);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/servers/:id/roles/:roleId
router.delete('/:id/roles/:roleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_roles'))) {
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
    const io = req.app.get('io');
    if (io) {
      const { rows: updatedRoles } = await query(
        `SELECT * FROM server_roles WHERE server_id = $1 ORDER BY position`,
        [req.params.id]
      );
      io.to(`server:${req.params.id}`).emit('roles_updated', { server_id: req.params.id, roles: updatedRoles });
    }
    return res.json({ message: 'Role deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Invites ───────────────────────────────────────────────────────────────────

// GET /api/servers/invite/:code/info  — public, no auth required
router.get('/invite/:code/info', async (req: Request, res: Response) => {
  try {
    const { rows: [invite] } = await query(
      `SELECT si.code, si.expires_at,
              s.id AS server_id, s.name AS server_name, s.icon_url,
              u.username AS creator_username, u.avatar_url AS creator_avatar
       FROM server_invites si
       JOIN servers s ON s.id = si.server_id
       JOIN users   u ON u.id = si.creator_id
       WHERE si.code = $1`,
      [req.params.code]
    );
    if (!invite) return res.status(404).json({ error: 'Invalid invite' });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite expired' });
    }
    return res.json({
      code: invite.code,
      server_id: invite.server_id,
      server_name: invite.server_name,
      icon_url: invite.icon_url,
      creator_username: invite.creator_username,
      creator_avatar: invite.creator_avatar,
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/invite/create
router.post('/invite/create', authMiddleware, inviteCreateLimiter, async (req: AuthRequest, res: Response) => {
  const { server_id, expires_in } = req.body;
  try {
    if (!(await hasMemberPermission(server_id, req.user!.id, 'create_invites'))) {
      return res.status(403).json({ error: 'Nie masz uprawnień do tworzenia zaproszeń' });
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
router.post('/join/:code', authMiddleware, joinLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [invite] } = await query(
      `SELECT * FROM server_invites WHERE code = $1`, [req.params.code]
    );
    if (!invite) return res.status(404).json({ error: 'Invalid invite' });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invite expired' });
    }
    // Check if user is banned from this server
    const { rowCount: isBanned } = await query(
      `SELECT 1 FROM server_bans WHERE server_id=$1 AND user_id=$2`,
      [invite.server_id, req.user!.id]
    );
    if (isBanned) return res.status(403).json({ error: 'Masz ban na tym serwerze' });
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
      [invite.server_id, u?.username, `**${u?.username}** dołączył/a do serwera`]
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
      // Run member_join automations
      runAutomations(invite.server_id, 'member_join', { userId: req.user!.id, io }).catch(console.error);
    }
    return res.json(server);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Custom Emoji ──────────────────────────────────────────────────
// GET /api/servers/:id/emojis
router.get('/:id/emojis', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [member] } = await query(
      'SELECT 1 FROM server_members WHERE server_id=$1 AND user_id=$2',
      [req.params.id, req.user!.id]
    );
    if (!member) return res.status(403).json({ error: 'Not a member' });
    const { rows } = await query(
      'SELECT * FROM server_emojis WHERE server_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/:id/emojis
router.post('/:id/emojis', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_server'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { name, image_url } = req.body;
    if (!name || !image_url) return res.status(400).json({ error: 'name and image_url required' });
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(name)) return res.status(400).json({ error: 'Invalid emoji name' });
    const { rows: [count] } = await query(
      'SELECT COUNT(*) FROM server_emojis WHERE server_id=$1', [req.params.id]
    );
    if (parseInt(count.count) >= 50) return res.status(400).json({ error: 'Max 50 custom emojis per server' });
    const { rows: [emoji] } = await query(
      'INSERT INTO server_emojis(server_id, name, image_url, uploaded_by) VALUES($1,$2,$3,$4) RETURNING *',
      [req.params.id, name.toLowerCase(), image_url, req.user!.id]
    );
    return res.status(201).json(emoji);
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Emoji name already exists' });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/servers/:id/emojis/:emojiId
router.delete('/:id/emojis/:emojiId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_server'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await query('DELETE FROM server_emojis WHERE id=$1 AND server_id=$2', [req.params.emojiId, req.params.id]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Server Tag ────────────────────────────────────────────────────────────────

// GET /api/servers/:id/tag — anyone can read a server's tag
router.get('/:id/tag', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isMember(req.params.id, req.user!.id))) {
      return res.status(403).json({ error: 'Not a member' });
    }
    const { rows: [tag] } = await query(
      'SELECT tag, color, icon, created_at FROM server_tags WHERE server_id = $1',
      [req.params.id]
    );
    return res.json(tag || null);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/servers/:id/tag — Owner/Admin only; upserts tag
router.put('/:id/tag',
  authMiddleware,
  body('tag').isString().trim().isLength({ min: 2, max: 4 }).matches(/^[A-Z0-9]+$/i),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Tag must be 2–4 alphanumeric characters' });
    try {
      if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_server'))) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const tag = (req.body.tag as string).toUpperCase();
      const color = typeof req.body.color === 'string' ? req.body.color.slice(0, 32) : null;
      const icon  = typeof req.body.icon  === 'string' ? req.body.icon.slice(0, 32)  : null;
      const { rows: [row] } = await query(
        `INSERT INTO server_tags (server_id, tag, color, icon) VALUES ($1, $2, $3, $4)
         ON CONFLICT (server_id) DO UPDATE SET tag = EXCLUDED.tag, color = EXCLUDED.color, icon = EXCLUDED.icon
         RETURNING tag, color, icon, created_at`,
        [req.params.id, tag, color, icon]
      );
      // Broadcast tag change to all server members
      const io = req.app.get('io');
      if (io) io.to(`server:${req.params.id}`).emit('server_tag_updated', { server_id: req.params.id, tag: row.tag, color: row.color, icon: row.icon });
      return res.json(row);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// DELETE /api/servers/:id/tag — Owner/Admin only; removes tag
router.delete('/:id/tag', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_server'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await query('DELETE FROM server_tags WHERE server_id = $1', [req.params.id]);
    const io = req.app.get('io');
    if (io) io.to(`server:${req.params.id}`).emit('server_tag_updated', { server_id: req.params.id, tag: null });
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Server Discovery ──────────────────────────────────────────────────────────
// GET /api/servers/discover/list
router.get('/discover/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string || '').toLowerCase();
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.description, s.discovery_description,
              s.icon_url, s.banner_url, s.accent_color, s.is_official,
              COUNT(sm.user_id)::int AS member_count,
              COUNT(CASE WHEN u.status NOT IN ('offline') THEN 1 END)::int AS online_count
       FROM servers s
       LEFT JOIN server_members sm ON sm.server_id = s.id
       LEFT JOIN users u ON u.id = sm.user_id
       WHERE s.is_public = true
         ${q ? `AND (LOWER(s.name) LIKE '%' || $1 || '%' OR LOWER(s.description) LIKE '%' || $1 || '%' OR LOWER(COALESCE(s.discovery_description,'')) LIKE '%' || $1 || '%')` : ''}
       GROUP BY s.id
       ORDER BY member_count DESC
       LIMIT 100`,
      q ? [q] : []
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PATCH /api/servers/:id/discovery
router.patch('/:id/discovery', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_server'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { is_public, discovery_description } = req.body;
    await query(
      `UPDATE servers SET is_public = COALESCE($1, is_public), discovery_description = COALESCE($2, discovery_description) WHERE id = $3`,
      [is_public, discovery_description, req.params.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Server Onboarding ─────────────────────────────────────────────────────────
// GET /api/servers/:id/onboarding
router.get('/:id/onboarding', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const ob = await query(`SELECT * FROM server_onboarding WHERE server_id = $1`, [req.params.id]);
    const comp = await query(
      `SELECT 1 FROM server_onboarding_completions WHERE server_id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    const data = ob.rows[0] || { server_id: req.params.id, enabled: false, rules_text: null, welcome_text: null, assign_role_id: null };
    return res.json({ ...data, completed: comp.rows.length > 0 });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/servers/:id/onboarding
router.put('/:id/onboarding', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAuthorized(req.params.id, req.user!.id, 'manage_server'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { enabled, rules_text, welcome_text, assign_role_id } = req.body;
    await query(
      `INSERT INTO server_onboarding (server_id, enabled, rules_text, welcome_text, assign_role_id)
       VALUES ($1, COALESCE($2, false), $3, $4, $5)
       ON CONFLICT (server_id) DO UPDATE SET
         enabled = COALESCE($2, server_onboarding.enabled),
         rules_text = COALESCE($3, server_onboarding.rules_text),
         welcome_text = COALESCE($4, server_onboarding.welcome_text),
         assign_role_id = COALESCE($5, server_onboarding.assign_role_id),
         updated_at = NOW()`,
      [req.params.id, enabled, rules_text, welcome_text, assign_role_id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/:id/onboarding/complete
router.post('/:id/onboarding/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const serverId = req.params.id;
  try {
    await query(
      `INSERT INTO server_onboarding_completions (server_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [serverId, userId]
    );
    // Optionally assign role
    const ob = await query(`SELECT assign_role_id FROM server_onboarding WHERE server_id = $1`, [serverId]);
    if (ob.rows[0]?.assign_role_id) {
      await query(
        `INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [serverId, userId, ob.rows[0].assign_role_id]
      ).catch(() => {});
    }
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/:id/join-public — join a public server without invite code
router.post('/:id/join-public', authMiddleware, joinLimiter, async (req: AuthRequest, res: Response) => {
  const serverId = req.params.id;
  const userId = req.user!.id;
  try {
    const { rows: [srv] } = await query(`SELECT * FROM servers WHERE id = $1 AND is_public = true`, [serverId]);
    if (!srv) return res.status(404).json({ error: 'Public server not found' });
    const { rowCount: isBanned } = await query(`SELECT 1 FROM server_bans WHERE server_id=$1 AND user_id=$2`, [serverId, userId]);
    if (isBanned) return res.status(403).json({ error: 'Masz ban na tym serwerze' });
    const existing = await query(`SELECT 1 FROM server_members WHERE server_id=$1 AND user_id=$2`, [serverId, userId]);
    if (existing.rowCount) return res.status(409).json({ error: 'Already a member' });
    await query(`INSERT INTO server_members (server_id, user_id, role_name) VALUES ($1, $2, 'Member')`, [serverId, userId]);
    const { rows: [memberRole] } = await query(
      `SELECT id FROM server_roles WHERE server_id=$1 AND is_default=TRUE AND name='Member' LIMIT 1`, [serverId]
    );
    if (memberRole) {
      await query(`INSERT INTO member_roles (server_id, user_id, role_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [serverId, userId, memberRole.id]).catch(() => {});
    }
    const { rows: [u] } = await query(`SELECT id, username, avatar_url, status FROM users WHERE id=$1`, [userId]);
    const io = req.app.get('io');
    if (io) {
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      for (const s of sockets) s.join(`server:${serverId}`);
      io.to(`server:${serverId}`).emit('member_joined', { server_id: serverId, user: { ...u, role_name: 'Member', roles: [] } });
    }
    return res.json(srv);
  } catch (err) { console.error('[join-public]', err); return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
