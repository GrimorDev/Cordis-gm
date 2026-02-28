import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 100, 3000);
  },
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

// Keys
export const KEYS = {
  userStatus: (userId: string) => `user:status:${userId}`,
  voiceChannel: (channelId: string) => `voice:${channelId}:members`,
  onlineUsers: 'online:users',
  rateLimitMessages: (userId: string) => `ratelimit:msg:${userId}`,
  blacklistToken: (jti: string) => `blacklist:${jti}`,
};

// Helpers
export async function setUserStatus(userId: string, status: string) {
  await redis.setex(KEYS.userStatus(userId), 300, status); // 5min TTL
  if (status !== 'offline') {
    await redis.sadd(KEYS.onlineUsers, userId);
  } else {
    await redis.srem(KEYS.onlineUsers, userId);
  }
}

export async function getUserStatus(userId: string): Promise<string> {
  const status = await redis.get(KEYS.userStatus(userId));
  return status || 'offline';
}

export async function getOnlineUsers(): Promise<string[]> {
  return redis.smembers(KEYS.onlineUsers);
}

export async function joinVoiceChannel(channelId: string, userId: string) {
  await redis.sadd(KEYS.voiceChannel(channelId), userId);
  await redis.expire(KEYS.voiceChannel(channelId), 86400); // 24h TTL
}

export async function leaveVoiceChannel(channelId: string, userId: string) {
  await redis.srem(KEYS.voiceChannel(channelId), userId);
}

export async function getVoiceMembers(channelId: string): Promise<string[]> {
  return redis.smembers(KEYS.voiceChannel(channelId));
}
