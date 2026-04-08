import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../../db/pool';
import { authMiddleware } from '../../middleware/auth';
import { AuthRequest } from '../../types';

const router = Router();

// GET /api/developer/applications
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT da.*, u.username AS bot_username, u.avatar_url AS bot_avatar
       FROM developer_applications da
       LEFT JOIN users u ON u.id = da.bot_user_id
       WHERE da.owner_id = $1
       ORDER BY da.created_at DESC`,
      [req.user!.id]
    );
    // Never return client_secret
    res.json(rows.map(r => ({ ...r, client_secret: undefined })));
  } catch (err) {
    console.error('GET /developer/applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/developer/applications
router.post('/', authMiddleware,
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, description } = req.body;
      const rawSecret = crypto.randomBytes(32).toString('hex');
      const secretHash = await bcrypt.hash(rawSecret, 10);

      const { rows } = await query(
        `INSERT INTO developer_applications (owner_id, name, description, client_secret)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.user!.id, name, description || null, secretHash]
      );

      res.status(201).json({
        ...rows[0],
        client_secret: rawSecret, // shown only once
      });
    } catch (err) {
      console.error('POST /developer/applications error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/developer/applications/:appId
router.get('/:appId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT da.*, u.username AS bot_username, u.avatar_url AS bot_avatar, u.is_bot
       FROM developer_applications da
       LEFT JOIN users u ON u.id = da.bot_user_id
       WHERE da.id = $1 AND da.owner_id = $2`,
      [req.params.appId, req.user!.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ ...rows[0], client_secret: undefined });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/developer/applications/:appId
router.patch('/:appId', authMiddleware,
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('redirect_uris').optional().isArray({ max: 20 }),
  body('redirect_uris.*').optional().isURL(),
  body('is_public').optional().isBoolean(),
  body('terms_url').optional().isURL(),
  body('privacy_url').optional().isURL(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      const allowed = ['name', 'description', 'redirect_uris', 'is_public', 'terms_url', 'privacy_url', 'icon_url'];
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates.push(`${key} = $${i++}`);
          values.push(req.body[key]);
        }
      }
      if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
      updates.push(`updated_at = NOW()`);
      values.push(req.params.appId, req.user!.id);

      const { rows } = await query(
        `UPDATE developer_applications SET ${updates.join(', ')}
         WHERE id = $${i} AND owner_id = $${i + 1} RETURNING *`,
        values
      );
      if (!rows.length) return res.status(404).json({ error: 'Application not found' });
      res.json({ ...rows[0], client_secret: undefined });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/developer/applications/:appId
router.delete('/:appId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'DELETE FROM developer_applications WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.appId, req.user!.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/developer/applications/:appId/secret — regenerate client_secret
router.post('/:appId/secret', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query(
      'SELECT 1 FROM developer_applications WHERE id = $1 AND owner_id = $2',
      [req.params.appId, req.user!.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Application not found' });

    const rawSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = await bcrypt.hash(rawSecret, 10);
    await query(
      'UPDATE developer_applications SET client_secret = $1, updated_at = NOW() WHERE id = $2',
      [secretHash, req.params.appId]
    );
    res.json({ client_secret: rawSecret }); // shown only once
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
