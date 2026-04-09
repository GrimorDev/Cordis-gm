/**
 * GET /api/apps — public bot marketplace (no auth)
 * GET /api/apps/:clientId — single public app info
 */
import { Router, Request, Response } from 'express';
import { query } from '../db/pool';

const router = Router();

const appSelect = `
  SELECT da.client_id, da.name, da.description, da.icon_url, da.is_verified,
         da.terms_url, da.privacy_url, da.created_at,
         u.id  AS bot_user_id,
         u.username   AS bot_username,
         u.avatar_url AS bot_avatar,
         (SELECT COUNT(*)::int FROM bot_server_installations bsi
          WHERE bsi.application_id = da.id) AS server_count
  FROM developer_applications da
  LEFT JOIN users u ON u.id = da.bot_user_id
`;

// GET /api/apps — list all public bots, sorted by server_count
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await query(
      appSelect +
      `WHERE da.is_public = TRUE AND da.bot_user_id IS NOT NULL
       ORDER BY server_count DESC, da.created_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/apps error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/apps/search?q=<query>
router.get('/search', async (req: Request, res: Response) => {
  const q = `%${(req.query.q as string || '').toLowerCase()}%`;
  try {
    const { rows } = await query(
      appSelect +
      `WHERE da.is_public = TRUE AND da.bot_user_id IS NOT NULL
         AND (LOWER(da.name) LIKE $1 OR LOWER(da.description) LIKE $1)
       ORDER BY server_count DESC, da.created_at DESC
       LIMIT 50`,
      [q]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/apps/:clientId — single public app info
router.get('/:clientId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      appSelect +
      `WHERE da.client_id = $1 AND da.is_public = TRUE AND da.bot_user_id IS NOT NULL`,
      [req.params.clientId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
