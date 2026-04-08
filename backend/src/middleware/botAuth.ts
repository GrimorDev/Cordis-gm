import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool';
import { redis } from '../redis/client';

export interface BotPrincipal {
  type: 'bot';
  botUserId: string;
  applicationId: string;
  username: string;
}

export interface OAuth2Principal {
  type: 'oauth2';
  userId: string;
  applicationId: string;
  scopes: string[];
  username: string;
}

export type V1Principal = BotPrincipal | OAuth2Principal;

declare global {
  namespace Express {
    interface Request {
      v1Principal?: V1Principal;
    }
  }
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function resolveBotToken(raw: string): Promise<BotPrincipal | null> {
  const hash = sha256(raw);
  const prefix = hash.slice(0, 16);
  const cacheKey = `bot:token:${prefix}`;

  // Try Redis cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const p = JSON.parse(cached);
      return p as BotPrincipal;
    }
  } catch { /* ignore */ }

  // DB lookup
  const { rows } = await query(
    `SELECT bt.bot_user_id, bt.application_id, u.username
     FROM bot_tokens bt
     JOIN users u ON u.id = bt.bot_user_id
     WHERE bt.token_hash = $1 AND bt.revoked_at IS NULL`,
    [hash]
  );
  if (!rows.length) return null;

  const principal: BotPrincipal = {
    type: 'bot',
    botUserId: rows[0].bot_user_id,
    applicationId: rows[0].application_id,
    username: rows[0].username,
  };

  // Update last_used asynchronously
  query('UPDATE bot_tokens SET last_used_at = NOW() WHERE token_hash = $1', [hash]).catch(() => {});

  // Cache 5 minutes
  try { await redis.setex(cacheKey, 300, JSON.stringify(principal)); } catch { /* ignore */ }

  return principal;
}

async function resolveOAuth2Token(raw: string): Promise<OAuth2Principal | null> {
  const hash = sha256(raw);
  const prefix = hash.slice(0, 16);
  const cacheKey = `oauth2:token:${prefix}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as OAuth2Principal;
  } catch { /* ignore */ }

  const { rows } = await query(
    `SELECT ot.user_id, ot.application_id, ot.scopes, u.username
     FROM oauth2_tokens ot
     JOIN users u ON u.id = ot.user_id
     WHERE ot.access_token = $1 AND NOT ot.revoked AND ot.access_expires > NOW()`,
    [hash]
  );
  if (!rows.length) return null;

  const principal: OAuth2Principal = {
    type: 'oauth2',
    userId: rows[0].user_id,
    applicationId: rows[0].application_id,
    scopes: rows[0].scopes,
    username: rows[0].username,
  };

  query('UPDATE oauth2_tokens SET last_used_at = NOW() WHERE access_token = $1', [hash]).catch(() => {});

  try { await redis.setex(cacheKey, 300, JSON.stringify(principal)); } catch { /* ignore */ }

  return principal;
}

export async function v1AuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: 'Authorization header required', code: 0 });
    return;
  }

  try {
    if (auth.startsWith('Bot ')) {
      const principal = await resolveBotToken(auth.slice(4));
      if (!principal) {
        res.status(401).json({ error: 'Invalid bot token', code: 0 });
        return;
      }
      req.v1Principal = principal;
      next();
    } else if (auth.startsWith('Bearer ')) {
      const principal = await resolveOAuth2Token(auth.slice(7));
      if (!principal) {
        res.status(401).json({ error: 'Invalid or expired access token', code: 0 });
        return;
      }
      req.v1Principal = principal;
      next();
    } else {
      res.status(401).json({ error: 'Unknown authorization scheme', code: 0 });
    }
  } catch (err) {
    console.error('[v1Auth] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function requireScope(...scopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const p = req.v1Principal;
    if (!p) { res.status(401).json({ error: 'Unauthorized' }); return; }

    if (p.type === 'bot') {
      // Bots have all scopes by default (controlled by server installation)
      next();
      return;
    }

    const missing = scopes.filter(s => !p.scopes.includes(s));
    if (missing.length) {
      res.status(403).json({ error: 'Missing required scopes', missing_scopes: missing, code: 50013 });
      return;
    }
    next();
  };
}

export async function assertBotInGuild(botUserId: string, guildId: string): Promise<boolean> {
  const { rowCount } = await query(
    'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
    [guildId, botUserId]
  );
  return (rowCount ?? 0) > 0;
}
