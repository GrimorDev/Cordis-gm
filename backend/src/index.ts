import express from 'express';
import http from 'http';
import cors from 'cors';
import { spawn } from 'child_process';
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
import botsRoutes from './routes/bots';
import { musicStates } from './routes/bots';

const app = express();
const httpServer = http.createServer(app);

// Trust Nginx proxy (required for express-rate-limit + X-Forwarded-For)
app.set('trust proxy', 1);

// ── Security & Middleware ────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// API uses JWT (Authorization header), not cookies — CORS does not add security here.
// Accept all origins so the desktop app (tauri://localhost / https://tauri.localhost)
// and any future clients can connect without configuration changes.
app.use(cors({
  origin: true,
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
app.use('/api/servers/:serverId/bots', botsRoutes);

// ── Music audio proxy stream ──────────────────────────────────────────────────
// Streams the current music bot audio for a voice channel.
// Uses ffmpeg to transcode from the yt-dlp direct URL, seeking to the correct position.
// No auth required — audio is not sensitive and channel IDs are already known to members.
app.get('/api/stream/:channelId', (req, res) => {
  const state = musicStates.get(req.params.channelId);
  if (!state?.playing || !state.directUrl) {
    return res.status(404).json({ error: 'No music playing on this channel' });
  }

  const elapsed = state.started_at
    ? Math.max(0, Math.floor((Date.now() - state.started_at) / 1000) - 2)
    : 0;

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const ffmpegArgs: string[] = [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
  ];
  if (elapsed > 5) ffmpegArgs.push('-ss', String(elapsed));
  ffmpegArgs.push(
    '-i', state.directUrl,
    '-vn', '-f', 'mp3', '-ar', '44100', '-ab', '192k',
    '-loglevel', 'error',
    'pipe:1'
  );

  const ffmpegProc = spawn('ffmpeg', ffmpegArgs);
  ffmpegProc.stdout.pipe(res);
  ffmpegProc.stderr.on('data', () => {});
  ffmpegProc.on('error', () => { if (!res.headersSent) res.status(500).end(); });

  const cleanup = () => { try { ffmpegProc.kill('SIGTERM'); } catch {} };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
});

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
async function waitForPostgres(maxAttempts = 15, delayMs = 3000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('PostgreSQL connected');
      return;
    } catch (err: any) {
      console.warn(`[pg] connection attempt ${i}/${maxAttempts} failed: ${err?.message}`);
      if (i < maxAttempts) await new Promise(r => setTimeout(r, delayMs));
      else { console.error('PostgreSQL unavailable after max retries'); process.exit(1); }
    }
  }
}

async function start() {
  // Connect to Redis
  try {
    await redis.connect();
  } catch (err) {
    console.error('Redis connection failed:', err);
    // Non-fatal - continue without Redis if needed
  }

  // Wait for PostgreSQL (pg_isready passes before init.sql finishes on first deploy)
  await waitForPostgres();

  // Run migrations
  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }

  httpServer.listen(config.port, () => {
    console.log(`Cordis backend running on port ${config.port} [${config.nodeEnv}]`);
  });
}

start();

export { app, io };
