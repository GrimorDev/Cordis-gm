import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { pool } from './db/pool';
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

const app = express();
const httpServer = http.createServer(app);

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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts' },
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

  // Test PostgreSQL connection
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('PostgreSQL connection failed:', err);
    process.exit(1);
  }

  httpServer.listen(config.port, () => {
    console.log(`Cordis backend running on port ${config.port} [${config.nodeEnv}]`);
  });
}

start();

export { app, io };
