/**
 * GET /api/files/*
 *
 * Serwuje pliki z Cloudflare R2 przez pre-signed URL redirect.
 * Bucket pozostaje prywatny — żaden plik nie jest publicznie dostępny.
 *
 * Flow:
 *   1. Klient żąda /api/files/uploads/<hash>.ext
 *   2. Backend sprawdza auth (opcjonalnie) i generuje pre-signed URL (1h TTL)
 *   3. Odpowiada 302 → R2 signed URL
 *   4. Przeglądarka pobiera plik bezpośrednio z R2 (nie przez backend)
 *   5. Po 1h URL wygasa, ale /api/files/* zawsze generuje świeży
 *
 * Gdy R2_PUBLIC_URL ustawione (custom CDN domain) — ten endpoint nie jest używany,
 * pliki lecą bezpośrednio przez CDN.
 */

import { Router, Request, Response } from 'express';
import { getR2SignedUrl, r2Enabled } from '../services/r2';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/files/*key  (np. /api/files/uploads/abc123.mp4)
router.get('/*', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!r2Enabled) {
    return res.status(404).json({ error: 'R2 storage nie jest skonfigurowany' });
  }

  // Wyciągnij klucz z URL: /api/files/uploads/hash.ext → uploads/hash.ext
  const key = (req.params as any)[0] as string;
  if (!key) return res.status(400).json({ error: 'Brak klucza pliku' });

  // Bezpieczeństwo — zapobiegaj path traversal
  if (key.includes('..') || key.startsWith('/')) {
    return res.status(400).json({ error: 'Nieprawidłowy klucz' });
  }

  try {
    const signedUrl = await getR2SignedUrl(key);
    // Cache-Control: przeglądarka może cachować przez 55 min (URL ważny 60 min)
    res.setHeader('Cache-Control', 'private, max-age=3300');
    return res.redirect(302, signedUrl);
  } catch (err: any) {
    console.error('[R2 sign error]', key, err.message);
    return res.status(404).json({ error: 'Plik nie znaleziony lub błąd R2' });
  }
});

export default router;
