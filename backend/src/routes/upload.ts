import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const storage = multer.diskStorage({
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

// MIME types allowed for attachments (images + audio + video + docs + archives + code)
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
  // archives — browsers send many different MIME variants for same format
  'application/zip','application/x-zip','application/x-zip-compressed',
  'application/x-rar-compressed','application/vnd.rar','application/x-7z-compressed',
  'application/x-tar','application/gzip','application/x-gzip','application/x-bzip2','application/x-xz',
  // octet-stream fallback (used for unknown/binary files incl. zips on some OSes)
  'application/octet-stream',
]);

const imageOnlyFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) cb(new Error('Only images allowed'));
  else cb(null, true);
};

const attachmentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  // Allow by MIME or by extension for text/code files (browsers often send application/octet-stream)
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const codeExts = new Set(['js','jsx','ts','tsx','html','htm','css','scss','sass','less',
    'json','xml','yaml','yml','toml','ini','env','php','py','rb','rs','go','java','c','cpp',
    'cs','sh','bash','zsh','ps1','sql','graphql','md','mdx','vue','svelte','kt','swift',
    'dart','r','lua','ex','exs','txt','log','csv','tsv','conf','cfg','nfo','readme']);
  if (ALLOWED_ATTACHMENT_MIMES.has(file.mimetype) || codeExts.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Typ pliku nieobsługiwany: ${file.mimetype} (.${ext})`));
  }
};

const uploadImages = multer({
  storage,
  limits: { fileSize: config.uploads.maxSize },
  fileFilter: imageOnlyFilter,
});

const uploadAttachments = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for attachments
  fileFilter: attachmentFilter,
});

// POST /api/upload?folder=avatars|banners|servers|attachments|emojis
router.post('/', authMiddleware, (req: AuthRequest, res: Response, next) => {
  const folder = (req.query.folder as string) || 'misc';
  const middleware = folder === 'attachments'
    ? uploadAttachments.single('file')
    : uploadImages.single('file');
  middleware(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${folder}/${req.file.filename}`;
    return res.json({ url });
  });
});

export default router;
