// Cordis Socket.IO Client
import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      auth: { token: getToken() },
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: getToken() };
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
