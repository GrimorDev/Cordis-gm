import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { query } from '../db/pool';
import { saveUploadedFile } from '../services/storage';

const router = Router();

// ── MIME types allowed ────────────────────────────────────────────────────────
const ALLOWED_ATTACHMENT_MIMES = new Set([
  // images (SVG excluded — it's HTML and can execute scripts when opened directly)
  'image/jpeg','image/png','image/gif','image/webp','image/bmp','image/avif',
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

// ── Memory storage — handlers save via saveUploadedFile (R2 primary, disk fallback) ──
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageOnlyFilter,
});

const uploadAttachments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 600 * 1024 * 1024 }, // 600MB max (Cordyn Power)
  fileFilter: attachmentFilter,
});

// ── POST /api/upload/image?folder=avatars|banners|servers|emojis ──────────────
router.post('/image', authMiddleware, (req: AuthRequest, res: Response) => {
  uploadImages.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const folder = (req.query.folder as string) || 'misc';
    const { url } = await saveUploadedFile(req.file.buffer, req.file.mimetype, req.file.originalname, folder);
    return res.json({ url });
  });
});

// ── POST /api/upload?folder=attachments|avatars|emojis|servers ───────────────
// R2 primary (when configured) — VPS dysk ma tylko 75GB i służy jako fallback
// (lokalny dev bez credentiali R2, albo gdy konkretny upload do R2 się nie powiedzie).
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
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

    const { url, r2Key } = await saveUploadedFile(req.file.buffer, req.file.mimetype, req.file.originalname, folder);

    // ── Track quota ────────────────────────────────────────────────────────────
    if (folder === 'attachments') {
      try {
        await query(
          'UPDATE users SET storage_used_bytes = storage_used_bytes + $1 WHERE id=$2',
          [fileSize, userId]
        );
      } catch (e) {
        console.error('[attachment quota error]', e);
      }
    }

    return res.json({ url, r2_key: r2Key, size: fileSize, mime: req.file.mimetype });
  });
});

export default router;
