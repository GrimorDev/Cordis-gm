// Determine the API base URL — priority order:
// 1. VITE_API_BASE baked in at build time (GitHub Actions secret → always correct)
// 2. __TAURI_BASE__ global injected below at runtime as fallback for Tauri
// 3. Tauri dev fallback (localhost)
// 4. Web same-origin (/api)
const _viteBase = (import.meta.env.VITE_API_BASE as string | undefined) || '';
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const BASE = (
  _viteBase
    ? _viteBase
    : isTauri
      ? 'http://localhost:4000/api'
      : '/api'
).replace(/\/$/, '');

export const API_BASE = BASE;

// Origin without /api — resolves /uploads/... to absolute URLs in Tauri.
export const STATIC_BASE = BASE.replace(/\/api\/?$/, '');

// Log at startup so DevTools shows what URL is being used
if (typeof window !== 'undefined') {
  console.log(`[api] BASE=${BASE} STATIC_BASE=${STATIC_BASE} VITE_API_BASE=${_viteBase||'(not set)'}`);
}

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
export const getToken = () => localStorage.getItem('cordyn_token') || sessionStorage.getItem('cordyn_token');
export const setToken = (t: string) => localStorage.setItem('cordyn_token', t);
export const clearToken = () => localStorage.removeItem('cordyn_token');

// ── Types ──────────────────────────────────────────────────────────────────
export interface Badge {
  id: string; name: string; label: string;
  color: string; icon: string;
  description?: string | null; position?: number;
}
export interface UserProfile {
  id: string; username: string; email: string;
  avatar_url?: string | null; banner_url?: string | null;
  banner_color: string; bio?: string | null; custom_status?: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline'; created_at: string;
  mutual_friends_count?: number;
  badges?: Badge[];
  is_admin?: boolean;
  // User preferences (stored in DB)
  accent_color?: string | null;
  compact_messages?: boolean | null;
  voice_noise_cancel?: boolean | null;
  font_size?: string | null;
  show_timestamps?: boolean | null;
  show_chat_avatars?: boolean | null;
  message_animations?: boolean | null;
  show_link_previews?: boolean | null;
  privacy_status_visible?: boolean | null;
  privacy_typing_visible?: boolean | null;
  privacy_read_receipts?: boolean | null;
  privacy_friend_requests?: boolean | null;
  privacy_dm_from_strangers?: boolean | null;
  avatar_effect?: string | null;
  active_tag_server_id?: string | null;
  active_tag?: string | null;
  theme_id?: string | null;
}
export interface ServerData {
  id: string; name: string; description?: string | null;
  icon_url?: string | null; banner_url?: string | null;
  is_official?: boolean;
  owner_id: string; created_at: string;
}
export interface ServerTag {
  server_id: string;
  tag: string;
  color?: string | null;
  icon?: string | null;
  created_at: string;
}
export interface ServerRole {
  id: string; server_id: string; name: string; color: string;
  permissions: string[]; position: number; created_at: string;
  is_default?: boolean;
}
export interface ChannelData {
  id: string; server_id: string; category_id: string | null;
  name: string; type: 'text' | 'voice' | 'forum' | 'announcement'; description?: string | null;
  is_private?: boolean; position: number; slowmode_seconds?: number;
  allowed_roles?: { role_id: string; role_name: string; color: string }[];
}
export interface ForumPost {
  id: string; channel_id: string; author_id: string; title: string; content: string;
  image_url?: string | null; pinned: boolean; locked: boolean; reply_count: number;
  created_at: string; updated_at: string;
  author_username: string; author_avatar?: string | null;
  replies?: ForumReply[];
}
export interface ForumReply {
  id: string; post_id: string; author_id: string; content: string; created_at: string;
  author_username: string; author_avatar?: string | null;
}
export interface ChannelCategory {
  id: string; name: string; position: number; channels: ChannelData[];
}
export interface ServerFull extends ServerData {
  my_role: string; categories: ChannelCategory[];
  my_permissions?: string[];
  member_count?: number;
}
export interface ServerBan {
  user_id: string; username: string; avatar_url?: string | null;
  reason?: string | null; created_at: string; banned_by_username?: string | null;
}
export interface MsgReaction { emoji: string; count: number; mine: boolean; }
export interface MessageFull {
  id: string; channel_id: string; content: string; edited: boolean;
  created_at: string; updated_at: string;
  attachment_url?: string | null; reply_to_id?: string | null;
  reply_content?: string | null; reply_username?: string | null;
  sender_id: string; sender_username: string;
  sender_avatar?: string | null; sender_status?: string;
  sender_role?: string | null;
  sender_role_color?: string | null;
  sender_avatar_effect?: string | null;
  sender_tag?: string | null;
  sender_tag_color?: string | null;
  sender_tag_icon?: string | null;
  sender_tag_server_id?: string | null;
  pinned?: boolean;
  reactions?: MsgReaction[];
}
export interface DmConversation {
  id: string; created_at: string;
  other_user_id: string; other_username: string;
  other_avatar?: string | null; other_status: string;
  other_custom_status?: string | null;
  other_last_read_at?: string | null;
  other_avatar_effect?: string | null;
  other_tag?: string | null;
  other_tag_color?: string | null;
  other_tag_icon?: string | null;
  other_tag_server_id?: string | null;
  last_message?: string | null; last_message_at?: string | null;
}
export interface DmMessageFull {
  id: string; conversation_id: string; content: string; edited: boolean;
  created_at: string; attachment_url?: string | null;
  reply_to_id?: string | null; reply_content?: string | null; reply_username?: string | null;
  sender_id: string; sender_username: string; sender_avatar?: string | null;
  sender_avatar_effect?: string | null;
  sender_tag?: string | null;
  sender_tag_color?: string | null;
  sender_tag_icon?: string | null;
  sender_tag_server_id?: string | null;
}
export interface FriendEntry {
  id: string; username: string; avatar_url?: string | null;
  status: string; custom_status?: string | null;
  friendship_id?: string;
  friends_since?: string;
}
export interface FriendRequest {
  id: string;
  from_id: string;
  from_username: string;
  from_avatar?: string | null;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}
export interface FavoriteGame {
  id: string; game_name: string; game_cover_url?: string | null;
  game_genre?: string | null; rawg_id?: number | null; display_order: number;
}
export interface SpotifyTrack {
  name: string; artists: string; album_cover?: string | null;
  preview_url?: string | null; external_url?: string | null;
  uri?: string | null; is_playing?: boolean;
  progress_ms?: number | null; duration_ms?: number | null;
}
export interface SpotifyJamSession {
  role: 'host' | 'listener' | null;
  jam_id?: string;
  host?: { id: string; username: string; avatar_url?: string | null };
  members: string[];
}
export interface SpotifyVoiceDj {
  dj: { id: string; username: string; avatar_url?: string | null } | null;
}
export interface SpotifyData {
  connected: boolean; show_on_profile: boolean; display_name?: string | null;
  current_playing?: SpotifyTrack | null; top_tracks?: SpotifyTrack[];
}

export interface ServerMember {
  id: string; username: string; avatar_url?: string | null;
  status: string; custom_status?: string | null;
  role_name: string; joined_at: string;
  roles: { role_id: string; name: string; color: string }[];
  avatar_effect?: string | null;
  badges?: Badge[];
  is_bot?: boolean;
  active_tag?: string | null;
  active_tag_server_id?: string | null;
}

// ── Bot types ──────────────────────────────────────────────────────────────
export interface BotDefinition {
  id: string;           // static ID, e.g. 'music'
  name: string;         // display name
  description: string;
  avatar: string;       // emoji or URL
  category: string;     // 'Music' | 'Utility' | 'Fun'
  commands: { name: string; description: string; usage: string }[];
}
export interface InstalledBot {
  bot_id: string; server_id: string; channel_id?: string | null;
  installed_at: string; installed_by: string;
}
export interface MusicBotState {
  playing: boolean;
  title?: string;
  url?: string;
  directUrl?: string;     // Direct CDN audio URL from yt-dlp (for server proxy streaming)
  videoId?: string;       // YouTube video ID — used for iframe embed on client
  thumbnail?: string;
  duration?: number;
  channel_id: string;
  started_at?: number;    // Unix ms — used to seek iframe to current position
  requested_by?: string;
  queue: { title: string; url: string; duration?: number }[];
}

// ── Available bots (static, frontend-defined) ─────────────────────────────
export const AVAILABLE_BOTS: BotDefinition[] = [
  {
    id: 'music',
    name: 'Cordyn Music',
    description: 'Odtwarzaj muzykę z YouTube na kanałach głosowych. Obsługuje kolejkę, pomijanie i wiele więcej.',
    avatar: '🎵',
    category: 'Music',
    commands: [
      { name: 'play',   description: 'Odtwórz utwór z YouTube',  usage: '/play <url>' },
      { name: 'skip',   description: 'Pomiń aktualny utwór',     usage: '/skip' },
      { name: 'stop',   description: 'Zatrzymaj odtwarzanie',    usage: '/stop' },
      { name: 'pause',  description: 'Wstrzymaj odtwarzanie',    usage: '/pause' },
      { name: 'queue',  description: 'Pokaż kolejkę',            usage: '/queue' },
      { name: 'volume', description: 'Ustaw głośność (0-100)',   usage: '/volume <0-100>' },
    ],
  },
  {
    id: 'fun',
    name: 'Cordyn Fun',
    description: 'Zabawy i gry dla całego serwera — kostki, monety, magiczna kula 8 i więcej.',
    avatar: '🎮',
    category: 'Fun',
    commands: [
      { name: 'dice',  description: 'Rzuć kością (domyślnie k6)', usage: '/dice [ilość ścian]' },
      { name: 'flip',  description: 'Rzuć monetą',               usage: '/flip' },
      { name: '8ball', description: 'Zapytaj magiczną kulę',      usage: '/8ball <pytanie>' },
      { name: 'meme',  description: 'Losowy mem dla programistów', usage: '/meme' },
      { name: 'rps',   description: 'Kamień, papier, nożyce',    usage: '/rps <kamien|papier|nozyce>' },
    ],
  },
  {
    id: 'moderacja',
    name: 'Cordyn Moderacja',
    description: 'Narzędzia moderacyjne — ostrzeżenia, usuwanie wiadomości, wyrzucanie.',
    avatar: '🔨',
    category: 'Moderation',
    commands: [
      { name: 'warn',  description: 'Ostrzeż użytkownika',       usage: '/warn <użytkownik> [powód]' },
      { name: 'warns', description: 'Pokaż ostrzeżenia',         usage: '/warns <użytkownik>' },
      { name: 'clear', description: 'Usuń ostatnie N wiadomości', usage: '/clear <1-100>' },
      { name: 'kick',  description: 'Wyrzuć z serwera',          usage: '/kick <użytkownik>' },
    ],
  },
  {
    id: 'polls',
    name: 'Cordyn Polls',
    description: 'Twórz ankiety z opcjami bezpośrednio na kanale tekstowym.',
    avatar: '📊',
    category: 'Utility',
    commands: [
      { name: 'poll', description: 'Utwórz ankietę z opcjami', usage: '/poll Pytanie | Opcja 1 | Opcja 2' },
    ],
  },
  {
    id: 'info',
    name: 'Cordyn Info',
    description: 'Informacje o serwerze i użytkownikach — statystyki, profile, ping.',
    avatar: 'ℹ️',
    category: 'Utility',
    commands: [
      { name: 'serverinfo', description: 'Pokaż statystyki serwera',          usage: '/serverinfo' },
      { name: 'userinfo',   description: 'Pokaż profil użytkownika',          usage: '/userinfo [@użytkownik]' },
      { name: 'ping',       description: 'Sprawdź opóźnienie bota',           usage: '/ping' },
    ],
  },
  {
    id: 'remind',
    name: 'Cordyn Remind',
    description: 'Ustawiaj przypomnienia — bot napisze do Ciebie na kanale gdy minie czas.',
    avatar: '⏰',
    category: 'Utility',
    commands: [
      { name: 'remind', description: 'Ustaw przypomnienie', usage: '/remind <czas> <treść>  np. /remind 30m Sprawdź piekarnik' },
    ],
  },
];

// ── Bot API ──────────────────────────────────────────────────────────────
export const botsApi = {
  list: (serverId: string) =>
    req<InstalledBot[]>('GET', `/servers/${serverId}/bots`),
  install: (serverId: string, botId: string, channelId?: string) =>
    req<InstalledBot>('POST', `/servers/${serverId}/bots`, { bot_id: botId, channel_id: channelId }),
  remove: (serverId: string, botId: string) =>
    req<void>('DELETE', `/servers/${serverId}/bots/${botId}`),
  getBotSettings: (serverId: string) =>
    req<{ bot_channel_id: string | null }>('GET', `/servers/${serverId}/bots/settings`),
  setBotSettings: (serverId: string, data: { bot_channel_id: string | null }) =>
    req<{ bot_channel_id: string | null }>('PUT', `/servers/${serverId}/bots/settings`, data),
};

// ── Auth ───────────────────────────────────────────────────────────────────
export type LoginResult =
  | { user: UserProfile; token: string; requiresTwoFactor?: never }
  | { requiresTwoFactor: true; sessionId: string; user?: never; token?: never };

export const auth = {
  sendCode: (email: string) =>
    req<{ message: string }>('POST', '/auth/send-code', { email }),
  register: (d: { username: string; email: string; password: string; code: string }) =>
    req<{ user: UserProfile; token: string }>('POST', '/auth/register', d),
  login: (d: { login: string; password: string }) =>
    req<LoginResult>('POST', '/auth/login', d),
  verify2fa: (d: { sessionId: string; code: string; type: 'totp' | 'backup' }) =>
    req<{ user: UserProfile; token: string }>('POST', '/auth/2fa-verify', d),
  logout: () => req<void>('POST', '/auth/logout'),
  me: () => req<UserProfile>('GET', '/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>('PUT', '/auth/change-password', { currentPassword, newPassword }),
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
  updateMe: (d: Partial<Pick<UserProfile,
    'username' | 'bio' | 'custom_status' | 'banner_color' | 'banner_url' |
    'accent_color' | 'compact_messages' | 'voice_noise_cancel' |
    'font_size' | 'show_timestamps' | 'show_chat_avatars' | 'message_animations' | 'show_link_previews' |
    'privacy_status_visible' | 'privacy_typing_visible' | 'privacy_read_receipts' |
    'privacy_friend_requests' | 'privacy_dm_from_strangers' | 'avatar_effect' | 'theme_id'
  >>) => req<UserProfile>('PUT', '/users/me', d),
  updateStatus: (s: string, durationMs?: number) => req<{ status: string; status_until: string | null }>('PUT', '/users/me/status', { status: s, ...(durationMs ? { duration_ms: durationMs } : {}) }),
  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const fd = new FormData(); fd.append('avatar', file);
    return req<{ avatar_url: string }>('POST', '/users/me/avatar', fd, true);
  },
  uploadBanner: async (file: File): Promise<{ banner_url: string }> => {
    const fd = new FormData(); fd.append('banner', file);
    return req<{ banner_url: string }>('POST', '/users/me/banner', fd, true);
  },
  requestDeletion: () => req<{ message: string }>('POST', '/users/me/request-deletion'),
  confirmDeletion: (code: string) => req<{ message: string }>('DELETE', '/users/me', { code }),
};

// ── Two-Factor Auth ────────────────────────────────────────────────────────
export interface TwoFactorStatus {
  totp_enabled: boolean;
  backup_codes_count: number;
  phone_number: string | null;
  phone_verified: boolean;
}
export const twoFactorApi = {
  status: () => req<TwoFactorStatus>('GET', '/users/me/2fa/status'),
  totpSetup: () => req<{ secret: string; qr_code: string; manual_key: string }>('POST', '/users/me/2fa/totp/setup'),
  totpEnable: (code: string) => req<{ backup_codes: string[] }>('POST', '/users/me/2fa/totp/enable', { code }),
  totpDisable: (password: string, code: string) => req<{ ok: boolean }>('DELETE', '/users/me/2fa/totp', { password, code }),
  regenerateBackupCodes: (password: string, code: string) =>
    req<{ backup_codes: string[] }>('POST', '/users/me/2fa/backup-codes/regenerate', { password, code }),
};

// ── Servers ────────────────────────────────────────────────────────────────
export const serversApi = {
  list: () => req<ServerData[]>('GET', '/servers'),
  get: (id: string) => req<ServerFull>('GET', `/servers/${id}`),
  create: (name: string) => req<ServerData>('POST', '/servers', { name }),
  update: (id: string, d: Partial<Pick<ServerData, 'name' | 'description' | 'icon_url' | 'banner_url'>>) =>
    req<ServerData>('PUT', `/servers/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/servers/${id}`),
  leave: (id: string) => req<void>('POST', `/servers/${id}/leave`),
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
  inviteInfo: (code: string) =>
    req<{ code: string; server_id: string; server_name: string; icon_url: string | null; creator_username: string; creator_avatar: string | null }>('GET', `/servers/invite/${code}/info`),
  join: (code: string) => req<ServerData>('POST', `/servers/join/${code}`),
  activity: (id: string) => req<{id:string;type:string;icon:string;text:string;time:string}[]>('GET', `/servers/${id}/activity`),
  bans: {
    list: (serverId: string) => req<ServerBan[]>('GET', `/servers/${serverId}/bans`),
    ban: (serverId: string, userId: string, reason?: string) =>
      req<void>('POST', `/servers/${serverId}/bans/${userId}`, { reason }),
    unban: (serverId: string, userId: string) =>
      req<void>('DELETE', `/servers/${serverId}/bans/${userId}`),
  },
  tag: {
    get: (serverId: string) => req<ServerTag | null>('GET', `/servers/${serverId}/tag`),
    set: (serverId: string, tag: string, color?: string|null, icon?: string|null) => req<ServerTag>('PUT', `/servers/${serverId}/tag`, { tag, color, icon }),
    remove: (serverId: string) => req<{ ok: boolean }>('DELETE', `/servers/${serverId}/tag`),
  },
  setActiveTag: (serverId: string | null) =>
    req<{ active_tag_server_id: string | null; tag: string | null }>('PUT', '/users/me/active-tag', { server_id: serverId }),
};

// ── Channels ───────────────────────────────────────────────────────────────
export const channelsApi = {
  list: (serverId: string) => req<ChannelCategory[]>('GET', `/channels/server/${serverId}`),
  voiceUsers: (serverId: string) =>
    req<Record<string, { id: string; username: string; avatar_url: string | null; status: string }[]>>(
      'GET', `/channels/server/${serverId}/voice-users`
    ),
  create: (d: { server_id: string; name: string; type: 'text' | 'voice' | 'forum' | 'announcement'; category_id?: string; is_private?: boolean; role_ids?: string[] }) =>
    req<ChannelData>('POST', '/channels', d),
  update: (id: string, d: Partial<Pick<ChannelData, 'name' | 'description' | 'is_private'>> & { role_ids?: string[] }) =>
    req<ChannelData>('PUT', `/channels/${id}`, d),
  delete: (id: string) => req<void>('DELETE', `/channels/${id}`),
  createCategory: (server_id: string, name: string, is_private?: boolean, role_ids?: string[]) =>
    req<ChannelCategory>('POST', '/channels/categories', { server_id, name, is_private, role_ids }),
  updateCategory: (id: string, name: string) =>
    req<ChannelCategory>('PUT', `/channels/categories/${id}`, { name }),
  deleteCategory: (id: string) =>
    req<void>('DELETE', `/channels/categories/${id}`),
  reorderCategories: (serverId: string, categories: { id: string; position: number }[]) =>
    req<{ ok: boolean }>('PATCH', '/channels/categories/reorder', { server_id: serverId, categories }),
  reorderChannels: (serverId: string, channels: { id: string; position: number; category_id: string }[]) =>
    req<{ ok: boolean }>('PATCH', '/channels/reorder', { server_id: serverId, channels }),
};

// ── Forum ─────────────────────────────────────────────────────────────────
export const forumApi = {
  listPosts: (channelId: string) => req<ForumPost[]>('GET', `/channels/${channelId}/posts`),
  createPost: (channelId: string, d: { title: string; content: string; image_url?: string }) =>
    req<ForumPost>('POST', `/channels/${channelId}/posts`, d),
  getPost: (channelId: string, postId: string) => req<ForumPost>('GET', `/channels/${channelId}/posts/${postId}`),
  deletePost: (channelId: string, postId: string) => req<void>('DELETE', `/channels/${channelId}/posts/${postId}`),
  createReply: (channelId: string, postId: string, content: string) =>
    req<ForumReply>('POST', `/channels/${channelId}/posts/${postId}/replies`, { content }),
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
  pin: (id: string, pinned?: boolean) => req<void>('PUT', `/messages/${id}/pin`, { pinned: pinned !== false }),
  listPinned: (channelId: string) => req<MessageFull[]>('GET', `/messages/channel/${channelId}/pinned`),
  edits: (id: string) => req<{old_content:string;edited_at:string}[]>('GET', `/messages/${id}/edits`),
};

// ── DMs ────────────────────────────────────────────────────────────────────
export const dmsApi = {
  conversations: () => req<DmConversation[]>('GET', '/dms/conversations'),
  messages: (userId: string, before?: string) =>
    req<DmMessageFull[]>('GET', `/dms/${userId}/messages${before ? `?before=${before}` : ''}`),
  send: (userId: string, content: string, opts?: { reply_to_id?: string; attachment_url?: string }) =>
    req<DmMessageFull>('POST', `/dms/${userId}/messages`, { content, ...opts }),
  sendSystem: (userId: string, content: string) =>
    req<DmMessageFull>('POST', `/dms/${userId}/system-message`, { content }),
  editMessage: (id: string, content: string) => req<DmMessageFull>('PUT', `/dms/messages/${id}`, { content }),
  deleteMessage: (id: string) => req<void>('DELETE', `/dms/messages/${id}`),
  messageEdits: (id: string) => req<{old_content:string;edited_at:string}[]>('GET', `/dms/messages/${id}/edits`),
  markRead: (userId: string) => req<{ok:boolean}>('PUT', `/dms/${userId}/read`),
};

// ── Friends ────────────────────────────────────────────────────────────────
export const friendsApi = {
  list: () => req<FriendEntry[]>('GET', '/friends'),
  requests: () => req<FriendRequest[]>('GET', '/friends/requests'),
  sendRequest: (username: string) => req<void>('POST', '/friends/request', { username }),
  respondRequest: (id: string, action: 'accept' | 'reject') =>
    req<void>('PUT', `/friends/request/${id}`, { action }),
  remove: (id: string) => req<void>('DELETE', `/friends/${id}`),
  block: (userId: string) => req<void>('POST', `/friends/block/${userId}`),
  unblock: (userId: string) => req<void>('DELETE', `/friends/block/${userId}`),
  blocked: () => req<{ id: string; username: string; avatar_url?: string; blocked_at: string }[]>('GET', '/friends/blocked'),
};

// ── Admin ───────────────────────────────────────────────────────────────────
export interface AdminStats {
  users: number; servers: number; messages: number; dm_messages: number;
  badges: number; badge_assignments: number;
  memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
  node_version: string; uptime_seconds: number;
}
export interface AdminUser {
  id: string; username: string; avatar_url?: string | null;
  status: string; is_admin: boolean; created_at: string;
  badges: Badge[];
  server_count?: number; message_count?: number;
}
export interface UserBan {
  id: string; user_id: string; banned_by: string | null; banned_by_username?: string;
  reason: string | null; ban_type: 'permanent' | 'temporary' | 'ip';
  banned_until: string | null; ip_address: string | null;
  is_active: boolean; created_at: string;
}
export interface AdminServer {
  id: string; name: string; icon_url?: string | null;
  owner_id: string; owner_name: string;
  member_count: number; channel_count: number; created_at: string;
}
export interface AdminOverview {
  total_users: number; total_servers: number; total_messages: number;
  total_dms: number; total_channels: number; online_users: number;
  registrations_7d: { date: string; count: number }[];
  memory: { rss: number; heapUsed: number; heapTotal: number };
  node_version: string; uptime_seconds: number;
}
// ── Games (RAWG) ───────────────────────────────────────────────────────────
export const gamesApi = {
  search:  (q: string)  => req<{rawg_id:number;name:string;cover_url:string|null;genre:string|null}[]>('GET', `/games/search?q=${encodeURIComponent(q)}`),
  getUser: (userId: string) => req<FavoriteGame[]>('GET', `/games/user/${userId}`),
  add:     (d: { game_name: string; game_cover_url?: string|null; game_genre?: string|null; rawg_id?: number|null }) =>
             req<FavoriteGame>('POST', '/games', d),
  remove:  (id: string) => req<void>('DELETE', `/games/${id}`),
};

// ── Twitch ─────────────────────────────────────────────────────────────────
export interface TwitchStream {
  title: string; game_name: string; viewer_count: number;
  thumbnail_url: string; login: string;
}
export interface TwitchData {
  connected: boolean; show_on_profile: boolean;
  login?: string | null; display_name?: string | null;
  is_live: boolean; stream?: TwitchStream | null;
}

// ── Steam ──────────────────────────────────────────────────────────────────
export interface SteamGame {
  name: string; gameid: string;
  header_image: string; // cdn.akamai.steamstatic.com/steam/apps/{gameid}/header.jpg
}
export interface SteamData {
  connected: boolean; show_on_profile: boolean;
  display_name?: string | null; avatar_url?: string | null;
  current_game?: SteamGame | null;
}

// ── Spotify ────────────────────────────────────────────────────────────────
export const spotifyApi = {
  connect:       () => req<{ url: string }>('GET', '/spotify/connect'),
  status:        () => req<SpotifyData>('GET', '/spotify/status'),
  nowPlaying:    () => req<{ track: SpotifyTrack | null }>('GET', '/spotify/now-playing'),
  userPublic:    (userId: string) => req<SpotifyData>('GET', `/spotify/user/${userId}`),
  setSettings:   (d: { show_on_profile: boolean }) => req<{ok:boolean}>('PUT', '/spotify/settings', d),
  disconnect:    () => req<{ok:boolean}>('DELETE', '/spotify/disconnect'),
  // Playback control (requires Premium)
  play:          (uri: string, position_ms?: number) =>
    req<{ok:boolean}>('POST', '/spotify/playback/play', { uri, position_ms }),
  setVolume:     (volume_percent: number) =>
    req<{ok:boolean}>('PUT', '/spotify/playback/volume', { volume_percent }),
  // JAM sessions
  jamStart:      () => req<{ jam_id: string }>('POST', '/spotify/jam/start'),
  jamJoin:       (hostId: string) => req<{ ok: boolean; jam_id: string }>('POST', `/spotify/jam/join/${hostId}`),
  jamLeave:      () => req<{ ok: boolean; was_host: boolean; notified_members?: string[]; host_id?: string }>('DELETE', '/spotify/jam'),
  jamActive:     () => req<SpotifyJamSession>('GET', '/spotify/jam/active'),
  jamInfo:       (hostId: string) => req<{ jam_id: string; host: any; members: any[] }>('GET', `/spotify/jam/${hostId}`),
  // Voice DJ
  voiceDjStart:  (channel_id: string) => req<{ok:boolean}>('POST', '/spotify/voice-dj/start', { channel_id }),
  voiceDjStop:   () => req<{ok:boolean; channel_id: string|null}>('DELETE', '/spotify/voice-dj'),
  voiceDjGet:    (channelId: string) => req<SpotifyVoiceDj>('GET', `/spotify/voice-dj/${channelId}`),
};

export const twitchApi = {
  connect:     () => req<{ url: string }>('GET', '/twitch/connect'),
  status:      () => req<TwitchData>('GET', '/twitch/status'),
  stream:      () => req<{ stream: TwitchStream | null }>('GET', '/twitch/stream'),
  userPublic:  (userId: string) => req<TwitchData>('GET', `/twitch/user/${userId}`),
  setSettings: (d: { show_on_profile: boolean }) => req<{ok:boolean}>('PUT', '/twitch/settings', d),
  disconnect:  () => req<{ok:boolean}>('DELETE', '/twitch/disconnect'),
};

export const steamApi = {
  connect:     () => req<{ url: string }>('GET', '/steam/connect'),
  status:      () => req<SteamData>('GET', '/steam/status'),
  nowPlaying:  () => req<{ game: SteamGame | null }>('GET', '/steam/now-playing'),
  userPublic:  (userId: string) => req<SteamData>('GET', `/steam/user/${userId}`),
  setSettings: (d: { show_on_profile: boolean }) => req<{ok:boolean}>('PUT', '/steam/settings', d),
  disconnect:  () => req<{ok:boolean}>('DELETE', '/steam/disconnect'),
};

export const adminApi = {
  stats: () => req<AdminStats>('GET', '/admin/stats'),
  overview: () => req<AdminOverview>('GET', '/admin/overview'),
  badges: {
    list: () => req<Badge[]>('GET', '/admin/badges'),
    create: (d: { name: string; label: string; color?: string; icon?: string; description?: string; position?: number }) =>
      req<Badge>('POST', '/admin/badges', d),
    update: (id: string, d: Partial<{ label: string; color: string; icon: string; description: string; position: number }>) =>
      req<Badge>('PUT', `/admin/badges/${id}`, d),
    delete: (id: string) => req<void>('DELETE', `/admin/badges/${id}`),
    assign: (user_id: string, badge_id: string) =>
      req<{ ok: boolean }>('POST', '/admin/badges/assign', { user_id, badge_id }),
    remove: (userId: string, badgeId: string) =>
      req<{ ok: boolean }>('DELETE', `/admin/users/${userId}/badges/${badgeId}`),
  },
  users: {
    list: (page = 1, limit = 50) =>
      req<{ users: AdminUser[]; total: number }>('GET', `/admin/users?page=${page}&limit=${limit}`),
    search: (q: string) => req<AdminUser[]>('GET', `/admin/users/search?q=${encodeURIComponent(q)}`),
    setAdmin: (userId: string, is_admin: boolean) =>
      req<{ ok: boolean }>('POST', `/admin/users/${userId}/set-admin`, { is_admin }),
    bans: (userId: string) => req<UserBan[]>('GET', `/admin/users/${userId}/bans`),
    ban: (userId: string, data: { ban_type: 'permanent' | 'temporary' | 'ip'; reason?: string; duration_hours?: number; ip_address?: string }) =>
      req<UserBan>('POST', `/admin/users/${userId}/ban`, data),
    unban: (userId: string) => req<{ ok: boolean }>('DELETE', `/admin/users/${userId}/ban`),
  },
  servers: () => req<AdminServer[]>('GET', '/admin/servers'),
  storage: {
    stats:     () => req<AdminStorageStats>('GET', '/admin/storage'),
    users:     (page = 1, q = '') => req<{ users: StorageUser[]; total: number }>('GET', `/admin/storage/users?page=${page}&limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    deleteAtt: (id: number) => req<{ ok: boolean }>('DELETE', `/admin/storage/attachment/${id}`),
    setQuota:  (userId: string, data: { quota_mb?: number; is_premium?: boolean }) =>
      req<{ ok: boolean }>('POST', `/admin/storage/users/${userId}/quota`, data),
    recalc:    () => req<{ ok: boolean }>('POST', '/admin/storage/recalc'),
  },
};

export interface StorageUser {
  id: string; username: string; avatar_url: string | null; is_premium: boolean;
  storage_used_bytes: number; storage_quota_bytes: number; file_count: number; real_bytes: number;
}
export interface AdminStorageStats {
  r2_enabled: boolean;
  totals: {
    total_files: number; total_bytes: number;
    image_bytes: number; video_bytes: number; audio_bytes: number; other_bytes: number;
    unique_uploaders: number;
  };
  by_mime: { category: string; count: number; bytes: number }[];
  top_users: StorageUser[];
  recent: { id: number; r2_key: string; url: string; file_size: number; mime_type: string; original_name: string; created_at: string; username: string; avatar_url: string | null }[];
}

// ── Custom Server Emojis ───────────────────────────────────────────────────
export interface ServerEmoji {
  id: string; server_id: string; name: string; image_url: string;
  uploaded_by: string | null; created_at: string;
}
export const emojisApi = {
  list:   (serverId: string) => req<ServerEmoji[]>('GET', `/servers/${serverId}/emojis`),
  create: (serverId: string, name: string, image_url: string) =>
    req<ServerEmoji>('POST', `/servers/${serverId}/emojis`, { name, image_url }),
  delete: (serverId: string, emojiId: string) =>
    req<{ ok: boolean }>('DELETE', `/servers/${serverId}/emojis/${emojiId}`),
};

// ── User Notes ────────────────────────────────────────────────────────────
export const notesApi = {
  get:    (userId: string) => req<{ content: string }>('GET', `/users/notes/${userId}`),
  save:   (userId: string, content: string) =>
    req<{ ok: boolean }>('PUT', `/users/notes/${userId}`, { content }),
  delete: (userId: string) => req<{ ok: boolean }>('DELETE', `/users/notes/${userId}`),
};

// ── Polls ─────────────────────────────────────────────────────────────────
export interface PollOption { id: string; text: string; }
export interface PollData {
  id: string; question: string; options: PollOption[];
  multi_vote: boolean; ends_at: string | null; created_at: string;
  message_id: string | null; dm_message_id: string | null;
  votes: Record<string, number>;   // option_id → count
  my_votes: string[];              // option_ids I voted for
  total_votes: number;
}
export const pollsApi = {
  create: (d: { message_id?: string; dm_message_id?: string; question: string; options: PollOption[]; multi_vote?: boolean; ends_at?: string | null }) =>
    req<PollData>('POST', '/polls', d),
  get:    (id: string) => req<PollData>('GET', `/polls/${id}`),
  vote:   (id: string, option_id: string) => req<PollData>('POST', `/polls/${id}/vote`, { option_id }),
  unvote: (id: string, option_id: string) => req<PollData>('DELETE', `/polls/${id}/vote`, { option_id }),
};

// ── Push Notifications ────────────────────────────────────────────────────
export const pushApi = {
  subscribe:   (sub: { endpoint: string; p256dh: string; auth: string }) =>
    req<{ ok: boolean }>('POST', '/push/subscribe', sub),
  unsubscribe: () => req<{ ok: boolean }>('DELETE', '/push/subscribe'),
};

// ── Server Automations ────────────────────────────────────────────────────
export type AutomationTrigger = 'member_join'|'member_leave'|'role_assigned'|'message_contains';
export type AutomationActionType = 'assign_role'|'remove_role'|'send_channel_message'|'send_dm'|'delete_message'|'kick_member';
export interface AutomationAction {
  type: AutomationActionType;
  config: { role_id?: string; channel_id?: string; message?: string };
}
export interface ServerAutomation {
  id: string; server_id: string; name: string; enabled: boolean;
  trigger_type: AutomationTrigger;
  trigger_config: { role_id?: string; keyword?: string };
  actions: AutomationAction[]; created_by: string | null; created_at: string;
}
export const automationsApi = {
  list:   (serverId: string) => req<ServerAutomation[]>('GET', `/servers/${serverId}/automations`),
  create: (serverId: string, d: Omit<ServerAutomation, 'id'|'server_id'|'created_by'|'created_at'>) =>
    req<ServerAutomation>('POST', `/servers/${serverId}/automations`, d),
  update: (serverId: string, id: string, d: Partial<Omit<ServerAutomation,'id'|'server_id'|'created_by'|'created_at'>>) =>
    req<ServerAutomation>('PUT', `/servers/${serverId}/automations/${id}`, d),
  delete: (serverId: string, id: string) =>
    req<{ ok: boolean }>('DELETE', `/servers/${serverId}/automations/${id}`),
  toggle: (serverId: string, id: string, enabled: boolean) =>
    req<{ ok: boolean }>('PATCH', `/servers/${serverId}/automations/${id}/toggle`, { enabled }),
};

// ── DM Pinned Messages ────────────────────────────────────────────────────
// Extending dmsApi — add to dmsApi object in your component via direct calls:
export const dmPinApi = {
  pin:    (messageId: string) => req<{ pinned: boolean }>('PUT', `/dms/messages/${messageId}/pin`),
  pinned: (userId: string)    => req<DmMessageFull[]>('GET', `/dms/${userId}/pinned`),
};
