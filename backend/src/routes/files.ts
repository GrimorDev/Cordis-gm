/**
 * GET /api/files/*
 * Streamuje pliki z R2 przez backend (brak redirect = brak CORS).
 * Obsługuje Range (seek audio/video). ?dl=1 = download.
 */

import { Router, Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, r2Enabled } from '../services/r2';
import { config } from '../config';

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
    const cmd = new GetObjectCommand({
      Bucket: config.r2.bucket,
      Key:    key,
      ...(range ? { Range: range } : {}),
    });

    const result = await r2Client.send(cmd);

    if (!result.Body) {
      return res.status(404).json({ error: 'Plik pusty lub nie znaleziony' });
    }

    const contentType   = result.ContentType   || 'application/octet-stream';
    const contentLength = result.ContentLength;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3300');
    res.setHeader('Accept-Ranges', 'bytes');

    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    }

    if (range && result.ContentRange) {
      res.setHeader('Content-Range', result.ContentRange);
      if (contentLength != null) res.setHeader('Content-Length', String(contentLength));
      res.status(206);
    } else {
      if (contentLength != null) res.setHeader('Content-Length', String(contentLength));
      res.status(200);
    }

    // AWS SDK v3: Body jest SdkStreamMixin — użyj transformToWebStream lub pipe bezpośrednio
    const body = result.Body as any;
    if (typeof body.pipe === 'function') {
      // Node.js Readable — bezpośrednie pipe
      body.on('error', (err: Error) => {
        console.error('[R2 stream error]', key, err.message);
        if (!res.headersSent) res.status(500).end();
      });
      body.pipe(res);
    } else if (typeof body.transformToByteArray === 'function') {
      // SDK mixin — pobierz jako buffer i wyślij
      const bytes = await body.transformToByteArray();
      res.end(Buffer.from(bytes));
    } else {
      // Web ReadableStream fallback
      const reader = (body as ReadableStream<Uint8Array>).getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          res.write(Buffer.from(value));
        }
      };
      await pump();
    }
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Plik nie znaleziony' });
    }
    console.error('[R2 stream error]', key, err.message);
    if (!res.headersSent) return res.status(500).json({ error: 'Błąd pobierania pliku z R2' });
  }
});

export default router;
