import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, getClient } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import crypto from 'crypto';

const router = Router();

// GET /api/servers - list user's servers
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.icon_url, s.owner_id, s.created_at
       FROM servers s
       INNER JOIN server_members sm ON sm.server_id = s.id
       WHERE sm.user_id = $1
       ORDER BY s.created_at`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers - create server
router.post(
  '/',
  authMiddleware,
  [body('name').trim().isLength({ min: 1, max: 100 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name } = req.body;
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { rows: [server] } = await client.query(
        `INSERT INTO servers (name, owner_id) VALUES ($1, $2) RETURNING *`,
        [name, req.user!.id]
      );

      // Add owner as member with Owner role
      await client.query(
        `INSERT INTO server_members (server_id, user_id, role_name) VALUES ($1, $2, 'Owner')`,
        [server.id, req.user!.id]
      );

      // Create default categories
      const { rows: [general_cat] } = await client.query(
        `INSERT INTO channel_categories (server_id, name, position) VALUES ($1, 'General', 0) RETURNING id`,
        [server.id]
      );
      const { rows: [voice_cat] } = await client.query(
        `INSERT INTO channel_categories (server_id, name, position) VALUES ($1, 'Voice Rooms', 1) RETURNING id`,
        [server.id]
      );

      // Create default channels
      await client.query(
        `INSERT INTO channels (server_id, category_id, name, type, position) VALUES ($1, $2, 'general', 'text', 0)`,
        [server.id, general_cat.id]
      );
      await client.query(
        `INSERT INTO channels (server_id, category_id, name, type, position) VALUES ($1, $2, 'General', 'voice', 0)`,
        [server.id, voice_cat.id]
      );

      await client.query('COMMIT');
      return res.status(201).json(server);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  }
);

// GET /api/servers/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [server] } = await query(
      `SELECT s.*, sm.role_name as my_role
       FROM servers s
       INNER JOIN server_members sm ON sm.server_id = s.id AND sm.user_id = $2
       WHERE s.id = $1`,
      [req.params.id, req.user!.id]
    );
    if (!server) return res.status(404).json({ error: 'Server not found or no access' });

    // Get categories with channels
    const { rows: categories } = await query(
      `SELECT id, name, position FROM channel_categories WHERE server_id = $1 ORDER BY position`,
      [req.params.id]
    );
    const { rows: channels } = await query(
      `SELECT id, category_id, name, type, description, position
       FROM channels WHERE server_id = $1 ORDER BY position`,
      [req.params.id]
    );

    server.categories = categories.map((cat: any) => ({
      ...cat,
      channels: channels.filter((ch: any) => ch.category_id === cat.id),
    }));

    return res.json(server);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/servers/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, icon_url } = req.body;
  try {
    const { rows: [member] } = await query(
      `SELECT role_name FROM server_members WHERE server_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    if (!member || !['Owner', 'Admin'].includes(member.role_name)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { rows: [server] } = await query(
      `UPDATE servers SET name = COALESCE($1, name), icon_url = COALESCE($2, icon_url)
       WHERE id = $3 RETURNING *`,
      [name, icon_url, req.params.id]
    );
    return res.json(server);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/servers/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [server] } = await query(
      `SELECT owner_id FROM servers WHERE id = $1`,
      [req.params.id]
    );
    if (!server) return res.status(404).json({ error: 'Not found' });
    if (server.owner_id !== req.user!.id) return res.status(403).json({ error: 'Only owner can delete' });

    await query('DELETE FROM servers WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Server deleted' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/servers/:id/members
router.get('/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const access = await query(
      `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    if (!access.rowCount) return res.status(403).json({ error: 'No access' });

    const { rows } = await query(
      `SELECT u.id, u.username, u.avatar_url, u.status, u.custom_status, sm.role_name
       FROM server_members sm
       INNER JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = $1
       ORDER BY sm.role_name, u.username`,
      [req.params.id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers/:id/invite - generate invite code
router.post('/invite/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { server_id, expires_in } = req.body;
  try {
    const access = await query(
      `SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2`,
      [server_id, req.user!.id]
    );
    if (!access.rowCount) return res.status(403).json({ error: 'No access' });

    const code = crypto.randomBytes(5).toString('hex');
    let expiresAt: Date | null = null;
    if (expires_in && expires_in !== 'never') {
      expiresAt = new Date(Date.now() + parseInt(expires_in) * 1000);
    }

    await query(
      `INSERT INTO server_invites (code, server_id, creator_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [code, server_id, req.user!.id, expiresAt]
    );
    return res.json({ code, expires_at: expiresAt });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers/join/:code
router.post('/join/:code', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [invite] } = await query(
      `SELECT * FROM server_invites WHERE code = $1`,
      [req.params.code]
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

    const { rows: [server] } = await query(`SELECT * FROM servers WHERE id = $1`, [invite.server_id]);
    return res.json(server);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
