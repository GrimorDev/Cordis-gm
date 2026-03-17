import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { PassThrough } from 'stream';
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

        if (bot === 'music') {
          await handleMusicCommand({ io, user, command, args, channel_id, server_id });
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

// ── Music bot command handler ─────────────────────────────────────────────
async function handleMusicCommand(opts: {
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  user: { id: string; username: string };
  command: string;
  args: string[];
  channel_id: string;
  server_id: string;
}) {
  const { io, user, command, args, channel_id, server_id } = opts;
  const broadcastState = (state: MusicBotState) => {
    io.to(`server:${server_id}`).emit('music_bot_update' as any, state);
  };

  const sendBotMsg = async (content: string) => {
    try {
      const { rows: [msg] } = await query(
        `INSERT INTO messages (channel_id, sender_id, content, is_automated, system_name)
         VALUES ($1, $2, $3, TRUE, '🎵 Cordyn Music')
         RETURNING id, channel_id, content, created_at, updated_at, edited,
                   attachment_url, reply_to_id, is_automated, system_name, pinned`,
        [channel_id, user.id, content]
      );
      if (msg) {
        io.to(`channel:${channel_id}`).emit('new_message', {
          ...msg,
          sender_id: user.id,
          sender_username: '🎵 Cordyn Music',
          sender_avatar: null,
          sender_status: null,
          sender_role: null,
          sender_role_color: null,
          sender_avatar_effect: null,
        });
      }
    } catch (err) {
      console.error('sendBotMsg error:', err);
    }
  };

  if (command === 'play') {
    const ytUrl = args[0];
    if (!ytUrl) {
      await sendBotMsg('❌ Podaj URL YouTube: `/play <url>`');
      return;
    }
    // Validate URL
    if (!ytUrl.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//)) {
      await sendBotMsg('❌ Podaj poprawny URL YouTube.');
      return;
    }

    // Get video info + stream using play-dl (bypasses YouTube bot detection)
    let title = 'Nieznany utwór';
    let thumbnail: string | undefined;
    let duration: number | undefined;
    let stream: PassThrough | undefined;

    try {
      // @ts-ignore – play-dl is a CJS/ESM hybrid; dynamic import works at runtime
      const playdl = await import('play-dl').catch(() => null) as any;
      if (!playdl) {
        await sendBotMsg('❌ Moduł play-dl nie jest zainstalowany na serwerze.');
        return;
      }

      // Validate that the URL is a real YouTube link
      const validateResult = playdl.yt_validate ? playdl.yt_validate(ytUrl) : 'video';
      if (validateResult !== 'video') {
        await sendBotMsg('❌ Podaj poprawny link do YouTube (nie playlist ani kanału).');
        return;
      }

      // Fetch video details
      const info = await playdl.video_info(ytUrl);
      title = info.video_details.title ?? 'Nieznany utwór';
      thumbnail = info.video_details.thumbnails?.[0]?.url;
      duration = info.video_details.durationInSec;

      // Destroy previous stream if any
      const existing = musicStates.get(channel_id);
      if (existing?._stream) {
        try { existing._stream.destroy(); } catch { /* */ }
      }

      // Create PassThrough + pipe play-dl audio stream into it
      const pt = new PassThrough();
      const source = await playdl.stream(ytUrl, { quality: 2 });
      source.stream.pipe(pt);
      source.stream.on('error', (e: Error) => {
        console.error('play-dl stream error:', e.message);
        try { pt.destroy(); } catch { /* */ }
      });
      pt.on('error', () => { /* ignore client disconnects */ });

      const state: MusicBotState = {
        playing: true, title, url: ytUrl, thumbnail, duration,
        channel_id,
        stream_url: `/api/servers/${server_id}/bots/music/stream/${channel_id}`,
        requested_by: user.username,
        queue: [],
        _stream: pt,
        _ytUrl: ytUrl,
      };
      musicStates.set(channel_id, state);
      stream = pt;

      broadcastState({ ...state, _stream: undefined, _ytUrl: undefined });
      await sendBotMsg(`🎵 Teraz odtwarzam: **${title}** (zamówił: ${user.username})`);
    } catch (err: any) {
      console.error('Music bot play error:', err);
      await sendBotMsg(`❌ Nie udało się odtworzyć: ${err?.message || 'Nieznany błąd'}`);
    }
  } else if (command === 'stop') {
    const state = musicStates.get(channel_id);
    if (state?._stream) {
      try { state._stream.destroy(); } catch { /* */ }
    }
    const stopped: MusicBotState = { playing: false, channel_id, queue: [] };
    musicStates.set(channel_id, stopped);
    broadcastState(stopped);
    await sendBotMsg('⏹️ Zatrzymano odtwarzanie.');
  } else if (command === 'skip') {
    const state = musicStates.get(channel_id);
    if (state?.queue.length) {
      const next = state.queue[0];
      // Recursively play next
      await handleMusicCommand({ ...opts, command: 'play', args: [next.url] });
    } else {
      // Stop
      if (state?._stream) { try { state._stream.destroy(); } catch { /* */ } }
      const stopped: MusicBotState = { playing: false, channel_id, queue: [] };
      musicStates.set(channel_id, stopped);
      broadcastState(stopped);
      await sendBotMsg('⏭️ Pominięto. Kolejka jest pusta.');
    }
  } else if (command === 'pause') {
    const state = musicStates.get(channel_id);
    if (state) {
      state.playing = false;
      musicStates.set(channel_id, state);
      broadcastState({ ...state, _stream: undefined, _ytUrl: undefined });
      await sendBotMsg('⏸️ Wstrzymano odtwarzanie.');
    }
  } else if (command === 'queue') {
    const state = musicStates.get(channel_id);
    if (!state || (!state.playing && state.queue.length === 0)) {
      await sendBotMsg('📭 Kolejka jest pusta.');
    } else {
      const lines = state.title ? [`▶️ Teraz: **${state.title}**`] : [];
      state.queue.slice(0, 5).forEach((q, i) => lines.push(`${i + 1}. ${q.title || q.url}`));
      await sendBotMsg(lines.join('\n'));
    }
  } else if (command === 'volume') {
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 100) {
      await sendBotMsg('❌ Podaj wartość od 0 do 100.');
    } else {
      await sendBotMsg(`🔊 Głośność: ${vol}% (ustawienie głośności klienta — użyj suwaka w odtwarzaczu)`);
    }
  } else {
    await sendBotMsg(`❓ Nieznana komenda: \`/${command}\`. Wpisz \`/queue\`, \`/play\`, \`/skip\`, \`/stop\`, \`/pause\`.`);
  }
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
