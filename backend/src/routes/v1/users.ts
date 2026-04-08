import { Router, Request, Response } from 'express';
import { requireScope } from '../../middleware/botAuth';
import { query } from '../../db/pool';

const router = Router();

// GET /api/v1/users/@me
router.get('/@me', async (req: Request, res: Response) => {
  const p = req.v1Principal!;
  const userId = p.type === 'bot' ? p.botUserId : p.userId;

  try {
    const { rows } = await query(
      'SELECT id, username, avatar_url, is_bot, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found', code: 10013 });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/users/@me/guilds — OAuth2 only, requires 'guilds' scope
router.get('/@me/guilds', requireScope('guilds'), async (req: Request, res: Response) => {
  const p = req.v1Principal!;
  if (p.type === 'bot') return res.status(403).json({ error: 'Bot tokens cannot use this endpoint' });

  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.icon_url, sm.role_name
       FROM server_members sm
       JOIN servers s ON s.id = sm.server_id
       WHERE sm.user_id = $1`,
      [p.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/users/:userId — public profile
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT id, username, avatar_url, is_bot, created_at FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Unknown User', code: 10013 });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
