import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Verify user is server member
async function isMember(serverId: string, userId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT role_name FROM server_members WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );
  return rows[0]?.role_name || null;
}

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
      `SELECT id, category_id, name, type, description, position
       FROM channels WHERE server_id = $1 ORDER BY position`,
      [req.params.serverId]
    );

    const result = cats.map((cat: any) => ({
      ...cat,
      channels: channels.filter((c: any) => c.category_id === cat.id),
    }));
    return res.json(result);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/channels - create channel
router.post(
  '/',
  authMiddleware,
  [
    body('server_id').isUUID(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('type').isIn(['text', 'voice']),
    body('category_id').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { server_id, name, type, category_id, description } = req.body;
    const role = await isMember(server_id, req.user!.id);
    if (!role || !['Owner', 'Admin'].includes(role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    try {
      const { rows: [channel] } = await query(
        `INSERT INTO channels (server_id, category_id, name, type, description)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [server_id, category_id || null, name, type, description || null]
      );
      return res.status(201).json(channel);
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/channels/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [req.params.id]);
    if (!ch) return res.status(404).json({ error: 'Not found' });

    const role = await isMember(ch.server_id, req.user!.id);
    if (!role || !['Owner', 'Admin'].includes(role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { name, description } = req.body;
    const { rows: [updated] } = await query(
      `UPDATE channels SET
         name = COALESCE($1, name),
         description = COALESCE($2, description)
       WHERE id = $3 RETURNING *`,
      [name, description, req.params.id]
    );
    return res.json(updated);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/channels/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [req.params.id]);
    if (!ch) return res.status(404).json({ error: 'Not found' });

    const role = await isMember(ch.server_id, req.user!.id);
    if (!role || !['Owner', 'Admin'].includes(role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await query(`DELETE FROM channels WHERE id = $1`, [req.params.id]);
    return res.json({ message: 'Channel deleted' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/channels/categories - create category
router.post('/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { server_id, name } = req.body;
  const role = await isMember(server_id, req.user!.id);
  if (!role || !['Owner', 'Admin'].includes(role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  try {
    const { rows: [cat] } = await query(
      `INSERT INTO channel_categories (server_id, name) VALUES ($1, $2) RETURNING *`,
      [server_id, name]
    );
    return res.status(201).json(cat);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
