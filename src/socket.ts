// Cordis Socket.IO Client
import { io, Socket } from 'socket.io-client';
import { getToken, tryRefreshToken } from './api';

// In Tauri desktop context relative paths don't work — connect explicitly.
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// When Tauri loads from a remote frontendDist URL (e.g. https://cordyn.pl),
// window.location.origin is that URL — use it as the socket server.
// Falls back to VITE_API_BASE (baked-in CI secret), then localhost for dev.
const _origin = typeof window !== 'undefined' ? window.location.origin : '';
const _isRemoteOrigin = (
  _origin &&
  !_origin.startsWith('tauri://') &&
  !_origin.startsWith('https://tauri.localhost') &&
  !_origin.includes('localhost')
);
export const SOCKET_URL = isTauri
  ? (_isRemoteOrigin
      ? _origin
      : import.meta.env.VITE_API_BASE
        ? import.meta.env.VITE_API_BASE.replace(/\/api\/?$/, '')
        : 'http://localhost:4000')
  : '/';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      // Use a function so every reconnect attempt picks up the latest token from localStorage.
      // A static object { token: getToken() } captures the token at creation time and would
      // cause infinite reconnect loops when the 1h access token expires mid-session.
      auth: (cb: (data: object) => void) => cb({ token: getToken() }),
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Handle authentication errors during reconnect (expired / invalid token)
    socket.on('connect_error', async (err) => {
      const msg = (err as any)?.message ?? '';
      if (msg === 'Invalid token' || msg === 'Authentication required') {
        // Token expired — try to get a new one via the refresh token
        const newToken = await tryRefreshToken();
        if (!newToken) {
          // Refresh token also expired — stop reconnecting, let App.tsx force logout
          socket?.disconnect();
        }
        // If refresh succeeded, the next reconnect attempt will pick up the new
        // token automatically via the auth function above
      }
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function joinChannel(channelId: string) {
  getSocket().emit('join_channel', channelId);
}

export function leaveChannel(channelId: string) {
  getSocket().emit('leave_channel', channelId);
}

export function sendTypingStart(channelId: string) {
  getSocket().emit('typing_start', channelId);
}

export function sendTypingStop(channelId: string) {
  getSocket().emit('typing_stop', channelId);
}

export function joinVoiceChannel(channelId: string) {
  getSocket().emit('voice_join', channelId);
}

export function leaveVoiceChannel(channelId: string) {
  getSocket().emit('voice_leave', channelId);
}

export function sendCallInvite(toUserId: string, type: 'voice' | 'video') {
  getSocket().emit('call_invite', { to_user_id: toUserId, type });
}

export function acceptCall(conversationId: string, toUserId: string) {
  getSocket().emit('call_accept', { conversation_id: conversationId, to_user_id: toUserId });
}

export function rejectCall(toUserId: string) {
  getSocket().emit('call_reject', { to_user_id: toUserId });
}

export function endCall(toUserId: string) {
  getSocket().emit('call_end', { to_user_id: toUserId });
}

// ── Group calls ───────────────────────────────────────────────────
export function startGroupCall(groupId: string) {
  getSocket().emit('group_call_start', { group_id: groupId });
}
export function joinGroupCall(groupId: string) {
  getSocket().emit('group_call_join', { group_id: groupId });
}
export function leaveGroupCall(groupId: string) {
  getSocket().emit('group_call_leave', { group_id: groupId });
}
export function dismissGroupCall(groupId: string) {
  getSocket().emit('group_call_dismiss', { group_id: groupId });
}
