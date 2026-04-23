import { create } from 'zustand';
import { storage } from './storage';
import type { User, Server, Channel, Message, DmConversation, DmMessage, Friend, FriendRequest } from './api';

type VoiceUser = { id: string; username: string; avatar_url: string | null };

interface AppStore {
  token: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  setCurrentUser: (user: User) => void;

  servers: Server[];
  setServers: (s: Server[]) => void;
  addServer: (s: Server) => void;
  removeServer: (id: string) => void;

  channels: Channel[];
  setChannels: (c: Channel[]) => void;

  activeServer: Server | null;
  setActiveServer: (s: Server | null) => void;
  activeChannel: Channel | null;
  setActiveChannel: (c: Channel | null) => void;

  messages: Record<string, Message[]>;
  setMessages: (channelId: string, msgs: Message[]) => void;
  prependMessages: (channelId: string, msgs: Message[]) => void;
  addMessage: (channelId: string, msg: Message) => void;
  updateMessage: (channelId: string, msg: Message) => void;
  removeMessage: (channelId: string, id: string) => void;

  dmConversations: DmConversation[];
  setDmConversations: (c: DmConversation[]) => void;
  dmMessages: Record<string, DmMessage[]>;
  setDmMessages: (userId: string, msgs: DmMessage[]) => void;
  addDmMessage: (userId: string, msg: DmMessage) => void;
  updateDmMessage: (userId: string, msg: DmMessage) => void;
  removeDmMessage: (userId: string, id: string) => void;

  friends: Friend[];
  setFriends: (f: Friend[]) => void;
  friendRequests: FriendRequest[];
  setFriendRequests: (r: FriendRequest[]) => void;

  typingUsers: Record<string, string[]>;
  setTyping: (channelId: string, usernames: string[]) => void;

  userStatuses: Record<string, string>;
  setUserStatus: (userId: string, status: string) => void;

  /** Voice channel presence: channelId → users currently connected */
  voiceUsers: Record<string, VoiceUser[]>;
  addVoiceUser: (channelId: string, user: VoiceUser) => void;
  removeVoiceUser: (channelId: string, userId: string) => void;
  setVoiceUsers: (channelId: string, users: VoiceUser[]) => void;
}

export const useStore = create<AppStore>((set) => ({
  token: null,
  currentUser: null,
  isAuthenticated: false,

  setAuth: async (token, user) => {
    await storage.setItemAsync('cordyn_token', token);
    set({ token, currentUser: user, isAuthenticated: true });
  },
  clearAuth: async () => {
    await storage.deleteItemAsync('cordyn_token');
    set({
      token: null, currentUser: null, isAuthenticated: false,
      servers: [], channels: [], messages: {},
      dmConversations: [], friends: [], friendRequests: [],
      voiceUsers: {},
    });
  },
  setCurrentUser: (user) => set({ currentUser: user }),

  servers: [],
  setServers: (servers) => set({ servers }),
  addServer: (s) => set((st) => ({ servers: [...st.servers, s] })),
  removeServer: (id) => set((st) => ({ servers: st.servers.filter((s) => s.id !== id) })),

  channels: [],
  setChannels: (channels) => set({ channels }),

  activeServer: null,
  setActiveServer: (s) => set({ activeServer: s, activeChannel: null, channels: [] }),
  activeChannel: null,
  setActiveChannel: (c) => set({ activeChannel: c }),

  messages: {},
  setMessages: (channelId, msgs) =>
    set((st) => ({ messages: { ...st.messages, [channelId]: msgs } })),
  prependMessages: (channelId, msgs) =>
    set((st) => ({ messages: { ...st.messages, [channelId]: [...msgs, ...(st.messages[channelId] ?? [])] } })),
  addMessage: (channelId, msg) =>
    set((st) => ({ messages: { ...st.messages, [channelId]: [...(st.messages[channelId] ?? []), msg] } })),
  updateMessage: (channelId, msg) =>
    set((st) => ({
      messages: {
        ...st.messages,
        [channelId]: (st.messages[channelId] ?? []).map((m) => (m.id === msg.id ? msg : m)),
      },
    })),
  removeMessage: (channelId, id) =>
    set((st) => ({
      messages: { ...st.messages, [channelId]: (st.messages[channelId] ?? []).filter((m) => m.id !== id) },
    })),

  dmConversations: [],
  setDmConversations: (c) => set({ dmConversations: c }),
  dmMessages: {},
  setDmMessages: (userId, msgs) =>
    set((st) => ({ dmMessages: { ...st.dmMessages, [userId]: msgs } })),
  addDmMessage: (userId, msg) =>
    set((st) => ({ dmMessages: { ...st.dmMessages, [userId]: [...(st.dmMessages[userId] ?? []), msg] } })),
  updateDmMessage: (userId, msg) =>
    set((st) => ({
      dmMessages: {
        ...st.dmMessages,
        [userId]: (st.dmMessages[userId] ?? []).map((m) => (m.id === msg.id ? msg : m)),
      },
    })),
  removeDmMessage: (userId, id) =>
    set((st) => ({
      dmMessages: {
        ...st.dmMessages,
        [userId]: (st.dmMessages[userId] ?? []).filter((m) => m.id !== id),
      },
    })),

  friends: [],
  setFriends: (f) => set({ friends: f }),
  friendRequests: [],
  setFriendRequests: (r) => set({ friendRequests: r }),

  typingUsers: {},
  setTyping: (channelId, usernames) =>
    set((st) => ({ typingUsers: { ...st.typingUsers, [channelId]: usernames } })),

  userStatuses: {},
  setUserStatus: (userId, status) =>
    set((st) => ({ userStatuses: { ...st.userStatuses, [userId]: status } })),

  voiceUsers: {},
  addVoiceUser: (channelId, user) =>
    set((st) => ({
      voiceUsers: {
        ...st.voiceUsers,
        [channelId]: [
          ...(st.voiceUsers[channelId] ?? []).filter((u) => u.id !== user.id),
          user,
        ],
      },
    })),
  removeVoiceUser: (channelId, userId) =>
    set((st) => ({
      voiceUsers: {
        ...st.voiceUsers,
        [channelId]: (st.voiceUsers[channelId] ?? []).filter((u) => u.id !== userId),
      },
    })),
  setVoiceUsers: (channelId, users) =>
    set((st) => ({ voiceUsers: { ...st.voiceUsers, [channelId]: users } })),
}));
