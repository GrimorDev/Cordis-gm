import dotenv from 'dotenv';
dotenv.config();

// ── Security: fail fast if critical secrets are missing in production ──────────
const isProd = (process.env.NODE_ENV || 'development') === 'production';

if (isProd) {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'POSTGRES_PASSWORD'] as const;
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[SECURITY] Missing required environment variables in production: ${missing.join(', ')}.\n` +
      'Set them in your .env file or Portainer environment before starting the server.'
    );
  }
  if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('[SECURITY] JWT_SECRET must be at least 32 characters long.');
  }
}

// Dev-only fallbacks (never used in production due to fail-fast above)
const JWT_SECRET_DEFAULT         = 'cordis_jwt_super_secret_CHANGE_IN_PROD_min32chars!!';
const JWT_REFRESH_SECRET_DEFAULT = 'cordis_refresh_secret_CHANGE_IN_PROD_min32chars!!';

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'cordis',
    user: process.env.POSTGRES_USER || 'cordis',
    password: process.env.POSTGRES_PASSWORD || 'cordis_secret',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || JWT_SECRET_DEFAULT,
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || JWT_REFRESH_SECRET_DEFAULT,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  uploads: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || String(50 * 1024 * 1024)), // 50MB (Cordyn Power)
    dir: process.env.UPLOAD_DIR || './uploads',
  },

  r2: {
    endpoint:        process.env.R2_ENDPOINT         || '',
    accessKeyId:     process.env.R2_ACCESS_KEY_ID    || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket:          process.env.R2_BUCKET           || 'cordyn',
    publicUrl:       (process.env.R2_PUBLIC_URL      || '').replace(/\/$/, ''),
  },

  storage: {
    // Quota in bytes — free: 50MB, premium: 600MB
    freeQuota:    parseInt(process.env.STORAGE_FREE_QUOTA    || String(50  * 1024 * 1024)),
    premiumQuota: parseInt(process.env.STORAGE_PREMIUM_QUOTA || String(600 * 1024 * 1024)),
  },

  vapid: {
    publicKey:  process.env.VAPID_PUBLIC_KEY  || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    email:      process.env.VAPID_EMAIL       || 'admin@cordyn.pl',
  },
};
