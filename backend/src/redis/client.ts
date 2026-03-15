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
  slowmode: (channelId: string, userId: string) => `slowmode:${channelId}:${userId}`,
  msgCache: (channelId: string) => `msgcache:${channelId}:latest`,
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

/** Returns seconds remaining in slowmode, or 0 if user can send */
export async function checkSlowmode(channelId: string, userId: string, slowmodeSeconds: number): Promise<number> {
  if (slowmodeSeconds <= 0) return 0;
  const key = KEYS.slowmode(channelId, userId);
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 0;
}

/** Mark that user just sent a message in a slowmode channel */
export async function setSlowmode(channelId: string, userId: string, slowmodeSeconds: number): Promise<void> {
  if (slowmodeSeconds <= 0) return;
  await redis.setex(KEYS.slowmode(channelId, userId), slowmodeSeconds, '1');
}

// ── Spotify JAM sessions ──────────────────────────────────────────────────────
// jam:{hostId} → JSON array of member userIds
// jam:host:{memberId} → hostId (reverse lookup)
// vdj:{channelId} → hostUserId
// vdj:user:{userId} → channelId (reverse lookup)

export async function startSpotifyJam(hostId: string): Promise<void> {
  await redis.setex(`jam:${hostId}`, 14400, JSON.stringify([])); // 4h TTL
}

export async function endSpotifyJam(hostId: string): Promise<string[]> {
  const raw = await redis.get(`jam:${hostId}`);
  const members: string[] = raw ? JSON.parse(raw) : [];
  await redis.del(`jam:${hostId}`);
  // Clean up reverse keys for all members
  for (const m of members) await redis.del(`jam:host:${m}`);
  return members;
}

export async function joinSpotifyJam(hostId: string, memberId: string): Promise<boolean> {
  const raw = await redis.get(`jam:${hostId}`);
  if (!raw) return false; // session does not exist
  const members: string[] = JSON.parse(raw);
  if (!members.includes(memberId)) members.push(memberId);
  await redis.setex(`jam:${hostId}`, 14400, JSON.stringify(members));
  await redis.setex(`jam:host:${memberId}`, 14400, hostId);
  return true;
}

export async function leaveSpotifyJam(memberId: string): Promise<string | null> {
  const hostId = await redis.get(`jam:host:${memberId}`);
  if (!hostId) return null;
  await redis.del(`jam:host:${memberId}`);
  const raw = await redis.get(`jam:${hostId}`);
  if (raw) {
    const members: string[] = JSON.parse(raw);
    await redis.setex(`jam:${hostId}`, 14400, JSON.stringify(members.filter(m => m !== memberId)));
  }
  return hostId;
}

export async function getSpotifyJamMembers(hostId: string): Promise<string[] | null> {
  const raw = await redis.get(`jam:${hostId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getMyJamHostId(userId: string): Promise<string | null> {
  return redis.get(`jam:host:${userId}`);
}

// ── Voice Channel DJ ──────────────────────────────────────────────────────────
export async function setVoiceDj(channelId: string, userId: string): Promise<void> {
  await redis.setex(`vdj:${channelId}`, 86400, userId);
  await redis.setex(`vdj:user:${userId}`, 86400, channelId);
}

export async function clearVoiceDj(channelId: string): Promise<string | null> {
  const userId = await redis.get(`vdj:${channelId}`);
  await redis.del(`vdj:${channelId}`);
  if (userId) await redis.del(`vdj:user:${userId}`);
  return userId;
}

export async function getVoiceDj(channelId: string): Promise<string | null> {
  return redis.get(`vdj:${channelId}`);
}

export async function getMyVoiceDjChannel(userId: string): Promise<string | null> {
  return redis.get(`vdj:user:${userId}`);
}
