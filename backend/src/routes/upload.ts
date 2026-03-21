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

// ── Disk storage (fallback / images) ─────────────────────────────────────────
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

// Attachments: memory when R2 enabled (to pipe buffer), disk otherwise
const uploadAttachments = multer({
  storage: r2Enabled ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: config.uploads.maxSize },
  fileFilter: attachmentFilter,
});

// ── POST /api/upload?folder=avatars|banners|servers|emojis (image only) ───────
router.post('/image', authMiddleware, (req: AuthRequest, res: Response, next) => {
  uploadImages.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const folder = (req.query.folder as string) || 'misc';
    return res.json({ url: `/uploads/${folder}/${req.file.filename}` });
  });
});

// ── POST /api/upload?folder=attachments (full files + quota + R2) ─────────────
router.post('/', authMiddleware, (req: AuthRequest, res: Response, next) => {
  const folder = (req.query.folder as string) || 'misc';
  const middleware = folder === 'attachments'
    ? uploadAttachments.single('file')
    : uploadImages.single('file');

  middleware(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId   = req.user!.id;
    const fileSize = req.file.size;

    // ── Quota check ────────────────────────────────────────────────────────
    if (folder === 'attachments') {
      try {
        const { rows: [u] } = await query(
          'SELECT storage_used_bytes, storage_quota_bytes FROM users WHERE id=$1', [userId]
        );
        if (u && (Number(u.storage_used_bytes) + fileSize) > Number(u.storage_quota_bytes)) {
          return res.status(413).json({
            error: 'Przekroczono limit przestrzeni dyskowej',
            used:  Number(u.storage_used_bytes),
            quota: Number(u.storage_quota_bytes),
          });
        }
      } catch { /* quota check failure → allow through */ }
    }

    // ── R2 upload or disk fallback ─────────────────────────────────────────
    let url: string;
    let r2Key: string | null = null;
    let deduplicated = false;

    if (r2Enabled && req.file.buffer) {
      try {
        const result = await uploadToR2(req.file.buffer, req.file.mimetype, req.file.originalname);
        url          = result.url;
        r2Key        = result.key;
        deduplicated = result.deduplicated;
      } catch (uploadErr: any) {
        console.error('[R2 upload error]', uploadErr);
        return res.status(500).json({ error: 'Błąd uploadu do storage: ' + uploadErr.message });
      }
    } else {
      url = `/uploads/${folder}/${req.file.filename}`;
    }

    // ── Track quota + attachment record ────────────────────────────────────
    if (folder === 'attachments') {
      try {
        if (!deduplicated) {
          await query(
            'UPDATE users SET storage_used_bytes = storage_used_bytes + $1 WHERE id=$2',
            [fileSize, userId]
          );
        }
        if (r2Key) {
          await query(
            `INSERT INTO attachments (user_id, r2_key, url, file_size, mime_type, original_name)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
            [userId, r2Key, url, fileSize, req.file.mimetype, req.file.originalname]
          );
        }
      } catch (e) {
        console.error('[attachment tracking error]', e);
      }
    }

    return res.json({ url, r2_key: r2Key, size: fileSize, mime: req.file.mimetype });
  });
});

export default router;
