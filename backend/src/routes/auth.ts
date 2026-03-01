import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { redis, KEYS, setUserStatus } from '../redis/client';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const signToken = (payload: { id: string; username: string; email: string }) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as any);

// POST /api/auth/register
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 2, max: 32 }).matches(/^[a-zA-Z0-9_]+$/),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6, max: 128 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;

    try {
      const existing = await query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      if (existing.rowCount! > 0) {
        return res.status(409).json({ error: 'Username or email already taken' });
      }

      const password_hash = await bcrypt.hash(password, 12);
      const { rows } = await query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, avatar_url, banner_url, banner_color, bio, custom_status, status,
                   accent_color, compact_messages,
                   privacy_status_visible, privacy_typing_visible, privacy_read_receipts, privacy_friend_requests,
                   created_at`,
        [username, email, password_hash]
      );

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
      `SELECT id, username, email, avatar_url, banner_url, banner_color, bio, custom_status, status,
              accent_color, compact_messages,
              privacy_status_visible, privacy_typing_visible, privacy_read_receipts, privacy_friend_requests,
              created_at
       FROM users WHERE id = $1`,
      [req.user!.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
