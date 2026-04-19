const API_URL = window.location.origin + '/api';

async function getToken(): Promise<string | null> {
  return localStorage.getItem('cordyn_token');
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  is_admin: boolean;
  about_me?: string | null;
  preferred_status?: string | null;
  created_at: string;
}

export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  description?: string | null;
  member_count?: number;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: 'text' | 'voice' | 'forum' | 'announcement';
  position: number;
  category_id?: string | null;
  category_name?: string | null;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
  updated_at?: string | null;
  is_edited?: boolean;
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  reply_to_username?: string | null;
  reactions?: { emoji: string; count: number; reacted: boolean }[];
}

export interface DmConversation {
  id: string;
  other_user_id: string;
  other_username: string;
  other_avatar: string | null;
  other_status: string;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
  is_group?: boolean;
  group_name?: string | null;
}

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
  is_edited?: boolean;
}

export interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  since: string;
}

export interface FriendRequest {
  id: string;
  from_id: string;
  from_username: string;
  from_avatar: string | null;
  to_id: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (username: string, password: string) =>
    req<{ token: string; user: User }>('POST', '/auth/login', { username, password }),
  register: (username: string, password: string) =>
    req<{ token: string; user: User }>('POST', '/auth/register', { username, password }),
  me:       () => req<User>('GET', '/auth/me'),
  logout:   () => req<{ ok: boolean }>('POST', '/auth/logout'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  updateMe:     (data: Partial<{ username: string; about_me: string; preferred_status: string }>) =>
    req<User>('PUT', '/users/me', data),
  updateStatus: (status: string) =>
    req<{ ok: boolean }>('PUT', '/users/me/status', { status }),
  get: (id: string) => req<User>('GET', `/users/${id}`),
};

// ── Servers ───────────────────────────────────────────────────────────────────
export const serversApi = {
  list:   () => req<Server[]>('GET', '/servers'),
  get:    (id: string) => req<Server>('GET', `/servers/${id}`),
  create: (name: string) => req<Server>('POST', '/servers', { name }),
  join:   (code: string) => req<Server>('POST', '/servers/join', { code }),
  leave:  (id: string) => req<{ ok: boolean }>('POST', `/servers/${id}/leave`),
};

// ── Channels ──────────────────────────────────────────────────────────────────
export const channelsApi = {
  list: (serverId: string) => req<Channel[]>('GET', `/channels?server_id=${serverId}`),
};

// ── Messages ──────────────────────────────────────────────────────────────────
export const messagesApi = {
  list:   (channelId: string, before?: string) =>
    req<Message[]>('GET', `/messages/channel/${channelId}${before ? `?before=${before}` : ''}`),
  send:   (channelId: string, content: string, replyToId?: string) =>
    req<Message>('POST', `/messages/channel/${channelId}`, { content, reply_to_id: replyToId }),
  edit:   (id: string, content: string) => req<Message>('PUT', `/messages/${id}`, { content }),
  delete: (id: string) => req<{ ok: boolean }>('DELETE', `/messages/${id}`),
  react:  (id: string, emoji: string) =>
    req<{ ok: boolean }>('POST', `/messages/${id}/react`, { emoji }),
};

// ── DMs ───────────────────────────────────────────────────────────────────────
export const dmsApi = {
  conversations: () => req<DmConversation[]>('GET', '/dms/conversations'),
  messages: (userId: string, before?: string) =>
    req<DmMessage[]>('GET', `/dms/${userId}/messages${before ? `?before=${before}` : ''}`),
  send: (userId: string, content: string) =>
    req<DmMessage>('POST', `/dms/${userId}/messages`, { content }),
};

// ── Friends ───────────────────────────────────────────────────────────────────
export const friendsApi = {
  list:     () => req<Friend[]>('GET', '/friends'),
  requests: () => req<FriendRequest[]>('GET', '/friends/requests'),
  send:     (username: string) => req<{ ok: boolean }>('POST', '/friends/request', { username }),
  accept:   (id: string) => req<{ ok: boolean }>('POST', `/friends/${id}/accept`),
  reject:   (id: string) => req<{ ok: boolean }>('DELETE', `/friends/requests/${id}`),
  remove:   (id: string) => req<{ ok: boolean }>('DELETE', `/friends/${id}`),
};
