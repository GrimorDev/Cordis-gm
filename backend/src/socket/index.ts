import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { setUserStatus, joinVoiceChannel, leaveVoiceChannel } from '../redis/client';
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
      socket.to(`channel:${channelId}`).emit('user_typing', {
        channel_id: channelId,
        user_id: user.id,
        username: user.username,
      });
    });

    socket.on('typing_stop', (channelId) => {
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
        query(`SELECT server_id FROM channels WHERE id = $1`, [channelId]),
      ]);
      // Broadcast to all server members (includes voice participants) so everyone sees real-time voice state
      if (ch?.server_id) {
        io.to(`server:${ch.server_id}`).emit('voice_user_joined', {
          channel_id: channelId,
          user: { ...u, custom_status: null },
        });
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
      }
    });

    // ── 1-to-1 Calls (signaling) ─────────────────────────────────────
    socket.on('call_invite', ({ to_user_id, type }) => {
      io.to(`user:${to_user_id}`).emit('call_invite', {
        from: { id: user.id, username: user.username, avatar_url: null, status: 'online', custom_status: null },
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
  // Get all servers the user belongs to
  const { rows: servers } = await query(
    `SELECT server_id FROM server_members WHERE user_id = $1`, [userId]
  );
  for (const { server_id } of servers) {
    io.to(`server:${server_id}`).emit('user_status', { user_id: userId, status });
  }
}
