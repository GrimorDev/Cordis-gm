import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './api';

let socket: Socket | null = null;

const SOCKET_URL = API_URL.replace('/api', '');

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync('cordyn_token');
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
