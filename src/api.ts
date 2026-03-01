const BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(method: string, path: string, body?: unknown, isFormData = false): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? (body as BodyInit) : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || data.message || 'Error');
  return data as T;
}

// ── Token ──────────────────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem('cordis_token');
export const setToken = (t: string) => localStorage.setItem('cordis_token', t);
export const clearToken = () => localStorage.removeItem('cordis_token');

// ── Types ──────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string; username: string; email: string;
  avatar_url?: string | null; banner_url?: string | null;
  banner_color: string; bio?: string | null; custom_status?: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline'; created_at: string;
}
export interface ServerData {
  id: string; name: string; description?: string | null;
  icon_url?: string | null; banner_url?: string | null;
  owner_id: string; created_at: string;
}
export interface ServerRole {
  id: string; server_id: string; name: string; color: string;
  permissions: string[]; position: number; created_at: string;
}
export interface ChannelData {
  id: string; server_id: string; category_id: string | null;
  name: string; type: 'text' | 'voice'; description?: string | null;
  is_private?: boolean; position: number;
  allowed_roles?: { role_id: string; role_name: string; color: string }[];
}
export interface ChannelCategory {
  id: string; name: string; position: number; channels: ChannelData[];
}
export interface ServerFull extends ServerData {
  my_role: string; categories: ChannelCategory[];
}
export interface MessageFull {
  id: string; channel_id: string; content: string; edited: boolean;
  created_at: string; updated_at: string;
  attachment_url?: string | null; reply_to_id?: string | null;
  reply_content?: string | null; reply_username?: string | null;
  sender_id: string; sender_username: string;
  sender_avatar?: string | null; sender_status?: string;
  sender_role?: string | null;
}
export interface DmConversation {
  id: string; created_at: string;
  other_user_id: string; other_username: string;
  other_avatar?: string | null; other_status: string;
  other_custom_status?: string | null;
  last_message?: string | null; last_message_at?: string | null;
}
export interface DmMessageFull {
  id: string; conversation_id: string; content: string; edited: boolean;
  created_at: string; attachment_url?: string | null;
  reply_to_id?: string | null; reply_content?: string | null; reply_username?: string | null;
  sender_id: string; sender_username: string; sender_avatar?: string | null;
}
export interface FriendEntry {
  id: string; username: string; avatar_url?: string | null;
  status: string; custom_status?: string | null;
}
export interface FriendRequest {
  id: string; requester_id: string; addressee_id: string;
  status: string; created_at: string; username?: string; avatar_url?: string | null;
}
export interface ServerMember {
  id: string; username: string; avatar_url?: string | null;
  status: string; custom_status?: string | null;
  role_name: string; joined_at: string;
  roles: { role_id: string; name: string; color: string }[];
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const auth = {
  register: (d: { username: string; email: string; password: string }) =>
    req<{ user: UserProfile; token: string }>('POST', '/auth/register', d),
  login: (d: { login: string; password: string }) =>
    req<{ user: UserProfile; token: string }>('POST', '/auth/login', d),
  logout: () => req<void>('POST', '/auth/logout'),
  me: () => req<UserProfile>('GET', '/auth/me'),
};

// ── Upload helper ──────────────────────────────────────────────────────────
export async function uploadFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const data = await req<{ url: string }>('POST', `/upload?folder=${folder}`, fd, true);
  return data.url;
}

// ── Users ──────────────────────────────────────────────────────────────────
export const users = {
  get: (id: string) => req<UserProfile>('GET', `/users/${id}`),
  search: (q: string) => req<UserProfile[]>('GET', `/users/search/query?q=${encodeURIComponent(q)}`),
  updateMe: (d: Partial<Pick<UserProfile, 'username' | 'bio' | 'custom_status' | 'banner_color' | 'banner_url'>>) =>
    req<UserProfile>('PUT', '/users/me', d),
  updateStatus: (s: string) => req<{ status: string }>('PUT', '/users/me/status', { status: s }),
  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const fd = new FormData(); fd.append('avatar', file);
    return req<{ avatar_url: string }>('POST', '/users/me/avatar', fd, true);
  },
  uploadBanner: async (file: File): Promise<{ banner_url: string }> => {
    const fd = new FormData(); fd.append('banner', file);
    return req<{ banner_url: string }>('POST', '/users/me/banner', fd, true);
  },
};

// ── Servers ────────────────────────────────────────────────────────────────
export const serversApi = {
  list: () => req<ServerData[]>('GET', '/servers'),
  get: (id: string) => req<ServerFull>('GET', `/servers/${id}`),
  create: (name: string) => req<ServerData>('POST', '/servers', { name }),
  update: (id: string, d: Partial<Pick<ServerData, 'name' | 'description' | 'icon_url' | 'banner_url'>>) =>
    req<ServerData>('PUT', `/servers/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/servers/${id}`),
  members: (id: string) => req<ServerMember[]>('GET', `/servers/${id}/members`),
  updateMemberRoles: (serverId: string, userId: string, data: { role_ids?: string[]; role_name?: string }) =>
    req<void>('PUT', `/servers/${serverId}/members/${userId}/roles`, data),
  kickMember: (serverId: string, userId: string) =>
    req<void>('DELETE', `/servers/${serverId}/members/${userId}`),
  roles: {
    list: (serverId: string) => req<ServerRole[]>('GET', `/servers/${serverId}/roles`),
    create: (serverId: string, d: { name: string; color: string; permissions: string[] }) =>
      req<ServerRole>('POST', `/servers/${serverId}/roles`, d),
    update: (serverId: string, roleId: string, d: Partial<{ name: string; color: string; permissions: string[] }>) =>
      req<ServerRole>('PUT', `/servers/${serverId}/roles/${roleId}`, d),
    delete: (serverId: string, roleId: string) =>
      req<void>('DELETE', `/servers/${serverId}/roles/${roleId}`),
  },
  createInvite: (serverId: string, expiresIn: string) =>
    req<{ code: string; expires_at: string | null }>('POST', '/servers/invite/create', { server_id: serverId, expires_in: expiresIn }),
  join: (code: string) => req<ServerData>('POST', `/servers/join/${code}`),
};

// ── Channels ───────────────────────────────────────────────────────────────
export const channelsApi = {
  list: (serverId: string) => req<ChannelCategory[]>('GET', `/channels/server/${serverId}`),
  create: (d: { server_id: string; name: string; type: 'text' | 'voice'; category_id?: string }) =>
    req<ChannelData>('POST', '/channels', d),
  update: (id: string, d: Partial<Pick<ChannelData, 'name' | 'description' | 'is_private'>> & { role_ids?: string[] }) =>
    req<ChannelData>('PUT', `/channels/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/channels/${id}`),
  createCategory: (server_id: string, name: string) =>
    req<ChannelCategory>('POST', '/channels/categories', { server_id, name }),
};

// ── Messages ───────────────────────────────────────────────────────────────
export const messagesApi = {
  list: (channelId: string, before?: string) =>
    req<MessageFull[]>('GET', `/messages/channel/${channelId}${before ? `?before=${before}` : ''}`),
  send: (channelId: string, content: string, opts?: { reply_to_id?: string; attachment_url?: string }) =>
    req<MessageFull>('POST', `/messages/channel/${channelId}`, { content, ...opts }),
  edit: (id: string, content: string) => req<MessageFull>('PUT', `/messages/${id}`, { content }),
  delete: (id: string) => req<void>('DELETE', `/messages/${id}`),
  addReaction: (id: string, emoji: string) => req<void>('POST', `/messages/${id}/reactions`, { emoji }),
  removeReaction: (id: string, emoji: string) => req<void>('DELETE', `/messages/${id}/reactions/${emoji}`),
};

// ── DMs ────────────────────────────────────────────────────────────────────
export const dmsApi = {
  conversations: () => req<DmConversation[]>('GET', '/dms/conversations'),
  messages: (userId: string, before?: string) =>
    req<DmMessageFull[]>('GET', `/dms/${userId}/messages${before ? `?before=${before}` : ''}`),
  send: (userId: string, content: string, opts?: { reply_to_id?: string; attachment_url?: string }) =>
    req<DmMessageFull>('POST', `/dms/${userId}/messages`, { content, ...opts }),
  deleteMessage: (id: string) => req<void>('DELETE', `/dms/messages/${id}`),
};

// ── Friends ────────────────────────────────────────────────────────────────
export const friendsApi = {
  list: () => req<FriendEntry[]>('GET', '/friends'),
  requests: () => req<FriendRequest[]>('GET', '/friends/requests'),
  sendRequest: (username: string) => req<void>('POST', '/friends/request', { username }),
  respondRequest: (id: string, action: 'accept' | 'reject') =>
    req<void>('PUT', `/friends/request/${id}`, { action }),
  remove: (id: string) => req<void>('DELETE', `/friends/${id}`),
};
