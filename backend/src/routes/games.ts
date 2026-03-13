import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const RAWG_API_KEY = process.env.RAWG_API_KEY || '';
const MAX_GAMES = 6;

// GET /api/games/search?q=... — proxy RAWG (hides API key)
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string || '').trim();
  if (!q) return res.json([]);
  if (!RAWG_API_KEY) return res.status(503).json({ error: 'RAWG API not configured' });
  try {
    const url = `https://api.rawg.io/api/games?search=${encodeURIComponent(q)}&key=${RAWG_API_KEY}&page_size=8&ordering=-rating`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: 'RAWG API error' });
    const data: any = await r.json();
    const results = (data.results || []).map((g: any) => ({
      rawg_id:   g.id,
      name:      g.name,
      cover_url: g.background_image || null,
      genre:     g.genres?.[0]?.name || null,
    }));
    return res.json(results);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/games/user/:userId — public, get favorite games for a user
router.get('/user/:userId', async (req, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, game_name, game_cover_url, game_genre, rawg_id, display_order
       FROM user_favorite_games WHERE user_id=$1 ORDER BY display_order ASC, created_at ASC`,
      [req.params.userId]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/games — add a game (auth)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { game_name, game_cover_url, game_genre, rawg_id } = req.body;
  if (!game_name) return res.status(400).json({ error: 'game_name required' });
  try {
    const { rows: count } = await query(
      `SELECT COUNT(*)::int as c FROM user_favorite_games WHERE user_id=$1`,
      [req.user!.id]
    );
    if ((count[0]?.c || 0) >= MAX_GAMES) {
      return res.status(400).json({ error: `Maximum ${MAX_GAMES} games allowed` });
    }
    // Get max display_order
    const { rows: ord } = await query(
      `SELECT COALESCE(MAX(display_order),0) as m FROM user_favorite_games WHERE user_id=$1`,
      [req.user!.id]
    );
    const nextOrder = (ord[0]?.m || 0) + 1;
    const { rows } = await query(
      `INSERT INTO user_favorite_games (user_id, game_name, game_cover_url, game_genre, rawg_id, display_order)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, game_name, game_cover_url, game_genre, rawg_id, display_order`,
      [req.user!.id, game_name.slice(0,255), game_cover_url||null, game_genre||null, rawg_id||null, nextOrder]
    );
    return res.status(201).json(rows[0]);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/games/:id — remove a game (auth, own only)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM user_favorite_games WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.user!.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
