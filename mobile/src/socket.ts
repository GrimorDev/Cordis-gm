import { io, Socket } from 'socket.io-client';
import { storage } from './storage';
import { SOCKET_URL } from './config';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await storage.getItemAsync('cordyn_token');
  if (!token) throw new Error('No token');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ─── 1:1 DM call signaling (mirrors src/socket.ts on desktop exactly) ──────
export function sendCallInvite(toUserId: string, type: 'voice' | 'video') {
  getSocket()?.emit('call_invite', { to_user_id: toUserId, type });
}

export function acceptCall(conversationId: string, toUserId: string) {
  getSocket()?.emit('call_accept', { conversation_id: conversationId, to_user_id: toUserId });
}

export function rejectCall(toUserId: string) {
  getSocket()?.emit('call_reject', { to_user_id: toUserId });
}

export function endCall(toUserId: string) {
  getSocket()?.emit('call_end', { to_user_id: toUserId });
}
