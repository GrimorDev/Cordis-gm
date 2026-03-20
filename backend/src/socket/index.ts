import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import {
  setUserStatus, joinVoiceChannel, leaveVoiceChannel,
  getSpotifyJamMembers, getVoiceDj, getMyVoiceDjChannel,
  endSpotifyJam, clearVoiceDj,
} from '../redis/client';
import { query } from '../db/pool';
import { JwtPayload, ServerToClientEvents, ClientToServerEvents } from '../types';
import { runAutomations } from '../services/automations';
import { musicStates, MusicBotState } from '../routes/bots';

interface SocketData {
  user: {
    id: string;
    username: string;
    email: string;
  };
}


// stream_watchers: "channel_id:streamer_id" → Map<watcher_user_id, username>
const streamWatchers = new Map<string, Map<string, string>>();

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

  // ── Redis adapter — required for multi-instance horizontal scaling ──
  // Each backend replica shares room/event state via Redis pub/sub.
  // Without this, messages only reach users connected to the same instance.
  const redisCfg = { host: config.redis.host, port: config.redis.port, password: config.redis.password };
  const pubClient = new Redis(redisCfg);
  const subClient = pubClient.duplicate();
  pubClient.on('error', (err) => console.error('Socket.IO Redis pub error:', err.message));
  subClient.on('error', (err) => console.error('Socket.IO Redis sub error:', err.message));
  io.adapter(createAdapter(pubClient, subClient));

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
          [ch.server_id, user.username, `**${user.username}** dołączył/a do **#${ch.name ?? 'kanał głosowy'}**`]
        );
        if (act) io.to(`server:${ch.server_id}`).emit('server_activity', { ...act, server_id: ch.server_id });
      }
    });

    socket.on('voice_leave', async (channelId) => {
      await leaveVoiceChannel(channelId, user.id);
      socket.leave(`voice:${channelId}`);
      (socket.data as SocketData & { voiceChannelId?: string }).voiceChannelId = undefined;

      const { rows: [ch] } = await query(`SELECT server_id, name FROM channels WHERE id = $1`, [channelId]);
      if (ch?.server_id) {
        io.to(`server:${ch.server_id}`).emit('voice_user_left', {
          channel_id: channelId,
          user_id: user.id,
        });
        const { rows: [act] } = await query(
          `INSERT INTO server_activity (server_id, type, username, icon, text) VALUES ($1,'voice_leave',$2,'🚶',$3) RETURNING id, type, icon, text, created_at as time`,
          [ch.server_id, user.username, `**${user.username}** opuścił/a **#${ch.name ?? 'kanał głosowy'}**`]
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
      // Clean up watchers for this stream
      if (channel_id) {
        const key = `${channel_id}:${user.id}`;
        streamWatchers.delete(key);
      }
    });

    // ── Stream viewer tracking ────────────────────────────────────────
    const broadcastWatchers = (channelId: string, streamerId: string) => {
      const key = `${channelId}:${streamerId}`;
      const map = streamWatchers.get(key);
      const watchers = map ? [...map.entries()].map(([id, username]) => ({ id, username })) : [];
      io.to(`voice:${channelId}`).emit('stream_watchers_update' as any, { streamer_id: streamerId, watchers });
    };

    socket.on('stream_watch_start' as any, ({ channel_id, streamer_id }: { channel_id: string; streamer_id: string }) => {
      const key = `${channel_id}:${streamer_id}`;
      if (!streamWatchers.has(key)) streamWatchers.set(key, new Map());
      streamWatchers.get(key)!.set(String(user.id), user.username);
      broadcastWatchers(channel_id, streamer_id);
    });

    socket.on('stream_watch_stop' as any, ({ channel_id, streamer_id }: { channel_id: string; streamer_id: string }) => {
      const key = `${channel_id}:${streamer_id}`;
      streamWatchers.get(key)?.delete(String(user.id));
      broadcastWatchers(channel_id, streamer_id);
    });

    // ── Bot commands ─────────────────────────────────────────────────
    socket.on('bot_command' as any, async (data: {
      bot: string; command: string; args: string[];
      channel_id: string; server_id: string;
    }) => {
      try {
        const { bot, command, args, channel_id, server_id } = data;
        // Validate: user must be member of server, and bot must be installed
        const { rows: [member] } = await query(
          'SELECT 1 FROM server_members WHERE server_id=$1 AND user_id=$2',
          [server_id, user.id]
        );
        if (!member) return;
        const { rows: [botRow] } = await query(
          'SELECT 1 FROM server_bots WHERE server_id=$1 AND bot_id=$2',
          [server_id, bot]
        );
        if (!botRow) {
          io.to(`user:${user.id}`).emit('bot_response' as any, {
            bot, channel_id, type: 'error',
            message: `Bot "${bot}" nie jest zainstalowany na tym serwerze. Dodaj go przez Cordyn Apps.`,
          });
          return;
        }

        // Check if this server restricts bot commands to a specific channel
        try {
          const { rows: srvRows } = await query('SELECT bot_channel_id FROM servers WHERE id=$1', [server_id]);
          const botChannelId = srvRows[0]?.bot_channel_id;
          if (botChannelId && channel_id !== botChannelId) {
            // Silently ignore command from wrong channel, or send a hint
            const sendHint = makeBotSender(io, channel_id, user.id, '🤖 System');
            await sendHint(`❌ Komendy botów są ograniczone do kanału <#${botChannelId}>. Użyj tamtego kanału.`);
            return;
          }
        } catch { /* ignore DB errors — don't block commands */ }

        if (bot === 'music') {
          // For /play we need the user's current voice channel; stop/skip/pause
          // send channel_id = their voice channel from the UI buttons — use as-is.
          const voiceChannelId = (socket.data as any).voiceChannelId as string | undefined;
          if (command === 'play' && !voiceChannelId) {
            const errSender = makeBotSender(io, channel_id, user.id, '🎵 Cordyn Music');
            await errSender('❌ Musisz dołączyć do kanału głosowego, żeby odtwarzać muzykę!');
            return;
          }
          // play → voice channel as the music channel; everything else keeps channel_id
          const musicChannelId = (command === 'play' && voiceChannelId) ? voiceChannelId : channel_id;
          await handleMusicCommand({ io, user, command, args, channel_id: musicChannelId, text_channel_id: channel_id, server_id });
        } else if (bot === 'fun') {
          await handleFunCommand({ io, user, command, args, channel_id });
        } else if (bot === 'moderacja') {
          await handleModerationCommand({ io, user, command, args, channel_id, server_id });
        } else if (bot === 'polls') {
          await handlePollCommand({ io, user, command, args, channel_id });
        } else if (bot === 'info') {
          await handleInfoCommand({ io, user, command, args, channel_id, server_id });
        } else if (bot === 'remind') {
          await handleRemindCommand({ io, user, command, args, channel_id });
        }
      } catch (err) {
        console.error('bot_command error:', err);
      }
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

      // Clean up stream watches on disconnect
      for (const [key, map] of streamWatchers.entries()) {
        if (map.has(String(user.id))) {
          map.delete(String(user.id));
          const [channelId, streamerId] = key.split(':');
          const watchers = [...map.entries()].map(([id, username]) => ({ id, username }));
          io.to(`voice:${channelId}`).emit('stream_watchers_update' as any, { streamer_id: streamerId, watchers });
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

// ── Shared bot message sender ─────────────────────────────────────────────
function makeBotSender(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
  channel_id: string,
  user_id: string,
  system_name: string,
) {
  return async (content: string) => {
    try {
      const { rows: [msg] } = await query(
        `INSERT INTO messages (channel_id, sender_id, content, is_automated, system_name)
         VALUES ($1, $2, $3, TRUE, $4)
         RETURNING id, channel_id, content, created_at, updated_at, edited,
                   attachment_url, reply_to_id, is_automated, system_name, pinned`,
        [channel_id, user_id, content, system_name]
      );
      if (msg) {
        io.to(`channel:${channel_id}`).emit('new_message', {
          ...msg,
          sender_id: user_id,
          sender_username: system_name,
          sender_avatar: null,
          sender_status: null,
          sender_role: null,
          sender_role_color: null,
          sender_avatar_effect: null,
        });
      }
    } catch (err) {
      console.error('bot sendBotMsg error:', err);
    }
  };
}

// ── Music bot helpers ─────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  // [?&]v= ensures we match the actual video param, not rv= or sv= etc.
  const watchM = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchM) return watchM[1];
  // youtu.be/VIDEO_ID  or  youtube.com/shorts/VIDEO_ID  or  youtube.com/embed/VIDEO_ID
  const shortM = url.match(/(?:youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return shortM ? shortM[1] : null;
}

// YouTube oEmbed: public, no auth, no bot detection issues
async function ytOembed(videoId: string): Promise<{ title: string; thumbnail?: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { title: 'Nieznany utwór' };
    const j = await res.json() as any;
    return { title: j.title ?? 'Nieznany utwór', thumbnail: j.thumbnail_url };
  } catch {
    return { title: 'Nieznany utwór' };
  }
}

// Emit virtual voice_user_joined / voice_user_left for the music bot
function botVoiceJoin(io: SocketServer<ClientToServerEvents, ServerToClientEvents>, serverId: string, channelId: string) {
  io.to(`server:${serverId}`).emit('voice_user_joined', {
    channel_id: channelId,
    user: { id: `music_bot_${serverId}`, username: 'Cordyn Music', avatar_url: null, status: 'online', custom_status: null, is_bot: true },
  } as any);
}

function botVoiceLeave(io: SocketServer<ClientToServerEvents, ServerToClientEvents>, serverId: string, channelId: string) {
  io.to(`server:${serverId}`).emit('voice_user_left', {
    channel_id: channelId,
    user_id: `music_bot_${serverId}`,
  } as any);
}

// ── Music bot command handler ─────────────────────────────────────────────
async function handleMusicCommand(opts: {
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  user: { id: string; username: string };
  command: string; args: string[];
  channel_id: string;      // voice channel — keys musicStates
  text_channel_id: string; // text channel — where bot chat messages appear
  server_id: string;
  _carryQueue?: MusicBotState['queue']; // internal: queue carried over from skip
}) {
  const { io, user, command, args, channel_id, text_channel_id, server_id } = opts;
  const sendBotMsg = makeBotSender(io, text_channel_id, user.id, '🎵 Cordyn Music');
  const broadcastState = (state: MusicBotState) => {
    io.to(`server:${server_id}`).emit('music_bot_update' as any, state);
  };

  if (command === 'play') {
    const ytUrl = args[0];
    if (!ytUrl) { await sendBotMsg('❌ Podaj URL YouTube: `/play <url>`'); return; }

    const videoId = extractYouTubeId(ytUrl);
    if (!videoId) {
      await sendBotMsg('❌ Podaj poprawny URL YouTube (youtube.com lub youtu.be).'); return;
    }

    const prev = musicStates.get(channel_id);

    // If already playing (and NOT called from skip), add to queue instead of replacing
    if (prev?.playing && !opts._carryQueue) {
      const info = await ytOembed(videoId);
      prev.queue.push({ title: info.title, url: ytUrl });
      broadcastState(prev);
      await sendBotMsg(`➕ Dodano do kolejki: **${info.title}** (pozycja ${prev.queue.length})`);
      return;
    }

    // Stop previous bot voice presence
    if (prev?.playing) botVoiceLeave(io, server_id, channel_id);

    await sendBotMsg(`🔍 Szukam: ${ytUrl}`);

    const info = await ytOembed(videoId);
    const started_at = Date.now();

    // Get direct CDN audio URL for server-side streaming (avoids client-side YouTube bot detection)
    let directUrl: string | undefined;
    try {
      const { spawn } = await import('child_process');
      directUrl = await new Promise<string>((resolve, reject) => {
        const proc = spawn('yt-dlp', ['--no-playlist', '-f', 'bestaudio', '--get-url', ytUrl]);
        let out = '';
        proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
        proc.stderr.on('data', () => {});
        proc.on('close', (code: number) => {
          const url = out.trim().split('\n')[0];
          if (code === 0 && url) resolve(url);
          else reject(new Error('yt-dlp --get-url failed'));
        });
      });
    } catch { /* directUrl stays undefined; clients fall back to thumbnail only */ }

    const state: MusicBotState = {
      playing: true, ...info, url: ytUrl, directUrl, videoId,
      channel_id, started_at, requested_by: user.username,
      queue: opts._carryQueue ?? [],  // preserve queue carried from skip
    };
    musicStates.set(channel_id, state);

    botVoiceJoin(io, server_id, channel_id);
    broadcastState(state);
    await sendBotMsg(`🎵 Teraz odtwarzam: **${info.title}** (zamówił: ${user.username})`);

  } else if (command === 'stop') {
    // Stop music but keep bot in voice channel
    const stopped: MusicBotState = { playing: false, channel_id, queue: [] };
    musicStates.set(channel_id, stopped);
    broadcastState(stopped);
    await sendBotMsg('⏹️ Zatrzymano muzykę. Bot nadal jest na kanale głosowym.');

  } else if (command === 'leave') {
    // Stop music AND remove bot from voice channel
    const prev = musicStates.get(channel_id);
    if (prev?.playing) botVoiceLeave(io, server_id, channel_id);
    const stopped: MusicBotState = { playing: false, channel_id, queue: [] };
    musicStates.set(channel_id, stopped);
    broadcastState(stopped);
    await sendBotMsg('👋 Bot opuścił kanał głosowy.');

  } else if (command === 'skip') {
    const state = musicStates.get(channel_id);
    if (state?.queue.length) {
      const next = state.queue.shift()!;
      const remaining = [...state.queue]; // preserve rest of queue before recursive call
      await handleMusicCommand({ ...opts, command: 'play', args: [next.url], _carryQueue: remaining });
    } else {
      // No queue — stop playback but keep bot in voice channel (use /stop or /leave to disconnect)
      const stopped: MusicBotState = { playing: false, channel_id, queue: [] };
      musicStates.set(channel_id, stopped);
      broadcastState(stopped);
      await sendBotMsg('⏭️ Kolejka jest pusta — odtwarzanie zatrzymane. Użyj `/stop leave` żeby rozłączyć bota.');
    }

  } else if (command === 'pause') {
    const state = musicStates.get(channel_id);
    if (state?.playing) {
      state.playing = false;
      broadcastState(state);
      await sendBotMsg('⏸️ Wstrzymano odtwarzanie.');
    }

  } else if (command === 'queue') {
    const state = musicStates.get(channel_id);
    if (!state || (!state.playing && !state.queue.length)) {
      await sendBotMsg('📭 Kolejka jest pusta.');
    } else {
      const lines = state.title ? [`▶️ Teraz: **${state.title}**`] : [];
      state.queue.slice(0, 5).forEach((q, i) => lines.push(`${i + 1}. ${q.title || q.url}`));
      await sendBotMsg(lines.join('\n'));
    }

  } else if (command === 'volume') {
    await sendBotMsg(`🔊 Głośność kontrolujesz suwakiem w odtwarzaczu YouTube.`);

  } else {
    await sendBotMsg(`❓ Nieznana komenda. Dostępne: \`/play\`, \`/stop\`, \`/skip\`, \`/pause\`, \`/queue\`, \`/leave\``);
  }
}

// ── Fun bot command handler ───────────────────────────────────────────────
const EIGHT_BALL = [
  '✅ Tak, zdecydowanie!', '✅ Bez wątpliwości.', '✅ Na pewno.', '✅ Można na to liczyć.',
  '✅ Tak — według moich informacji.', '❌ Nie licz na to.', '❌ Moje źródła mówią nie.',
  '❌ Nie wygląda to dobrze.', '❌ Bardzo wątpliwe.', '🔮 Zapytaj później.',
  '🔮 Nie jestem teraz pewien.', '🔮 Lepiej nie odpowiadać.', '🔮 Mgliście widzę... tak.',
  '🔮 Skup się i zapytaj ponownie.',
];
const MEMES = [
  'To nie bug, to undocumented feature. 🐛',
  'Działa u mnie. — *Push to production* 🤷',
  'Nie dotykaj kodu w piątek po południu. ⚠️',
  'Git blame pokazuje, że to ty napisałeś 6 miesięcy temu. 😅',
  '99 bugów w kodzie, napraw jeden... 127 bugów w kodzie. 🔥',
  'Skopiowałem ze Stack Overflow i nie wiem jak to działa, ale działa. ✅',
  'Dokumentacja? Kod jest dokumentacją. 📖',
  'To działa tylko w production, w dev nie wiem dlaczego. 🧩',
];

async function handleFunCommand(opts: {
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  user: { id: string; username: string };
  command: string; args: string[];
  channel_id: string;
}) {
  const { io, user, command, args, channel_id } = opts;
  const send = makeBotSender(io, channel_id, user.id, '🎮 Cordyn Fun');

  if (command === 'dice') {
    const sides = Math.max(2, Math.min(1000, parseInt(args[0]) || 6));
    const result = Math.floor(Math.random() * sides) + 1;
    await send(`🎲 **${user.username}** rzucił kością **k${sides}** i wyrzucił: **${result}**!`);
  } else if (command === 'flip') {
    const result = Math.random() < 0.5 ? 'Orzeł 🦅' : 'Reszka 🪙';
    await send(`🪙 **${user.username}** rzucił monetą: **${result}**!`);
  } else if (command === '8ball') {
    const q = args.join(' ');
    const a = EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)];
    await send(`🎱 **${q || '???'}**\n> ${a}`);
  } else if (command === 'meme') {
    await send(MEMES[Math.floor(Math.random() * MEMES.length)]);
  } else if (command === 'rps') {
    const choices = ['Kamień 🪨', 'Papier 📄', 'Nożyce ✂️'];
    const bot = choices[Math.floor(Math.random() * 3)];
    const user_pick = args[0]?.toLowerCase();
    const mapped: Record<string, string> = { kamien: 'Kamień 🪨', papier: 'Papier 📄', nozyce: 'Nożyce ✂️', k: 'Kamień 🪨', p: 'Papier 📄', n: 'Nożyce ✂️' };
    if (!user_pick || !mapped[user_pick]) {
      await send(`✂️ Użycie: \`/rps kamien|papier|nozyce\`. Bot wybrał: **${bot}**`);
    } else {
      const up = mapped[user_pick];
      const wins = { 'Kamień 🪨': 'Nożyce ✂️', 'Papier 📄': 'Kamień 🪨', 'Nożyce ✂️': 'Papier 📄' };
      const result = up === bot ? '🤝 Remis!' : wins[up as keyof typeof wins] === bot ? `🏆 **${user.username}** wygrywa!` : '🤖 Bot wygrywa!';
      await send(`✂️ **${user.username}**: ${up} vs Bot: ${bot} → ${result}`);
    }
  } else {
    await send(`❓ Nieznana komenda. Dostępne: \`/dice\`, \`/flip\`, \`/8ball\`, \`/meme\`, \`/rps\``);
  }
}

// ── Moderation bot command handler ────────────────────────────────────────
async function handleModerationCommand(opts: {
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  user: { id: string; username: string };
  command: string; args: string[];
  channel_id: string; server_id: string;
}) {
  const { io, user, command, args, channel_id, server_id } = opts;
  const send = makeBotSender(io, channel_id, user.id, '🔨 Cordyn Moderacja');

  // Check if caller has mod permissions
  const { rows: [callerRow] } = await query(
    `SELECT role_name FROM server_members WHERE server_id=$1 AND user_id=$2`,
    [server_id, user.id]
  );
  const canMod = callerRow && ['Owner', 'Admin', 'Moderator'].includes(callerRow.role_name);
  if (!canMod) {
    await send('❌ Nie masz uprawnień do używania komend moderacji.'); return;
  }

  if (command === 'warn') {
    const targetUsername = args[0]?.replace(/^@/, '');
    const reason = args.slice(1).join(' ') || 'Brak powodu';
    if (!targetUsername) { await send('❌ Użycie: `/warn <użytkownik> [powód]`'); return; }

    const { rows: [target] } = await query(
      `SELECT u.id, u.username FROM users u
       JOIN server_members sm ON sm.user_id=u.id
       WHERE sm.server_id=$1 AND LOWER(u.username)=LOWER($2)`,
      [server_id, targetUsername]
    );
    if (!target) { await send(`❌ Nie znaleziono użytkownika **${targetUsername}** na tym serwerze.`); return; }

    await query(
      `INSERT INTO member_warnings (server_id, user_id, warned_by, reason) VALUES ($1,$2,$3,$4)`,
      [server_id, target.id, user.id, reason]
    );
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM member_warnings WHERE server_id=$1 AND user_id=$2`,
      [server_id, target.id]
    );
    await send(`⚠️ **${target.username}** otrzymał ostrzeżenie od **${user.username}**.\n> Powód: ${reason}\n> Łącznie ostrzeżeń: **${count}**`);

  } else if (command === 'warns') {
    const targetUsername = args[0]?.replace(/^@/, '');
    if (!targetUsername) { await send('❌ Użycie: `/warns <użytkownik>`'); return; }

    const { rows: [target] } = await query(
      `SELECT u.id, u.username FROM users u
       JOIN server_members sm ON sm.user_id=u.id
       WHERE sm.server_id=$1 AND LOWER(u.username)=LOWER($2)`,
      [server_id, targetUsername]
    );
    if (!target) { await send(`❌ Nie znaleziono użytkownika **${targetUsername}**.`); return; }

    const { rows: warnings } = await query(
      `SELECT mw.reason, mw.created_at, u.username as by
       FROM member_warnings mw LEFT JOIN users u ON u.id=mw.warned_by
       WHERE mw.server_id=$1 AND mw.user_id=$2 ORDER BY mw.created_at DESC LIMIT 5`,
      [server_id, target.id]
    );
    if (!warnings.length) {
      await send(`✅ **${target.username}** nie ma żadnych ostrzeżeń.`);
    } else {
      const lines = [`⚠️ Ostrzeżenia **${target.username}** (ostatnie ${warnings.length}):`];
      warnings.forEach((w, i) => {
        const date = new Date(w.created_at).toLocaleDateString('pl-PL');
        lines.push(`${i + 1}. ${date} przez **${w.by ?? '?'}** — ${w.reason}`);
      });
      await send(lines.join('\n'));
    }

  } else if (command === 'clear') {
    const count = Math.max(1, Math.min(100, parseInt(args[0]) || 0));
    if (!count) { await send('❌ Użycie: `/clear <1-100>`'); return; }

    const { rows: msgs } = await query(
      `SELECT id FROM messages WHERE channel_id=$1 AND is_automated=FALSE
       ORDER BY created_at DESC LIMIT $2`,
      [channel_id, count]
    );
    if (!msgs.length) { await send('📭 Brak wiadomości do usunięcia.'); return; }

    const ids = msgs.map((m: { id: string }) => m.id);
    await query(`DELETE FROM messages WHERE id=ANY($1::uuid[])`, [ids]);
    for (const id of ids) {
      io.to(`channel:${channel_id}`).emit('message_deleted', { id, channel_id });
    }
    await send(`🗑️ Usunięto **${ids.length}** wiadomości.`);

  } else if (command === 'kick') {
    // Only Owner/Admin can kick
    if (!['Owner', 'Admin'].includes(callerRow.role_name)) {
      await send('❌ Tylko Admin lub Owner może wyrzucać użytkowników.'); return;
    }
    const targetUsername = args[0]?.replace(/^@/, '');
    if (!targetUsername) { await send('❌ Użycie: `/kick <użytkownik>`'); return; }

    const { rows: [target] } = await query(
      `SELECT u.id, u.username, sm.role_name FROM users u
       JOIN server_members sm ON sm.user_id=u.id
       WHERE sm.server_id=$1 AND LOWER(u.username)=LOWER($2)`,
      [server_id, targetUsername]
    );
    if (!target) { await send(`❌ Nie znaleziono **${targetUsername}** na serwerze.`); return; }
    if (target.role_name === 'Owner') { await send('❌ Nie możesz wyrzucić właściciela serwera.'); return; }

    await query(`DELETE FROM server_members WHERE server_id=$1 AND user_id=$2`, [server_id, target.id]);
    io.to(`user:${target.id}`).emit('kicked_from_server' as any, { server_id });
    await send(`👟 **${target.username}** został wyrzucony z serwera przez **${user.username}**.`);

  } else {
    await send(`❓ Nieznana komenda. Dostępne: \`/warn\`, \`/warns\`, \`/clear\`, \`/kick\``);
  }
}

// ── Polls bot command handler ─────────────────────────────────────────────
async function handlePollCommand(opts: {
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  user: { id: string; username: string };
  command: string; args: string[];
  channel_id: string;
}) {
  const { io, user, command, args, channel_id } = opts;
  const send = makeBotSender(io, channel_id, user.id, '📊 Cordyn Polls');

  if (command !== 'poll') {
    await send(`❓ Nieznana komenda. Użyj: \`/poll Pytanie | Opcja 1 | Opcja 2 | ...\``); return;
  }

  const raw = args.join(' ');
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 3) {
    await send('❌ Podaj pytanie i co najmniej 2 opcje rozdzielone `|`.\nPrzykład: `/poll Ulubiony kolor | Niebieski | Czerwony | Zielony`');
    return;
  }
  const [question, ...options] = parts;
  if (options.length > 9) { await send('❌ Maksymalnie 9 opcji.'); return; }

  const EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  const lines = [
    `📊 **${question}**`,
    `> Zagłosuj reagując na tę wiadomość:`,
    '',
    ...options.map((opt, i) => `${EMOJIS[i]} ${opt}`),
    '',
    `*Ankieta od **${user.username}***`,
  ];
  await send(lines.join('\n'));
}

// ── Info bot ──────────────────────────────────────────────────────────────

async function handleInfoCommand(opts: {
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  user: { id: string; username: string };
  command: string; args: string[];
  channel_id: string; server_id: string;
}) {
  const { io, user, command, args, channel_id, server_id } = opts;
  const send = makeBotSender(io, channel_id, user.id, 'ℹ️ Cordyn Info');

  if (command === 'serverinfo') {
    const { rows: [srv] } = await query(
      `SELECT s.name, s.created_at,
              (SELECT COUNT(*) FROM server_members WHERE server_id = s.id)::int AS member_count,
              (SELECT COUNT(*) FROM channels       WHERE server_id = s.id)::int AS channel_count,
              u.username AS owner_name
       FROM servers s LEFT JOIN users u ON u.id = s.owner_id
       WHERE s.id = $1`, [server_id]
    );
    if (!srv) { await send('❌ Nie znaleziono serwera.'); return; }
    const created = new Date(srv.created_at).toLocaleDateString('pl-PL');
    await send([
      `🏠 **${srv.name}**`,
      `👥 Członkowie: **${srv.member_count}**`,
      `📺 Kanały: **${srv.channel_count}**`,
      `👑 Właściciel: **${srv.owner_name}**`,
      `📅 Założony: **${created}**`,
    ].join('\n'));

  } else if (command === 'userinfo') {
    const targetUsername = args[0]?.replace(/^@/, '');
    let targetId: string = user.id;
    if (targetUsername) {
      const { rows: [found] } = await query(
        `SELECT u.id FROM users u
         JOIN server_members sm ON sm.user_id = u.id AND sm.server_id = $1
         WHERE LOWER(u.username) = LOWER($2) LIMIT 1`,
        [server_id, targetUsername]
      );
      if (!found) { await send(`❌ Nie znaleziono użytkownika **${targetUsername}** na tym serwerze.`); return; }
      targetId = found.id;
    }
    const { rows: [u] } = await query(
      `SELECT u.username, u.created_at AS account_created, sm.joined_at,
              COALESCE(
                (SELECT r.name FROM server_member_roles smr
                 JOIN server_roles r ON r.id = smr.role_id
                 WHERE smr.member_user_id = u.id AND smr.member_server_id = $2
                 LIMIT 1), 'Brak'
              ) AS role_name
       FROM users u
       JOIN server_members sm ON sm.user_id = u.id AND sm.server_id = $2
       WHERE u.id = $1`, [targetId, server_id]
    );
    if (!u) { await send('❌ Nie znaleziono użytkownika.'); return; }
    const joined  = new Date(u.joined_at).toLocaleDateString('pl-PL');
    const created = new Date(u.account_created).toLocaleDateString('pl-PL');
    await send([
      `👤 **${u.username}**`,
      `🎭 Rola: **${u.role_name}**`,
      `📅 Dołączył: **${joined}**`,
      `🎂 Konto założono: **${created}**`,
    ].join('\n'));

  } else if (command === 'ping') {
    const t = Date.now();
    await send(`🏓 Pong! Opóźnienie API: **${Date.now() - t}ms**`);

  } else {
    await send('❓ Nieznana komenda. Dostępne: `/serverinfo`, `/userinfo [@użytkownik]`, `/ping`');
  }
}

// ── Remind bot ────────────────────────────────────────────────────────────

// In-memory reminders — lost on server restart, acceptable for MVP
const activeReminders = new Map<string, ReturnType<typeof setTimeout>>();

async function handleRemindCommand(opts: {
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  user: { id: string; username: string };
  command: string; args: string[];
  channel_id: string;
}) {
  const { io, user, command, args, channel_id } = opts;
  const send = makeBotSender(io, channel_id, user.id, '⏰ Cordyn Remind');

  if (command !== 'remind') {
    await send('❓ Nieznana komenda. Użyj: `/remind <czas> <treść>`'); return;
  }
  if (args.length < 2) {
    await send('❌ Użycie: `/remind <czas> <treść>`\nFormaty: `30s`, `5m`, `2h`, `1d`'); return;
  }

  const timeMatch = args[0].match(/^(\d+)(s|m|h|d)$/i);
  if (!timeMatch) { await send('❌ Nieprawidłowy format czasu. Przykłady: `30s` `5m` `2h` `1d`'); return; }

  const amount = parseInt(timeMatch[1], 10);
  const unit   = timeMatch[2].toLowerCase();
  const msMap: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const ms     = amount * msMap[unit];

  if (ms > 7 * 24 * 60 * 60_000) { await send('❌ Maksymalny czas to **7 dni**.'); return; }
  if (ms < 5_000)                  { await send('❌ Minimalny czas to **5 sekund**.'); return; }

  const message  = args.slice(1).join(' ');
  const unitName = unit === 's' ? 'sekund' : unit === 'm' ? 'minut' : unit === 'h' ? 'godzin' : 'dni';
  await send(`⏰ Okej **${user.username}**! Przypomnę Ci za **${amount} ${unitName}**: *${message}*`);

  const reminderId = `${user.id}-${Date.now()}`;
  const timer = setTimeout(async () => {
    activeReminders.delete(reminderId);
    const notify = makeBotSender(io, channel_id, user.id, '⏰ Cordyn Remind');
    await notify(`🔔 **Przypomnienie dla ${user.username}!**\n${message}`);
  }, ms);
  activeReminders.set(reminderId, timer);
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
