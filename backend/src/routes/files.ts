/**
 * GET /api/files/*
 *
 * Serwuje pliki z Cloudflare R2 przez pre-signed URL redirect.
 *
 * ?dl=1  → signed URL z Content-Disposition: attachment (pobieranie)
 *           przeglądarka robi navigation, nie fetch → brak CORS
 * brak   → signed URL bez CD (wyświetlanie: img, video, audio)
 */

import { Router, Request, Response } from 'express';
import { getR2SignedUrl, r2Enabled } from '../services/r2';

const router = Router();

router.get('/*', async (req: Request, res: Response) => {
  if (!r2Enabled) {
    return res.status(404).json({ error: 'R2 storage nie jest skonfigurowany' });
  }

  const key = (req.params as any)[0] as string;
  if (!key) return res.status(400).json({ error: 'Brak klucza pliku' });

  if (key.includes('..') || key.startsWith('/')) {
    return res.status(400).json({ error: 'Nieprawidłowy klucz' });
  }

  const download = req.query.dl === '1';
  const filename = (req.query.name as string) || key.split('/').pop() || 'plik';

  try {
    const signedUrl = await getR2SignedUrl(key, download ? filename : undefined);
    res.setHeader('Cache-Control', 'private, max-age=3300');
    return res.redirect(302, signedUrl);
  } catch (err: any) {
    console.error('[R2 sign error]', key, err.message);
    return res.status(404).json({ error: 'Plik nie znaleziony lub błąd R2' });
  }
});

export default router;
