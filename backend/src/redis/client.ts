import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
  // Reconnect with exponential backoff up to 3 s
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 100, 3000);
  },
  // Reduce round-trips: pipeline commands where possible
  enableAutoPipelining: true,
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

// ════════════════════════════════════════════════════════════════════
//  Key definitions
//  All TTLs chosen to maximise hit rate while keeping data fresh enough.
// ════════════════════════════════════════════════════════════════════
export const KEYS = {
  // ── Real-time presence ──────────────────────────────────────────
  userStatus:      (userId: string) => `user:status:${userId}`,
  voiceChannel:    (channelId: string) => `voice:${channelId}:members`,
  onlineUsers:     'online:users',

  // ── Rate limiting ───────────────────────────────────────────────
  rateLimitMessages: (userId: string) => `ratelimit:msg:${userId}`,
  blacklistToken:  (jti: string) => `blacklist:${jti}`,
  slowmode:        (channelId: string, userId: string) => `slowmode:${channelId}:${userId}`,

  // ── Message caches ──────────────────────────────────────────────
  // Raised from 10 s → 30 s: chat messages don't change often;
  // 10 s was too short to absorb repeated "scroll up" reads.
  msgCache:        (channelId: string) => `msgcache:${channelId}:latest`,
  dmMsgCache:      (convId: string)    => `dmcache:${convId}:latest`,

  // ── User profile cache (badges included) ────────────────────────
  // Key: user:<id>:profile  TTL: 120 s
  // Invalidated on: profile update, badge grant/revoke
  userProfile:     (userId: string) => `user:${userId}:profile`,

  // ── Server cache (channels + categories) ────────────────────────
  // Key: server:<id>:channels  TTL: 60 s
  // Invalidated on: channel create/update/delete, category change
  serverChannels:  (serverId: string) => `server:${serverId}:channels`,

  // ── Server member list ───────────────────────────────────────────
  // Key: server:<id>:members  TTL: 60 s
  // Invalidated on: join/leave/kick/role change
  serverMembers:   (serverId: string) => `server:${serverId}:members`,

  // ── DM conversation list per user ───────────────────────────────
  // Key: user:<id>:dmlist  TTL: 30 s
  // Invalidated on: new DM, new message (updates last_message)
  dmList:          (userId: string) => `user:${userId}:dmlist`,

  // ── Notification unread count ────────────────────────────────────
  // Key: user:<id>:notif:count  TTL: 60 s
  // Invalidated on: new notification, mark-as-read
  notifCount:      (userId: string) => `user:${userId}:notif:count`,

  // ── Spotify JAM ─────────────────────────────────────────────────
  spotifyJam:      (hostId: string)   => `jam:${hostId}`,
  spotifyJamHost:  (memberId: string) => `jam:host:${memberId}`,

  // ── Voice DJ ────────────────────────────────────────────────────
  voiceDj:         (channelId: string) => `vdj:${channelId}`,
  voiceDjUser:     (userId: string)    => `vdj:user:${userId}`,
};

// TTL constants (seconds) — single source of truth
export const TTL = {
  userStatus:     300,   // 5 min — refreshed on every socket heartbeat
  voiceChannel:   86400, // 24 h
  msgCache:       30,    // 30 s (was 10 s — tripled hit window)
  dmMsgCache:     30,    // 30 s
  userProfile:    120,   // 2 min — badges/bio rarely change
  serverChannels: 60,    // 1 min
  serverMembers:  60,    // 1 min
  dmList:         30,    // 30 s — last_message needs to be fairly fresh
  notifCount:     60,    // 1 min
  jam:            14400, // 4 h
  voiceDj:        86400, // 24 h
};

// ════════════════════════════════════════════════════════════════════
//  Generic JSON cache helpers
// ════════════════════════════════════════════════════════════════════

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // never let a Redis miss crash the request
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch { /* non-fatal */ }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch { /* non-fatal */ }
}

// ════════════════════════════════════════════════════════════════════
//  Presence helpers
// ════════════════════════════════════════════════════════════════════

export async function setUserStatus(userId: string, status: string) {
  await redis.setex(KEYS.userStatus(userId), TTL.userStatus, status);
  if (status !== 'offline') {
    await redis.sadd(KEYS.onlineUsers, userId);
  } else {
    await redis.srem(KEYS.onlineUsers, userId);
  }
  // Presence change invalidates cached profile (shows status badge)
  await cacheDel(KEYS.userProfile(userId));
}

export async function getUserStatus(userId: string): Promise<string> {
  const status = await redis.get(KEYS.userStatus(userId));
  return status || 'offline';
}

export async function getOnlineUsers(): Promise<string[]> {
  return redis.smembers(KEYS.onlineUsers);
}

// ════════════════════════════════════════════════════════════════════
//  Voice channel helpers
// ════════════════════════════════════════════════════════════════════

export async function joinVoiceChannel(channelId: string, userId: string) {
  await redis.sadd(KEYS.voiceChannel(channelId), userId);
  await redis.expire(KEYS.voiceChannel(channelId), TTL.voiceChannel);
}

export async function leaveVoiceChannel(channelId: string, userId: string) {
  await redis.srem(KEYS.voiceChannel(channelId), userId);
}

export async function getVoiceMembers(channelId: string): Promise<string[]> {
  return redis.smembers(KEYS.voiceChannel(channelId));
}

// ════════════════════════════════════════════════════════════════════
//  Slowmode helpers
// ════════════════════════════════════════════════════════════════════

/** Returns seconds remaining in slowmode, or 0 if user can send */
export async function checkSlowmode(channelId: string, userId: string, slowmodeSeconds: number): Promise<number> {
  if (slowmodeSeconds <= 0) return 0;
  const ttl = await redis.ttl(KEYS.slowmode(channelId, userId));
  return ttl > 0 ? ttl : 0;
}

/** Mark that user just sent a message in a slowmode channel */
export async function setSlowmode(channelId: string, userId: string, slowmodeSeconds: number): Promise<void> {
  if (slowmodeSeconds <= 0) return;
  await redis.setex(KEYS.slowmode(channelId, userId), slowmodeSeconds, '1');
}

// ════════════════════════════════════════════════════════════════════
//  User profile cache
//  Wraps: GET /api/users/:id  (badges, mutual friends count, etc.)
//  Invalidate on: profile update, avatar change, badge grant/revoke.
// ════════════════════════════════════════════════════════════════════

export async function getUserProfileCache<T>(userId: string): Promise<T | null> {
  return cacheGet<T>(KEYS.userProfile(userId));
}

export async function setUserProfileCache(userId: string, profile: unknown): Promise<void> {
  await cacheSet(KEYS.userProfile(userId), profile, TTL.userProfile);
}

export async function invalidateUserProfileCache(userId: string): Promise<void> {
  await cacheDel(KEYS.userProfile(userId));
}

// ════════════════════════════════════════════════════════════════════
//  Server channels + categories cache
//  Wraps: GET /api/servers/:id  (channels list, categories)
//  Invalidate on: channel create/update/delete/reorder, category change.
// ════════════════════════════════════════════════════════════════════

export async function getServerChannelsCache<T>(serverId: string): Promise<T | null> {
  return cacheGet<T>(KEYS.serverChannels(serverId));
}

export async function setServerChannelsCache(serverId: string, data: unknown): Promise<void> {
  await cacheSet(KEYS.serverChannels(serverId), data, TTL.serverChannels);
}

export async function invalidateServerChannelsCache(serverId: string): Promise<void> {
  await cacheDel(KEYS.serverChannels(serverId));
}

// ════════════════════════════════════════════════════════════════════
//  Server members cache
//  Wraps: GET /api/servers/:id/members
//  Invalidate on: join, leave, kick, role change.
// ════════════════════════════════════════════════════════════════════

export async function getServerMembersCache<T>(serverId: string): Promise<T | null> {
  return cacheGet<T>(KEYS.serverMembers(serverId));
}

export async function setServerMembersCache(serverId: string, data: unknown): Promise<void> {
  await cacheSet(KEYS.serverMembers(serverId), data, TTL.serverMembers);
}

export async function invalidateServerMembersCache(serverId: string): Promise<void> {
  await cacheDel(KEYS.serverMembers(serverId));
}

// ════════════════════════════════════════════════════════════════════
//  DM list cache
//  Wraps: GET /api/dms/conversations
//  Invalidate on: new DM message (updates last_message + unread count).
// ════════════════════════════════════════════════════════════════════

export async function getDmListCache<T>(userId: string): Promise<T | null> {
  return cacheGet<T>(KEYS.dmList(userId));
}

export async function setDmListCache(userId: string, data: unknown): Promise<void> {
  await cacheSet(KEYS.dmList(userId), data, TTL.dmList);
}

export async function invalidateDmListCache(userId: string): Promise<void> {
  await cacheDel(KEYS.dmList(userId));
}

// ════════════════════════════════════════════════════════════════════
//  Notification count cache
//  Wraps: GET /api/notifications/count (unread badge)
//  Invalidate on: new notification, mark-all-read.
// ════════════════════════════════════════════════════════════════════

export async function getNotifCount(userId: string): Promise<number | null> {
  const val = await redis.get(KEYS.notifCount(userId));
  return val !== null ? parseInt(val, 10) : null;
}

export async function setNotifCount(userId: string, count: number): Promise<void> {
  await redis.setex(KEYS.notifCount(userId), TTL.notifCount, String(count));
}

export async function invalidateNotifCount(userId: string): Promise<void> {
  await cacheDel(KEYS.notifCount(userId));
}

// ════════════════════════════════════════════════════════════════════
//  Spotify JAM sessions
// ════════════════════════════════════════════════════════════════════

export async function startSpotifyJam(hostId: string): Promise<void> {
  await redis.setex(KEYS.spotifyJam(hostId), TTL.jam, JSON.stringify([]));
}

export async function endSpotifyJam(hostId: string): Promise<string[]> {
  const raw = await redis.get(KEYS.spotifyJam(hostId));
  const members: string[] = raw ? JSON.parse(raw) : [];
  await redis.del(KEYS.spotifyJam(hostId));
  for (const m of members) await redis.del(KEYS.spotifyJamHost(m));
  return members;
}

export async function joinSpotifyJam(hostId: string, memberId: string): Promise<boolean> {
  const raw = await redis.get(KEYS.spotifyJam(hostId));
  if (!raw) return false;
  const members: string[] = JSON.parse(raw);
  if (!members.includes(memberId)) members.push(memberId);
  await redis.setex(KEYS.spotifyJam(hostId), TTL.jam, JSON.stringify(members));
  await redis.setex(KEYS.spotifyJamHost(memberId), TTL.jam, hostId);
  return true;
}

export async function leaveSpotifyJam(memberId: string): Promise<string | null> {
  const hostId = await redis.get(KEYS.spotifyJamHost(memberId));
  if (!hostId) return null;
  await redis.del(KEYS.spotifyJamHost(memberId));
  const raw = await redis.get(KEYS.spotifyJam(hostId));
  if (raw) {
    const members: string[] = JSON.parse(raw);
    await redis.setex(KEYS.spotifyJam(hostId), TTL.jam, JSON.stringify(members.filter(m => m !== memberId)));
  }
  return hostId;
}

export async function getSpotifyJamMembers(hostId: string): Promise<string[] | null> {
  const raw = await redis.get(KEYS.spotifyJam(hostId));
  return raw ? JSON.parse(raw) : null;
}

export async function getMyJamHostId(userId: string): Promise<string | null> {
  return redis.get(KEYS.spotifyJamHost(userId));
}

// ════════════════════════════════════════════════════════════════════
//  Voice DJ
// ════════════════════════════════════════════════════════════════════

export async function setVoiceDj(channelId: string, userId: string): Promise<void> {
  await redis.setex(KEYS.voiceDj(channelId), TTL.voiceDj, userId);
  await redis.setex(KEYS.voiceDjUser(userId), TTL.voiceDj, channelId);
}

export async function clearVoiceDj(channelId: string): Promise<string | null> {
  const userId = await redis.get(KEYS.voiceDj(channelId));
  await redis.del(KEYS.voiceDj(channelId));
  if (userId) await redis.del(KEYS.voiceDjUser(userId));
  return userId;
}

export async function getVoiceDj(channelId: string): Promise<string | null> {
  return redis.get(KEYS.voiceDj(channelId));
}

export async function getMyVoiceDjChannel(userId: string): Promise<string | null> {
  return redis.get(KEYS.voiceDjUser(userId));
}
