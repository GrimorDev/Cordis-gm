/**
 * GET /api/files/*
 *
 * Wyświetlanie (img/audio/video): 302 redirect na pre-signed R2 URL (1h TTL).
 * SW w sw.js pomija r2.cloudflarestorage.com — brak CORS dla img/audio/video.
 *
 * ?dl=1 (pobieranie): stream przez backend z Content-Disposition: attachment.
 */

import { Router, Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

  try {
    if (download) {
      // ── Pobieranie: stream z Content-Disposition: attachment ───────────────
      const range = req.headers.range;
      const cmd = new GetObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
        ...(range ? { Range: range } : {}),
      });
      const result = await r2Client.send(cmd);
      if (!result.Body) return res.status(404).json({ error: 'Plik nie znaleziony' });

      res.setHeader('Content-Type', result.ContentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Cache-Control', 'private, max-age=3300');
      if (result.ContentLength != null) res.setHeader('Content-Length', String(result.ContentLength));

      const body = result.Body as any;
      if (typeof body.pipe === 'function') {
        body.on('error', () => { if (!res.headersSent) res.status(500).end(); });
        body.pipe(res);
      } else if (typeof body.transformToByteArray === 'function') {
        const bytes = await body.transformToByteArray();
        res.end(Buffer.from(bytes));
      }
    } else {
      // ── Wyświetlanie: redirect do public URL (CDN) lub pre-signed URL ─────
      // Dodajemy nagłówki CORS by fetch() z przeglądarki też działał (dla loadText etc.)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');

      if (config.r2.publicUrl) {
        // Mamy CDN/public URL — redirect bez generowania signed URL (szybciej)
        const publicFileUrl = `${config.r2.publicUrl}/${key}`;
        res.setHeader('Cache-Control', 'public, max-age=3300');
        return res.redirect(302, publicFileUrl);
      }

      // Brak CDN — generuj signed URL
      const signedCmd = new GetObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
      });
      const signedUrl = await getSignedUrl(r2Client, signedCmd, { expiresIn: 3600 });
      res.setHeader('Cache-Control', 'private, max-age=3300');
      return res.redirect(302, signedUrl);
    }
  } catch (err: any) {
    const status = err.$metadata?.httpStatusCode;
    if (err.name === 'NoSuchKey' || status === 404) {
      return res.status(404).json({ error: 'Plik nie znaleziony' });
    }
    console.error('[R2 error]', key, err.name, err.message);
    if (!res.headersSent) return res.status(500).json({ error: 'Błąd R2: ' + err.message });
  }
});

export default router;
