import { Router } from 'express';
import { v1AuthMiddleware } from '../../middleware/botAuth';
import usersRouter from './users';
import guildsRouter from './guilds';
import channelsRouter from './channels';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../../redis/client';

const router = Router();

// Rate limiter for v1 API - per application_id
const v1Limiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You are being rate limited.', retry_after: 1, global: false, code: 20029 },
  keyGenerator: (req) => {
    const p = (req as any).v1Principal;
    return p ? `v1:${p.type === 'bot' ? p.applicationId : p.applicationId}` : req.ip || 'unknown';
  },
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redis as any).call(...args),
    prefix: 'rl:v1:',
  }),
  skip: (req) => {
    const p = (req as any).v1Principal;
    return p?.type === 'bot'; // apply rate limit after auth
  },
});

router.use(v1AuthMiddleware);
router.use(v1Limiter);

// Track bot API usage in Redis for the rate-limit dashboard
router.use((req, _res, next) => {
  const p = (req as any).v1Principal;
  if (p?.type === 'bot') {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())}`;
    const hour = `${day}-${pad(now.getUTCHours())}`;
    const pipe = redis.pipeline();
    pipe.incr(`ratelimit:bot:${p.applicationId}:hour:${hour}`);
    pipe.expire(`ratelimit:bot:${p.applicationId}:hour:${hour}`, 90000);
    pipe.incr(`ratelimit:bot:${p.applicationId}:day:${day}`);
    pipe.expire(`ratelimit:bot:${p.applicationId}:day:${day}`, 691200);
    pipe.exec().catch(() => {});
  }
  next();
});

router.use('/users', usersRouter);
router.use('/guilds', guildsRouter);
router.use('/channels', channelsRouter);

// API info
router.get('/', (_req, res) => {
  res.json({
    version: 1,
    name: 'Cordyn API',
    docs: 'https://cordyn.pl/developers/docs',
  });
});

export default router;
