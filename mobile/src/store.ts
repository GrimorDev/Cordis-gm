import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, Server, Channel, Message, DmConversation, DmMessage, Friend, FriendRequest } from './api';

interface AppStore {
  // Auth
  token: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setCurrentUser: (user: User) => void;

  // Servers
  servers: Server[];
  setServers: (s: Server[]) => void;
  addServer: (s: Server) => void;
  removeServer: (id: string) => void;

  // Channels
  channels: Channel[];
  setChannels: (c: Channel[]) => void;

  // Active nav
  activeServer: Server | null;
  setActiveServer: (s: Server | null) => void;
  activeChannel: Channel | null;
  setActiveChannel: (c: Channel | null) => void;

  // Messages
  messages: Record<string, Message[]>;
  setMessages: (channelId: string, msgs: Message[]) => void;
  prependMessages: (channelId: string, msgs: Message[]) => void;
  addMessage: (channelId: string, msg: Message) => void;
  updateMessage: (channelId: string, msg: Message) => void;
  removeMessage: (channelId: string, id: string) => void;

  // DMs
  dmConversations: DmConversation[];
  setDmConversations: (c: DmConversation[]) => void;
  dmMessages: Record<string, DmMessage[]>;
  setDmMessages: (userId: string, msgs: DmMessage[]) => void;
  addDmMessage: (userId: string, msg: DmMessage) => void;

  // Friends
  friends: Friend[];
  setFriends: (f: Friend[]) => void;
  friendRequests: FriendRequest[];
  setFriendRequests: (r: FriendRequest[]) => void;

  // Typing
  typingUsers: Record<string, string[]>;
  setTyping: (channelId: string, usernames: string[]) => void;

  // Online status
  userStatuses: Record<string, string>;
  setUserStatus: (userId: string, status: string) => void;
}

export const useStore = create<AppStore>((set) => ({
  // Auth
  token: null,
  currentUser: null,
  isAuthenticated: false,
  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('cordyn_token', token);
    set({ token, currentUser: user, isAuthenticated: true });
  },
  clearAuth: async () => {
    await SecureStore.deleteItemAsync('cordyn_token');
    set({ token: null, currentUser: null, isAuthenticated: false, servers: [], channels: [], messages: {}, dmConversations: [], friends: [] });
  },
  setCurrentUser: (user) => set({ currentUser: user }),

  // Servers
  servers: [],
  setServers: (servers) => set({ servers }),
  addServer: (s) => set((st) => ({ servers: [...st.servers, s] })),
  removeServer: (id) => set((st) => ({ servers: st.servers.filter((s) => s.id !== id) })),

  // Channels
  channels: [],
  setChannels: (channels) => set({ channels }),

  // Active nav
  activeServer: null,
  setActiveServer: (s) => set({ activeServer: s, activeChannel: null, channels: [] }),
  activeChannel: null,
  setActiveChannel: (c) => set({ activeChannel: c }),

  // Messages
  messages: {},
  setMessages: (channelId, msgs) => set((st) => ({ messages: { ...st.messages, [channelId]: msgs } })),
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
    set((st) => ({ messages: { ...st.messages, [channelId]: (st.messages[channelId] ?? []).filter((m) => m.id !== id) } })),

  // DMs
  dmConversations: [],
  setDmConversations: (c) => set({ dmConversations: c }),
  dmMessages: {},
  setDmMessages: (userId, msgs) => set((st) => ({ dmMessages: { ...st.dmMessages, [userId]: msgs } })),
  addDmMessage: (userId, msg) =>
    set((st) => ({ dmMessages: { ...st.dmMessages, [userId]: [...(st.dmMessages[userId] ?? []), msg] } })),

  // Friends
  friends: [],
  setFriends: (f) => set({ friends: f }),
  friendRequests: [],
  setFriendRequests: (r) => set({ friendRequests: r }),

  // Typing
  typingUsers: {},
  setTyping: (channelId, usernames) =>
    set((st) => ({ typingUsers: { ...st.typingUsers, [channelId]: usernames } })),

  // Online status
  userStatuses: {},
  setUserStatus: (userId, status) =>
    set((st) => ({ userStatuses: { ...st.userStatuses, [userId]: status } })),
}));
