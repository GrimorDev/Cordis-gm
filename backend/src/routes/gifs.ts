import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Google fully shut down the Tenor API (all versions, all keys) on 2026-06-30 —
// this is GIPHY's native API instead. GIPHY_API_KEY is a real, rate-limited key,
// so it's kept server-side and never shipped to the frontend bundle.
const GIPHY_KEY = (process.env.GIPHY_API_KEY || '').trim();

interface GifResult { id: string; url: string; preview: string; }

function mapGiphyResults(data: any): GifResult[] {
  return ((data?.data ?? []) as any[])
    .map((g): GifResult => ({
      id:      g.id,
      url:     g.images?.original?.url            || g.images?.downsized?.url || '',
      preview: g.images?.fixed_height_small?.url  || g.images?.fixed_height?.url || g.images?.original?.url || '',
    }))
    .filter((g) => g.url);
}

// Small in-memory cache — a free/beta GIPHY key is capped at ~100 req/hr,
// shared across every user with the picker open, so identical queries within
// a short window are served from cache instead of hitting GIPHY again.
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, { data: GifResult[]; ts: number }>();

async function fetchGiphy(url: string, cacheKey: string): Promise<GifResult[]> {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`GIPHY responded ${r.status}`);
  const data: any = await r.json();
  const results = mapGiphyResults(data);

  cache.set(cacheKey, { data: results, ts: Date.now() });
  if (cache.size > 300) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  return results;
}

// GET /api/gifs/search?q=... — auth required
router.get('/search', authMiddleware, async (req: Request, res: Response) => {
  if (!GIPHY_KEY) return res.status(503).json({ error: 'GIFs not configured', results: [] });
  const q = String(req.query.q || '').slice(0, 100).trim();
  if (!q) return res.json({ results: [] });
  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13&lang=en`;
    const results = await fetchGiphy(url, `s:${q}`);
    return res.json({ results });
  } catch {
    return res.status(502).json({ error: 'GIF search failed', results: [] });
  }
});

// GET /api/gifs/trending — auth required
router.get('/trending', authMiddleware, async (_req: Request, res: Response) => {
  if (!GIPHY_KEY) return res.status(503).json({ error: 'GIFs not configured', results: [] });
  try {
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;
    const results = await fetchGiphy(url, 'trending');
    return res.json({ results });
  } catch {
    return res.status(502).json({ error: 'GIF trending failed', results: [] });
  }
});

export default router;
