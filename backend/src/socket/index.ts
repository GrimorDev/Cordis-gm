import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import {
  setUserStatus, joinVoiceChannel, leaveVoiceChannel,
  getSpotifyJamMembers, getVoiceDj, getMyVoiceDjChannel,
  endSpotifyJam, clearVoiceDj,
} from '../redis/client';
import { query } from '../db/pool';
import { JwtPayload, ServerToClientEvents, ClientToServerEvents } from '../types';

interface SocketData {
  user: {
    id: string;
    username: string;
    email: string;
  };
}


export function initSocket(httpServer: HttpServer): SocketServer<ClientToServerEvents, ServerToClientEvents> {
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(String(token), config.jwt.secret) as JwtPayload;

      // Reject banned users
      const { rows: bans } = await query(
        `SELECT id FROM user_bans WHERE user_id=$1 AND is_active=TRUE
         AND (banned_until IS NULL OR banned_until > NOW()) LIMIT 1`,
        [payload.id]
      );
      if (bans.length > 0) return next(new Error('Account suspended'));

      (socket.data as SocketData).user = {
        id: payload.id,
        username: payload.username,
        email: payload.email,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = (socket.data as SocketData).user;
    console.log(`Socket connected: ${user.username} (${socket.id})`);

    // ── Anti-flood: disconnect sockets that send too many events ─────
    let eventCount = 0;
    const FLOOD_WINDOW_MS = 10_000;
    const FLOOD_MAX_EVENTS = 120; // 120 events / 10s is already extreme
    const floodTimer = setInterval(() => { eventCount = 0; }, FLOOD_WINDOW_MS);
    socket.onAny(() => {
      eventCount++;
      if (eventCount > FLOOD_MAX_EVENTS) {
        console.warn(`Flood detected from ${user.username} (${socket.id}), disconnecting`);
        clearInterval(floodTimer);
        socket.disconnect(true);
      }
    });
    socket.on('disconnect', () => clearInterval(floodTimer));

    // ── Typing throttle: 1 broadcast per 2 s per channel per user ────
    const typingLastSent = new Map<string, number>();

    // Join personal room for DMs and notifications
    socket.join(`user:${user.id}`);

    // Update status to online
    await setUserStatus(user.id, 'online');
    await query('UPDATE users SET status = $1 WHERE id = $2', ['online', user.id]);

    // Notify user's servers about status change
    await broadcastUserStatus(io, user.id, 'online');

    // Join server rooms the user belongs to
    const { rows: servers } = await query(
      `SELECT server_id FROM server_members WHERE user_id = $1`,
      [user.id]
    );
    for (const { server_id } of servers) {
      socket.join(`server:${server_id}`);
    }

    // ── Channel events ──────────────────────────────────────────────
    socket.on('join_channel', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('leave_channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    // ── Typing indicators ────────────────────────────────────────────
    socket.on('typing_start', (channelId) => {
      const now = Date.now();
      if ((now - (typingLastSent.get(channelId) ?? 0)) < 2000) return;
      typingLastSent.set(channelId, now);
      socket.to(`channel:${channelId}`).emit('user_typing', {
        channel_id: channelId,
        user_id: user.id,
        username: user.username,
      });
    });

    socket.on('typing_stop', (channelId) => {
      typingLastSent.delete(channelId);
      socket.to(`channel:${channelId}`).emit('user_stop_typing', {
        channel_id: channelId,
        user_id: user.id,
      });
    });

    // ── Voice channels ───────────────────────────────────────────────
    socket.on('voice_join', async (channelId) => {
      await joinVoiceChannel(channelId, user.id);
      socket.join(`voice:${channelId}`);
      (socket.data as SocketData & { voiceChannelId?: string }).voiceChannelId = channelId;

      const [{ rows: [u] }, { rows: [ch] }] = await Promise.all([
        query(`SELECT id, username, avatar_url, status FROM users WHERE id = $1`, [user.id]),
        query(`SELECT server_id, name FROM channels WHERE id = $1`, [channelId]),
      ]);
      if (ch?.server_id) {
        io.to(`server:${ch.server_id}`).emit('voice_user_joined', {
          channel_id: channelId,
          user: { ...u, custom_status: null },
        });
        // Persist + broadcast activity
        const { rows: [act] } = await query(
          `INSERT INTO server_activity (server_id, type, username, icon, text) VALUES ($1,'voice_join',$2,'🎤',$3) RETURNING id, type, icon, text, created_at as time`,
          [ch.server_id, user.username, `${user.username} dołączył/a do kanału głosowego`]
        );
        if (act) io.to(`server:${ch.server_id}`).emit('server_activity', { ...act, server_id: ch.server_id });
      }
    });

    socket.on('voice_leave', async (channelId) => {
      await leaveVoiceChannel(channelId, user.id);
      socket.leave(`voice:${channelId}`);
      (socket.data as SocketData & { voiceChannelId?: string }).voiceChannelId = undefined;

      const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [channelId]);
      if (ch?.server_id) {
        io.to(`server:${ch.server_id}`).emit('voice_user_left', {
          channel_id: channelId,
          user_id: user.id,
        });
        const { rows: [act] } = await query(
          `INSERT INTO server_activity (server_id, type, username, icon, text) VALUES ($1,'voice_leave',$2,'🚶',$3) RETURNING id, type, icon, text, created_at as time`,
          [ch.server_id, user.username, `${user.username} opuścił/a kanał głosowy`]
        );
        if (act) io.to(`server:${ch.server_id}`).emit('server_activity', { ...act, server_id: ch.server_id });
      }
    });

    // ── Spotify now-playing broadcast ────────────────────────────────
    socket.on('spotify_update', async ({ track }) => {
      // Broadcast to all server rooms this user is in
      const { rows: serverRows } = await query(
        `SELECT server_id FROM server_members WHERE user_id = $1`, [user.id]
      );
      for (const { server_id } of serverRows) {
        socket.to(`server:${server_id}`).emit('friend_spotify_update', { user_id: user.id, track });
      }
      // Also notify friends directly (for DM/friends-list context)
      const { rows: friendRows } = await query(
        `SELECT CASE WHEN requester_id=$1 THEN addressee_id ELSE requester_id END AS friend_id
         FROM friends WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'`,
        [user.id]
      );
      for (const { friend_id } of friendRows) {
        socket.to(`user:${friend_id}`).emit('friend_spotify_update', { user_id: user.id, track });
      }

      // ── JAM: if this user is a JAM host, sync all listeners ──────
      const jamMembers = await getSpotifyJamMembers(user.id);
      if (jamMembers && jamMembers.length > 0) {
        for (const memberId of jamMembers) {
          io.to(`user:${memberId}`).emit('spotify_jam_sync' as any, { host_id: user.id, track });
        }
      }

      // ── Voice DJ: if this user is a voice DJ, sync listeners ─────
      const djChannelId = await getMyVoiceDjChannel(user.id);
      if (djChannelId) {
        socket.to(`vdj:${djChannelId}`).emit('voice_dj_sync' as any, { dj_id: user.id, channel_id: djChannelId, track });
      }
    });

    // ── Spotify JAM socket management ────────────────────────────────
    // Client calls this when they successfully join a JAM (after REST call)
    socket.on('spotify_jam_joined' as any, ({ host_id }: { host_id: string }) => {
      socket.join(`jam:${host_id}`);
    });

    // Client calls this when they leave a JAM
    socket.on('spotify_jam_left' as any, ({ host_id }: { host_id: string }) => {
      socket.leave(`jam:${host_id}`);
      // Notify host
      io.to(`user:${host_id}`).emit('spotify_jam_member_left' as any, { user_id: user.id });
    });

    // Host notifies when they end the JAM — broadcast to room
    socket.on('spotify_jam_ended' as any, ({ host_id }: { host_id: string }) => {
      io.to(`jam:${host_id}`).emit('spotify_jam_ended' as any, { host_id });
    });

    // ── Voice DJ socket management ────────────────────────────────────
    // User opts in to voice DJ listening
    socket.on('voice_dj_listen' as any, ({ channel_id }: { channel_id: string }) => {
      socket.join(`vdj:${channel_id}`);
    });

    // User opts out
    socket.on('voice_dj_unlisten' as any, ({ channel_id }: { channel_id: string }) => {
      socket.leave(`vdj:${channel_id}`);
    });

    // DJ notifies channel when starting/stopping
    socket.on('voice_dj_started' as any, ({ channel_id }: { channel_id: string }) => {
      socket.to(`voice:${channel_id}`).emit('voice_dj_started' as any, { dj_id: user.id, channel_id });
    });

    socket.on('voice_dj_stopped' as any, ({ channel_id }: { channel_id: string }) => {
      io.to(`voice:${channel_id}`).emit('voice_dj_stopped' as any, { dj_id: user.id, channel_id });
      io.to(`vdj:${channel_id}`).emit('voice_dj_stopped' as any, { dj_id: user.id, channel_id });
    });

    // ── Twitch live status broadcast ─────────────────────────────────
    socket.on('twitch_update', async ({ stream }) => {
      const { rows: serverRows } = await query(
        `SELECT server_id FROM server_members WHERE user_id = $1`, [user.id]
      );
      for (const { server_id } of serverRows) {
        socket.to(`server:${server_id}`).emit('friend_twitch_update', { user_id: user.id, stream });
      }
      const { rows: friendRows } = await query(
        `SELECT CASE WHEN requester_id=$1 THEN addressee_id ELSE requester_id END AS friend_id
         FROM friends WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'`,
        [user.id]
      );
      for (const { friend_id } of friendRows) {
        socket.to(`user:${friend_id}`).emit('friend_twitch_update', { user_id: user.id, stream });
      }
    });

    // ── Steam current game broadcast ──────────────────────────────────
    socket.on('steam_update', async ({ game }) => {
      const { rows: serverRows } = await query(
        `SELECT server_id FROM server_members WHERE user_id = $1`, [user.id]
      );
      for (const { server_id } of serverRows) {
        socket.to(`server:${server_id}`).emit('friend_steam_update', { user_id: user.id, game });
      }
      const { rows: friendRows } = await query(
        `SELECT CASE WHEN requester_id=$1 THEN addressee_id ELSE requester_id END AS friend_id
         FROM friends WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'`,
        [user.id]
      );
      for (const { friend_id } of friendRows) {
        socket.to(`user:${friend_id}`).emit('friend_steam_update', { user_id: user.id, game });
      }
    });

    // ── 1-to-1 Calls (signaling) ─────────────────────────────────────
    socket.on('call_invite', async ({ to_user_id, type }) => {
      const { rows: [caller] } = await query('SELECT avatar_url FROM users WHERE id = $1', [user.id]);
      io.to(`user:${to_user_id}`).emit('call_invite', {
        from: { id: user.id, username: user.username, avatar_url: caller?.avatar_url || null, status: 'online', custom_status: null },
        type,
        conversation_id: `call_${user.id}_${to_user_id}_${Date.now()}`,
      });
    });

    socket.on('call_accept', ({ to_user_id, conversation_id }) => {
      io.to(`user:${to_user_id}`).emit('call_accepted', {
        from_user_id: user.id,
        conversation_id,
      });
    });

    socket.on('call_reject', ({ to_user_id }) => {
      io.to(`user:${to_user_id}`).emit('call_rejected', { from_user_id: user.id });
    });

    socket.on('call_end', ({ to_user_id }) => {
      io.to(`user:${to_user_id}`).emit('call_ended', { by_user_id: user.id });
    });

    // ── WebRTC signaling ─────────────────────────────────────────────
    socket.on('webrtc_offer', ({ to, sdp }) => {
      io.to(`user:${to}`).emit('webrtc_offer', { from: user.id, sdp });
    });

    socket.on('webrtc_answer', ({ to, sdp }) => {
      io.to(`user:${to}`).emit('webrtc_answer', { from: user.id, sdp });
    });

    socket.on('webrtc_ice', ({ to, candidate }) => {
      io.to(`user:${to}`).emit('webrtc_ice', { from: user.id, candidate });
    });

    // ── Voice state (mute/deafen) ────────────────────────────────────
    socket.on('voice_state', ({ muted, deafened, channel_id, to_user_id }) => {
      if (channel_id) socket.to(`voice:${channel_id}`).emit('voice_user_state', { user_id: user.id, muted, deafened });
      if (to_user_id) io.to(`user:${to_user_id}`).emit('voice_user_state', { user_id: user.id, muted, deafened });
    });

    // ── Screen share signaling ────────────────────────────────────────
    socket.on('screen_share_start', ({ to_user_id, channel_id }) => {
      if (to_user_id) io.to(`user:${to_user_id}`).emit('screen_share_start', { from: user.id });
      if (channel_id) socket.to(`voice:${channel_id}`).emit('screen_share_start', { from: user.id });
    });

    socket.on('screen_share_stop', ({ to_user_id, channel_id }) => {
      if (to_user_id) io.to(`user:${to_user_id}`).emit('screen_share_stop', { from: user.id });
      if (channel_id) socket.to(`voice:${channel_id}`).emit('screen_share_stop', { from: user.id });
    });

    // ── Disconnect ───────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${user.username}`);

      // Clean up voice DJ session if user disconnects while DJ
      const djChannel = await getMyVoiceDjChannel(user.id);
      if (djChannel) {
        await clearVoiceDj(djChannel);
        io.to(`voice:${djChannel}`).emit('voice_dj_stopped' as any, { dj_id: user.id, channel_id: djChannel });
        io.to(`vdj:${djChannel}`).emit('voice_dj_stopped' as any, { dj_id: user.id, channel_id: djChannel });
      }

      // End JAM if user disconnects while hosting
      const jamMembers = await getSpotifyJamMembers(user.id);
      if (jamMembers !== null) {
        await endSpotifyJam(user.id);
        io.to(`jam:${user.id}`).emit('spotify_jam_ended' as any, { host_id: user.id });
      }

      // Clean up voice channel if user disconnected while in one
      const voiceChannelId = (socket.data as SocketData & { voiceChannelId?: string }).voiceChannelId;
      if (voiceChannelId) {
        await leaveVoiceChannel(voiceChannelId, user.id);
        const { rows: [ch] } = await query(`SELECT server_id FROM channels WHERE id = $1`, [voiceChannelId]);
        if (ch?.server_id) {
          io.to(`server:${ch.server_id}`).emit('voice_user_left', {
            channel_id: voiceChannelId,
            user_id: user.id,
          });
        }
      }

      // Check if user has any other active sockets
      const userSockets = await io.in(`user:${user.id}`).fetchSockets();
      if (userSockets.length === 0) {
        await setUserStatus(user.id, 'offline');
        await query('UPDATE users SET status = $1 WHERE id = $2', ['offline', user.id]);
        await broadcastUserStatus(io, user.id, 'offline');
      }
    });
  });

  return io;
}

async function broadcastUserStatus(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
  userId: string,
  status: string
) {
  // Check if user has hidden their status
  const { rows: [user] } = await query(
    `SELECT privacy_status_visible FROM users WHERE id = $1`, [userId]
  );
  const broadcastStatus = user?.privacy_status_visible === false ? 'offline' : status;

  // Get all servers the user belongs to
  const { rows: servers } = await query(
    `SELECT server_id FROM server_members WHERE user_id = $1`, [userId]
  );
  for (const { server_id } of servers) {
    io.to(`server:${server_id}`).emit('user_status', { user_id: userId, status: broadcastStatus });
  }
}
