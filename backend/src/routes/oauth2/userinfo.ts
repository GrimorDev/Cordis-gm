import { Router, Request, Response } from 'express';
import { v1AuthMiddleware, requireScope } from '../../middleware/botAuth';
import { query } from '../../db/pool';

const router = Router();

// GET /api/oauth2/userinfo — requires Bearer OAuth2 token with identify scope
router.get('/', v1AuthMiddleware, requireScope('identify'), async (req: Request, res: Response) => {
  const p = req.v1Principal!;
  if (p.type !== 'oauth2') return res.status(403).json({ error: 'Only OAuth2 tokens supported' });

  try {
    const fields = ['id', 'username', 'avatar_url', 'created_at'];
    const scopes = p.scopes;
    if (scopes.includes('email')) fields.push('email');

    const { rows } = await query(`SELECT ${fields.join(',')} FROM users WHERE id = $1`, [p.userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
