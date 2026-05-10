import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { uploadToR2, r2Enabled } from '../services/r2';

const router = Router();

// ── MIME types allowed ────────────────────────────────────────────────────────
const ALLOWED_ATTACHMENT_MIMES = new Set([
  // images
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/bmp','image/avif',
  // audio
  'audio/mpeg','audio/ogg','audio/wav','audio/flac','audio/mp4','audio/aac','audio/opus','audio/x-wav',
  // video
  'video/mp4','video/webm','video/quicktime','video/x-msvideo','video/x-matroska','video/ogg',
  // documents
  'application/pdf',
  'text/plain','text/html','text/css','text/javascript','text/typescript','text/csv',
  'text/x-python','text/x-php','text/x-ruby','text/x-java-source','text/x-c','text/x-c++',
  'text/x-go','text/x-rust','text/x-swift','text/x-kotlin','text/x-shellscript',
  'application/json','application/xml','application/x-yaml','application/toml',
  'application/javascript','application/typescript',
  // archives
  'application/zip','application/x-zip','application/x-zip-compressed',
  'application/x-rar-compressed','application/vnd.rar','application/x-7z-compressed',
  'application/x-tar','application/gzip','application/x-gzip','application/x-bzip2','application/x-xz',
  // generic binary (zip on Windows etc.)
  'application/octet-stream',
]);

const CODE_EXTS = new Set([
  'js','jsx','ts','tsx','html','htm','css','scss','sass','less',
  'json','xml','yaml','yml','toml','ini','env','php','py','rb','rs','go','java','c','cpp',
  'cs','sh','bash','zsh','ps1','sql','graphql','md','mdx','vue','svelte','kt','swift',
  'dart','r','lua','ex','exs','txt','log','csv','tsv','conf','cfg','nfo','readme',
]);

const imageOnlyFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) cb(new Error('Only images allowed'));
  else cb(null, true);
};

const attachmentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  if (ALLOWED_ATTACHMENT_MIMES.has(file.mimetype) || CODE_EXTS.has(ext)) cb(null, true);
  else cb(new Error(`Typ pliku nieobsługiwany: ${file.mimetype} (.${ext})`));
};

// ── Disk storage (images + fallback) ─────────────────────────────────────────
const diskStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = (req.query.folder as string) || 'misc';
    const dir = path.join(config.uploads.dir, folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const uploadImages = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageOnlyFilter,
});

// Attachments: memory storage — pliki trafiają w pamięć, handler zapisuje na dysk
// (i opcjonalnie do R2 w tle jako CDN backup)
const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 600 * 1024 * 1024 }, // 600MB max (Cordyn Power)
  fileFilter: attachmentFilter,
});

// ── POST /api/upload/image?folder=avatars|banners|servers|emojis ──────────────
router.post('/image', authMiddleware, (req: AuthRequest, res: Response, next) => {
  uploadImages.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const folder = (req.query.folder as string) || 'misc';
    return res.json({ url: `/uploads/${folder}/${req.file.filename}` });
  });
});

// ── POST /api/upload?folder=attachments ──────────────────────────────────────
// STRATEGIA: dysk jako primary storage, R2 jako background backup (opcjonalne).
// URL zawsze jest disk-based (/uploads/...) — niezależny od dostępności R2.
// Eliminuje 404 z R2 presigned URL lub streaming proxy.
router.post('/', authMiddleware, (req: AuthRequest, res: Response, next) => {
  const folder = (req.query.folder as string) || 'misc';
  const middleware = folder === 'attachments'
    ? uploadAttachments.single('file')
    : uploadImages.single('file');

  middleware(req, res, async (err) => {
    if (err) {
      const code = (err as any).code;
      if (code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Plik za duży — maksymalny rozmiar to 50 MB (Cordyn Power: 600 MB)' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId   = req.user!.id;
    const fileSize = req.file.size;

    // ── Per-file size limit ────────────────────────────────────────────────────
    if (folder === 'attachments') {
      try {
        const { rows: [u] } = await query('SELECT is_premium FROM users WHERE id=$1', [userId]);
        const maxFileSize = u?.is_premium ? 600 * 1024 * 1024 : 50 * 1024 * 1024;
        if (fileSize > maxFileSize) {
          return res.status(413).json({
            error: u?.is_premium
              ? 'Plik za duży — maksymalny rozmiar to 600 MB'
              : 'Plik za duży — maksymalny rozmiar to 50 MB (Cordyn Power: 600 MB)',
          });
        }
      } catch { /* błąd sprawdzenia → przepuść */ }
    }

    // ── Zapisz na dysk (primary storage) ──────────────────────────────────────
    let diskUrl: string;

    if (req.file.buffer) {
      // memory storage (attachments)
      try {
        const ext      = path.extname(req.file.originalname).toLowerCase() || '';
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const dir      = path.resolve(path.join(config.uploads.dir, folder));
        fs.mkdirSync(dir, { recursive: true });
        await fs.promises.writeFile(path.join(dir, filename), req.file.buffer);
        diskUrl = `/uploads/${folder}/${filename}`;
        console.log(`[upload] disk ok: ${diskUrl}`);
      } catch (diskErr: any) {
        console.error('[upload] disk write failed:', diskErr);
        return res.status(500).json({ error: 'Nie można zapisać pliku na dysk' });
      }
    } else {
      // disk storage (images uploaded via uploadImages middleware)
      diskUrl = `/uploads/${folder}/${req.file.filename}`;
    }

    // ── R2 backup w tle (fire-and-forget, nie blokuje odpowiedzi) ─────────────
    // Cel: CDN/deduplication backup. Błędy R2 nie wpływają na odpowiedź.
    // Retry z exponential backoff: 3 próby co 2s, 4s, 8s
    let r2Key: string | null = null;
    let deduplicated = false;

    if (r2Enabled && req.file.buffer) {
      const buf = Buffer.from(req.file.buffer); // capture reference before multer clears it
      const mime = req.file.mimetype;
      const orig = req.file.originalname;
      (async () => {
        const delays = [0, 2000, 4000, 8000];
        for (let attempt = 0; attempt < delays.length; attempt++) {
          if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
          try {
            const result = await uploadToR2(buf, mime, orig);
            r2Key        = result.key;
            deduplicated = result.deduplicated;
            console.log(`[upload] R2 backup ok (attempt ${attempt + 1}): ${result.key}${result.deduplicated ? ' (dedup)' : ''}`);
            return;
          } catch (err: any) {
            if (attempt < delays.length - 1) {
              console.warn(`[upload] R2 attempt ${attempt + 1} failed, retrying: ${err?.message}`);
            } else {
              console.warn(`[upload] R2 backup permanently failed after ${delays.length} attempts: ${err?.message}`);
            }
          }
        }
      })();
    }

    // ── Track quota ────────────────────────────────────────────────────────────
    if (folder === 'attachments') {
      try {
        // Quota update: nie czekamy na R2 wynik (deduplicated może być nieznane)
        await query(
          'UPDATE users SET storage_used_bytes = storage_used_bytes + $1 WHERE id=$2',
          [fileSize, userId]
        );
      } catch (e) {
        console.error('[attachment quota error]', e);
      }
    }

    // ── Odpowiedź: zawsze URL z dysku ─────────────────────────────────────────
    return res.json({ url: diskUrl, r2_key: r2Key, size: fileSize, mime: req.file.mimetype });
  });
});

export default router;
