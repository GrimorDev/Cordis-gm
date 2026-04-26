import { storage } from './storage';
export { API_URL } from './config';
import { API_URL } from './config';

async function getToken(): Promise<string | null> {
  return storage.getItemAsync('cordyn_token');
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
  attachment_url?: string | null;
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
  attachment_url?: string | null;
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  reply_to_username?: string | null;
  initiator_id?: string | null; // for system messages
}

export interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  since: string;
  friendship_id?: string;
}

export interface BlockedUser {
  id: string;
  username: string;
  avatar_url: string | null;
  blocked_at: string;
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
    req<{ token: string; user: User }>('POST', '/auth/login', { login: username, password }),
  register: (username: string, password: string) =>
    req<{ token: string; user: User }>('POST', '/auth/register', { username, password }),
  me:       () => req<User>('GET', '/auth/me'),
  logout:   () => req<{ ok: boolean }>('POST', '/auth/logout'),
};

export interface ServerMember {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  role_name: string;
  role_color?: string | null;
}

export interface ServerBan {
  user_id: string;
  username: string;
  avatar_url: string | null;
  reason: string | null;
  banned_at: string;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  updateMe:      (data: Partial<{ username: string; about_me: string; preferred_status: string; bio: string }>) =>
    req<User>('PUT', '/users/me', data),
  updateStatus:  (status: string) =>
    req<{ ok: boolean }>('PUT', '/users/me/status', { status }),
  changePassword:(current: string, newPass: string) =>
    req<{ ok: boolean }>('PUT', '/users/me/password', { current_password: current, new_password: newPass }),
  get:           (id: string) => req<User>('GET', `/users/${id}`),
  updateAvatar:  async (formData: FormData): Promise<User> => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/users/me/avatar`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
    return data as User;
  },
};

// ── Servers ───────────────────────────────────────────────────────────────────
export const serversApi = {
  list:        () => req<Server[]>('GET', '/servers'),
  get:         (id: string) => req<Server>('GET', `/servers/${id}`),
  create:      (name: string, description?: string) => req<Server>('POST', '/servers', { name, description }),
  join:        (code: string) => req<Server>('POST', '/servers/join', { code }),
  leave:       (id: string) => req<{ ok: boolean }>('POST', `/servers/${id}/leave`),
  members:     (id: string) => req<ServerMember[]>('GET', `/servers/${id}/members`),
  generateInvite: (id: string) => req<{ code: string; url: string }>('POST', `/servers/${id}/invite`),
  update:      (id: string, data: { name?: string; description?: string; icon_url?: string; banner_url?: string; accent_color?: string }) =>
    req<Server>('PUT', `/servers/${id}`, data),
  delete:      (id: string) => req<{ ok: boolean }>('DELETE', `/servers/${id}`),
  kick:        (serverId: string, userId: string) =>
    req<{ ok: boolean }>('POST', `/servers/${serverId}/kick`, { user_id: userId }),
  ban:         (serverId: string, userId: string, reason?: string) =>
    req<{ ok: boolean }>('POST', `/servers/${serverId}/ban`, { user_id: userId, reason }),
  getBans:     (serverId: string) => req<ServerBan[]>('GET', `/servers/${serverId}/bans`),
  unban:       (serverId: string, userId: string) =>
    req<{ ok: boolean }>('DELETE', `/servers/${serverId}/bans/${userId}`),
  getRoles:    (serverId: string) =>
    req<{ id: string; name: string; color: string; permissions: number }[]>('GET', `/servers/${serverId}/roles`),
  uploadImage: async (formData: FormData, folder: 'servers' | 'banners'): Promise<{ url: string }> => {
    const token = await getToken();
    const res = await fetch(`${API_URL}/upload/image?folder=${folder}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
    return data as { url: string };
  },
};

// Richer channel type with optional editable fields
export interface ChannelFull extends Channel {
  description?: string | null;
  is_private?: boolean;
  slowmode_seconds?: number;
  user_limit?: number;
  bitrate?: number;
  background_url?: string | null;
  background_gradient?: string | null;
}

// ── Channels ──────────────────────────────────────────────────────────────────
export const channelsApi = {
  /**
   * The backend returns a category-grouped structure:
   *   [ { id, name, channels: [ Channel, ... ] } ]
   * This function flattens it into a plain Channel[] with category_id / category_name set.
   */
  list: async (serverId: string): Promise<ChannelFull[]> => {
    const raw = await req<{ id: string | null; name: string | null; channels: any[] }[]>(
      'GET', `/channels/server/${serverId}`
    );
    const result: ChannelFull[] = [];
    for (const cat of raw ?? []) {
      for (const ch of cat.channels ?? []) {
        result.push({
          id: ch.id,
          server_id: ch.server_id ?? serverId,
          name: ch.name,
          type: ch.type ?? 'text',
          position: ch.position ?? 0,
          category_id: cat.id ?? null,
          category_name: cat.name ?? null,
          description: ch.description ?? null,
          is_private: ch.is_private ?? false,
          slowmode_seconds: ch.slowmode_seconds ?? 0,
          user_limit: ch.user_limit ?? 0,
          bitrate: ch.bitrate ?? 64,
          background_url: ch.background_url ?? null,
          background_gradient: ch.background_gradient ?? null,
        });
      }
    }
    return result;
  },
  create: (serverId: string, name: string, type: 'text' | 'voice' = 'text', opts?: {
    description?: string; is_private?: boolean; user_limit?: number; bitrate?: number;
  }) =>
    req<Channel>('POST', '/channels', { server_id: serverId, name, type, ...opts }),
  update: (id: string, data: {
    name?: string; description?: string; is_private?: boolean;
    slowmode_seconds?: number; user_limit?: number; bitrate?: number;
    background_url?: string | null; background_gradient?: string | null;
  }) => req<Channel>('PUT', `/channels/${id}`, data),
  delete: (id: string) => req<{ ok: boolean }>('DELETE', `/channels/${id}`),
  createCategory: (serverId: string, name: string) =>
    req<{ id: string; name: string }>('POST', '/channels/categories', { server_id: serverId, name }),
};

// ── Messages ──────────────────────────────────────────────────────────────────
export const messagesApi = {
  list:   (channelId: string, before?: string) =>
    req<Message[]>('GET', `/messages/channel/${channelId}${before ? `?before=${before}` : ''}`),
  send:   (channelId: string, content: string, replyToId?: string, attachmentUrl?: string) =>
    req<Message>('POST', `/messages/channel/${channelId}`, { content, reply_to_id: replyToId, attachment_url: attachmentUrl }),
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
  send: (userId: string, content: string, attachmentUrl?: string) =>
    req<DmMessage>('POST', `/dms/${userId}/messages`, { content, attachment_url: attachmentUrl }),
  editMessage: (id: string, content: string) =>
    req<DmMessage>('PUT', `/dms/messages/${id}`, { content }),
  deleteMessage: (id: string) =>
    req<{ ok: boolean }>('DELETE', `/dms/messages/${id}`),
};

// ── Friends ───────────────────────────────────────────────────────────────────
export const friendsApi = {
  list:    () => req<Friend[]>('GET', '/friends'),
  requests:() => req<FriendRequest[]>('GET', '/friends/requests'),
  send:    (username: string) => req<{ ok: boolean }>('POST', '/friends/request', { username }),
  accept:  (id: string) => req<{ ok: boolean }>('PUT', `/friends/request/${id}`, { action: 'accept' }),
  reject:  (id: string) => req<{ ok: boolean }>('PUT', `/friends/request/${id}`, { action: 'reject' }),
  remove:  (friendshipId: string) => req<{ ok: boolean }>('DELETE', `/friends/${friendshipId}`),
  block:   (userId: string) => req<{ ok: boolean }>('POST', `/friends/block/${userId}`),
  unblock: (userId: string) => req<{ ok: boolean }>('DELETE', `/friends/block/${userId}`),
  blocked: () => req<BlockedUser[]>('GET', '/friends/blocked'),
};
