/**
 * GET /api/files/*
 *
 * Streamuje pliki z Cloudflare R2 przez backend (bez redirect).
 * SW pomija /api/ więc nie ma CORS. Obsługuje Range (seek audio/video).
 *
 * ?dl=1  → Content-Disposition: attachment (pobieranie pliku)
 * brak   → wyświetlanie (img, video, audio)
 */

import { Router, Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, r2Enabled } from '../services/r2';
import { config } from '../config';
import { Readable } from 'stream';

const router = Router();

router.get('/*', async (req: Request, res: Response) => {
  if (!r2Client || !r2Enabled) {
    return res.status(404).json({ error: 'R2 storage nie jest skonfigurowany' });
  }

  const key = (req.params as any)[0] as string;
  if (!key) return res.status(400).json({ error: 'Brak klucza pliku' });
  if (key.includes('..') || key.startsWith('/')) {
    return res.status(400).json({ error: 'Nieprawidłowy klucz' });
  }

  const download = req.query.dl === '1';
  const filename = (req.query.name as string) || key.split('/').pop() || 'plik';
  const range    = req.headers.range;

  try {
    // Pobierz metadata żeby wiedzieć ContentLength
    const cmd = new GetObjectCommand({
      Bucket: config.r2.bucket,
      Key:    key,
      ...(range ? { Range: range } : {}),
    });

    const result = await r2Client.send(cmd);
    const contentType   = result.ContentType   || 'application/octet-stream';
    const contentLength = result.ContentLength;

    // Nagłówki
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3300');
    res.setHeader('Accept-Ranges', 'bytes');

    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    }

    if (range && result.ContentRange) {
      // Partial content (seeking)
      res.setHeader('Content-Range', result.ContentRange);
      if (contentLength != null) res.setHeader('Content-Length', contentLength);
      res.status(206);
    } else {
      if (contentLength != null) res.setHeader('Content-Length', contentLength);
      res.status(200);
    }

    // Stream bytes bezpośrednio do klienta
    (result.Body as Readable).pipe(res);
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Plik nie znaleziony' });
    }
    console.error('[R2 stream error]', key, err.message);
    return res.status(500).json({ error: 'Błąd pobierania pliku z R2' });
  }
});

export default router;
