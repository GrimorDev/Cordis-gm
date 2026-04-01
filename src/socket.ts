// Cordis Socket.IO Client
import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

// In Tauri desktop context relative paths don't work — connect explicitly.
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const SOCKET_URL = isTauri
  ? (import.meta.env.VITE_API_BASE
      ? import.meta.env.VITE_API_BASE.replace(/\/api\/?$/, '')
      : 'http://localhost:4000')
  : '/';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: getToken() },
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
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

// ── MediaSoup SFU helpers ──────────────────────────────────────────
function msEmit<T = any>(event: string, data: object): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    getSocket().emit(event as any, data, (res: any) => {
      if (res && res.error) reject(new Error(res.error));
      else resolve(res as T);
    });
  });
}

export function msJoin(roomId: string): Promise<{ rtpCapabilities: any; existingProducers: any[] }> {
  return msEmit('ms_join', { roomId });
}

export function msCreateTransport(roomId: string, producing: boolean): Promise<any> {
  return msEmit('ms_create_transport', { roomId, producing });
}

export function msConnectTransport(roomId: string, transportId: string, dtlsParameters: any): Promise<void> {
  return msEmit('ms_connect_transport', { roomId, transportId, dtlsParameters });
}

export function msProduce(
  roomId: string,
  transportId: string,
  kind: string,
  rtpParameters: any,
  appData: any,
): Promise<{ producerId: string }> {
  return msEmit('ms_produce', { roomId, transportId, kind, rtpParameters, appData });
}

export function msConsume(
  roomId: string,
  producerId: string,
  rtpCapabilities: any,
): Promise<any> {
  return msEmit('ms_consume', { roomId, producerId, rtpCapabilities });
}

export function msResumeConsumer(roomId: string, consumerId: string): Promise<void> {
  return msEmit('ms_resume_consumer', { roomId, consumerId });
}

export function msCloseProducer(roomId: string, kind: string): Promise<void> {
  return msEmit('ms_close_producer', { roomId, kind });
}

export function msLeave(roomId: string): Promise<void> {
  return msEmit('ms_leave', { roomId });
}
