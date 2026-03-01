import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const router = Router();

function makeUpload(folder: string) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(config.uploads.dir, folder);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
  return multer({ storage, limits: { fileSize: config.uploads.maxSize },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) cb(new Error('Only images allowed'));
      else cb(null, true);
    },
  });
}

const avatarUpload = makeUpload('avatars');
const bannerUpload = makeUpload('banners');

// GET /api/users/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT id,username,avatar_url,banner_url,banner_color,bio,custom_status,status,created_at FROM users WHERE id=$1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/users/search/query?q=
router.get('/search/query', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    const { rows } = await query(
      'SELECT id,username,avatar_url,status,custom_status FROM users WHERE username ILIKE $1 AND id!=$2 ORDER BY username LIMIT 20',
      [`%${q}%`, req.user!.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/users/me
router.put('/me', authMiddleware,
  [
    body('username').optional().trim().isLength({ min: 2, max: 32 }).matches(/^[a-zA-Z0-9_]+$/),
    body('bio').optional().isLength({ max: 500 }),
    body('custom_status').optional().isLength({ max: 128 }),
    body('banner_color').optional().isLength({ max: 200 }),
    body('banner_url').optional().isLength({ max: 500 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { username, bio, custom_status, banner_color, banner_url } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (username    !== undefined) { updates.push(`username=$${idx++}`);     values.push(username); }
    if (bio         !== undefined) { updates.push(`bio=$${idx++}`);          values.push(bio); }
    if (custom_status !== undefined) { updates.push(`custom_status=$${idx++}`); values.push(custom_status); }
    if (banner_color !== undefined) { updates.push(`banner_color=$${idx++}`); values.push(banner_color); }
    if (banner_url  !== undefined) { updates.push(`banner_url=$${idx++}`);   values.push(banner_url); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    updates.push(`updated_at=NOW()`);
    values.push(req.user!.id);
    try {
      if (username) {
        const ex = await query('SELECT id FROM users WHERE username=$1 AND id!=$2', [username, req.user!.id]);
        if (ex.rowCount! > 0) return res.status(409).json({ error: 'Username already taken' });
      }
      const { rows } = await query(
        `UPDATE users SET ${updates.join(',')} WHERE id=$${idx}
         RETURNING id,username,email,avatar_url,banner_url,banner_color,bio,custom_status,status`,
        values
      );
      return res.json(rows[0]);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// PUT /api/users/me/status
router.put('/me/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!['online','idle','dnd','offline'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await query('UPDATE users SET status=$1 WHERE id=$2', [status, req.user!.id]);
    return res.json({ status });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/users/me/avatar
router.post('/me/avatar', authMiddleware, avatarUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  try {
    await query('UPDATE users SET avatar_url=$1 WHERE id=$2', [avatarUrl, req.user!.id]);
    return res.json({ avatar_url: avatarUrl });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/users/me/banner
router.post('/me/banner', authMiddleware, bannerUpload.single('banner'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const bannerUrl = `/uploads/banners/${req.file.filename}`;
  try {
    await query('UPDATE users SET banner_url=$1 WHERE id=$2', [bannerUrl, req.user!.id]);
    return res.json({ banner_url: bannerUrl });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
