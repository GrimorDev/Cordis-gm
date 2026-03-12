import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../redis/client';
import { AuthRequest } from '../types';

const redisStore = (prefix: string) => new RedisStore({
  sendCommand: (...args: string[]) => (redis as any).call(...args),
  prefix,
});

// Per-user message rate limit: max 8 messages per 5 seconds.
// Keyed by authenticated user ID so one spammer cannot affect others.
export const msgLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Wysyłasz zbyt szybko, zwolnij' },
  keyGenerator: (req) => (req as AuthRequest).user?.id ?? 'anon',
  store: redisStore('rl:msg:'),
});
