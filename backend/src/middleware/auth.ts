import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, JwtPayload } from '../types';
import { redis, KEYS } from '../redis/client';

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Check if token is blacklisted (logout)
    const isBlacklisted = await redis.get(KEYS.blacklistToken(token.slice(-20)));
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    req.user = {
      id: payload.id,
      username: payload.username,
      email: payload.email,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), config.jwt.secret) as JwtPayload;
      req.user = { id: payload.id, username: payload.username, email: payload.email };
    } catch {
      // ignore invalid token in optional auth
    }
  }
  next();
}
