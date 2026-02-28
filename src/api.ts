// Cordis API Service
// Connects frontend to backend REST API

const BASE_URL = '/api';

// ── Token Management ─────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('cordis_token');
export const setToken = (token: string) => localStorage.setItem('cordis_token', token);
export const clearToken = () => localStorage.removeItem('cordis_token');

// ── Base fetch ───────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(error.error || 'Request failed', res.status);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Auth ─────────────────────────────────────────────────────────────
export const auth = {
  register: (data: { username: string; email: string; password: string }) =>
    apiFetch<{ token: string; user: UserProfile }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { login: string; password: string }) =>
    apiFetch<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    apiFetch('/auth/logout', { method: 'POST' }),

  me: () =>
    apiFetch<UserProfile>('/auth/me'),
};

// ── Users ─────────────────────────────────────────────────────────────
export const users = {
  get: (id: string) =>
    apiFetch<UserPublic>(`/users/${id}`),

  search: (q: string) =>
    apiFetch<UserPublic[]>(`/users/search/query?q=${encodeURIComponent(q)}`),

  updateMe: (data: Partial<{ username: string; bio: string; custom_status: string; banner_color: string }>) =>
    apiFetch<UserProfile>('/users/me', { method: 'PUT', body: JSON.stringify(data) }),

  updateStatus: (status: 'online' | 'idle' | 'dnd' | 'offline') =>
    apiFetch('/users/me/status', { method: 'PUT', body: JSON.stringify({ status }) }),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    const token = getToken();
    return fetch(`${BASE_URL}/users/me/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json()) as Promise<{ avatar_url: string }>;
  },
};

// ── Servers ───────────────────────────────────────────────────────────
export const servers = {
  list: () =>
    apiFetch<ServerData[]>('/servers'),

  get: (id: string) =>
    apiFetch<ServerFull>(`/servers/${id}`),

  create: (name: string) =>
    apiFetch<ServerData>('/servers', { method: 'POST', body: JSON.stringify({ name }) }),

  update: (id: string, data: { name?: string; icon_url?: string }) =>
    apiFetch<ServerData>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch(`/servers/${id}`, { method: 'DELETE' }),

  members: (id: string) =>
    apiFetch<ServerMember[]>(`/servers/${id}/members`),

  createInvite: (server_id: string, expires_in?: string) =>
    apiFetch<{ code: string; expires_at: string | null }>('/servers/invite/create', {
      method: 'POST',
      body: JSON.stringify({ server_id, expires_in }),
    }),

  join: (code: string) =>
    apiFetch<ServerData>(`/servers/join/${code}`, { method: 'POST' }),
};

// ── Channels ──────────────────────────────────────────────────────────
export const channels = {
  list: (serverId: string) =>
    apiFetch<ChannelCategory[]>(`/channels/server/${serverId}`),

  create: (data: { server_id: string; name: string; type: 'text' | 'voice'; category_id?: string; description?: string }) =>
    apiFetch<Channel>('/channels', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<Channel>(`/channels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch(`/channels/${id}`, { method: 'DELETE' }),

  createCategory: (server_id: string, name: string) =>
    apiFetch<ChannelCategory>('/channels/categories', { method: 'POST', body: JSON.stringify({ server_id, name }) }),
};

// ── Messages ──────────────────────────────────────────────────────────
export const messages = {
  list: (channelId: string, before?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.append('before', before);
    return apiFetch<MessageFull[]>(`/messages/channel/${channelId}?${params}`);
  },

  send: (channelId: string, content: string) =>
    apiFetch<MessageFull>(`/messages/channel/${channelId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  edit: (id: string, content: string) =>
    apiFetch<MessageFull>(`/messages/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),

  delete: (id: string) =>
    apiFetch(`/messages/${id}`, { method: 'DELETE' }),

  addReaction: (id: string, emoji: string) =>
    apiFetch(`/messages/${id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),

  removeReaction: (id: string, emoji: string) =>
    apiFetch(`/messages/${id}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' }),
};

// ── DMs ───────────────────────────────────────────────────────────────
export const dms = {
  conversations: () =>
    apiFetch<DmConversation[]>('/dms/conversations'),

  messages: (userId: string, before?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.append('before', before);
    return apiFetch<DmMessageFull[]>(`/dms/${userId}/messages?${params}`);
  },

  send: (userId: string, content: string) =>
    apiFetch<DmMessageFull>(`/dms/${userId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteMessage: (id: string) =>
    apiFetch(`/dms/messages/${id}`, { method: 'DELETE' }),
};

// ── Friends ───────────────────────────────────────────────────────────
export const friends = {
  list: () =>
    apiFetch<FriendEntry[]>('/friends'),

  requests: () =>
    apiFetch<FriendRequest[]>('/friends/requests'),

  sendRequest: (username: string) =>
    apiFetch('/friends/request', { method: 'POST', body: JSON.stringify({ username }) }),

  respondRequest: (id: string, action: 'accept' | 'reject') =>
    apiFetch(`/friends/request/${id}`, { method: 'PUT', body: JSON.stringify({ action }) }),

  remove: (id: string) =>
    apiFetch(`/friends/${id}`, { method: 'DELETE' }),
};

// ── Types ─────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  banner_color: string;
  bio: string | null;
  custom_status: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  created_at: string;
}

export interface UserPublic {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  custom_status: string | null;
}

export interface ServerData {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  created_at: string;
}

export interface ServerFull extends ServerData {
  my_role: string;
  categories: ChannelCategory[];
}

export interface ServerMember extends UserPublic {
  role_name: string;
}

export interface ChannelCategory {
  id: string;
  name: string;
  position: number;
  channels: Channel[];
}

export interface Channel {
  id: string;
  server_id: string;
  category_id: string | null;
  name: string;
  type: 'text' | 'voice';
  description: string | null;
  position: number;
}

export interface MessageFull {
  id: string;
  channel_id: string;
  content: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string | null;
  sender_status: string;
  sender_role: string;
}

export interface DmConversation {
  id: string;
  created_at: string;
  other_user_id: string;
  other_username: string;
  other_avatar: string | null;
  other_status: string;
  other_custom_status: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

export interface DmMessageFull {
  id: string;
  conversation_id: string;
  content: string;
  edited: boolean;
  created_at: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string | null;
}

export interface FriendEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  custom_status: string | null;
  friendship_id: string;
}

export interface FriendRequest {
  id: string;
  created_at: string;
  from_id: string;
  from_username: string;
  from_avatar: string | null;
  direction: 'incoming' | 'outgoing';
}
