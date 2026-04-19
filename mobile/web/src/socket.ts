import { io, Socket } from 'socket.io-client';

const SOCKET_URL = window.location.origin;
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  const token = localStorage.getItem('cordyn_token');
  if (!token) throw new Error('No token');
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
