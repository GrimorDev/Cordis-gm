import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Hash, Volume2, Video, Settings, Plus, Search, Bell, Users,
  Mic, Headphones, Smile, Paperclip, Send,
  ChevronDown, MessageSquare, Zap, Activity, MoreHorizontal,
  Phone, ScreenShare, LayoutGrid, Menu, X, Edit3, MessageCircle,
  Shield, PlusCircle, Trash2, Settings2, UserPlus, Check, X as XIcon,
  LogOut, Loader2
} from 'lucide-react';
import {
  auth, users, servers as serversApi, channels as channelsApi,
  messages as messagesApi, dms as dmsApi, friends as friendsApi,
  setToken, clearToken, getToken,
  type UserProfile, type ServerData, type ServerFull,
  type ChannelCategory, type MessageFull, type DmConversation,
  type DmMessageFull, type FriendEntry, type FriendRequest,
  type ServerMember, ApiError
} from './api';
import { connectSocket, disconnectSocket, getSocket, joinChannel, leaveChannel, sendTypingStart, sendTypingStop } from './socket';

// ─── Helpers ────────────────────────────────────────────────────────────────

const avatarUrl = (u: { avatar_url?: string | null; username: string }, size = 40) =>
  u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.username)}&size=${size}`;

const statusColor = (s: string) => {
  switch (s) {
    case 'online': return 'bg-emerald-500';
    case 'idle':   return 'bg-amber-500';
    case 'dnd':    return 'bg-rose-500';
    default:       return 'bg-zinc-500';
  }
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ─── Auth Screen ─────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: (user: UserProfile, token: string) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (tab === 'login') {
        res = await auth.login({ login: form.login, password: form.password });
      } else {
        res = await auth.register({ username: form.username, email: form.email, password: form.password });
      }
      setToken(res.token);
      onAuth(res.user, res.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
            <Zap size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Cordis</h1>
          <p className="text-sm text-zinc-500 mt-1">Platforma dla twórców</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-800/50 border border-white/5 rounded-2xl p-1 mb-6">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t === 'login' ? 'Zaloguj się' : 'Rejestracja'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {tab === 'login' ? (
            <input
              required
              value={form.login}
              onChange={set('login')}
              placeholder="Nazwa użytkownika lub email"
              className="bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors"
            />
          ) : (
            <>
              <input
                required
                value={form.username}
                onChange={set('username')}
                placeholder="Nazwa użytkownika (a-z, 0-9, _)"
                pattern="[a-zA-Z0-9_]+"
                minLength={2}
                maxLength={32}
                className="bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="Email"
                className="bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors"
              />
            </>
          )}
          <input
            required
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Hasło"
            minLength={6}
            className="bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors"
          />

          {error && (
            <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  // ── Auth ────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading]         = useState(true);
  const [currentUser, setCurrentUser]         = useState<UserProfile | null>(null);

  // ── UI State ────────────────────────────────────────────────────
  const [activeServer, setActiveServer]         = useState('');
  const [activeChannel, setActiveChannel]       = useState('');
  const [activeDmUserId, setActiveDmUserId]     = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView]             = useState<'servers' | 'dms' | 'friends'>('servers');
  const [activeCall, setActiveCall]             = useState<{ type: 'voice' | 'video'; user: string } | null>(null);

  // ── Data ────────────────────────────────────────────────────────
  const [serverList, setServerList]               = useState<ServerData[]>([]);
  const [serverFull, setServerFull]               = useState<ServerFull | null>(null);
  const [channelMessages, setChannelMessages]     = useState<MessageFull[]>([]);
  const [dmConversations, setDmConversations]     = useState<DmConversation[]>([]);
  const [dmMessages, setDmMessages]               = useState<DmMessageFull[]>([]);
  const [friendList, setFriendList]               = useState<FriendEntry[]>([]);
  const [friendRequests, setFriendRequests]       = useState<FriendRequest[]>([]);
  const [serverMembers, setServerMembers]         = useState<ServerMember[]>([]);

  // ── Input ───────────────────────────────────────────────────────
  const [messageInput, setMessageInput]     = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [sendingMsg, setSendingMsg]         = useState(false);

  // ── Profile ─────────────────────────────────────────────────────
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser]             = useState<any>(null);
  const [editProfile, setEditProfile]               = useState<any>(null);

  // ── Modals ──────────────────────────────────────────────────────
  const [isCreateServerOpen, setIsCreateServerOpen]     = useState(false);
  const [createServerMode, setCreateServerMode]         = useState<'create' | 'join'>('create');
  const [createServerName, setCreateServerName]         = useState('');
  const [joinServerKey, setJoinServerKey]               = useState('');
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [serverSettingsTab, setServerSettingsTab]       = useState<'overview' | 'roles' | 'invites'>('overview');
  const [inviteDuration, setInviteDuration]             = useState('86400');
  const [generatedInvite, setGeneratedInvite]           = useState<string | null>(null);
  const [channelModalConfig, setChannelModalConfig]     = useState<{ isOpen: boolean; mode: 'create' | 'edit'; categoryId: string; channel: any }>({ isOpen: false, mode: 'create', categoryId: '', channel: null });
  const [newChannelName, setNewChannelName]             = useState('');
  const [newChannelType, setNewChannelType]             = useState<'text' | 'voice'>('text');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevChannelRef = useRef<string>('');

  // ── Init: check existing token ───────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthLoading(false); return; }
    auth.me()
      .then(user => {
        setCurrentUser(user);
        setIsAuthenticated(true);
        setEditProfile({ ...user });
      })
      .catch(() => { clearToken(); })
      .finally(() => setAuthLoading(false));
  }, []);

  // ── On authenticated: setup socket + load data ───────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = connectSocket();

    socket.on('new_message', (msg) => {
      setChannelMessages(prev => [...prev, msg as unknown as MessageFull]);
    });
    socket.on('new_dm', (msg) => {
      setDmMessages(prev => [...prev, msg as unknown as DmMessageFull]);
    });
    socket.on('message_deleted', ({ id }) => {
      setChannelMessages(prev => prev.filter(m => m.id !== id));
    });
    socket.on('user_status', ({ user_id, status }) => {
      setFriendList(prev => prev.map(f => f.id === user_id ? { ...f, status } : f));
      setDmConversations(prev => prev.map(d => d.other_user_id === user_id ? { ...d, other_status: status } : d));
    });

    loadServers();
    loadFriends();
    loadDmConversations();

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated]);

  // ── Load channels when server changes ───────────────────────────
  useEffect(() => {
    if (!activeServer) return;
    serversApi.get(activeServer).then(s => {
      setServerFull(s);
      // Auto-select first text channel
      const firstText = s.categories.flatMap(c => c.channels).find(ch => ch.type === 'text');
      if (firstText && !activeChannel) setActiveChannel(firstText.id);
    }).catch(console.error);
    serversApi.members(activeServer).then(setServerMembers).catch(console.error);
  }, [activeServer]);

  // ── Load messages when channel changes ──────────────────────────
  useEffect(() => {
    if (!activeChannel || activeView !== 'servers') return;
    const prev = prevChannelRef.current;
    if (prev) leaveChannel(prev);
    prevChannelRef.current = activeChannel;
    joinChannel(activeChannel);
    messagesApi.list(activeChannel).then(setChannelMessages).catch(console.error);
  }, [activeChannel, activeView]);

  // ── Load DM messages when DM user changes ───────────────────────
  useEffect(() => {
    if (!activeDmUserId) return;
    dmsApi.messages(activeDmUserId).then(setDmMessages).catch(console.error);
  }, [activeDmUserId]);

  // ── Scroll to bottom on new messages ────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages, dmMessages]);

  // ── Auth handler ─────────────────────────────────────────────────
  const handleAuth = (user: UserProfile, _token: string) => {
    setCurrentUser(user);
    setEditProfile({ ...user });
    setIsAuthenticated(true);
  };

  // ── Logout ───────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await auth.logout(); } catch { /* ignore */ }
    clearToken();
    disconnectSocket();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setServerList([]);
    setActiveServer('');
    setActiveChannel('');
  };

  // ── Data loaders ─────────────────────────────────────────────────
  const loadServers = () => {
    serversApi.list().then(list => {
      setServerList(list);
      if (list.length > 0 && !activeServer) {
        setActiveServer(list[0].id);
        setActiveView('servers');
      }
    }).catch(console.error);
  };

  const loadFriends = () => {
    friendsApi.list().then(setFriendList).catch(console.error);
    friendsApi.requests().then(setFriendRequests).catch(console.error);
  };

  const loadDmConversations = () => {
    dmsApi.conversations().then(setDmConversations).catch(console.error);
  };

  // ── Send message ─────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (!content || sendingMsg) return;
    setMessageInput('');
    setSendingMsg(true);
    try {
      if (activeView === 'dms' && activeDmUserId) {
        await dmsApi.send(activeDmUserId, content);
        // socket broadcasts new_dm to both users
      } else if (activeChannel) {
        await messagesApi.send(activeChannel, content);
        // socket broadcasts new_message to channel
      }
    } catch (err) {
      console.error('Send message failed:', err);
      setMessageInput(content);
    } finally {
      setSendingMsg(false);
    }
  };

  // ── Create server ─────────────────────────────────────────────────
  const handleCreateServer = async () => {
    if (!createServerName.trim()) return;
    try {
      const s = await serversApi.create(createServerName.trim());
      setServerList(prev => [...prev, s]);
      setActiveServer(s.id);
      setActiveView('servers');
      setActiveChannel('');
      setIsCreateServerOpen(false);
      setCreateServerName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinServer = async () => {
    if (!joinServerKey.trim()) return;
    try {
      const s = await serversApi.join(joinServerKey.trim());
      setServerList(prev => [...prev, s]);
      setActiveServer(s.id);
      setActiveView('servers');
      setIsCreateServerOpen(false);
      setJoinServerKey('');
    } catch (err: any) {
      alert(err?.message || 'Nieprawidłowe zaproszenie');
    }
  };

  // ── Create channel ────────────────────────────────────────────────
  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !activeServer) return;
    try {
      await channelsApi.create({
        server_id: activeServer,
        name: newChannelName.trim(),
        type: newChannelType,
        category_id: channelModalConfig.categoryId || undefined,
      });
      setChannelModalConfig({ isOpen: false, mode: 'create', categoryId: '', channel: null });
      setNewChannelName('');
      const s = await serversApi.get(activeServer);
      setServerFull(s);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Delete channel ────────────────────────────────────────────────
  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Usunąć kanał?')) return;
    try {
      await channelsApi.delete(channelId);
      const s = await serversApi.get(activeServer);
      setServerFull(s);
      if (activeChannel === channelId) setActiveChannel('');
    } catch (err) {
      console.error(err);
    }
  };

  // ── Generate invite ────────────────────────────────────────────────
  const handleGenerateInvite = async () => {
    try {
      const res = await serversApi.createInvite(activeServer, inviteDuration);
      setGeneratedInvite(res.code);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Friend actions ────────────────────────────────────────────────
  const handleAddFriend = async () => {
    if (!addFriendInput.trim()) return;
    try {
      await friendsApi.sendRequest(addFriendInput.trim());
      setAddFriendInput('');
      loadFriends();
    } catch (err: any) {
      alert(err?.message || 'Nie można wysłać zaproszenia');
    }
  };

  const handleFriendRequest = async (id: string, action: 'accept' | 'reject') => {
    try {
      await friendsApi.respondRequest(id, action);
      loadFriends();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Open profile ──────────────────────────────────────────────────
  const openUserProfile = (user: any) => {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  };

  const openOwnProfile = () => {
    setSelectedUser(currentUser);
    setIsProfileModalOpen(true);
  };

  // ── Save profile ──────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!editProfile) return;
    try {
      const updated = await users.updateMe({
        username: editProfile.username,
        bio: editProfile.bio,
        custom_status: editProfile.custom_status,
        banner_color: editProfile.banner_color,
      });
      setCurrentUser(updated);
      setEditProfile({ ...updated });
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Start call (UI only until WebRTC integrated) ──────────────────
  const startCall = (user: string, type: 'voice' | 'video') => {
    setActiveCall({ user, type });
    setIsProfileModalOpen(false);
  };
  const endCall = () => setActiveCall(null);

  // ── DM open ──────────────────────────────────────────────────────
  const openDm = (userId: string) => {
    setActiveDmUserId(userId);
    setActiveView('dms');
    setIsProfileModalOpen(false);
  };

  // ── Avatar upload ─────────────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    try {
      const res = await users.uploadAvatar(file);
      setCurrentUser(prev => prev ? { ...prev, avatar_url: res.avatar_url } : prev);
      setEditProfile((prev: any) => prev ? { ...prev, avatar_url: res.avatar_url } : prev);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 size={32} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  const allChannels = serverFull?.categories.flatMap(c => c.channels) ?? [];
  const activeChannelObj = allChannels.find(c => c.id === activeChannel);
  const activeDmConv = dmConversations.find(d => d.other_user_id === activeDmUserId);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black text-zinc-300 font-sans overflow-hidden selection:bg-indigo-500/30 relative">

      {/* TOP NAVIGATION BAR */}
      <nav className="h-14 md:h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-black shrink-0 z-30 relative">
        <div className="flex items-center gap-4 md:gap-8">
          <button
            onClick={() => setIsMobileMenuOpen(v => !v)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="hidden md:flex items-center gap-2 bg-zinc-900/50 p-1 rounded-2xl border border-white/5">
            <button
              onClick={() => { setActiveView('friends'); setActiveServer(''); setActiveChannel(''); }}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${activeView === 'friends' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            ><Users size={18} /></button>
            <button
              onClick={() => { setActiveView('dms'); loadDmConversations(); }}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${activeView === 'dms' ? 'bg-indigo-500 text-white shadow-sm' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            ><MessageCircle size={18} /></button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            {serverList.map(server => (
              <button
                key={server.id}
                onClick={() => { setActiveServer(server.id); setActiveView('servers'); }}
                className={`flex items-center justify-center lg:justify-start lg:gap-2 w-10 h-10 lg:w-auto lg:h-auto lg:px-3 lg:py-1.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap overflow-hidden ${
                  activeServer === server.id && activeView === 'servers'
                    ? 'bg-zinc-800 text-white shadow-sm border border-white/10'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="w-7 h-7 lg:w-6 lg:h-6 rounded-lg bg-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {server.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden lg:inline-block">{server.name}</span>
              </button>
            ))}
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button onClick={() => setIsCreateServerOpen(true)} className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors shrink-0">
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold text-lg md:text-xl tracking-tight">Cordis</div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative group hidden sm:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
            <input type="text" placeholder="Search..." className="bg-zinc-900/80 border border-white/10 rounded-full pl-9 pr-4 py-1.5 md:py-2 text-sm text-zinc-200 w-40 lg:w-64 focus:w-48 lg:focus:w-80 transition-all duration-300 outline-none focus:border-indigo-500/50 focus:bg-zinc-900" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex gap-1">
              <kbd className="bg-zinc-800 border border-white/10 rounded px-1.5 text-[10px] font-mono text-zinc-500">⌘</kbd>
              <kbd className="bg-zinc-800 border border-white/10 rounded px-1.5 text-[10px] font-mono text-zinc-500">K</kbd>
            </div>
          </div>
          <button className="relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full border border-white/10 hover:bg-white/5 transition-colors text-zinc-400 hover:text-white shrink-0">
            <Bell size={18} />
            {friendRequests.filter(r => r.direction === 'incoming').length > 0 && (
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-black" />
            )}
          </button>
          <button
            onClick={openOwnProfile}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-colors shrink-0 cursor-pointer"
          >
            <img src={currentUser ? avatarUrl(currentUser) : ''} alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>
      </nav>

      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex gap-2 md:gap-4 p-2 md:p-4 overflow-hidden bg-black relative">

        {/* LEFT PANEL */}
        <aside className={`absolute md:relative z-30 md:z-0 w-72 md:w-64 shrink-0 flex flex-col bg-zinc-900 border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl transition-transform duration-300 ease-in-out h-[calc(100%-1rem)] md:h-auto ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'}`}>

          {/* Mobile servers list */}
          <div className="md:hidden p-4 border-b border-white/5 overflow-x-auto flex gap-2 custom-scrollbar">
            {[
              { view: 'friends' as const, icon: <Users size={20} /> },
              { view: 'dms' as const, icon: <MessageCircle size={20} /> },
            ].map(({ view, icon }) => (
              <button
                key={view}
                onClick={() => { setActiveView(view); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl transition-all ${activeView === view ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white bg-zinc-900/50 border border-white/5'}`}
              >{icon}</button>
            ))}
            <div className="w-px h-8 bg-white/10 mx-1 self-center" />
            {serverList.map(server => (
              <button
                key={server.id}
                onClick={() => { setActiveServer(server.id); setActiveView('servers'); setIsMobileMenuOpen(false); }}
                className={`flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl overflow-hidden transition-all ${activeServer === server.id && activeView === 'servers' ? 'bg-zinc-800 border border-white/10' : 'bg-zinc-900/50 border border-transparent'}`}
              >
                <span className="text-sm font-bold text-white">{server.name.charAt(0)}</span>
              </button>
            ))}
            <button onClick={() => setIsCreateServerOpen(true)} className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl text-zinc-500 hover:text-white border border-white/5 bg-zinc-900/50 transition-colors">
              <Plus size={20} />
            </button>
          </div>

          {/* Servers view */}
          {activeView === 'servers' && (
            <>
              <div className="p-4 md:p-5 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setIsServerSettingsOpen(true)}>
                <h2 className="text-base md:text-lg font-bold text-white flex items-center justify-between group">
                  {serverFull?.name || serverList.find(s => s.id === activeServer)?.name || 'Serwer'}
                  <Settings2 size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Kliknij żeby otworzyć ustawienia</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 md:p-3 custom-scrollbar">
                {serverFull?.categories.map(cat => (
                  <div key={cat.id} className="mb-6">
                    <div className="flex items-center justify-between px-2 mb-2 group/cat">
                      <span className="text-[10px] md:text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{cat.name}</span>
                      {serverFull?.my_role && ['Owner','Admin'].includes(serverFull.my_role) && (
                        <Plus size={14} className="text-zinc-500 hover:text-white cursor-pointer opacity-0 group-hover/cat:opacity-100 transition-opacity"
                          onClick={() => { setChannelModalConfig({ isOpen: true, mode: 'create', categoryId: cat.id, channel: null }); setNewChannelName(''); }} />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {cat.channels.map(ch => (
                        <button
                          key={ch.id}
                          onClick={() => { if (ch.type === 'text') { setActiveChannel(ch.id); if (window.innerWidth < 768) setIsMobileMenuOpen(false); } }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group/ch ${activeChannel === ch.id && ch.type === 'text' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'}`}
                        >
                          <div className="flex items-center gap-2.5 truncate w-full">
                            {ch.type === 'text'
                              ? <Hash size={16} className={`shrink-0 ${activeChannel === ch.id ? 'text-indigo-400' : 'text-zinc-600 group-hover/ch:text-zinc-400'}`} />
                              : <Volume2 size={16} className="shrink-0 text-zinc-600 group-hover/ch:text-zinc-400" />}
                            <span className="text-sm font-medium truncate">{ch.name}</span>
                          </div>
                          {serverFull?.my_role && ['Owner','Admin'].includes(serverFull.my_role) && (
                            <Trash2
                              size={13}
                              className="text-zinc-600 hover:text-rose-400 opacity-0 group-hover/ch:opacity-100 transition-opacity shrink-0"
                              onClick={e => { e.stopPropagation(); handleDeleteChannel(ch.id); }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!serverFull && activeServer && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="text-zinc-600 animate-spin" />
                  </div>
                )}
              </div>
            </>
          )}

          {/* DMs view */}
          {activeView === 'dms' && (
            <>
              <div className="p-4 md:p-5 border-b border-white/5">
                <h2 className="text-base md:text-lg font-bold text-white">Direct Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 md:p-3 custom-scrollbar">
                <div className="flex flex-col gap-1">
                  {dmConversations.map(dm => (
                    <button
                      key={dm.id}
                      onClick={() => { setActiveDmUserId(dm.other_user_id); if (window.innerWidth < 768) setIsMobileMenuOpen(false); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 ${activeDmUserId === dm.other_user_id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'}`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="relative shrink-0">
                          <img src={avatarUrl({ avatar_url: dm.other_avatar, username: dm.other_username })} className="w-8 h-8 rounded-full object-cover" alt={dm.other_username} />
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${statusColor(dm.other_status)} border-2 border-zinc-900 rounded-full`} />
                        </div>
                        <span className="text-sm font-medium truncate">{dm.other_username}</span>
                      </div>
                    </button>
                  ))}
                  {dmConversations.length === 0 && (
                    <p className="text-xs text-zinc-600 px-3 py-4">Brak wiadomości bezpośrednich</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Friends view left panel */}
          {activeView === 'friends' && (
            <div className="p-4 md:p-5 border-b border-white/5">
              <h2 className="text-base md:text-lg font-bold text-white">Znajomi</h2>
            </div>
          )}

          {/* User mini profile */}
          <div className="p-2 md:p-3 bg-zinc-900/30 border-t border-white/5">
            <div className="flex items-center justify-between bg-zinc-900/80 border border-white/5 p-2 rounded-2xl">
              <div className="flex items-center gap-2.5 overflow-hidden cursor-pointer group" onClick={openOwnProfile}>
                <div className="relative shrink-0">
                  <img src={currentUser ? avatarUrl(currentUser) : ''} alt="User" className="w-8 h-8 rounded-full object-cover group-hover:opacity-80 transition-opacity" />
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${statusColor(currentUser?.status ?? 'offline')} border-2 border-zinc-900 rounded-full`} />
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-white leading-none truncate group-hover:text-indigo-400 transition-colors">{currentUser?.username}</span>
                  <span className="text-[10px] text-zinc-400 mt-1 font-medium truncate">{currentUser?.custom_status || currentUser?.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Mic size={14} /></button>
                <button onClick={handleLogout} title="Wyloguj" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"><LogOut size={14} /></button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANEL */}
        <section className="flex-1 flex flex-col bg-zinc-900 border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl relative min-w-0">

          {activeView === 'friends' ? (
            <div className="flex-1 flex flex-col">
              <div className="h-14 md:h-16 border-b border-white/5 flex items-center px-4 md:px-6 shrink-0 bg-zinc-900/80 backdrop-blur-md z-10">
                <Users size={20} className="text-zinc-400 mr-3" />
                <h1 className="text-lg font-bold text-white">Znajomi</h1>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                  {/* Add Friend */}
                  <div className="mb-8">
                    <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Dodaj znajomego</h2>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addFriendInput}
                        onChange={e => setAddFriendInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                        placeholder="Wpisz nazwę użytkownika..."
                        className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50"
                      />
                      <button onClick={handleAddFriend} className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2">
                        <UserPlus size={18} /> Dodaj
                      </button>
                    </div>
                  </div>

                  {/* Pending */}
                  {friendRequests.filter(r => r.direction === 'incoming').length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                        Oczekujące — {friendRequests.filter(r => r.direction === 'incoming').length}
                      </h2>
                      <div className="flex flex-col gap-2">
                        {friendRequests.filter(r => r.direction === 'incoming').map(req => (
                          <div key={req.id} className="flex items-center justify-between bg-zinc-900/30 border border-white/5 p-3 rounded-xl">
                            <div className="flex items-center gap-3">
                              <img src={avatarUrl({ avatar_url: req.from_avatar, username: req.from_username })} className="w-10 h-10 rounded-full object-cover" alt={req.from_username} />
                              <span className="font-bold text-white">{req.from_username}</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleFriendRequest(req.id, 'accept')} className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"><Check size={18} /></button>
                              <button onClick={() => handleFriendRequest(req.id, 'reject')} className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors"><XIcon size={18} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Friends list */}
                  <div>
                    <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Wszyscy znajomi — {friendList.length}</h2>
                    <div className="flex flex-col gap-2">
                      {friendList.map(friend => (
                        <div key={friend.id} className="flex items-center justify-between bg-zinc-900/30 border border-white/5 p-3 rounded-xl hover:bg-zinc-900/50 transition-colors group">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => openUserProfile(friend)}>
                            <div className="relative">
                              <img src={avatarUrl(friend)} className="w-10 h-10 rounded-full object-cover" alt={friend.username} />
                              <div className={`absolute bottom-0 right-0 w-3 h-3 ${statusColor(friend.status)} border-2 border-zinc-900 rounded-full`} />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-white">{friend.username}</span>
                              <span className="text-xs text-zinc-500">{friend.status}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openDm(friend.id)} className="w-9 h-9 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"><MessageCircle size={18} /></button>
                            <button className="w-9 h-9 rounded-xl bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors"><MoreHorizontal size={18} /></button>
                          </div>
                        </div>
                      ))}
                      {friendList.length === 0 && <p className="text-sm text-zinc-600 py-4">Brak znajomych. Dodaj kogoś!</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <header className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-zinc-900/80 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  {activeView === 'dms' ? (
                    <div className="flex items-center gap-3">
                      {activeDmConv && (
                        <>
                          <div className="relative">
                            <img src={avatarUrl({ avatar_url: activeDmConv.other_avatar, username: activeDmConv.other_username })} className="w-8 h-8 rounded-full object-cover" alt={activeDmConv.other_username} />
                            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${statusColor(activeDmConv.other_status)} border-2 border-zinc-900 rounded-full`} />
                          </div>
                          <h3 className="font-bold text-white text-base md:text-lg">{activeDmConv.other_username}</h3>
                        </>
                      )}
                      {!activeDmConv && activeDmUserId && <h3 className="font-bold text-white text-base">DM</h3>}
                    </div>
                  ) : (
                    <>
                      <div className="hidden sm:flex w-8 h-8 md:w-10 md:h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center shrink-0">
                        <Hash size={18} className="text-indigo-400" />
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-white text-base md:text-lg leading-tight truncate">
                          <span className="sm:hidden text-zinc-500 mr-1">#</span>
                          {activeChannelObj?.name || activeChannel}
                        </h3>
                        {activeChannelObj?.description && (
                          <span className="hidden sm:block text-xs text-zinc-500 truncate">{activeChannelObj.description}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-2">
                  {activeView === 'dms' && activeDmConv && (
                    <div className="flex gap-2 mr-2 border-r border-white/10 pr-4">
                      <button onClick={() => startCall(activeDmConv.other_username, 'voice')} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><Phone size={16} /></button>
                      <button onClick={() => startCall(activeDmConv.other_username, 'video')} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><Video size={16} /></button>
                    </div>
                  )}
                  <div className="hidden lg:flex -space-x-2 mr-2 md:mr-4">
                    {serverMembers.slice(0, 3).map(m => (
                      <img key={m.id} src={avatarUrl(m)} className="w-7 h-7 rounded-full border-2 border-zinc-900 object-cover" alt={m.username} title={m.username} />
                    ))}
                    {serverMembers.length > 3 && (
                      <div className="w-7 h-7 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">+{serverMembers.length - 3}</div>
                    )}
                  </div>
                  <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"><MoreHorizontal size={16} /></button>
                </div>
              </header>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar flex flex-col pb-20 md:pb-24">
                <div className="mt-auto flex flex-col gap-4 md:gap-6">
                  <div className="text-center my-6 md:my-8">
                    {activeView === 'dms' && activeDmConv ? (
                      <>
                        <img src={avatarUrl({ avatar_url: activeDmConv.other_avatar, username: activeDmConv.other_username })} className="w-16 h-16 md:w-20 md:h-20 rounded-full mx-auto mb-4 border-4 border-zinc-900 object-cover" alt={activeDmConv.other_username} />
                        <h1 className="text-xl md:text-2xl font-bold text-white mb-1">{activeDmConv.other_username}</h1>
                        <p className="text-xs md:text-sm text-zinc-500">Początek Twojej historii wiadomości.</p>
                      </>
                    ) : (
                      <>
                        <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 mb-3 md:mb-4">
                          <Hash size={24} className="md:w-8 md:h-8 text-zinc-400" />
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-white mb-1">Witaj w #{activeChannelObj?.name || activeChannel}</h1>
                        <p className="text-xs md:text-sm text-zinc-500">To jest początek tego kanału.</p>
                      </>
                    )}
                  </div>

                  {activeView !== 'dms' && channelMessages.length > 0 && (
                    <div className="flex items-center gap-4 my-2">
                      <div className="h-px bg-white/5 flex-1" />
                      <span className="text-[10px] md:text-xs font-semibold text-zinc-600 uppercase tracking-widest">Dzisiaj</span>
                      <div className="h-px bg-white/5 flex-1" />
                    </div>
                  )}

                  {activeView === 'servers' && channelMessages.map((msg, idx) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.3), duration: 0.2 }}
                      className="flex gap-3 md:gap-4 group"
                    >
                      <img
                        src={avatarUrl({ avatar_url: msg.sender_avatar, username: msg.sender_username })}
                        alt={msg.sender_username}
                        onClick={() => openUserProfile({ id: msg.sender_id, username: msg.sender_username, avatar_url: msg.sender_avatar, status: msg.sender_status })}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                          <span
                            className="font-bold text-white text-sm cursor-pointer hover:text-indigo-400 transition-colors"
                            onClick={() => openUserProfile({ id: msg.sender_id, username: msg.sender_username, avatar_url: msg.sender_avatar, status: msg.sender_status })}
                          >
                            {msg.sender_username}
                          </span>
                          {msg.sender_role && (
                            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-md uppercase">{msg.sender_role}</span>
                          )}
                          <span className="text-[11px] text-zinc-600">{fmtTime(msg.created_at)}</span>
                          {msg.edited && <span className="text-[10px] text-zinc-600 italic">(edytowano)</span>}
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed break-words">{msg.content}</p>
                      </div>
                      {currentUser && msg.sender_id === currentUser.id && (
                        <button
                          onClick={() => { if (confirm('Usunąć wiadomość?')) messagesApi.delete(msg.id).catch(console.error); }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all shrink-0 self-start mt-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </motion.div>
                  ))}

                  {activeView === 'dms' && dmMessages.map((msg, idx) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.3), duration: 0.2 }}
                      className="flex gap-3 md:gap-4 group"
                    >
                      <img
                        src={avatarUrl({ avatar_url: msg.sender_avatar, username: msg.sender_username })}
                        alt={msg.sender_username}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-xl object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-bold text-white text-sm">{msg.sender_username}</span>
                          <span className="text-[11px] text-zinc-600">{fmtTime(msg.created_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed break-words">{msg.content}</p>
                      </div>
                    </motion.div>
                  ))}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message Input */}
              <form
                onSubmit={handleSendMessage}
                className="absolute bottom-0 left-0 right-0 p-3 md:p-4 bg-zinc-900/95 backdrop-blur-sm border-t border-white/5"
              >
                <div className="flex items-center gap-2 md:gap-3 bg-zinc-800/80 border border-white/10 rounded-2xl px-3 md:px-4 py-2 md:py-3">
                  <button type="button" className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">
                    <Paperclip size={18} />
                  </button>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { handleSendMessage(e); } }}
                    placeholder={activeView === 'dms' && activeDmConv
                      ? `Wiadomość do ${activeDmConv.other_username}`
                      : `Wiadomość w #${activeChannelObj?.name || '...'}`}
                    className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none min-w-0"
                  />
                  <button type="button" className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"><Smile size={18} /></button>
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sendingMsg}
                    className="w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors shrink-0"
                  >
                    {sendingMsg ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* RIGHT PANEL */}
        <aside className="hidden xl:flex w-72 shrink-0 flex-col gap-3">
          {activeCall && (
            <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-white">Live: {activeCall.type === 'video' ? 'Video' : 'Voice'}</span>
                </div>
                <span className="text-xs text-zinc-500 font-mono">00:00</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {activeCall.type === 'video' ? (
                  <>
                    <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden relative">
                      <img src={currentUser ? avatarUrl(currentUser) : ''} className="w-full h-full object-cover opacity-50" alt="you" />
                      <div className="absolute bottom-1 left-2 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-[10px] text-white font-medium">Ty</span>
                      </div>
                    </div>
                    <div className="aspect-video bg-zinc-800 rounded-xl flex items-center justify-center">
                      <Users size={24} className="text-zinc-600" />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 flex items-center justify-center py-4 gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <img src={currentUser ? avatarUrl(currentUser) : ''} className="w-12 h-12 rounded-full object-cover" alt="you" />
                      <span className="text-xs text-white">{currentUser?.username}</span>
                    </div>
                    <div className="w-8 h-px bg-white/20" />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                        <Users size={20} className="text-zinc-500" />
                      </div>
                      <span className="text-xs text-zinc-400">{activeCall.user}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button className="flex-1 h-9 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-zinc-400 transition-colors"><Mic size={16} /></button>
                {activeCall.type === 'video' && <button className="flex-1 h-9 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-zinc-400 transition-colors"><ScreenShare size={16} /></button>}
                <button onClick={endCall} className="flex-1 h-9 bg-rose-500 hover:bg-rose-400 rounded-xl flex items-center justify-center text-white transition-colors"><Phone size={16} /></button>
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-4 shadow-2xl flex-1 overflow-y-auto">
            <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Aktywność</h3>
            <div className="flex flex-col gap-3">
              {serverMembers.slice(0, 8).map(m => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img src={avatarUrl(m)} className="w-8 h-8 rounded-full object-cover" alt={m.username} />
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${statusColor(m.status)} border-2 border-zinc-900 rounded-full`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.username}</p>
                    <p className="text-[11px] text-zinc-600 truncate">{m.role_name}</p>
                  </div>
                </div>
              ))}
              {serverMembers.length === 0 && !activeServer && (
                <p className="text-xs text-zinc-600">Brak serwera</p>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* ── MODALS ──────────────────────────────────────────────────── */}

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsProfileModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              {/* Banner */}
              <div className={`h-24 bg-gradient-to-r ${selectedUser.banner_color || 'from-indigo-500 via-purple-500 to-pink-500'} relative`}>
                <div className="absolute bottom-0 left-6 translate-y-1/2">
                  <div className="relative">
                    <img src={avatarUrl(selectedUser)} className="w-16 h-16 rounded-2xl border-4 border-zinc-900 object-cover" alt={selectedUser.username} />
                    <div className={`absolute bottom-0 right-0 w-4 h-4 ${statusColor(selectedUser.status || 'offline')} rounded-full border-2 border-zinc-900`} />
                  </div>
                </div>
              </div>
              <div className="p-6 pt-12">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedUser.username}</h3>
                    {selectedUser.custom_status && <p className="text-sm text-zinc-400 mt-0.5">{selectedUser.custom_status}</p>}
                  </div>
                  <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>
                {selectedUser.bio && <p className="text-sm text-zinc-400 mb-4 bg-zinc-800/50 rounded-xl p-3">{selectedUser.bio}</p>}

                {currentUser && selectedUser.id === currentUser.id ? (
                  // Own profile - edit
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Nazwa użytkownika</label>
                      <input value={editProfile?.username || ''} onChange={e => setEditProfile((p: any) => ({ ...p, username: e.target.value }))} className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Status</label>
                      <input value={editProfile?.custom_status || ''} onChange={e => setEditProfile((p: any) => ({ ...p, custom_status: e.target.value }))} className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50" placeholder="Ustaw status..." />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Bio</label>
                      <textarea value={editProfile?.bio || ''} onChange={e => setEditProfile((p: any) => ({ ...p, bio: e.target.value }))} rows={2} className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1 block">Avatar</label>
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="w-full text-xs text-zinc-400" />
                    </div>
                    <button onClick={handleSaveProfile} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2.5 rounded-xl transition-colors">Zapisz</button>
                  </div>
                ) : (
                  // Other user - actions
                  <div className="flex gap-2">
                    <button onClick={() => openDm(selectedUser.id)} className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <MessageSquare size={16} /> Wiadomość
                    </button>
                    <button onClick={() => startCall(selectedUser.username, 'voice')} className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white transition-colors">
                      <Phone size={18} />
                    </button>
                    <button onClick={() => startCall(selectedUser.username, 'video')} className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white transition-colors">
                      <Video size={18} />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Join Server Modal */}
      <AnimatePresence>
        {isCreateServerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsCreateServerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Serwer</h2>
                <button onClick={() => setIsCreateServerOpen(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="flex gap-2 mb-6">
                {(['create', 'join'] as const).map(m => (
                  <button key={m} onClick={() => setCreateServerMode(m)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${createServerMode === m ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                    {m === 'create' ? 'Utwórz' : 'Dołącz'}
                  </button>
                ))}
              </div>
              {createServerMode === 'create' ? (
                <div className="flex flex-col gap-4">
                  <input value={createServerName} onChange={e => setCreateServerName(e.target.value)} placeholder="Nazwa serwera..." className="bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50" />
                  <button onClick={handleCreateServer} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Utwórz serwer</button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <input value={joinServerKey} onChange={e => setJoinServerKey(e.target.value)} placeholder="Kod zaproszenia..." className="bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50" />
                  <button onClick={handleJoinServer} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Dołącz</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server Settings Modal */}
      <AnimatePresence>
        {isServerSettingsOpen && serverFull && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsServerSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Ustawienia: {serverFull.name}</h2>
                <button onClick={() => setIsServerSettingsOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="flex gap-2 mb-6 flex-wrap">
                {(['overview', 'invites'] as const).map(t => (
                  <button key={t} onClick={() => setServerSettingsTab(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${serverSettingsTab === t ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                    {t === 'overview' ? 'Ogólne' : 'Zaproszenia'}
                  </button>
                ))}
              </div>

              {serverSettingsTab === 'overview' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-widest mb-2 block">Rola na serwerze</label>
                    <div className="bg-zinc-800 rounded-xl px-4 py-3 text-sm text-white">{serverFull.my_role}</div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-widest mb-2 block">Członkowie ({serverMembers.length})</label>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {serverMembers.map(m => (
                        <div key={m.id} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl px-3 py-2">
                          <img src={avatarUrl(m)} className="w-8 h-8 rounded-full object-cover" alt={m.username} />
                          <span className="text-sm text-white font-medium">{m.username}</span>
                          <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">{m.role_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {serverSettingsTab === 'invites' && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-widest mb-2 block">Ważność zaproszenia</label>
                    <select value={inviteDuration} onChange={e => setInviteDuration(e.target.value)} className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none">
                      <option value="1800">30 minut</option>
                      <option value="3600">1 godzina</option>
                      <option value="86400">1 dzień</option>
                      <option value="never">Nigdy</option>
                    </select>
                  </div>
                  <button onClick={handleGenerateInvite} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Generuj zaproszenie</button>
                  {generatedInvite && (
                    <div className="bg-zinc-800 rounded-xl px-4 py-3">
                      <p className="text-xs text-zinc-500 mb-1">Kod zaproszenia</p>
                      <div className="flex items-center gap-2">
                        <code className="text-white font-mono text-sm flex-1">{generatedInvite}</code>
                        <button onClick={() => navigator.clipboard.writeText(generatedInvite)} className="text-xs text-indigo-400 hover:text-indigo-300">Kopiuj</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Channel Modal */}
      <AnimatePresence>
        {channelModalConfig.isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setChannelModalConfig({ isOpen: false, mode: 'create', categoryId: '', channel: null })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Nowy kanał</h2>
                <button onClick={() => setChannelModalConfig({ isOpen: false, mode: 'create', categoryId: '', channel: null })} className="text-zinc-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  {(['text', 'voice'] as const).map(t => (
                    <button key={t} onClick={() => setNewChannelType(t)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${newChannelType === t ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                      {t === 'text' ? <><Hash size={16} /> Tekstowy</> : <><Volume2 size={16} /> Głosowy</>}
                    </button>
                  ))}
                </div>
                <input
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
                  placeholder="nazwa-kanalu"
                  className="bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50"
                />
                <button onClick={handleCreateChannel} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Utwórz kanał</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
