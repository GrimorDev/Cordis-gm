import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { redis } from '../redis/client';
import { generateCode, sendDeletionEmail } from '../services/email';

const router = Router();

// Broadcast user profile update to all servers the user belongs to
async function broadcastUserUpdate(req: AuthRequest, data: any) {
  const io = req.app.get('io');
  if (!io) return;
  const { rows: memberships } = await query(
    'SELECT server_id FROM server_members WHERE user_id = $1', [req.user!.id]
  );
  for (const { server_id } of memberships) {
    io.to(`server:${server_id}`).emit('user_updated', data);
  }
  // Also notify the user's own room (for DM partner info updates)
  io.to(`user:${req.user!.id}`).emit('user_updated', data);
}

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
      `SELECT id,username,avatar_url,banner_url,banner_color,bio,custom_status,status,
              accent_color,compact_messages,
              privacy_status_visible,privacy_typing_visible,privacy_read_receipts,privacy_friend_requests,
              created_at,
              (SELECT COUNT(*)::int FROM (
                SELECT CASE WHEN f.requester_id=$2 THEN f.addressee_id ELSE f.requester_id END as fid
                FROM friends f WHERE (f.requester_id=$2 OR f.addressee_id=$2) AND f.status='accepted'
              ) mf INNER JOIN (
                SELECT CASE WHEN f.requester_id=$1 THEN f.addressee_id ELSE f.requester_id END as fid
                FROM friends f WHERE (f.requester_id=$1 OR f.addressee_id=$1) AND f.status='accepted'
              ) tf ON tf.fid=mf.fid) as mutual_friends_count
       FROM users WHERE id=$1`,
      [req.params.id, req.user!.id]
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
    body('custom_status').optional({ nullable: true }).isLength({ max: 128 }),
    body('banner_color').optional().isLength({ max: 200 }),
    body('banner_url').optional({ nullable: true }).isLength({ max: 500 }),
    body('accent_color').optional().isIn(['indigo','violet','pink','blue','emerald']),
    body('compact_messages').optional().isBoolean(),
    body('privacy_status_visible').optional().isBoolean(),
    body('privacy_typing_visible').optional().isBoolean(),
    body('privacy_read_receipts').optional().isBoolean(),
    body('privacy_friend_requests').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      username, bio, custom_status, banner_color, banner_url,
      accent_color, compact_messages,
      privacy_status_visible, privacy_typing_visible, privacy_read_receipts, privacy_friend_requests,
    } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (username              !== undefined) { updates.push(`username=$${idx++}`);              values.push(username); }
    if (bio                   !== undefined) { updates.push(`bio=$${idx++}`);                   values.push(bio); }
    if (custom_status         !== undefined) { updates.push(`custom_status=$${idx++}`);         values.push(custom_status); }
    if (banner_color          !== undefined) { updates.push(`banner_color=$${idx++}`);          values.push(banner_color); }
    if (banner_url            !== undefined) { updates.push(`banner_url=$${idx++}`);            values.push(banner_url); }
    if (accent_color          !== undefined) { updates.push(`accent_color=$${idx++}`);          values.push(accent_color); }
    if (compact_messages      !== undefined) { updates.push(`compact_messages=$${idx++}`);      values.push(compact_messages); }
    if (privacy_status_visible  !== undefined) { updates.push(`privacy_status_visible=$${idx++}`);  values.push(privacy_status_visible); }
    if (privacy_typing_visible  !== undefined) { updates.push(`privacy_typing_visible=$${idx++}`);  values.push(privacy_typing_visible); }
    if (privacy_read_receipts   !== undefined) { updates.push(`privacy_read_receipts=$${idx++}`);   values.push(privacy_read_receipts); }
    if (privacy_friend_requests !== undefined) { updates.push(`privacy_friend_requests=$${idx++}`); values.push(privacy_friend_requests); }
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
         RETURNING id,username,email,avatar_url,banner_url,banner_color,bio,custom_status,status,
                   accent_color,compact_messages,
                   privacy_status_visible,privacy_typing_visible,privacy_read_receipts,privacy_friend_requests`,
        values
      );
      await broadcastUserUpdate(req, { id: rows[0].id, username: rows[0].username, avatar_url: rows[0].avatar_url, custom_status: rows[0].custom_status });
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
    const { rows: [u] } = await query('UPDATE users SET avatar_url=$1 WHERE id=$2 RETURNING id,username,avatar_url,custom_status', [avatarUrl, req.user!.id]);
    await broadcastUserUpdate(req, u);
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

// POST /api/users/me/request-deletion  — send 7-char deletion code to user's email
router.post('/me/request-deletion', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [u] } = await query('SELECT id,email FROM users WHERE id=$1', [req.user!.id]);
    if (!u) return res.status(404).json({ error: 'User not found' });

    const code = generateCode(); // format XX-XXX-XXX  (8 visible chars with dashes)
    const redisKey = `deletion:${req.user!.id}`;
    await redis.setex(redisKey, 15 * 60, code); // 15 min TTL

    await sendDeletionEmail(u.email, code);
    return res.json({ message: 'Kod wysłany na Twój adres e-mail' });
  } catch (err) {
    console.error('request-deletion error:', err);
    return res.status(500).json({ error: 'Nie udało się wysłać kodu — spróbuj ponownie' });
  }
});

// DELETE /api/users/me  — confirm deletion with code, then delete account
router.delete('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Brak kodu' });

  try {
    const redisKey = `deletion:${req.user!.id}`;
    const stored = await redis.get(redisKey);
    if (!stored) return res.status(400).json({ error: 'Kod wygasł lub nie był wygenerowany' });
    if (stored.trim().toLowerCase() !== code.trim().toLowerCase())
      return res.status(400).json({ error: 'Nieprawidłowy kod' });

    // Delete the code so it can't be reused
    await redis.del(redisKey);

    // Cascade delete — all FK references have ON DELETE CASCADE so this covers everything
    await query('DELETE FROM users WHERE id=$1', [req.user!.id]);

    return res.json({ message: 'Konto zostało usunięte' });
  } catch (err) {
    console.error('delete-account error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
