import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, getClient } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { getVoiceMembers } from '../redis/client';

const router = Router();

async function isMember(serverId: string, userId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT role_name FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  return rows[0]?.role_name || null;
}

/**
 * Returns true if userId is Owner/Admin on the server,
 * OR if any of their custom roles grants 'administrator' or the specific permission.
 */
async function hasServerPermission(serverId: string, userId: string, permission: string): Promise<boolean> {
  const roleName = await isMember(serverId, userId);
  if (!roleName) return false;
  if (['Owner', 'Admin'].includes(roleName)) return true;
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

// Returns { serverId, roleInServer } if user can access the channel, null otherwise
async function canAccessChannel(channelId: string, userId: string): Promise<{ serverId: string; roleInServer: string } | null> {
  const { rows: [ch] } = await query(
    `SELECT c.server_id, c.is_private, sm.role_name
     FROM channels c
     LEFT JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = $2
     WHERE c.id = $1`,
    [channelId, userId]
  );
  if (!ch || !ch.role_name) return null;
  const result = { serverId: ch.server_id, roleInServer: ch.role_name };
  if (!ch.is_private) return result;
  if (['Owner', 'Admin'].includes(ch.role_name)) return result;
  const { rowCount } = await query(
    `SELECT 1 FROM channel_role_access cra
     INNER JOIN member_roles mr ON mr.role_id = cra.role_id
     WHERE cra.channel_id = $1 AND mr.user_id = $2 AND mr.server_id = $3
     LIMIT 1`,
    [channelId, userId, ch.server_id]
  );
  return rowCount ? result : null;
}

// GET /api/channels/server/:serverId/voice-users — current voice channel occupants (from Redis)
router.get('/server/:serverId/voice-users', authMiddleware, async (req: AuthRequest, res: Response) => {
  const role = await isMember(req.params.serverId, req.user!.id);
  if (!role) return res.status(403).json({ error: 'No access' });
  try {
    const { rows: vChs } = await query(
      `SELECT id FROM channels WHERE server_id = $1 AND type = 'voice'`,
      [req.params.serverId]
    );
    const result: Record<string, any[]> = {};
    for (const ch of vChs) {
      const memberIds = await getVoiceMembers(ch.id);
      if (memberIds.length > 0) {
        const { rows: users } = await query(
          `SELECT id, username, avatar_url, status FROM users WHERE id = ANY($1::uuid[])`,
          [memberIds]
        );
        if (users.length > 0) result[ch.id] = users;
      }
    }
    return res.json(result);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/channels/server/:serverId
router.get('/server/:serverId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const role = await isMember(req.params.serverId, req.user!.id);
  if (!role) return res.status(403).json({ error: 'No access' });
  try {
    const { rows: cats } = await query(
      `SELECT id, name, position FROM channel_categories WHERE server_id = $1 ORDER BY position`,
      [req.params.serverId]
    );
    const { rows: channels } = await query(
      `SELECT id, category_id, name, type, description, is_private, position FROM channels
       WHERE server_id = $1 ORDER BY position`,
      [req.params.serverId]
    );
    const result = cats.map((cat: any) => ({
      ...cat,
      channels: channels.filter((c: any) => c.category_id === cat.id),
    }));
    return res.json(result);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/channels
router.post('/', authMiddleware,
  [
    body('server_id').isUUID(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('type').isIn(['text', 'voice', 'forum', 'announcement']),
    body('category_id').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { server_id, name, type, category_id, description, is_private, role_ids } = req.body;
    if (!(await hasServerPermission(server_id, req.user!.id, 'manage_channels'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    try {
      const { rows: [channel] } = await query(
        `INSERT INTO channels (server_id, category_id, name, type, description, is_private)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [server_id, category_id || null, name, type, description || null, !!is_private]
      );
      if (is_private && Array.isArray(role_ids) && role_ids.length > 0) {
        for (const rid of role_ids) {
          await query(
            `INSERT INTO channel_role_access (channel_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [channel.id, rid]
          );
        }
      }
      const io = req.app.get('io');
      if (io) io.to(`server:${server_id}`).emit('channel_created', { ...channel, server_id, allowed_roles: [] });
      return res.status(201).json(channel);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// PUT /api/channels/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [req.params.id]);
    if (!ch) return res.status(404).json({ error: 'Not found' });
    if (!(await hasServerPermission(ch.server_id, req.user!.id, 'manage_channels'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { name, description, is_private, role_ids, slowmode_seconds } = req.body;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const { rows: [updated] } = await client.query(
        `UPDATE channels SET
           name             = COALESCE($1, name),
           description      = COALESCE($2, description),
           is_private       = COALESCE($3, is_private),
           slowmode_seconds = COALESCE($4, slowmode_seconds)
         WHERE id = $5 RETURNING *`,
        [name || null, description !== undefined ? description : null,
         is_private !== undefined ? is_private : null,
         slowmode_seconds !== undefined ? Math.max(0, Math.min(21600, parseInt(slowmode_seconds) || 0)) : null,
         req.params.id]
      );
      if (Array.isArray(role_ids)) {
        await client.query(`DELETE FROM channel_role_access WHERE channel_id = $1`, [req.params.id]);
        for (const rid of role_ids) {
          await client.query(
            `INSERT INTO channel_role_access (channel_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [req.params.id, rid]
          );
        }
      }
      await client.query('COMMIT');
      // Fetch updated allowed_roles for realtime update
      const { rows: allowedRoles } = await query(
        `SELECT cra.channel_id, cra.role_id, sr.name as role_name, sr.color
         FROM channel_role_access cra INNER JOIN server_roles sr ON sr.id = cra.role_id
         WHERE cra.channel_id = $1`, [req.params.id]
      ).catch(() => ({ rows: [] as any[] }));
      const io = req.app.get('io');
      if (io) io.to(`server:${ch.server_id}`).emit('channel_updated', { ...updated, server_id: ch.server_id, allowed_roles: allowedRoles });
      return res.json({ ...updated, allowed_roles: allowedRoles });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/channels/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [req.params.id]);
    if (!ch) return res.status(404).json({ error: 'Not found' });
    if (!(await hasServerPermission(ch.server_id, req.user!.id, 'manage_channels'))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await query(`DELETE FROM channels WHERE id = $1`, [req.params.id]);
    const io = req.app.get('io');
    if (io) io.to(`server:${ch.server_id}`).emit('channel_deleted', { channel_id: req.params.id, server_id: ch.server_id });
    return res.json({ message: 'Channel deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/channels/categories
router.post('/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { server_id, name, is_private, role_ids } = req.body;
  if (!(await hasServerPermission(server_id, req.user!.id, 'manage_channels'))) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: [cat] } = await client.query(
      `INSERT INTO channel_categories (server_id, name, is_private) VALUES ($1, $2, $3) RETURNING *`,
      [server_id, name, is_private ? true : false]
    );
    // Assign role access if private
    if (is_private && Array.isArray(role_ids) && role_ids.length > 0) {
      for (const rid of role_ids) {
        await client.query(
          `INSERT INTO category_role_access (category_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [cat.id, rid]
        );
      }
    }
    await client.query('COMMIT');
    const { rows: allowedRoles } = is_private && Array.isArray(role_ids) && role_ids.length > 0
      ? await query(`SELECT cra.category_id, cra.role_id, sr.name as role_name, sr.color FROM category_role_access cra INNER JOIN server_roles sr ON sr.id = cra.role_id WHERE cra.category_id = $1`, [cat.id])
      : { rows: [] as any[] };
    const io = req.app.get('io');
    if (io) io.to(`server:${server_id}`).emit('category_created', { ...cat, server_id, channels: [], allowed_roles: allowedRoles });
    return res.status(201).json({ ...cat, allowed_roles: allowedRoles });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

// PUT /api/channels/categories/:id  — rename category
router.put('/categories/:id', authMiddleware,
  [body('name').trim().isLength({ min: 1, max: 100 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { rows: [cat] } = await query('SELECT * FROM channel_categories WHERE id=$1', [req.params.id]);
      if (!cat) return res.status(404).json({ error: 'Not found' });
      if (!(await hasServerPermission(cat.server_id, req.user!.id, 'manage_channels'))) return res.status(403).json({ error: 'Not authorized' });
      const { rows: [updated] } = await query(
        'UPDATE channel_categories SET name=$1 WHERE id=$2 RETURNING *',
        [req.body.name, req.params.id]
      );
      const io = req.app.get('io');
      if (io) io.to(`server:${cat.server_id}`).emit('category_updated', { id: updated.id, name: updated.name, server_id: cat.server_id });
      return res.json(updated);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// DELETE /api/channels/categories/:id  — delete category (channels become uncategorized)
router.delete('/categories/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [cat] } = await query('SELECT * FROM channel_categories WHERE id=$1', [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    if (!(await hasServerPermission(cat.server_id, req.user!.id, 'manage_channels'))) return res.status(403).json({ error: 'Not authorized' });
    // Channels in this category become uncategorized
    await query('UPDATE channels SET category_id=NULL WHERE category_id=$1', [req.params.id]);
    await query('DELETE FROM channel_categories WHERE id=$1', [req.params.id]);
    const io = req.app.get('io');
    if (io) io.to(`server:${cat.server_id}`).emit('category_deleted', { id: req.params.id, server_id: cat.server_id });
    return res.json({ message: 'Deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Forum Posts ───────────────────────────────────────────────────────────

// GET /api/channels/:id/posts
router.get('/:id/posts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const access = await canAccessChannel(req.params.id, req.user!.id);
    if (!access) return res.status(403).json({ error: 'No access' });
    const { rows } = await query(
      `SELECT fp.*, u.username as author_username, u.avatar_url as author_avatar
       FROM forum_posts fp
       JOIN users u ON u.id = fp.author_id
       WHERE fp.channel_id = $1
       ORDER BY fp.pinned DESC, fp.created_at DESC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/channels/:id/posts
router.post('/:id/posts', authMiddleware,
  [body('title').trim().isLength({ min: 1, max: 200 }), body('content').trim().isLength({ min: 1 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const access = await canAccessChannel(req.params.id, req.user!.id);
      if (!access) return res.status(403).json({ error: 'No access' });
      const ch = { server_id: access.serverId };
      const { title, content, image_url } = req.body;
      const { rows: [post] } = await query(
        `INSERT INTO forum_posts (channel_id, author_id, title, content, image_url)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.params.id, req.user!.id, title, content, image_url || null]
      );
      const { rows: [author] } = await query(`SELECT username, avatar_url FROM users WHERE id = $1`, [req.user!.id]);
      const full = { ...post, author_username: author.username, author_avatar: author.avatar_url };
      const io = req.app.get('io');
      if (io) io.to(`server:${ch.server_id}`).emit('forum_post_created', { channel_id: req.params.id, post: full });
      return res.status(201).json(full);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// GET /api/channels/:id/posts/:postId
router.get('/:id/posts/:postId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await canAccessChannel(req.params.id, req.user!.id))) return res.status(403).json({ error: 'No access' });
    const { rows: [post] } = await query(
      `SELECT fp.*, u.username as author_username, u.avatar_url as author_avatar
       FROM forum_posts fp JOIN users u ON u.id = fp.author_id
       WHERE fp.id = $1 AND fp.channel_id = $2`,
      [req.params.postId, req.params.id]
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const { rows: replies } = await query(
      `SELECT fr.*, u.username as author_username, u.avatar_url as author_avatar
       FROM forum_replies fr JOIN users u ON u.id = fr.author_id
       WHERE fr.post_id = $1 ORDER BY fr.created_at`,
      [req.params.postId]
    );
    return res.json({ ...post, replies });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/channels/:id/posts/:postId/replies
router.post('/:id/posts/:postId/replies', authMiddleware,
  [body('content').trim().isLength({ min: 1 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const access = await canAccessChannel(req.params.id, req.user!.id);
      if (!access) return res.status(403).json({ error: 'No access' });
      const ch = { server_id: access.serverId };
      const { rows: [post] } = await query(`SELECT id, locked FROM forum_posts WHERE id = $1`, [req.params.postId]);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      if (post.locked && !['Owner', 'Admin'].includes(access.roleInServer)) return res.status(403).json({ error: 'Post is locked' });
      const { rows: [reply] } = await query(
        `INSERT INTO forum_replies (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING *`,
        [req.params.postId, req.user!.id, req.body.content]
      );
      await query(`UPDATE forum_posts SET reply_count = reply_count + 1 WHERE id = $1`, [req.params.postId]);
      const { rows: [author] } = await query(`SELECT username, avatar_url FROM users WHERE id = $1`, [req.user!.id]);
      const full = { ...reply, author_username: author.username, author_avatar: author.avatar_url };
      const io = req.app.get('io');
      if (io) io.to(`server:${ch.server_id}`).emit('forum_reply_created', { channel_id: req.params.id, post_id: req.params.postId, reply: full });
      return res.status(201).json(full);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// DELETE /api/channels/:id/posts/:postId
router.delete('/:id/posts/:postId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const access = await canAccessChannel(req.params.id, req.user!.id);
    if (!access) return res.status(403).json({ error: 'No access' });
    const { rows: [post] } = await query(`SELECT author_id FROM forum_posts WHERE id = $1`, [req.params.postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== req.user!.id && !['Owner', 'Admin'].includes(access.roleInServer)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await query(`DELETE FROM forum_posts WHERE id = $1`, [req.params.postId]);
    const io = req.app.get('io');
    if (io) io.to(`server:${access.serverId}`).emit('forum_post_deleted', { channel_id: req.params.id, post_id: req.params.postId });
    return res.json({ message: 'Deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── PATCH /api/channels/categories/reorder ───────────────────────
router.patch('/categories/reorder',
  [
    body('server_id').isUUID(),
    body('categories').isArray({ min: 1 }),
    body('categories.*.id').isUUID(),
    body('categories.*.position').isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { server_id, categories } = req.body;
      const canReorder = await hasServerPermission(server_id, req.user!.id, 'manage_channels');
      if (!canReorder) return res.status(403).json({ error: 'Forbidden' });
      const client = await getClient();
      try {
        await client.query('BEGIN');
        for (const cat of categories) {
          await client.query(
            'UPDATE channel_categories SET position=$1 WHERE id=$2 AND server_id=$3',
            [cat.position, cat.id, server_id]
          );
        }
        await client.query('COMMIT');
        const io = req.app.get('io');
        if (io) io.to(`server:${server_id}`).emit('categories_reordered', { server_id, categories });
        return res.json({ ok: true });
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch {}
        return res.status(500).json({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// ── PATCH /api/channels/reorder ──────────────────────────────────
router.patch('/reorder',
  [
    body('server_id').isUUID(),
    body('channels').isArray({ min: 1 }),
    body('channels.*.id').isUUID(),
    body('channels.*.position').isInt({ min: 0 }),
    body('channels.*.category_id').isUUID(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { server_id, channels } = req.body;
      const canReorder = await hasServerPermission(server_id, req.user!.id, 'manage_channels');
      if (!canReorder) return res.status(403).json({ error: 'Forbidden' });
      const client = await getClient();
      try {
        await client.query('BEGIN');
        for (const ch of channels) {
          await client.query(
            'UPDATE channels SET position=$1, category_id=$2 WHERE id=$3 AND server_id=$4',
            [ch.position, ch.category_id, ch.id, server_id]
          );
        }
        await client.query('COMMIT');
        const io = req.app.get('io');
        if (io) io.to(`server:${server_id}`).emit('channels_reordered', { server_id, channels });
        return res.json({ ok: true });
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch {}
        return res.status(500).json({ error: 'Internal server error' });
      } finally {
        client.release();
      }
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

export default router;
