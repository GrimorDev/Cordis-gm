import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { redis } from '../redis/client';
import { generateCode, sendDeletionEmail } from '../services/email';
import {
  generateTotpSecret, generateQrCode, verifyTotpCode,
  generateBackupCodes, hashBackupCodes, verifyBackupCode,
} from '../services/totp';
import { searchLimiter } from '../middleware/userRateLimits';

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
      `SELECT u.id, u.username, u.avatar_url, u.banner_url, u.banner_color, u.bio, u.custom_status, u.avatar_effect, u.card_effect, u.card_color, u.card_font,
              CASE WHEN u.privacy_status_visible=FALSE AND u.id!=$2 THEN 'offline' ELSE u.status END as status,
              u.accent_color, u.compact_messages,
              u.privacy_status_visible, u.privacy_typing_visible, u.privacy_read_receipts, u.privacy_friend_requests,
              u.created_at,
              COALESCE(
                (SELECT json_agg(json_build_object('id', gb.id, 'name', gb.name, 'label', gb.label, 'color', gb.color, 'icon', gb.icon) ORDER BY gb.position)
                 FROM user_badges ub INNER JOIN global_badges gb ON gb.id = ub.badge_id WHERE ub.user_id = u.id),
                '[]'::json
              ) as badges,
              (SELECT COUNT(*)::int FROM (
                SELECT CASE WHEN f.requester_id=$2 THEN f.addressee_id ELSE f.requester_id END as fid
                FROM friends f WHERE (f.requester_id=$2 OR f.addressee_id=$2) AND f.status='accepted'
              ) mf INNER JOIN (
                SELECT CASE WHEN f.requester_id=$1 THEN f.addressee_id ELSE f.requester_id END as fid
                FROM friends f WHERE (f.requester_id=$1 OR f.addressee_id=$1) AND f.status='accepted'
              ) tf ON tf.fid=mf.fid) as mutual_friends_count
       FROM users u WHERE u.id=$1`,
      [req.params.id, req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/users/search/query?q=
router.get('/search/query', authMiddleware, searchLimiter, async (req: AuthRequest, res: Response) => {
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
    body('accent_color').optional().isIn(['indigo','violet','pink','blue','emerald','amber','orange','rose','teal','cyan']),
    body('compact_messages').optional().isBoolean(),
    body('voice_noise_cancel').optional().isBoolean(),
    body('font_size').optional().isIn(['small','normal','large']),
    body('show_timestamps').optional().isBoolean(),
    body('show_chat_avatars').optional().isBoolean(),
    body('message_animations').optional().isBoolean(),
    body('show_link_previews').optional().isBoolean(),
    body('privacy_status_visible').optional().isBoolean(),
    body('privacy_typing_visible').optional().isBoolean(),
    body('privacy_read_receipts').optional().isBoolean(),
    body('privacy_friend_requests').optional().isBoolean(),
    body('privacy_dm_from_strangers').optional().isBoolean(),
    body('avatar_effect').optional().isIn(['none','glow','pulse','rainbow','neon','vortex-cw','portal','quantum','glitch','scan','katana','liquid-morph','radar-sweep','vhs','toxic-slime','sakura','demon','neon-cat','magic-aura','level-up','super-aura','crazy-eyes','hacker-smile','angelic-wings','arcade-coin']),
    body('card_effect').optional().isIn(['none','fire','hologram','rainbow','aurora','smoke','ink','teleport','matrix','vortex','glitch','lava','ice']),
    body('card_color').optional().isIn(['default','slate','midnight','crimson','forest','ocean','neon','copper','violet','teal','charcoal','olive','rose','white','sky','lavender','cream','coral','mint','sand']),
    body('card_font').optional().isIn(['default','mono','serif','nunito','raleway','josefin','exo','ubuntu','pixel','orbitron','bebas','cinzel','playfair','caveat','dancing','pacifico','righteous','comic']),
    body('theme_id').optional().isIn(['default','midnight','amoled','forest','sakura','sunset']),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const {
      username, bio, custom_status, banner_color, banner_url,
      accent_color, compact_messages, voice_noise_cancel,
      font_size, show_timestamps, show_chat_avatars, message_animations, show_link_previews,
      privacy_status_visible, privacy_typing_visible, privacy_read_receipts, privacy_friend_requests,
      privacy_dm_from_strangers, avatar_effect, card_effect, card_color, card_font, theme_id,
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
    if (voice_noise_cancel    !== undefined) { updates.push(`voice_noise_cancel=$${idx++}`);    values.push(voice_noise_cancel); }
    if (font_size             !== undefined) { updates.push(`font_size=$${idx++}`);             values.push(font_size); }
    if (show_timestamps       !== undefined) { updates.push(`show_timestamps=$${idx++}`);       values.push(show_timestamps); }
    if (show_chat_avatars     !== undefined) { updates.push(`show_chat_avatars=$${idx++}`);     values.push(show_chat_avatars); }
    if (message_animations    !== undefined) { updates.push(`message_animations=$${idx++}`);    values.push(message_animations); }
    if (show_link_previews    !== undefined) { updates.push(`show_link_previews=$${idx++}`);    values.push(show_link_previews); }
    if (privacy_status_visible    !== undefined) { updates.push(`privacy_status_visible=$${idx++}`);    values.push(privacy_status_visible); }
    if (privacy_typing_visible    !== undefined) { updates.push(`privacy_typing_visible=$${idx++}`);    values.push(privacy_typing_visible); }
    if (privacy_read_receipts     !== undefined) { updates.push(`privacy_read_receipts=$${idx++}`);     values.push(privacy_read_receipts); }
    if (privacy_friend_requests   !== undefined) { updates.push(`privacy_friend_requests=$${idx++}`);   values.push(privacy_friend_requests); }
    if (privacy_dm_from_strangers !== undefined) { updates.push(`privacy_dm_from_strangers=$${idx++}`); values.push(privacy_dm_from_strangers); }
    if (avatar_effect             !== undefined) { updates.push(`avatar_effect=$${idx++}`);             values.push(avatar_effect); }
    if (card_effect               !== undefined) { updates.push(`card_effect=$${idx++}`);               values.push(card_effect); }
    if (card_color                !== undefined) { updates.push(`card_color=$${idx++}`);                values.push(card_color); }
    if (card_font                 !== undefined) { updates.push(`card_font=$${idx++}`);                 values.push(card_font); }
    if (theme_id                  !== undefined) { updates.push(`theme_id=$${idx++}`);                  values.push(theme_id); }
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
                   accent_color,compact_messages,voice_noise_cancel,
                   font_size,show_timestamps,show_chat_avatars,message_animations,show_link_previews,
                   privacy_status_visible,privacy_typing_visible,privacy_read_receipts,
                   privacy_friend_requests,privacy_dm_from_strangers,avatar_effect,card_effect,card_color,card_font,theme_id`,
        values
      );
      await broadcastUserUpdate(req, { id: rows[0].id, username: rows[0].username, avatar_url: rows[0].avatar_url, banner_url: rows[0].banner_url, banner_color: rows[0].banner_color, bio: rows[0].bio, custom_status: rows[0].custom_status, privacy_read_receipts: rows[0].privacy_read_receipts, avatar_effect: rows[0].avatar_effect });
      return res.json(rows[0]);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// PUT /api/users/me/status
router.put('/me/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { status, duration_ms } = req.body;
  if (!['online','idle','dnd','offline'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    // status_until: null = permanent; number = expires after duration_ms ms
    const statusUntil = (duration_ms && duration_ms > 0 && status !== 'online')
      ? new Date(Date.now() + duration_ms).toISOString()
      : null;
    // Save both current status and preferred_status so restarts remember the choice
    await query(
      'UPDATE users SET status=$1, preferred_status=$1, status_until=$2 WHERE id=$3',
      [status, statusUntil, req.user!.id]
    );
    // Broadcast real-time status change to all servers the user belongs to
    const io = req.app.get('io');
    if (io) {
      const { rows: memberships } = await query(
        'SELECT server_id FROM server_members WHERE user_id=$1', [req.user!.id]
      );
      const payload = { user_id: req.user!.id, status };
      for (const { server_id } of memberships) {
        io.to(`server:${server_id}`).emit('user_status', payload);
      }
      // Also push to friends listening on their own user room
      io.to(`user:${req.user!.id}`).emit('user_status', payload);
    }
    return res.json({ status, status_until: statusUntil });
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
    const { rows: [u] } = await query(
      'UPDATE users SET banner_url=$1 WHERE id=$2 RETURNING id,username,avatar_url,banner_url,banner_color,bio,custom_status',
      [bannerUrl, req.user!.id]
    );
    await broadcastUserUpdate(req, { id: u.id, username: u.username, avatar_url: u.avatar_url, banner_url: u.banner_url, banner_color: u.banner_color, bio: u.bio, custom_status: u.custom_status });
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

// ── Two-Factor Authentication (2FA) ──────────────────────────────────────────

// GET /api/users/me/2fa/status
router.get('/me/2fa/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT totp_enabled, totp_backup_codes, phone_number, phone_verified FROM users WHERE id = $1',
      [req.user!.id]
    );
    const u = rows[0];
    return res.json({
      totp_enabled: u?.totp_enabled || false,
      backup_codes_count: (u?.totp_backup_codes || []).length,
      phone_number: u?.phone_number || null,
      phone_verified: u?.phone_verified || false,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/me/2fa/totp/setup — generate TOTP secret + QR code
router.post('/me/2fa/totp/setup', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query('SELECT username FROM users WHERE id = $1', [req.user!.id]);
    const username = rows[0]?.username;
    const { secret, otpauth_url } = generateTotpSecret(username);
    const qr_code = await generateQrCode(otpauth_url);
    // Store pending secret in Redis (5 min) until user confirms
    await redis.setex(`2fa:setup:${req.user!.id}`, 300, secret);
    return res.json({ secret, qr_code, manual_key: secret });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/me/2fa/totp/enable — verify code and activate TOTP
router.post(
  '/me/2fa/totp/enable',
  authMiddleware,
  [body('code').trim().isLength({ min: 6, max: 6 }).isNumeric()],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Podaj 6-cyfrowy kod z aplikacji' });

    const { code } = req.body;
    try {
      const secret = await redis.get(`2fa:setup:${req.user!.id}`);
      if (!secret) return res.status(400).json({ error: 'Sesja konfiguracji wygasła. Rozpocznij od nowa.' });

      if (!verifyTotpCode(secret, code)) {
        return res.status(400).json({ error: 'Nieprawidłowy kod. Sprawdź czas w aplikacji i spróbuj ponownie.' });
      }

      const rawCodes = generateBackupCodes();
      const hashedCodes = await hashBackupCodes(rawCodes);

      await query(
        'UPDATE users SET totp_secret = $1, totp_enabled = TRUE, totp_backup_codes = $2 WHERE id = $3',
        [secret, hashedCodes, req.user!.id]
      );
      await redis.del(`2fa:setup:${req.user!.id}`);

      return res.json({ backup_codes: rawCodes });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/users/me/2fa/totp — disable TOTP (requires password + current code)
router.delete(
  '/me/2fa/totp',
  authMiddleware,
  [body('password').notEmpty(), body('code').trim().isLength({ min: 6, max: 6 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Wymagane hasło i kod 2FA' });

    const { password, code } = req.body;
    try {
      const { rows } = await query(
        'SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id = $1',
        [req.user!.id]
      );
      if (!rows[0]?.totp_enabled) return res.status(400).json({ error: '2FA nie jest włączone' });

      const validPass = await bcrypt.compare(password, rows[0].password_hash);
      if (!validPass) return res.status(401).json({ error: 'Nieprawidłowe hasło' });

      if (!verifyTotpCode(rows[0].totp_secret, code)) {
        return res.status(401).json({ error: 'Nieprawidłowy kod weryfikacyjny' });
      }

      await query(
        'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, totp_backup_codes = ARRAY[]::TEXT[] WHERE id = $1',
        [req.user!.id]
      );
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/users/me/2fa/backup-codes/regenerate
router.post(
  '/me/2fa/backup-codes/regenerate',
  authMiddleware,
  [body('password').notEmpty(), body('code').trim().isLength({ min: 6, max: 6 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Wymagane hasło i kod 2FA' });

    const { password, code } = req.body;
    try {
      const { rows } = await query(
        'SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id = $1',
        [req.user!.id]
      );
      if (!rows[0]?.totp_enabled) return res.status(400).json({ error: '2FA nie jest włączone' });

      const validPass = await bcrypt.compare(password, rows[0].password_hash);
      if (!validPass) return res.status(401).json({ error: 'Nieprawidłowe hasło' });

      if (!verifyTotpCode(rows[0].totp_secret, code)) {
        return res.status(401).json({ error: 'Nieprawidłowy kod weryfikacyjny' });
      }

      const rawCodes = generateBackupCodes();
      const hashedCodes = await hashBackupCodes(rawCodes);

      await query(
        'UPDATE users SET totp_backup_codes = $1 WHERE id = $2',
        [hashedCodes, req.user!.id]
      );
      return res.json({ backup_codes: rawCodes });
    } catch (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── Active tag ───────────────────────────────────────────────────────────────

// PUT /api/users/me/active-tag — set or clear the user's displayed tag
// body: { server_id: string | null }
router.put('/me/active-tag', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { server_id } = req.body as { server_id: string | null };
  try {
    if (server_id) {
      // Verify user is a member of that server AND the server has a tag
      const { rowCount } = await query(
        `SELECT 1 FROM server_members sm
         INNER JOIN server_tags st ON st.server_id = sm.server_id
         WHERE sm.server_id = $1 AND sm.user_id = $2`,
        [server_id, req.user!.id]
      );
      if (!rowCount) return res.status(400).json({ error: 'Server not found, no tag, or not a member' });
    }
    await query('UPDATE users SET active_tag_server_id = $1 WHERE id = $2', [server_id || null, req.user!.id]);

    // Fetch resulting tag text so we can broadcast it
    let tag: string | null = null;
    if (server_id) {
      const { rows: [row] } = await query('SELECT tag FROM server_tags WHERE server_id = $1', [server_id]);
      tag = row?.tag || null;
    }

    // Broadcast updated tag to all servers the user belongs to
    await broadcastUserUpdate(req, {
      id: req.user!.id,
      active_tag_server_id: server_id || null,
      active_tag: tag,  // null when removing
    });

    return res.json({ active_tag_server_id: server_id, tag });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Mutual Servers ──────────────────────────────────────────────────────────
// GET /api/users/:id/mutual-servers
router.get('/:id/mutual-servers', authMiddleware, async (req: AuthRequest, res) => {
  const viewerId  = req.user!.id;
  const targetId  = req.params.id;
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.icon_url, s.description, s.is_official
       FROM servers s
       JOIN server_members a ON a.server_id = s.id AND a.user_id = $1
       JOIN server_members b ON b.server_id = s.id AND b.user_id = $2`,
      [viewerId, targetId]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Channel Notification Prefs ──────────────────────────────────────────────
// GET /api/users/me/channel-prefs
router.get('/me/channel-prefs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { rows } = await query(
      `SELECT channel_id, notifications, muted FROM user_channel_prefs WHERE user_id = $1`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/users/me/channel-prefs/:channelId
router.put('/me/channel-prefs/:channelId', authMiddleware, async (req: AuthRequest, res) => {
  const { channelId } = req.params;
  const { notifications, muted } = req.body;
  try {
    const { rows } = await query(
      `INSERT INTO user_channel_prefs (user_id, channel_id, notifications, muted)
       VALUES ($1, $2, COALESCE($3, 'default'), COALESCE($4, false))
       ON CONFLICT (user_id, channel_id) DO UPDATE SET
         notifications = COALESCE($3, user_channel_prefs.notifications),
         muted = COALESCE($4, user_channel_prefs.muted)
       RETURNING *`,
      [req.user!.id, channelId, notifications, muted]
    );
    return res.json(rows[0]);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
