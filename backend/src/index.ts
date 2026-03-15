import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import jwt from 'jsonwebtoken';
import path from 'path';
import { config } from './config';
import { pool } from './db/pool';
import { runMigrations } from './db/migrate';
import { redis } from './redis/client';
import { initSocket } from './socket';

// Routes
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import serversRoutes from './routes/servers';
import channelsRoutes from './routes/channels';
import messagesRoutes from './routes/messages';
import dmsRoutes from './routes/dms';
import friendsRoutes from './routes/friends';
import uploadRoutes from './routes/upload';
import ogRoutes from './routes/og';
import adminRoutes from './routes/admin';
import gamesRoutes from './routes/games';
import notificationsRoutes from './routes/notifications';
import spotifyRoutes from './routes/spotify';
import steamRoutes   from './routes/steam';
import twitchRoutes  from './routes/twitch';
import notesRoutes   from './routes/notes';
import pollsRoutes   from './routes/polls';
import pushRoutes    from './routes/push';
import automationsRoutes from './routes/automations';

const app = express();
const httpServer = http.createServer(app);

// Trust Nginx proxy (required for express-rate-limit + X-Forwarded-For)
app.set('trust proxy', 1);

// ── Security & Middleware ────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting helpers
const realIp = (req: express.Request) =>
  (req.headers['x-real-ip'] as string) || req.ip || 'unknown';

const redisStore = (prefix: string) => new RedisStore({
  sendCommand: (...args: string[]) => (redis as any).call(...args),
  prefix,
});

// For authenticated routes: key by JWT user ID so every user has their own
// bucket regardless of shared IP / NAT / CDN. Falls back to IP for guests.
const userOrIp = (req: express.Request): string => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), config.jwt.secret) as { id: string };
      return `u:${payload.id}`;
    } catch { /* expired / invalid — fall through to IP */ }
  }
  return realIp(req);
};

// Global API limiter — 2000 req / 15 min per user (or IP for guests).
// Individual write endpoints have tighter per-user limits in their routes.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
  keyGenerator: userOrIp,
  store: redisStore('rl:api:'),
});

// Auth limiter — still per real IP to protect against credential stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts' },
  keyGenerator: realIp,
  store: redisStore('rl:auth:'),
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/dms', dmsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/og', ogRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/games',         gamesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/steam',   steamRoutes);
app.use('/api/twitch',  twitchRoutes);
app.use('/api/users',   notesRoutes);
app.use('/api/polls',   pollsRoutes);
app.use('/api/push',    pushRoutes);
app.use('/api/servers/:serverId/automations', automationsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Socket.IO ────────────────────────────────────────────────────────
const io = initSocket(httpServer);
app.set('io', io);

// ── Start ─────────────────────────────────────────────────────────────
async function start() {
  // Connect to Redis
  try {
    await redis.connect();
  } catch (err) {
    console.error('Redis connection failed:', err);
    // Non-fatal - continue without Redis if needed
  }

  // Test PostgreSQL connection + run migrations
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
    await runMigrations();
  } catch (err) {
    console.error('PostgreSQL connection/migration failed:', err);
    process.exit(1);
  }

  httpServer.listen(config.port, () => {
    console.log(`Cordis backend running on port ${config.port} [${config.nodeEnv}]`);
  });
}

start();

export { app, io };
