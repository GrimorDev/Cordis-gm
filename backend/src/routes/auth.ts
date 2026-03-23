import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/pool';
import { redis, KEYS, setUserStatus } from '../redis/client';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { generateCode, sendVerificationEmail } from '../services/email';
import { verifyTotpCode, verifyBackupCode } from '../services/totp';

const router = Router();

const signToken = (payload: { id: string; username: string; email: string }) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as any);

// POST /api/auth/send-code — send email verification code
router.post(
  '/send-code',
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Podaj prawidłowy adres email' });

    const { email } = req.body;

    try {
      // Don't allow sending code if email already registered
      const taken = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (taken.rowCount! > 0) {
        return res.status(409).json({ error: 'Ten adres email jest już zajęty' });
      }

      // Rate-limit: max 3 codes per email in last 10 minutes
      const recent = await query(
        `SELECT COUNT(*) FROM email_verifications
         WHERE email = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
        [email]
      );
      if (parseInt(recent.rows[0].count) >= 3) {
        return res.status(429).json({ error: 'Zbyt wiele prób. Poczekaj chwilę przed wysłaniem nowego kodu.' });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await query(
        'INSERT INTO email_verifications (email, code, expires_at) VALUES ($1, $2, $3)',
        [email, code, expiresAt]
      );

      await sendVerificationEmail(email, code);

      return res.json({ message: 'Kod weryfikacyjny wysłany na podany adres email' });
    } catch (err) {
      console.error('Send-code error:', err);
      return res.status(500).json({ error: 'Nie udało się wysłać kodu. Sprawdź adres email i spróbuj ponownie.' });
    }
  }
);

// POST /api/auth/register
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 2, max: 32 }).matches(/^[a-zA-Z0-9_]+$/),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6, max: 128 }),
    body('code').trim().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password, code } = req.body;

    try {
      // Verify the code
      const { rows: codeRows } = await query(
        `SELECT id FROM email_verifications
         WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [email, code]
      );

      if (!codeRows[0]) {
        return res.status(400).json({ error: 'Nieprawidłowy lub wygasły kod weryfikacyjny' });
      }

      const codeId = codeRows[0].id;

      const existing = await query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      if (existing.rowCount! > 0) {
        return res.status(409).json({ error: 'Nazwa użytkownika lub email jest już zajęty' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const { rows } = await query(
        `INSERT INTO users (username, email, password_hash, email_verified)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, username, email, avatar_url, banner_url, banner_color, bio, custom_status, status,
                   accent_color, compact_messages,
                   privacy_status_visible, privacy_typing_visible, privacy_read_receipts, privacy_friend_requests,
                   created_at`,
        [username, email, password_hash]
      );

      // Mark code as used
      await query('UPDATE email_verifications SET used = TRUE WHERE id = $1', [codeId]);

      const user = rows[0];
      const token = signToken({ id: user.id, username: user.username, email: user.email });
      await setUserStatus(user.id, 'online');

      return res.status(201).json({ token, user });
    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('login').trim().notEmpty(), // username or email
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { login, password } = req.body;

    try {
      const { rows } = await query(
        `SELECT id, username, email, password_hash, avatar_url, banner_url, banner_color, bio, custom_status, status,
                accent_color, compact_messages,
                privacy_status_visible, privacy_typing_visible, privacy_read_receipts, privacy_friend_requests
         FROM users WHERE username = $1 OR email = $1`,
        [login]
      );

      if (!rows[0]) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      // Check platform-wide ban
      const { rows: bans } = await query(
        `SELECT reason, ban_type, banned_until FROM user_bans
         WHERE user_id=$1 AND is_active=TRUE
           AND (banned_until IS NULL OR banned_until > NOW())
         LIMIT 1`,
        [user.id]
      );
      if (bans[0]) {
        const b = bans[0];
        const msg = b.ban_type === 'temporary' && b.banned_until
          ? `Twoje konto jest zawieszone do ${new Date(b.banned_until).toLocaleString('pl-PL')}. Powód: ${b.reason || 'brak'}`
          : `Twoje konto zostało zbanowane. Powód: ${b.reason || 'brak'}`;
        return res.status(403).json({ error: msg });
      }

      // Check if 2FA is enabled
      const { rows: settingsRows } = await query(
        'SELECT totp_enabled FROM users WHERE id = $1', [user.id]
      );
      if (settingsRows[0]?.totp_enabled) {
        const sessionId = uuidv4();
        await redis.setex(`2fa:pending:${sessionId}`, 300, user.id); // 5 min TTL
        return res.json({ requiresTwoFactor: true, sessionId });
      }

      const token = signToken({ id: user.id, username: user.username, email: user.email });
      await setUserStatus(user.id, 'online');
      await query('UPDATE users SET status = $1 WHERE id = $2', ['online', user.id]);

      const { password_hash: _, ...safeUser } = user;
      return res.json({ token, user: safeUser });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/2fa-verify
router.post(
  '/2fa-verify',
  [body('sessionId').notEmpty(), body('code').trim().notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Nieprawidłowe dane' });

    const { sessionId, code, type = 'totp' } = req.body;

    try {
      const userId = await redis.get(`2fa:pending:${sessionId}`);
      if (!userId) return res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });

      const { rows } = await query(
        `SELECT id, username, email, password_hash, avatar_url, banner_url, banner_color, bio, custom_status, status,
                accent_color, compact_messages, totp_secret, totp_backup_codes,
                privacy_status_visible, privacy_typing_visible, privacy_read_receipts, privacy_friend_requests
         FROM users WHERE id = $1`,
        [userId]
      );
      if (!rows[0]) return res.status(401).json({ error: 'Użytkownik nie istnieje' });

      const user = rows[0];

      if (type === 'backup') {
        const normalizedCode = code.toUpperCase().replace(/[^A-F0-9-]/g, '');
        const idx = await verifyBackupCode(normalizedCode, user.totp_backup_codes || []);
        if (idx === null) return res.status(401).json({ error: 'Nieprawidłowy kod zapasowy' });
        // Remove used backup code
        const newCodes = [...(user.totp_backup_codes || [])];
        newCodes.splice(idx, 1);
        await query('UPDATE users SET totp_backup_codes = $1 WHERE id = $2', [newCodes, userId]);
      } else {
        if (!verifyTotpCode(user.totp_secret, code)) {
          return res.status(401).json({ error: 'Nieprawidłowy kod weryfikacyjny' });
        }
      }

      await redis.del(`2fa:pending:${sessionId}`);

      // Check ban
      const { rows: bans } = await query(
        `SELECT reason, ban_type, banned_until FROM user_bans
         WHERE user_id=$1 AND is_active=TRUE
           AND (banned_until IS NULL OR banned_until > NOW())
         LIMIT 1`,
        [userId]
      );
      if (bans[0]) {
        const b = bans[0];
        const msg = b.ban_type === 'temporary' && b.banned_until
          ? `Twoje konto jest zawieszone do ${new Date(b.banned_until).toLocaleString('pl-PL')}. Powód: ${b.reason || 'brak'}`
          : `Twoje konto zostało zbanowane. Powód: ${b.reason || 'brak'}`;
        return res.status(403).json({ error: msg });
      }

      const token = signToken({ id: user.id, username: user.username, email: user.email });
      await setUserStatus(userId, 'online');
      await query('UPDATE users SET status = $1 WHERE id = $2', ['online', userId]);

      const { password_hash: _, totp_secret: __, totp_backup_codes: ___, ...safeUser } = user;
      return res.json({ token, user: safeUser });
    } catch (err) {
      console.error('2fa-verify error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'Podaj obecne i nowe hasło (min. 8 znaków)' });
  try {
    const { rows: [user] } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user!.id]);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(403).json({ error: 'Nieprawidłowe obecne hasło' });
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user!.id]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization!.slice(7);
  // Blacklist token until it expires
  try {
    const decoded = jwt.decode(token) as any;
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
    if (ttl > 0) {
      await redis.setex(KEYS.blacklistToken(token.slice(-20)), ttl, '1');
    }
    await setUserStatus(req.user!.id, 'offline');
    await query('UPDATE users SET status = $1 WHERE id = $2', ['offline', req.user!.id]);
    return res.json({ message: 'Logged out' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.banner_url, u.banner_color, u.bio, u.custom_status, u.status, u.preferred_status,
              u.accent_color, u.compact_messages, u.voice_noise_cancel,
              u.font_size, u.show_timestamps, u.show_chat_avatars, u.message_animations, u.show_link_previews,
              u.privacy_status_visible, u.privacy_typing_visible, u.privacy_read_receipts,
              u.privacy_friend_requests, u.privacy_dm_from_strangers, u.avatar_effect, u.is_admin,
              u.active_tag_server_id, st.tag as active_tag, u.theme_id,
              u.created_at,
              COALESCE(
                (SELECT json_agg(json_build_object('id', gb.id, 'name', gb.name, 'label', gb.label, 'color', gb.color, 'icon', gb.icon) ORDER BY gb.position)
                 FROM user_badges ub INNER JOIN global_badges gb ON gb.id = ub.badge_id WHERE ub.user_id = u.id),
                '[]'::json
              ) as badges
       FROM users u
       LEFT JOIN server_tags st ON st.server_id = u.active_tag_server_id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
