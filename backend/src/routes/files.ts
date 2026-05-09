/**
 * GET /api/files/*
 *
 * Serwuje pliki z R2 przez backend (streaming proxy).
 * Używamy streamingu zamiast presigned URL redirect, żeby:
 *  - uniknąć problemów z CORS / bucket policy na R2
 *  - uniknąć 404 gdy presigned URL nie działa poprawnie
 *  - mieć jednolity cache-control i CORP header
 *
 * ?dl=1 → Content-Disposition: attachment (pobieranie z własną nazwą)
 */

import { Router, Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, r2Enabled } from '../services/r2';
import { config } from '../config';

const router = Router();

router.get('/*', async (req: Request, res: Response) => {
  if (!r2Client || !r2Enabled) {
    return res.status(503).json({ error: 'R2 storage nie jest skonfigurowany' });
  }

  const key = (req.params as any)[0] as string;
  if (!key) return res.status(400).json({ error: 'Brak klucza pliku' });
  if (key.includes('..') || key.startsWith('/')) {
    return res.status(400).json({ error: 'Nieprawidłowy klucz' });
  }

  const download = req.query.dl === '1';
  const filename = (req.query.name as string) || key.split('/').pop() || 'plik';

  // ── Gdy mamy publiczny CDN URL → redirect (szybciej, omija backend) ────────
  // Używamy tylko gdy R2_PUBLIC_URL jest ustawiony AND to nie jest pobieranie
  if (!download && config.r2.publicUrl) {
    const publicFileUrl = `${config.r2.publicUrl}/${key}`;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.redirect(302, publicFileUrl);
  }

  // ── Streaming przez backend ────────────────────────────────────────────────
  // Bezpieczniejsze niż presigned URL — nie ma problemów z bucket policy,
  // CORS ani konfiguracją R2 Public URL.
  try {
    const range = req.headers.range;
    const cmd = new GetObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      ...(range ? { Range: range } : {}),
    });
    const result = await r2Client.send(cmd);
    if (!result.Body) return res.status(404).json({ error: 'Plik nie znaleziony' });

    const contentType = result.ContentType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Cache-Control', 'private, max-age=3300');
    } else {
      // Inline — przeglądarka wyświetla (obraz / video / audio)
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    if (result.ContentLength != null) res.setHeader('Content-Length', String(result.ContentLength));

    // Range response (seek w video/audio)
    if (result.$metadata?.httpStatusCode === 206) {
      res.status(206);
      if (result.ContentRange) res.setHeader('Content-Range', result.ContentRange);
    }

    const body = result.Body as any;
    if (typeof body.pipe === 'function') {
      body.on('error', () => { if (!res.headersSent) res.status(500).end(); });
      body.pipe(res);
    } else if (typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      res.end(Buffer.from(bytes));
    } else {
      res.status(500).json({ error: 'Nieznany typ body R2' });
    }
  } catch (err: any) {
    const status = err.$metadata?.httpStatusCode;
    if (err.name === 'NoSuchKey' || status === 404) {
      return res.status(404).json({ error: 'Plik nie znaleziony' });
    }
    console.error('[R2 files error]', key, err.name, err.message);
    if (!res.headersSent) return res.status(500).json({ error: 'Błąd R2: ' + err.message });
  }
});

export default router;
