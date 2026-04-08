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
