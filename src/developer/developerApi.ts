import { API_BASE } from '../api';

// Strip trailing /api to get the root API base, then re-add /api/developer
// so this works in web (relative /api) AND Tauri desktop (absolute URL).
const BASE = `${API_BASE}/developer`;

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const token =
    localStorage.getItem('cordyn_token') ||
    sessionStorage.getItem('cordyn_token');
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface MyServer {
  id: string;
  name: string;
  icon_url: string | null;
  role_name: string;
  member_count: number;
}

export interface PublicApp {
  client_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  is_verified: boolean;
  terms_url: string | null;
  privacy_url: string | null;
  bot_user_id: string;
  bot_username: string;
  bot_avatar: string | null;
  server_count: number;
}

export interface DevApplication {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  client_id: string;
  client_secret?: string; // only shown once
  redirect_uris: string[];
  bot_user_id: string | null;
  bot_username?: string | null;
  bot_avatar?: string | null;
  is_public: boolean;
  is_verified: boolean;
  rate_limit_tier: string;
  created_at: string;
}

export interface BotServer {
  server_id: string;
  name: string;
  icon_url: string | null;
  member_count: number;
  installed_at: string;
}

export const devApi = {
  listApps: () => req<DevApplication[]>('GET', `${BASE}/applications`),
  createApp: (name: string, description?: string) =>
    req<DevApplication & { client_secret: string }>('POST', `${BASE}/applications`, {
      name,
      description,
    }),
  getApp: (id: string) => req<DevApplication>('GET', `${BASE}/applications/${id}`),
  updateApp: (id: string, data: Partial<DevApplication>) =>
    req<DevApplication>('PATCH', `${BASE}/applications/${id}`, data),
  deleteApp: (id: string) =>
    req<{ success: boolean }>('DELETE', `${BASE}/applications/${id}`),
  regenerateSecret: (id: string) =>
    req<{ client_secret: string }>('POST', `${BASE}/applications/${id}/secret`),

  createBot: (appId: string) =>
    req<{ bot: { id: string; username: string; avatar_url: string | null } }>(
      'POST',
      `${BASE}/applications/${appId}/bot`,
    ),
  deleteBot: (appId: string) =>
    req<{ success: boolean }>('DELETE', `${BASE}/applications/${appId}/bot`),
  regenerateToken: (appId: string) =>
    req<{ token: string }>('POST', `${BASE}/applications/${appId}/bot/token`),
  getInviteUrl: (appId: string) =>
    req<{ invite_url: string; client_id: string }>(
      'GET',
      `${BASE}/applications/${appId}/bot/invite-url`,
    ),
  getBotServers: (appId: string) =>
    req<BotServer[]>('GET', `${BASE}/applications/${appId}/bot/servers`),

  // Bot invite helpers (used by DeveloperPortal + AppsMarketplace)
  getMyServers: () =>
    req<MyServer[]>('GET', `${API_BASE}/oauth2/bot-invite/my-servers`),
  addBotToServer: (clientId: string, serverId: string) =>
    req<{ success: boolean }>('POST', `${API_BASE}/oauth2/bot-invite/confirm`, {
      client_id: clientId,
      server_id: serverId,
    }),
};

export const appsApi = {
  list: () => req<PublicApp[]>('GET', `${API_BASE}/apps`),
  search: (q: string) => req<PublicApp[]>('GET', `${API_BASE}/apps/search?q=${encodeURIComponent(q)}`),
  get: (clientId: string) => req<PublicApp>('GET', `${API_BASE}/apps/${clientId}`),
};
