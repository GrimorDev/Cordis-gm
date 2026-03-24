import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../redis/client';
import { AuthRequest } from '../types';

const store = (prefix: string) => new RedisStore({
  sendCommand: (...args: string[]) => (redis as any).call(...args),
  prefix,
});

// Key by authenticated user ID — one spammer cannot affect others
const byUserId = (req: AuthRequest) => req.user?.id ?? 'anon';

// 8 messages per 5 s — prevents broadcast storm
export { msgLimiter } from './messageLimiter';

// 5 server joins per hour — each join broadcasts member_joined to all
export const joinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Zbyt wiele dołączeń do serwerów, spróbuj za godzinę' },
  keyGenerator: byUserId as any,
  store: store('rl:join:'),
});

// 15 friend requests per hour — prevents mass-request spam
export const friendReqLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { error: 'Zbyt wiele zaproszeń do znajomych, spróbuj za godzinę' },
  keyGenerator: byUserId as any,
  store: store('rl:friend:'),
});

// 5 invite code creations per hour
export const inviteCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Zbyt wiele tworzonych zaproszeń' },
  keyGenerator: byUserId as any,
  store: store('rl:invite:'),
});

// 30 user searches per minute — prevents enumeration/scraping
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Zbyt wiele wyszukiwań, spróbuj za chwilę' },
  keyGenerator: byUserId as any,
  store: store('rl:search:'),
});
