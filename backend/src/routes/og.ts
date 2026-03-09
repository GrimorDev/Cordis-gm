import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Simple in-memory cache (url → { data, ts })
interface OgData { title: string; description: string; image: string; site_name: string; url: string; }
const cache = new Map<string, { data: OgData; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function extract(html: string, prop: string): string {
  // og:PROP content="..."  or content="..." property="og:PROP"
  const re1 = new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:${prop}["']`, 'i');
  return (html.match(re1) || html.match(re2))?.[1] || '';
}

// GET /api/og?url=
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const url = String(req.query.url || '').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  // Only allow reasonable URL lengths
  if (url.length > 2000) return res.status(400).json({ error: 'URL too long' });

  // Cache hit
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return res.json(cached.data);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CordisPreview/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return res.json({});

    // Limit to first 100 KB for performance
    const reader = response.body?.getReader();
    let html = '';
    if (reader) {
      let bytes = 0;
      while (bytes < 100_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
        bytes += value?.length ?? 0;
      }
      reader.cancel().catch(() => {});
    }

    const title = extract(html, 'title')
      || (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '');
    const description = extract(html, 'description')
      || (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i))?.[1] || '';
    const image = extract(html, 'image');
    const site_name = extract(html, 'site_name');
    const ogUrl = extract(html, 'url') || url;

    const data: OgData = {
      title:       title.substring(0, 200),
      description: description.substring(0, 400),
      image,
      site_name:   site_name.substring(0, 100),
      url:         ogUrl,
    };

    if (data.title) cache.set(url, { data, ts: Date.now() });
    return res.json(data);
  } catch {
    return res.json({});
  }
});

export default router;
