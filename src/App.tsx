import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Hash, Volume2, Video, Settings, Plus, Search, Bell, Users,
  Mic, MicOff, VolumeX, Smile, Paperclip, Send, Image, Reply,
  Menu, X, Edit3, MessageCircle, Minimize2,
  Shield, Trash2, Settings2, UserPlus, Check, X as XIcon,
  LogOut, Loader2, Lock, Phone, PhoneOff, MessageSquare, Upload, MoreHorizontal, ScreenShare,
  CheckCircle2, AlertCircle, Info, AlertTriangle
} from 'lucide-react';
import {
  auth, users, serversApi, channelsApi, messagesApi, dmsApi, friendsApi,
  uploadFile, setToken, clearToken, getToken,
  type UserProfile, type ServerData, type ServerFull, type ServerRole,
  type ChannelData, type MessageFull, type DmConversation,
  type DmMessageFull, type FriendEntry, type FriendRequest,
  type ServerMember, ApiError
} from './api';
import {
  connectSocket, disconnectSocket, joinChannel, leaveChannel,
  joinVoiceChannel, leaveVoiceChannel, sendCallInvite, acceptCall, rejectCall, endCall,
} from './socket';

// ─── Glass constants ──────────────────────────────────────────────────────────
const gp = 'bg-zinc-900/80 backdrop-blur-xl border border-white/[0.07] shadow-2xl';
const gm = 'bg-zinc-900/95 backdrop-blur-2xl border border-white/[0.1] shadow-2xl rounded-3xl';
const gi = 'bg-white/[0.05] border border-white/[0.08] text-white placeholder-zinc-500 outline-none focus:border-indigo-500/60 focus:bg-white/[0.08] transition-all';
const gb = 'bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-all';

const PERMISSIONS = [
  { id: 'administrator', label: 'Administrator' },
  { id: 'manage_server', label: 'Zarządzaj serwerem' },
  { id: 'manage_channels', label: 'Zarządzaj kanałami' },
  { id: 'manage_roles', label: 'Zarządzaj rolami' },
  { id: 'kick_members', label: 'Wyrzucaj członków' },
  { id: 'send_messages', label: 'Wysyłaj wiadomości' },
  { id: 'manage_messages', label: 'Zarządzaj wiadomościami' },
  { id: 'read_messages', label: 'Czytaj wiadomości' },
];
const ROLE_COLORS = ['#5865f2','#eb459e','#ed4245','#faa61a','#57f287','#1abc9c','#3498db','#9b59b6'];
const GRADIENTS = [
  'from-indigo-600 via-purple-600 to-pink-600',
  'from-rose-500 via-red-500 to-orange-500',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-blue-600 via-indigo-600 to-violet-600',
  'from-amber-500 via-orange-500 to-red-500',
  'from-zinc-700 via-zinc-600 to-zinc-700',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ava = (u: { avatar_url?: string | null; username: string }) =>
  u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.username)}&size=40`;

const sc = (s: string) => {
  if (s === 'online') return 'bg-emerald-500';
  if (s === 'idle') return 'bg-amber-500';
  if (s === 'dnd') return 'bg-rose-500';
  return 'bg-zinc-500';
};

const ft = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDur = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ─── Types ────────────────────────────────────────────────────────────────────
type Toast = { id: string; msg: string; type: 'info'|'success'|'error'|'warn'; onConfirm?: ()=>void };
type CallState = {
  type: 'voice_channel' | 'dm_voice' | 'dm_video';
  channelId?: string; channelName?: string; serverId?: string;
  userId?: string; username?: string;
  isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean;
};
type VoiceUser = { id: string; username: string; avatar_url: string|null; status: string };

// ─── AuthScreen ───────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (u: UserProfile, t: string) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = tab === 'login'
        ? await auth.login({ login: form.login, password: form.password })
        : await auth.register({ username: form.username, email: form.email, password: form.password });
      setToken(res.token); onAuth(res.user, res.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia');
    } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{ background: 'radial-gradient(ellipse at 50% 0%,rgba(99,102,241,.22) 0%,transparent 70%),radial-gradient(ellipse at 80% 80%,rgba(139,92,246,.1) 0%,transparent 50%),#09090b' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`w-full max-w-md ${gm} rounded-3xl p-8`}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Cordis</h1>
          <p className="text-sm text-zinc-500 mt-1">Platforma dla twórców</p>
        </div>
        <div className="flex bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1 mb-6">
          {(['login','register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${tab===t ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white'}`}>
              {t === 'login' ? 'Zaloguj się' : 'Rejestracja'}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {tab === 'login'
            ? <input required value={form.login} onChange={set('login')} placeholder="Login lub email" className={`${gi} rounded-xl px-4 py-3 text-sm w-full`} />
            : <>
                <input required value={form.username} onChange={set('username')} placeholder="Nazwa użytkownika" pattern="[a-zA-Z0-9_]+" minLength={2} maxLength={32} className={`${gi} rounded-xl px-4 py-3 text-sm w-full`} />
                <input required type="email" value={form.email} onChange={set('email')} placeholder="Email" className={`${gi} rounded-xl px-4 py-3 text-sm w-full`} />
              </>
          }
          <input required type="password" value={form.password} onChange={set('password')} placeholder="Hasło" minLength={6} className={`${gi} rounded-xl px-4 py-3 text-sm w-full`} />
          {error && <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {tab === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading]         = useState(true);
  const [currentUser, setCurrentUser]         = useState<UserProfile | null>(null);
  const [activeServer, setActiveServer]       = useState('');
  const [activeChannel, setActiveChannel]     = useState('');
  const [activeDmUserId, setActiveDmUserId]   = useState('');
  const [isMobileOpen, setIsMobileOpen]       = useState(false);
  const [activeView, setActiveView]           = useState<'servers'|'dms'|'friends'>('servers');
  const [activeCall, setActiveCall]           = useState<CallState|null>(null);
  const [showCallPanel, setShowCallPanel]     = useState(false);
  const [voiceUsers, setVoiceUsers]           = useState<Record<string, VoiceUser[]>>({});
  const [incomingCall, setIncomingCall]       = useState<{from:{id:string,username:string,avatar_url:string|null},type:'voice'|'video',conversation_id:string}|null>(null);
  const [callDuration, setCallDuration]       = useState(0);
  const [toasts, setToasts]                   = useState<Toast[]>([]);

  const [serverList, setServerList]           = useState<ServerData[]>([]);
  const [serverFull, setServerFull]           = useState<ServerFull | null>(null);
  const [channelMsgs, setChannelMsgs]         = useState<MessageFull[]>([]);
  const [dmConvs, setDmConvs]                 = useState<DmConversation[]>([]);
  const [dmMsgs, setDmMsgs]                   = useState<DmMessageFull[]>([]);
  const [friends, setFriends]                 = useState<FriendEntry[]>([]);
  const [friendReqs, setFriendReqs]           = useState<FriendRequest[]>([]);
  const [members, setMembers]                 = useState<ServerMember[]>([]);
  const [roles, setRoles]                     = useState<ServerRole[]>([]);

  const [msgInput, setMsgInput]               = useState('');
  const [addFriendVal, setAddFriendVal]       = useState('');
  const [sending, setSending]                 = useState(false);
  const [sendError, setSendError]             = useState('');
  const [replyTo, setReplyTo]                 = useState<MessageFull|DmMessageFull|null>(null);
  const [attachFile, setAttachFile]           = useState<File|null>(null);
  const [attachPreview, setAttachPreview]     = useState<string|null>(null);

  const [profileOpen, setProfileOpen]         = useState(false);
  const [selUser, setSelUser]                 = useState<any>(null);
  const [editProf, setEditProf]               = useState<any>(null);
  const [profBannerFile, setProfBannerFile]   = useState<File|null>(null);
  const [profBannerPrev, setProfBannerPrev]   = useState<string|null>(null);

  const [createSrvOpen, setCreateSrvOpen]     = useState(false);
  const [createSrvMode, setCreateSrvMode]     = useState<'create'|'join'>('create');
  const [createSrvName, setCreateSrvName]     = useState('');
  const [joinCode, setJoinCode]               = useState('');

  const [srvSettOpen, setSrvSettOpen]         = useState(false);
  const [srvSettTab, setSrvSettTab]           = useState<'overview'|'roles'|'members'|'invites'>('overview');
  const [inviteDur, setInviteDur]             = useState('86400');
  const [inviteCode, setInviteCode]           = useState<string|null>(null);
  const [srvForm, setSrvForm]                 = useState({ name:'', description:'', icon_url:'', banner_url:'' });
  const [srvIconFile, setSrvIconFile]         = useState<File|null>(null);
  const [srvBannerFile, setSrvBannerFile]     = useState<File|null>(null);

  const [chCreateOpen, setChCreateOpen]       = useState(false);
  const [chCreateCatId, setChCreateCatId]     = useState('');
  const [newChName, setNewChName]             = useState('');
  const [newChType, setNewChType]             = useState<'text'|'voice'>('text');
  const [chEditOpen, setChEditOpen]           = useState(false);
  const [editingCh, setEditingCh]             = useState<ChannelData|null>(null);
  const [chForm, setChForm]                   = useState({ name:'', description:'', is_private:false, role_ids:[] as string[] });

  const [roleModalOpen, setRoleModalOpen]     = useState(false);
  const [editingRole, setEditingRole]         = useState<ServerRole|null>(null);
  const [roleForm, setRoleForm]               = useState({ name:'', color:'#5865f2', permissions:[] as string[] });

  const bottomRef    = useRef<HTMLDivElement>(null);
  const prevChRef    = useRef('');
  const attachRef    = useRef<HTMLInputElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthLoading(false); return; }
    auth.me().then(u => { setCurrentUser(u); setEditProf({...u}); setIsAuthenticated(true); })
      .catch(() => clearToken()).finally(() => setAuthLoading(false));
  }, []);

  // ── Socket ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const sock = connectSocket();
    sock.on('new_message', msg => setChannelMsgs(p => [...p, msg as MessageFull]));
    sock.on('new_dm',      msg => setDmMsgs(p => [...p, msg as DmMessageFull]));
    sock.on('message_deleted', ({ id }) => setChannelMsgs(p => p.filter(m => m.id !== id)));
    sock.on('message_updated', ({ id, content, edited }) =>
      setChannelMsgs(p => p.map(m => m.id === id ? { ...m, content, edited } : m)));
    sock.on('user_status', ({ user_id, status }) => {
      setFriends(p => p.map(f => f.id === user_id ? { ...f, status } : f));
      setDmConvs(p => p.map(d => d.other_user_id === user_id ? { ...d, other_status: status } : d));
      setMembers(p => p.map(m => m.id === user_id ? { ...m, status } : m));
    });
    // Voice channel events
    sock.on('voice_user_joined', ({ channel_id, user }: any) => {
      setVoiceUsers(p => ({ ...p, [channel_id]: [...(p[channel_id]||[]).filter((u:VoiceUser) => u.id !== user.id), user] }));
    });
    sock.on('voice_user_left', ({ channel_id, user_id }: any) => {
      setVoiceUsers(p => ({ ...p, [channel_id]: (p[channel_id]||[]).filter((u:VoiceUser) => u.id !== user_id) }));
    });
    // DM call events
    sock.on('call_invite', ({ from, type, conversation_id }: any) => {
      setIncomingCall({ from, type, conversation_id });
    });
    const autoToast = (msg: string, type: Toast['type']) => {
      const id = Math.random().toString(36).slice(2);
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    };
    sock.on('call_accepted', () => autoToast('Połączenie zaakceptowane', 'success'));
    sock.on('call_rejected', () => {
      setActiveCall(null); setShowCallPanel(false);
      autoToast('Połączenie odrzucone', 'error');
    });
    sock.on('call_ended', () => {
      setActiveCall(null); setShowCallPanel(false); setCallDuration(0);
      autoToast('Rozmowa zakończona', 'info');
    });
    loadServers(); loadFriends(); loadDms();
    return () => { disconnectSocket(); };
  }, [isAuthenticated]);

  // ── Server change ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeServer) return;
    setServerFull(null);
    setChannelMsgs([]);
    serversApi.get(activeServer).then(s => {
      setServerFull(s);
      setSrvForm({ name: s.name, description: s.description||'', icon_url: s.icon_url||'', banner_url: s.banner_url||'' });
      // Always auto-select first text channel when switching servers
      const first = s.categories.flatMap(c => c.channels).find(ch => ch.type === 'text');
      setActiveChannel(first?.id || '');
    }).catch(console.error);
    serversApi.members(activeServer).then(setMembers).catch(console.error);
    serversApi.roles.list(activeServer).then(setRoles).catch(console.error);
  }, [activeServer]);

  // ── Channel change ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeChannel || activeView !== 'servers') return;
    if (prevChRef.current) leaveChannel(prevChRef.current);
    prevChRef.current = activeChannel;
    joinChannel(activeChannel);
    messagesApi.list(activeChannel).then(setChannelMsgs).catch(console.error);
    setReplyTo(null);
  }, [activeChannel, activeView]);

  // ── DM change ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDmUserId) return;
    dmsApi.messages(activeDmUserId).then(setDmMsgs).catch(console.error);
    setReplyTo(null);
  }, [activeDmUserId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [channelMsgs, dmMsgs]);

  // ── Call timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeCall) {
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [!!activeCall]);

  // ── Loaders ─────────────────────────────────────────────────────
  const loadServers = () => serversApi.list().then(list => {
    setServerList(list);
    if (list.length > 0 && !activeServer) { setActiveServer(list[0].id); setActiveView('servers'); }
  }).catch(console.error);
  const loadFriends = () => { friendsApi.list().then(setFriends).catch(console.error); friendsApi.requests().then(setFriendReqs).catch(console.error); };
  const loadDms    = () => dmsApi.conversations().then(setDmConvs).catch(console.error);

  // ── Auth ────────────────────────────────────────────────────────
  const handleAuth = (u: UserProfile) => { setCurrentUser(u); setEditProf({...u}); setIsAuthenticated(true); };
  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    clearToken(); disconnectSocket(); setIsAuthenticated(false); setCurrentUser(null);
    setServerList([]); setActiveServer(''); setActiveChannel('');
  };

  // ── Send message ────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = msgInput.trim();
    if ((!content && !attachFile) || sending) return;
    setSending(true); setSendError('');
    let attachUrl: string | undefined;
    if (attachFile) {
      try { attachUrl = await uploadFile(attachFile, 'attachments'); }
      catch (err: any) {
        const msg = err?.message || 'Błąd przesyłania pliku';
        setSendError(msg.includes('413') || msg.includes('large') ? 'Plik za duży (max 5MB)' : `Błąd uploadu: ${msg}`);
        setSending(false); return;
      }
    }
    const finalContent = content;
    const opts = { reply_to_id: replyTo?.id, attachment_url: attachUrl };
    setMsgInput(''); setAttachFile(null); setAttachPreview(null); setReplyTo(null);
    try {
      if (activeView === 'dms' && activeDmUserId) await dmsApi.send(activeDmUserId, finalContent, opts);
      else if (activeChannel) await messagesApi.send(activeChannel, finalContent, opts);
    } catch (err: any) { setSendError(err?.message || 'Nie udało się wysłać'); setMsgInput(finalContent); }
    finally { setSending(false); }
  };

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setAttachFile(f);
    if (f.type.startsWith('image/')) setAttachPreview(URL.createObjectURL(f));
    else setAttachPreview(null);
    e.target.value = '';
  };

  // ── Server ──────────────────────────────────────────────────────
  const handleCreateServer = async () => {
    if (!createSrvName.trim()) return;
    try {
      const s = await serversApi.create(createSrvName.trim());
      setServerList(p => [...p, s]); setActiveServer(s.id); setActiveView('servers');
      setActiveChannel(''); setCreateSrvOpen(false); setCreateSrvName('');
    } catch (err) { console.error(err); }
  };
  const handleJoinServer = async () => {
    if (!joinCode.trim()) return;
    try {
      const s = await serversApi.join(joinCode.trim());
      setServerList(p => [...p, s]); setActiveServer(s.id); setActiveView('servers');
      setCreateSrvOpen(false); setJoinCode('');
    } catch (err: any) { addToast(err?.message || 'Nieprawidłowe zaproszenie', 'error'); }
  };
  const handleSaveSrv = async () => {
    if (!activeServer) return;
    try {
      let icon = srvForm.icon_url, banner = srvForm.banner_url;
      if (srvIconFile)   { icon   = await uploadFile(srvIconFile, 'servers');   setSrvIconFile(null); }
      if (srvBannerFile) { banner = await uploadFile(srvBannerFile, 'servers'); setSrvBannerFile(null); }
      const upd = await serversApi.update(activeServer, { name: srvForm.name, description: srvForm.description, icon_url: icon, banner_url: banner });
      setServerList(p => p.map(s => s.id === activeServer ? { ...s, ...upd } : s));
      const s = await serversApi.get(activeServer); setServerFull(s);
    } catch (err) { console.error(err); }
  };

  // ── Channel ─────────────────────────────────────────────────────
  const handleCreateCh = async () => {
    if (!newChName.trim() || !activeServer) return;
    try {
      await channelsApi.create({ server_id: activeServer, name: newChName.trim(), type: newChType, category_id: chCreateCatId || undefined });
      setChCreateOpen(false); setNewChName('');
      const s = await serversApi.get(activeServer); setServerFull(s);
    } catch (err) { console.error(err); }
  };
  const handleDeleteCh = (id: string) => {
    confirmAction('Usunąć kanał?', async () => {
      try {
        await channelsApi.delete(id);
        const s = await serversApi.get(activeServer); setServerFull(s);
        if (activeChannel === id) setActiveChannel('');
      } catch (err) { console.error(err); }
    });
  };
  const openChEdit = (ch: ChannelData) => {
    setEditingCh(ch);
    setChForm({ name: ch.name, description: ch.description||'', is_private: ch.is_private||false, role_ids: ch.allowed_roles?.map(r => r.role_id)||[] });
    setChEditOpen(true);
  };
  const handleSaveCh = async () => {
    if (!editingCh) return;
    try {
      await channelsApi.update(editingCh.id, { name: chForm.name, description: chForm.description, is_private: chForm.is_private, role_ids: chForm.is_private ? chForm.role_ids : [] });
      setChEditOpen(false); setEditingCh(null);
      const s = await serversApi.get(activeServer); setServerFull(s);
    } catch (err) { console.error(err); }
  };

  // ── Roles ────────────────────────────────────────────────────────
  const openNewRole = () => { setEditingRole(null); setRoleForm({ name:'', color:'#5865f2', permissions:[] }); setRoleModalOpen(true); };
  const openEditRole = (r: ServerRole) => { setEditingRole(r); setRoleForm({ name: r.name, color: r.color, permissions: r.permissions||[] }); setRoleModalOpen(true); };
  const handleSaveRole = async () => {
    if (!activeServer || !roleForm.name.trim()) return;
    try {
      if (editingRole) {
        const u = await serversApi.roles.update(activeServer, editingRole.id, roleForm);
        setRoles(p => p.map(r => r.id === editingRole.id ? u : r));
      } else {
        const c = await serversApi.roles.create(activeServer, roleForm);
        setRoles(p => [...p, c]);
      }
      setRoleModalOpen(false);
    } catch (err) { console.error(err); }
  };
  const handleDeleteRole = (id: string) => {
    if (!activeServer) return;
    confirmAction('Usunąć rolę?', async () => {
      try { await serversApi.roles.delete(activeServer, id); setRoles(p => p.filter(r => r.id !== id)); }
      catch (err) { console.error(err); }
    });
  };
  const handleSetMemberRole = async (userId: string, roleName: string) => {
    if (!activeServer) return;
    try { await serversApi.updateMemberRoles(activeServer, userId, { role_name: roleName }); setMembers(p => p.map(m => m.id === userId ? { ...m, role_name: roleName } : m)); }
    catch (err) { console.error(err); }
  };
  const handleKick = (userId: string) => {
    if (!activeServer) return;
    confirmAction('Wyrzucić użytkownika?', async () => {
      try { await serversApi.kickMember(activeServer, userId); setMembers(p => p.filter(m => m.id !== userId)); }
      catch (err) { console.error(err); }
    });
  };

  // ── Invite ───────────────────────────────────────────────────────
  const handleInvite = async () => {
    try { const r = await serversApi.createInvite(activeServer, inviteDur); setInviteCode(r.code); }
    catch (err) { console.error(err); }
  };

  // ── Friends ──────────────────────────────────────────────────────
  const handleAddFriend = async () => {
    if (!addFriendVal.trim()) return;
    try { await friendsApi.sendRequest(addFriendVal.trim()); setAddFriendVal(''); loadFriends(); addToast('Zaproszenie wysłane!', 'success'); }
    catch (err: any) { addToast(err?.message || 'Nie znaleziono użytkownika', 'error'); }
  };
  const handleFriendReq = async (id: string, action: 'accept'|'reject') => {
    try { await friendsApi.respondRequest(id, action); loadFriends(); }
    catch (err) { console.error(err); }
  };

  // ── Profile ──────────────────────────────────────────────────────
  const openProfile = (u: any) => { setSelUser(u); setProfileOpen(true); };
  const openOwnProfile = () => { setSelUser(currentUser); setProfBannerFile(null); setProfBannerPrev(null); setProfileOpen(true); };
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const r = await users.uploadAvatar(f);
      setCurrentUser(p => p ? { ...p, avatar_url: r.avatar_url } : p);
      setEditProf((p: any) => p ? { ...p, avatar_url: r.avatar_url } : p);
      setSelUser((p: any) => p ? { ...p, avatar_url: r.avatar_url } : p);
    } catch (err) { console.error(err); }
  };
  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setProfBannerFile(f); setProfBannerPrev(URL.createObjectURL(f));
  };
  const handleSaveProfile = async () => {
    if (!editProf) return;
    try {
      let bannerUrl = editProf.banner_url;
      if (profBannerFile) { const r = await users.uploadBanner(profBannerFile); bannerUrl = r.banner_url; setProfBannerFile(null); setProfBannerPrev(null); }
      const upd = await users.updateMe({ username: editProf.username, bio: editProf.bio, custom_status: editProf.custom_status, banner_color: editProf.banner_color, banner_url: bannerUrl });
      setCurrentUser(upd); setEditProf({...upd}); setSelUser(upd); setProfileOpen(false);
    } catch (err) { console.error(err); }
  };
  const openDm = (userId: string) => { setActiveDmUserId(userId); setActiveView('dms'); setProfileOpen(false); };

  // ── Toasts ────────────────────────────────────────────────────────
  const addToast = (msg: string, type: Toast['type'] = 'info', onConfirm?: ()=>void) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, msg, type, onConfirm }]);
    if (!onConfirm) setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    return id;
  };
  const rmToast = (id: string) => setToasts(p => p.filter(t => t.id !== id));
  const confirmAction = (msg: string, fn: ()=>void) => addToast(msg, 'warn', fn);

  // ── Voice / Call ──────────────────────────────────────────────────
  const joinVoiceCh = (ch: ChannelData) => {
    if (activeCall?.channelId && activeCall.channelId !== ch.id) leaveVoiceChannel(activeCall.channelId);
    joinVoiceChannel(ch.id);
    setActiveCall({ type: 'voice_channel', channelId: ch.id, channelName: ch.name, serverId: activeServer, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    setShowCallPanel(true);
  };
  const hangupCall = () => {
    if (activeCall?.channelId) leaveVoiceChannel(activeCall.channelId);
    if (activeCall?.userId) endCall(activeCall.userId);
    setActiveCall(null); setShowCallPanel(false); setCallDuration(0);
  };
  const startDmCall = (userId: string, username: string, type: 'voice'|'video') => {
    sendCallInvite(userId, type);
    setActiveCall({ type: type === 'voice' ? 'dm_voice' : 'dm_video', userId, username, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    setActiveDmUserId(userId); setActiveView('dms'); setShowCallPanel(true); setProfileOpen(false);
  };
  const toggleMute    = () => setActiveCall(p => p ? {...p, isMuted: !p.isMuted} : p);
  const toggleDeafen  = () => setActiveCall(p => p ? {...p, isDeafened: !p.isDeafened} : p);
  const toggleCamera  = () => setActiveCall(p => p ? {...p, isCameraOn: !p.isCameraOn} : p);
  const toggleScreen  = () => setActiveCall(p => p ? {...p, isScreenSharing: !p.isScreenSharing} : p);

  // ──────────────────────────────────────────────────────────────────
  if (authLoading) return <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center"><Loader2 size={32} className="text-indigo-400 animate-spin" /></div>;
  if (!isAuthenticated) return <AuthScreen onAuth={(u, t) => handleAuth(u)} />;

  const allChs   = serverFull?.categories.flatMap(c => c.channels) ?? [];
  const activeCh = allChs.find(c => c.id === activeChannel);
  const activeDm = dmConvs.find(d => d.other_user_id === activeDmUserId);
  const isAdmin  = !!(serverFull?.my_role && ['Owner','Admin'].includes(serverFull.my_role));
  const incoming = friendReqs.filter(r => r.addressee_id === currentUser?.id);
  const messages = activeView === 'servers' ? channelMsgs : dmMsgs;

  return (
    <div className="flex flex-col h-[100dvh] w-full text-zinc-300 font-sans overflow-hidden relative"
      style={{ background: 'radial-gradient(ellipse at 15% 60%,rgba(99,102,241,.18) 0%,transparent 55%),radial-gradient(ellipse at 85% 15%,rgba(139,92,246,.12) 0%,transparent 55%),radial-gradient(ellipse at 50% 100%,rgba(79,70,229,.08) 0%,transparent 50%),#09090b' }}>

      {/* TOP NAV */}
      <nav className="h-14 border-b border-white/[0.06] flex items-center justify-between px-4 md:px-6 bg-zinc-950/80 backdrop-blur-xl shrink-0 z-30 relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileOpen(v => !v)} className={`md:hidden w-9 h-9 flex items-center justify-center rounded-xl ${gb}`}>
            {isMobileOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          <div className="hidden md:flex items-center gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.05]">
            {([{v:'friends' as const,i:<Users size={16}/>},{v:'dms' as const,i:<MessageCircle size={16}/>}]).map(({v,i}) => (
              <button key={v} onClick={() => { setActiveView(v); setActiveServer(''); setActiveChannel(''); }}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${activeView===v?'bg-indigo-500 text-white':'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
                {i}
              </button>
            ))}
            <div className="w-px h-5 bg-white/[0.07] mx-0.5"/>
            {serverList.map(srv => (
              <button key={srv.id} onClick={() => { setActiveServer(srv.id); setActiveView('servers'); setActiveChannel(''); setServerFull(null); }}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeServer===srv.id&&activeView==='servers'?'bg-white/[0.08] text-white border border-white/[0.08]':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'}`}>
                <span className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                  {srv.icon_url ? <img src={srv.icon_url} className="w-full h-full object-cover"/> : srv.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden lg:inline">{srv.name}</span>
              </button>
            ))}
            <div className="w-px h-5 bg-white/[0.07] mx-0.5"/>
            <button onClick={() => setCreateSrvOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
              <Plus size={16}/>
            </button>
          </div>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-bold tracking-tight">Cordis</div>
        <div className="flex items-center gap-2">
          <div className="relative group hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-400 transition-colors"/>
            <input placeholder="Szukaj..." className={`${gi} rounded-full pl-9 pr-4 py-1.5 text-sm w-32 lg:w-48 focus:w-40 lg:focus:w-64 transition-all duration-300`}/>
          </div>
          <button className={`relative w-9 h-9 flex items-center justify-center rounded-full ${gb}`}>
            <Bell size={16}/>
            {incoming.length>0&&<span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-zinc-950"/>}
          </button>
          <button onClick={openOwnProfile} className="w-9 h-9 rounded-full border border-white/[0.1] overflow-hidden hover:border-indigo-500/50 transition-colors shrink-0">
            <img src={currentUser ? ava(currentUser) : ''} alt="" className="w-full h-full object-cover"/>
          </button>
        </div>
      </nav>

      {isMobileOpen&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsMobileOpen(false)}/>}

      {/* WORKSPACE */}
      <main className="flex-1 flex gap-2 md:gap-3 p-2 md:p-3 overflow-hidden relative">

        {/* LEFT */}
        <aside className={`absolute md:relative z-30 md:z-0 w-64 shrink-0 flex flex-col ${gp} rounded-2xl md:rounded-3xl transition-transform duration-300 h-[calc(100%-1rem)] md:h-auto ${isMobileOpen?'translate-x-0':'-translate-x-[120%] md:translate-x-0'}`}>
          {/* mobile server row */}
          <div className="md:hidden p-2 border-b border-white/[0.05] flex gap-1.5 overflow-x-auto">
            {([{v:'friends' as const,i:<Users size={16}/>},{v:'dms' as const,i:<MessageCircle size={16}/>}]).map(({v,i}) => (
              <button key={v} onClick={() => { setActiveView(v); setIsMobileOpen(false); }}
                className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl ${activeView===v?'bg-indigo-500 text-white':`${gb}`}`}>{i}</button>
            ))}
            <div className="w-px h-7 bg-white/[0.07] self-center mx-0.5"/>
            {serverList.map(s => (
              <button key={s.id} onClick={() => { setActiveServer(s.id); setActiveView('servers'); setActiveChannel(''); setServerFull(null); setIsMobileOpen(false); }}
                className={`w-10 h-10 shrink-0 rounded-xl overflow-hidden border ${activeServer===s.id&&activeView==='servers'?'border-indigo-500/40':'border-white/[0.05]'}`}>
                <span className="text-sm font-bold text-white flex w-full h-full items-center justify-center bg-zinc-800">{s.name.charAt(0)}</span>
              </button>
            ))}
            <button onClick={() => setCreateSrvOpen(true)} className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl ${gb}`}><Plus size={16}/></button>
          </div>

          {/* servers */}
          {activeView==='servers'&&<>
            <div className="p-3.5 border-b border-white/[0.05] cursor-pointer hover:bg-white/[0.03] transition-colors group"
              onClick={() => { if(isAdmin){setSrvSettTab('overview');setSrvSettOpen(true);} }}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white truncate">{serverFull?.name||serverList.find(s=>s.id===activeServer)?.name||'Serwer'}</h2>
                {isAdmin&&<Settings2 size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0"/>}
              </div>
              {serverFull?.description&&<p className="text-xs text-zinc-600 mt-0.5 truncate">{serverFull.description}</p>}
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {serverFull?.categories.map(cat => (
                <div key={cat.id} className="mb-4">
                  <div className="flex items-center justify-between px-2 mb-1 group/cat">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{cat.name}</span>
                    {isAdmin&&<Plus size={12} className="text-zinc-600 hover:text-white cursor-pointer opacity-0 group-hover/cat:opacity-100 transition-opacity"
                      onClick={() => { setChCreateCatId(cat.id); setChCreateOpen(true); setNewChName(''); }}/>}
                  </div>
                  {cat.channels.map(ch => {
                    const isActiveVoice = activeCall?.channelId === ch.id;
                    const chVoiceUsers  = voiceUsers[ch.id] || [];
                    return (
                      <div key={ch.id}>
                        <button onClick={() => { ch.type==='text' ? (setActiveChannel(ch.id),setIsMobileOpen(false)) : joinVoiceCh(ch); }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-0.5 group/ch transition-all ${
                            (activeChannel===ch.id&&ch.type==='text')||(isActiveVoice&&ch.type==='voice')
                              ?'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              :'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 border border-transparent'}`}>
                          <div className="flex items-center gap-2 truncate flex-1">
                            {ch.type==='text'?<Hash size={14} className={`shrink-0 ${activeChannel===ch.id?'text-indigo-400':'text-zinc-600'}`}/>
                              :<Volume2 size={14} className={`shrink-0 ${isActiveVoice?'text-emerald-400':'text-zinc-600'}`}/>}
                            <span className="text-sm truncate">{ch.name}</span>
                            {ch.is_private&&<Lock size={10} className="text-zinc-700 shrink-0"/>}
                            {ch.type==='voice'&&chVoiceUsers.length>0&&<span className="text-[10px] text-emerald-500 ml-auto font-medium">{chVoiceUsers.length}</span>}
                          </div>
                          {isAdmin&&<div className="flex gap-1 opacity-0 group-hover/ch:opacity-100 transition-opacity">
                            <Settings2 size={12} className="text-zinc-600 hover:text-zinc-300" onClick={e=>{e.stopPropagation();openChEdit(ch);}}/>
                            <Trash2 size={12} className="text-zinc-600 hover:text-rose-400" onClick={e=>{e.stopPropagation();handleDeleteCh(ch.id);}}/>
                          </div>}
                        </button>
                        {ch.type==='voice'&&chVoiceUsers.length>0&&(
                          <div className="ml-6 mb-1">
                            {chVoiceUsers.map(u=>(
                              <div key={u.id} className="flex items-center gap-1.5 py-0.5 px-1">
                                <img src={ava(u)} className="w-4 h-4 rounded-full object-cover" alt=""/>
                                <span className="text-xs text-zinc-500 truncate">{u.username}</span>
                                {u.id===currentUser?.id&&activeCall?.channelId===ch.id&&activeCall.isMuted&&<MicOff size={9} className="text-rose-400 shrink-0"/>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {!serverFull&&activeServer&&<div className="flex justify-center py-8"><Loader2 size={18} className="text-zinc-600 animate-spin"/></div>}
            </div>
          </>}

          {/* dms */}
          {activeView==='dms'&&<>
            <div className="p-3.5 border-b border-white/[0.05]"><h2 className="text-sm font-bold text-white">Wiadomości</h2></div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {dmConvs.map(dm => (
                <button key={dm.id} onClick={() => { setActiveDmUserId(dm.other_user_id); setIsMobileOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 transition-all ${activeDmUserId===dm.other_user_id?'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400':'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 border border-transparent'}`}>
                  <div className="relative shrink-0">
                    <img src={ava({avatar_url:dm.other_avatar,username:dm.other_username})} className="w-8 h-8 rounded-full object-cover" alt=""/>
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(dm.other_status)} border-2 border-zinc-950 rounded-full`}/>
                  </div>
                  <div className="flex-1 truncate text-left">
                    <p className="text-sm font-medium truncate">{dm.other_username}</p>
                    {dm.last_message&&<p className="text-[11px] text-zinc-600 truncate">{dm.last_message}</p>}
                  </div>
                </button>
              ))}
              {dmConvs.length===0&&<p className="text-xs text-zinc-700 px-3 py-4">Brak wiadomości</p>}
            </div>
          </>}

          {activeView==='friends'&&<div className="p-3.5 border-b border-white/[0.05]"><h2 className="text-sm font-bold text-white">Znajomi</h2></div>}

          {/* user bar */}
          <div className="p-2 border-t border-white/[0.05]">
            <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] p-2 rounded-xl">
              <div className="flex items-center gap-2 overflow-hidden cursor-pointer group" onClick={openOwnProfile}>
                <div className="relative shrink-0">
                  <img src={currentUser?ava(currentUser):''} className="w-8 h-8 rounded-full object-cover" alt=""/>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(currentUser?.status??'offline')} border-2 border-zinc-950 rounded-full`}/>
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold text-white leading-none truncate group-hover:text-indigo-300 transition-colors">{currentUser?.username}</span>
                  <span className="text-[10px] text-zinc-600 mt-0.5 truncate">{currentUser?.custom_status||currentUser?.status}</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors`}><Mic size={13}/></button>
                <button onClick={handleLogout} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition-colors"><LogOut size={13}/></button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className={`flex-1 flex flex-col ${gp} rounded-2xl md:rounded-3xl overflow-hidden min-w-0`}>
          {showCallPanel && activeCall ? (
            /* ── CALL PANEL ─────────────────────────────────────────── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Call header */}
              <header className="h-13 border-b border-white/[0.05] flex items-center justify-between px-5 bg-zinc-950/40 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/>
                  {activeCall.type==='voice_channel'
                    ? <><Volume2 size={15} className="text-emerald-400"/><span className="font-bold text-white text-sm">{activeCall.channelName}</span></>
                    : activeCall.type==='dm_video'
                      ? <><Video size={15} className="text-indigo-400"/><span className="font-bold text-white text-sm">{activeCall.username}</span></>
                      : <><Phone size={15} className="text-indigo-400"/><span className="font-bold text-white text-sm">{activeCall.username}</span></>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono bg-zinc-950/60 px-2 py-0.5 rounded-lg">{fmtDur(callDuration)}</span>
                  <button onClick={()=>setShowCallPanel(false)} title="Minimalizuj" className={`w-7 h-7 ${gb} rounded-lg flex items-center justify-center`}><Minimize2 size={13}/></button>
                </div>
              </header>
              {/* Participants grid */}
              <div className="flex-1 flex flex-wrap items-center justify-center gap-6 p-8 overflow-y-auto">
                {/* Self */}
                {currentUser&&(
                  <div className="flex flex-col items-center gap-3">
                    <div className={`relative p-1 rounded-3xl border-2 transition-all ${activeCall.isMuted?'border-rose-500/40':'border-emerald-500/40'}`}>
                      <img src={ava(currentUser)} className="w-24 h-24 rounded-2xl object-cover" alt=""/>
                      <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${activeCall.isMuted?'bg-rose-500':'bg-emerald-500'}`}>
                        {activeCall.isMuted?<MicOff size={11} className="text-white"/>:<Mic size={11} className="text-white"/>}
                      </div>
                      {activeCall.isCameraOn&&<div className="absolute top-2 left-2 bg-indigo-500 rounded-full p-0.5"><Video size={9} className="text-white"/></div>}
                    </div>
                    <div className="text-center"><p className="text-sm font-bold text-white">{currentUser.username}</p><p className="text-[10px] text-zinc-600">Ty</p></div>
                  </div>
                )}
                {/* Other participants (voice channel only) */}
                {activeCall.channelId&&(voiceUsers[activeCall.channelId]||[]).filter(u=>u.id!==currentUser?.id).map(u=>(
                  <div key={u.id} className="flex flex-col items-center gap-3">
                    <div className="relative p-1 rounded-3xl border-2 border-emerald-500/30">
                      <img src={ava(u)} className="w-24 h-24 rounded-2xl object-cover" alt=""/>
                      <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><Mic size={11} className="text-white"/></div>
                    </div>
                    <p className="text-sm font-bold text-white">{u.username}</p>
                  </div>
                ))}
                {/* DM call partner */}
                {activeCall.userId&&activeCall.username&&(
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative p-1 rounded-3xl border-2 border-emerald-500/20">
                      <div className="w-24 h-24 rounded-2xl bg-zinc-800 border border-white/[0.06] flex items-center justify-center text-4xl font-bold text-zinc-600">
                        {activeCall.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center"><Mic size={11} className="text-zinc-400"/></div>
                    </div>
                    <p className="text-sm font-bold text-white">{activeCall.username}</p>
                  </div>
                )}
              </div>
              {/* Call controls */}
              <div className="shrink-0 p-5 border-t border-white/[0.05] bg-zinc-950/40 flex items-center justify-center gap-3">
                <button onClick={toggleMute} title={activeCall.isMuted?'Włącz mikrofon':'Wycisz mikrofon'}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeCall.isMuted?'bg-rose-500 hover:bg-rose-400 text-white':gb}`}>
                  {activeCall.isMuted?<MicOff size={18}/>:<Mic size={18}/>}
                </button>
                <button onClick={toggleDeafen} title={activeCall.isDeafened?'Włącz głośnik':'Wycisz głośnik'}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeCall.isDeafened?'bg-rose-500 hover:bg-rose-400 text-white':gb}`}>
                  {activeCall.isDeafened?<VolumeX size={18}/>:<Volume2 size={18}/>}
                </button>
                <button onClick={toggleCamera} title={activeCall.isCameraOn?'Wyłącz kamerę':'Włącz kamerę'}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeCall.isCameraOn?'bg-indigo-500 hover:bg-indigo-400 text-white':gb}`}>
                  <Video size={18}/>
                </button>
                <button onClick={toggleScreen} title={activeCall.isScreenSharing?'Zatrzymaj udostępnianie':'Udostępnij ekran'}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeCall.isScreenSharing?'bg-indigo-500 hover:bg-indigo-400 text-white':gb}`}>
                  <ScreenShare size={18}/>
                </button>
                <button onClick={hangupCall} title="Rozłącz"
                  className="w-12 h-12 rounded-2xl bg-rose-500 hover:bg-rose-400 flex items-center justify-center text-white transition-colors">
                  <PhoneOff size={18}/>
                </button>
              </div>
            </div>
          ) : activeView==='servers' && !activeChannel ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              {!serverFull
                ? <Loader2 size={28} className="text-indigo-400 animate-spin"/>
                : <><div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-2">
                    <Hash size={26} className="text-zinc-600"/>
                  </div>
                  <h2 className="text-lg font-bold text-white">{serverFull.name}</h2>
                  <p className="text-sm text-zinc-500">Wybierz kanał tekstowy z listy po lewej stronie.</p></>
              }
            </div>
          ) : activeView==='friends' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-13 border-b border-white/[0.05] flex items-center px-5 shrink-0 bg-zinc-950/40 backdrop-blur-md z-10">
                <Users size={17} className="text-zinc-500 mr-2.5"/><h1 className="text-sm font-bold text-white">Znajomi</h1>
              </div>
              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
                <div className="max-w-2xl mx-auto">
                  <div className="mb-6">
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Dodaj znajomego</h2>
                    <div className="flex gap-2">
                      <input value={addFriendVal} onChange={e=>setAddFriendVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddFriend()} placeholder="Nazwa użytkownika..." className={`flex-1 ${gi} rounded-xl px-4 py-2.5 text-sm`}/>
                      <button onClick={handleAddFriend} className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 text-sm"><UserPlus size={15}/> Dodaj</button>
                    </div>
                  </div>
                  {incoming.length>0&&<div className="mb-6">
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Oczekujące — {incoming.length}</h2>
                    {incoming.map(r => (
                      <div key={r.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] p-3 rounded-xl mb-2">
                        <div className="flex items-center gap-3">
                          <img src={ava({avatar_url:r.avatar_url,username:r.username||'User'})} className="w-9 h-9 rounded-full object-cover" alt=""/>
                          <span className="font-semibold text-white text-sm">{r.username}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>handleFriendReq(r.id,'accept')} className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center"><Check size={15}/></button>
                          <button onClick={()=>handleFriendReq(r.id,'reject')} className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center"><XIcon size={15}/></button>
                        </div>
                      </div>
                    ))}
                  </div>}
                  <div>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Wszyscy — {friends.length}</h2>
                    {friends.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl mb-1.5 hover:bg-white/[0.04] transition-colors group">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={()=>openProfile(f)}>
                          <div className="relative"><img src={ava(f)} className="w-9 h-9 rounded-full object-cover" alt=""/><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(f.status)} border-2 border-zinc-950 rounded-full`}/></div>
                          <div><p className="font-semibold text-white text-sm">{f.username}</p><p className="text-xs text-zinc-600">{f.custom_status||f.status}</p></div>
                        </div>
                        <button onClick={()=>openDm(f.id)} className={`w-8 h-8 rounded-xl ${gb} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity`}><MessageCircle size={15}/></button>
                      </div>
                    ))}
                    {friends.length===0&&<p className="text-sm text-zinc-700 py-4">Brak znajomych</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <header className="h-13 border-b border-white/[0.05] flex items-center justify-between px-4 md:px-5 bg-zinc-950/40 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {activeView==='dms' ? (activeDm ? (
                    <div className="flex items-center gap-2">
                      <div className="relative"><img src={ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})} className="w-7 h-7 rounded-full object-cover" alt=""/><div className={`absolute bottom-0 right-0 w-2 h-2 ${sc(activeDm.other_status)} border border-zinc-950 rounded-full`}/></div>
                      <h3 className="font-bold text-white text-sm">{activeDm.other_username}</h3>
                    </div>
                  ) : <h3 className="font-bold text-white text-sm">DM</h3>) : (
                    <>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hidden sm:flex items-center justify-center shrink-0">
                        <Hash size={15} className="text-indigo-400"/>
                      </div>
                      <div className="truncate">
                        <h3 className="font-bold text-white text-sm">{activeCh?.name||activeChannel}</h3>
                        {activeCh?.description&&<p className="text-[11px] text-zinc-600 truncate hidden sm:block">{activeCh.description}</p>}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeView==='dms'&&activeDm&&<div className="flex gap-1.5 mr-2 border-r border-white/[0.07] pr-2.5">
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'voice')} className={`w-8 h-8 flex items-center justify-center rounded-xl ${gb}`}><Phone size={14}/></button>
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'video')} className={`w-8 h-8 flex items-center justify-center rounded-xl ${gb}`}><Video size={14}/></button>
                  </div>}
                  <div className="hidden lg:flex -space-x-2 mr-2">
                    {members.slice(0,3).map(m=><img key={m.id} src={ava(m)} className="w-6 h-6 rounded-full border-2 border-zinc-950 object-cover" alt="" title={m.username}/>)}
                    {members.length>3&&<div className="w-6 h-6 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white">+{members.length-3}</div>}
                  </div>
                  <button className={`w-8 h-8 flex items-center justify-center rounded-xl ${gb}`}><MoreHorizontal size={14}/></button>
                </div>
              </header>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar flex flex-col">
                <div className="mt-auto flex flex-col gap-0.5">
                  <div className="text-center py-6 mb-2">
                    {activeView==='dms'&&activeDm ? (
                      <><img src={ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})} className="w-14 h-14 rounded-full mx-auto mb-3 border-4 border-zinc-950 object-cover" alt=""/>
                        <h1 className="text-xl font-bold text-white mb-1">{activeDm.other_username}</h1>
                        <p className="text-sm text-zinc-600">Początek Twojej rozmowy.</p></>
                    ) : (
                      <><div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-3"><Hash size={22} className="text-zinc-500"/></div>
                        <h1 className="text-xl font-bold text-white mb-1">#{activeCh?.name||activeChannel}</h1>
                        <p className="text-sm text-zinc-600">Początek kanału.</p></>
                    )}
                  </div>

                  {(messages as (MessageFull|DmMessageFull)[]).map((msg, idx) => {
                    const isOwn = currentUser?.id === msg.sender_id;
                    return (
                      <motion.div key={msg.id}
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.015, 0.1), duration: 0.12 }}
                        className="flex gap-3 group hover:bg-white/[0.015] px-2 py-1 rounded-xl -mx-2 transition-colors">
                        <img src={ava({avatar_url:msg.sender_avatar,username:msg.sender_username})} alt=""
                          onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar,status:(msg as MessageFull).sender_status})}
                          className="w-9 h-9 rounded-xl object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity mt-0.5"/>
                        <div className="flex-1 min-w-0">
                          {msg.reply_to_id&&msg.reply_content&&(
                            <div className="flex items-center gap-1.5 mb-1 text-xs text-zinc-500 border-l-2 border-indigo-500/40 pl-2 py-0.5 bg-white/[0.02] rounded-r-lg">
                              <Reply size={10} className="text-indigo-400 shrink-0"/>
                              <span className="font-semibold text-zinc-400">{msg.reply_username}</span>
                              <span className="truncate text-zinc-600">{msg.reply_content}</span>
                            </div>
                          )}
                          <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                            <span className="font-bold text-white text-sm cursor-pointer hover:text-indigo-300 transition-colors"
                              onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar})}>
                              {msg.sender_username}
                            </span>
                            {(msg as MessageFull).sender_role&&<span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">{(msg as MessageFull).sender_role}</span>}
                            <span className="text-[11px] text-zinc-700">{ft(msg.created_at)}</span>
                            {(msg as MessageFull).edited&&<span className="text-[10px] text-zinc-700 italic">(edytowano)</span>}
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed break-words">{msg.content}</p>
                          {msg.attachment_url&&(
                            <div className="mt-2 max-w-xs">
                              {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment_url) ? (
                                <img src={msg.attachment_url} alt="attachment" className="rounded-xl max-h-56 object-contain border border-white/[0.06] cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={()=>window.open(msg.attachment_url!,'_blank')}/>
                              ) : (
                                <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${gb} text-xs`}>
                                  <Paperclip size={12}/> {msg.attachment_url.split('/').pop()}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-start mt-1">
                          <button onClick={()=>setReplyTo(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-zinc-600 hover:text-zinc-300 transition-colors"><Reply size={12}/></button>
                          {isOwn&&<button onClick={()=>confirmAction('Usunąć wiadomość?', () => { if(activeView==='servers') messagesApi.delete(msg.id).catch(console.error); else dmsApi.deleteMessage(msg.id).catch(console.error); })} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-zinc-600 hover:text-rose-400 transition-colors"><Trash2 size={12}/></button>}
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={bottomRef}/>
                </div>
              </div>

              {/* Input */}
              <div className="shrink-0 p-3 bg-zinc-950/80 border-t border-white/[0.05]">
                {replyTo&&(
                  <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-1.5 mb-2 text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                      <Reply size={11} className="text-indigo-400 shrink-0"/>
                      <span className="text-indigo-300 font-semibold">{replyTo.sender_username}</span>
                      <span className="truncate text-zinc-600">{replyTo.content}</span>
                    </div>
                    <button onClick={()=>setReplyTo(null)} className="text-zinc-500 hover:text-white ml-2 shrink-0"><X size={12}/></button>
                  </div>
                )}
                {attachPreview&&(
                  <div className="relative inline-block mb-2">
                    <img src={attachPreview} alt="" className="h-16 rounded-xl object-cover border border-white/[0.07]"/>
                    <button onClick={()=>{setAttachFile(null);setAttachPreview(null);}} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center"><X size={10} className="text-white"/></button>
                  </div>
                )}
                {attachFile&&!attachPreview&&(
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ${gb} text-xs mb-2`}>
                    <Paperclip size={11}/> {attachFile.name}
                    <button onClick={()=>setAttachFile(null)} className="ml-1 text-zinc-500 hover:text-rose-400"><X size={10}/></button>
                  </div>
                )}
                {sendError&&(
                  <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5 mb-2 text-xs text-rose-400">
                    <X size={11} className="shrink-0"/>
                    <span className="flex-1">{sendError}</span>
                    <button type="button" onClick={()=>setSendError('')} className="text-rose-500 hover:text-rose-300 ml-1"><X size={10}/></button>
                  </div>
                )}
                <form onSubmit={handleSend}>
                  <div className={`flex items-center gap-2 ${gi} rounded-2xl px-3 py-2.5 border`}>
                    <input type="file" ref={attachRef} onChange={handleAttach} accept="image/*" className="hidden"/>
                    <button type="button" onClick={()=>attachRef.current?.click()} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"><Image size={17}/></button>
                    <input type="text" value={msgInput} onChange={e=>setMsgInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey) handleSend(e as any); }}
                      placeholder={activeView==='dms'&&activeDm?`Wiadomość do ${activeDm.other_username}`:`Wiadomość w #${activeCh?.name||'...'}`}
                      className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-700 outline-none min-w-0"/>
                    <button type="button" className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"><Smile size={17}/></button>
                    <button type="submit" disabled={(!msgInput.trim()&&!attachFile)||sending}
                      className="w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 flex items-center justify-center text-white transition-colors shrink-0">
                      {sending?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </section>

        {/* RIGHT */}
        <aside className="hidden xl:flex w-60 shrink-0 flex-col gap-2.5">
          <div className={`${gp} rounded-3xl p-4 flex-1 overflow-y-auto`}>
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Członkowie</h3>
            {members.slice(0,12).map(m=>(
              <div key={m.id} className="flex items-center gap-2.5 mb-3 cursor-pointer group" onClick={()=>openProfile(m)}>
                <div className="relative shrink-0">
                  <img src={ava(m)} className="w-7 h-7 rounded-full object-cover" alt=""/>
                  <div className={`absolute bottom-0 right-0 w-2 h-2 ${sc(m.status)} border border-zinc-950 rounded-full`}/>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-300 truncate group-hover:text-white transition-colors">{m.username}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{m.role_name}</p>
                </div>
              </div>
            ))}
            {members.length===0&&!activeServer&&<p className="text-xs text-zinc-700">Brak serwera</p>}
          </div>
        </aside>
      </main>

      {/* ── MODALS ─────────────────────────────────────────────────────── */}

      {/* Profile */}
      <AnimatePresence>
        {profileOpen&&selUser&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setProfileOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl w-full max-w-sm overflow-hidden`}>
              <div className="h-24 relative overflow-hidden">
                {(currentUser?.id===selUser.id ? (profBannerPrev||currentUser?.banner_url) : selUser.banner_url) ? (
                  <img src={currentUser?.id===selUser.id?(profBannerPrev||currentUser?.banner_url!):selUser.banner_url} className="w-full h-full object-cover" alt=""/>
                ) : (
                  <div className={`w-full h-full bg-gradient-to-r ${editProf?.banner_color||'from-indigo-600 via-purple-600 to-pink-600'}`}/>
                )}
                {currentUser?.id===selUser.id&&(
                  <label className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-lg flex items-center justify-center cursor-pointer transition-colors">
                    <Upload size={12} className="text-white"/>
                    <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden"/>
                  </label>
                )}
                <div className="absolute bottom-0 left-5 translate-y-1/2">
                  <div className="relative">
                    <img src={ava(selUser)} className="w-16 h-16 rounded-2xl border-4 border-zinc-900 object-cover" alt=""/>
                    <div className={`absolute bottom-0 right-0 w-4 h-4 ${sc(selUser.status||'offline')} rounded-full border-2 border-zinc-900`}/>
                  </div>
                </div>
              </div>
              <div className="p-5 pt-11">
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="text-lg font-bold text-white">{selUser.username}</h3>{selUser.custom_status&&<p className="text-sm text-zinc-500">{selUser.custom_status}</p>}</div>
                  <button onClick={()=>setProfileOpen(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={17}/></button>
                </div>
                {selUser.bio&&<p className="text-sm text-zinc-400 mb-4 bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">{selUser.bio}</p>}
                {currentUser?.id===selUser.id ? (
                  <div className="flex flex-col gap-3">
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1 block">Nazwa</label>
                      <input value={editProf?.username||''} onChange={e=>setEditProf((p:any)=>({...p,username:e.target.value}))} className={`w-full ${gi} rounded-xl px-3 py-2 text-sm`}/></div>
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1 block">Status</label>
                      <input value={editProf?.custom_status||''} onChange={e=>setEditProf((p:any)=>({...p,custom_status:e.target.value}))} placeholder="Ustaw status..." className={`w-full ${gi} rounded-xl px-3 py-2 text-sm`}/></div>
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1 block">Bio</label>
                      <textarea value={editProf?.bio||''} onChange={e=>setEditProf((p:any)=>({...p,bio:e.target.value}))} rows={2} className={`w-full ${gi} rounded-xl px-3 py-2 text-sm resize-none`}/></div>
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Kolor bannera</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {GRADIENTS.map(g=><button key={g} onClick={()=>setEditProf((p:any)=>({...p,banner_color:g}))}
                          className={`w-8 h-8 rounded-lg bg-gradient-to-r ${g} border-2 transition-all ${editProf?.banner_color===g?'border-white':'border-transparent'}`}/>)}
                      </div></div>
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1 block">Avatar</label>
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="w-full text-xs text-zinc-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-white/[0.06] file:text-zinc-300"/></div>
                    <button onClick={handleSaveProfile} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-2.5 rounded-xl transition-colors">Zapisz</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={()=>openDm(selUser.id)} className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm"><MessageSquare size={14}/> Wiadomość</button>
                    <button onClick={()=>startDmCall(selUser.id,selUser.username,'voice')} className={`w-10 h-10 ${gb} rounded-xl flex items-center justify-center`}><Phone size={15}/></button>
                    <button onClick={()=>startDmCall(selUser.id,selUser.username,'video')} className={`w-10 h-10 ${gb} rounded-xl flex items-center justify-center`}><Video size={15}/></button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Join Server */}
      <AnimatePresence>
        {createSrvOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setCreateSrvOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl p-7 w-full max-w-md`}>
              <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-white">Serwer</h2><button onClick={()=>setCreateSrvOpen(false)} className="text-zinc-600 hover:text-white"><X size={17}/></button></div>
              <div className="flex gap-1.5 mb-5 bg-white/[0.03] p-1 rounded-xl">
                {(['create','join'] as const).map(m=><button key={m} onClick={()=>setCreateSrvMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${createSrvMode===m?'bg-indigo-500 text-white':'text-zinc-500 hover:text-white'}`}>{m==='create'?'Utwórz':'Dołącz'}</button>)}
              </div>
              {createSrvMode==='create' ? (
                <div className="flex flex-col gap-3">
                  <input value={createSrvName} onChange={e=>setCreateSrvName(e.target.value)} placeholder="Nazwa serwera..." className={`${gi} rounded-xl px-4 py-3 text-sm w-full`}/>
                  <button onClick={handleCreateServer} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Utwórz</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Kod zaproszenia..." className={`${gi} rounded-xl px-4 py-3 text-sm w-full`}/>
                  <button onClick={handleJoinServer} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Dołącz</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server Settings */}
      <AnimatePresence>
        {srvSettOpen&&serverFull&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setSrvSettOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col`}>
              <div className="flex items-center justify-between p-5 border-b border-white/[0.06] shrink-0">
                <h2 className="text-base font-bold text-white">Ustawienia serwera</h2>
                <button onClick={()=>setSrvSettOpen(false)} className="text-zinc-600 hover:text-white"><X size={17}/></button>
              </div>
              <div className="flex border-b border-white/[0.06] shrink-0 px-5 gap-0.5">
                {(['overview','roles','members','invites'] as const).map(t=>(
                  <button key={t} onClick={()=>setSrvSettTab(t)}
                    className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${srvSettTab===t?'border-indigo-500 text-white':'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                    {t==='overview'?'Ogólne':t==='roles'?'Role':t==='members'?'Członkowie':'Zaproszenia'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                {srvSettTab==='overview'&&(
                  <div className="flex flex-col gap-5">
                    <div>
                      <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Banner</label>
                      <div className="relative h-28 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                        {(srvBannerFile?URL.createObjectURL(srvBannerFile):srvForm.banner_url) ? (
                          <img src={srvBannerFile?URL.createObjectURL(srvBannerFile):srvForm.banner_url} className="w-full h-full object-cover" alt=""/>
                        ) : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Image size={22}/></div>}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 cursor-pointer transition-opacity">
                          <span className="text-sm text-white font-semibold flex items-center gap-1.5"><Upload size={14}/> Zmień banner</span>
                          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setSrvBannerFile(f);e.target.value='';}} className="hidden"/>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Ikona</label>
                      <div className="flex items-center gap-4">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.06]">
                          {(srvIconFile?URL.createObjectURL(srvIconFile):srvForm.icon_url) ? (
                            <img src={srvIconFile?URL.createObjectURL(srvIconFile):srvForm.icon_url} className="w-full h-full object-cover" alt=""/>
                          ) : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-zinc-600">{serverFull.name.charAt(0)}</div>}
                        </div>
                        <label className={`cursor-pointer text-sm font-semibold ${gb} px-3 py-2 rounded-xl flex items-center gap-1.5`}>
                          <Upload size={13}/> Zmień ikonę
                          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setSrvIconFile(f);e.target.value='';}} className="hidden"/>
                        </label>
                      </div>
                    </div>
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Nazwa</label>
                      <input value={srvForm.name} onChange={e=>setSrvForm(p=>({...p,name:e.target.value}))} className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/></div>
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Opis</label>
                      <textarea value={srvForm.description} onChange={e=>setSrvForm(p=>({...p,description:e.target.value}))} rows={3} placeholder="Opis serwera..." className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm resize-none`}/></div>
                    <button onClick={handleSaveSrv} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Zapisz zmiany</button>
                  </div>
                )}
                {srvSettTab==='roles'&&(
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Role ({roles.length})</h3>
                      <button onClick={openNewRole} className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5"><Plus size={14}/> Nowa rola</button>
                    </div>
                    {roles.length===0&&<p className="text-sm text-zinc-700">Brak ról</p>}
                    {roles.map(r=>(
                      <div key={r.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] px-4 py-3 rounded-xl group">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{background:r.color}}/>
                          <span className="text-sm font-semibold text-white">{r.name}</span>
                          <span className="text-xs text-zinc-600">{(r.permissions||[]).length} uprawnień</span>
                        </div>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>openEditRole(r)} className={`w-7 h-7 ${gb} rounded-lg flex items-center justify-center`}><Edit3 size={12}/></button>
                          <button onClick={()=>handleDeleteRole(r.id)} className="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {srvSettTab==='members'&&(
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-white">Członkowie ({members.length})</h3>
                    {members.map(m=>(
                      <div key={m.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] px-4 py-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="relative"><img src={ava(m)} className="w-9 h-9 rounded-full object-cover" alt=""/><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(m.status)} border-2 border-zinc-950 rounded-full`}/></div>
                          <div><p className="text-sm font-semibold text-white">{m.username}</p><p className="text-xs text-zinc-600">{m.role_name}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.id!==currentUser?.id ? (
                            <>
                              <select value={m.role_name} onChange={e=>handleSetMemberRole(m.id,e.target.value)}
                                className={`text-xs ${gi} rounded-lg px-2 py-1.5`}>
                                <option value="Member">Member</option>
                                <option value="Admin">Admin</option>
                                {roles.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
                              </select>
                              {m.id!==serverFull?.owner_id&&<button onClick={()=>handleKick(m.id)} className="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center"><X size={12}/></button>}
                            </>
                          ) : <span className="text-xs text-zinc-700">(ty)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {srvSettTab==='invites'&&(
                  <div className="flex flex-col gap-4">
                    <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Ważność</label>
                      <select value={inviteDur} onChange={e=>setInviteDur(e.target.value)} className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}>
                        <option value="1800">30 minut</option><option value="3600">1 godzina</option><option value="86400">1 dzień</option><option value="never">Nigdy</option>
                      </select></div>
                    <button onClick={handleInvite} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Generuj zaproszenie</button>
                    {inviteCode&&(
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                        <p className="text-[10px] text-zinc-600 mb-1.5">KOD</p>
                        <div className="flex items-center gap-2">
                          <code className="text-white font-mono text-sm flex-1">{inviteCode}</code>
                          <button onClick={()=>navigator.clipboard.writeText(inviteCode)} className="text-xs text-indigo-400 hover:text-indigo-300">Kopiuj</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel Edit */}
      <AnimatePresence>
        {chEditOpen&&editingCh&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setChEditOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl p-7 w-full max-w-md`}>
              <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-white">Edytuj kanał</h2><button onClick={()=>setChEditOpen(false)} className="text-zinc-600 hover:text-white"><X size={17}/></button></div>
              <div className="flex flex-col gap-4">
                <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Nazwa</label>
                  <input value={chForm.name} onChange={e=>setChForm(p=>({...p,name:e.target.value}))} className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/></div>
                <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Opis</label>
                  <input value={chForm.description} onChange={e=>setChForm(p=>({...p,description:e.target.value}))} placeholder="Opis kanału..." className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/></div>
                <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] px-4 py-3 rounded-xl">
                  <div className="flex items-center gap-2"><Lock size={14} className="text-zinc-500"/>
                    <div><p className="text-sm font-semibold text-white">Prywatny</p><p className="text-xs text-zinc-600">Dostępny dla wybranych ról</p></div></div>
                  <button onClick={()=>setChForm(p=>({...p,is_private:!p.is_private}))}
                    className={`w-10 h-6 rounded-full transition-all relative ${chForm.is_private?'bg-indigo-500':'bg-white/[0.08]'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${chForm.is_private?'left-5':'left-1'}`}/>
                  </button>
                </div>
                {chForm.is_private&&roles.length>0&&(
                  <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Dostęp dla ról</label>
                    <div className="flex flex-col gap-2">
                      {roles.map(r=>{
                        const sel=chForm.role_ids.includes(r.id);
                        return <button key={r.id} onClick={()=>setChForm(p=>({...p,role_ids:sel?p.role_ids.filter(id=>id!==r.id):[...p.role_ids,r.id]}))}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${sel?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:r.color}}/>{r.name}
                          {sel&&<Check size={13} className="ml-auto text-indigo-400"/>}
                        </button>;
                      })}
                    </div></div>
                )}
                <button onClick={handleSaveCh} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Zapisz</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Channel */}
      <AnimatePresence>
        {chCreateOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setChCreateOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl p-7 w-full max-w-md`}>
              <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-white">Nowy kanał</h2><button onClick={()=>setChCreateOpen(false)} className="text-zinc-600 hover:text-white"><X size={17}/></button></div>
              <div className="flex flex-col gap-4">
                <div className="flex gap-1.5 bg-white/[0.03] p-1 rounded-xl">
                  {(['text','voice'] as const).map(t=><button key={t} onClick={()=>setNewChType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${newChType===t?'bg-indigo-500 text-white':'text-zinc-500 hover:text-white'}`}>
                    {t==='text'?<><Hash size={14}/> Tekstowy</>:<><Volume2 size={14}/> Głosowy</>}
                  </button>)}
                </div>
                <input value={newChName} onChange={e=>setNewChName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleCreateCh()} placeholder="nazwa-kanalu" className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/>
                <button onClick={handleCreateCh} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Utwórz kanał</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Modal */}
      <AnimatePresence>
        {roleModalOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setRoleModalOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl p-7 w-full max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar`}>
              <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-white">{editingRole?'Edytuj rolę':'Nowa rola'}</h2><button onClick={()=>setRoleModalOpen(false)} className="text-zinc-600 hover:text-white"><X size={17}/></button></div>
              <div className="flex flex-col gap-4">
                <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Nazwa</label>
                  <input value={roleForm.name} onChange={e=>setRoleForm(p=>({...p,name:e.target.value}))} placeholder="Nazwa roli..." className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/></div>
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Kolor</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {ROLE_COLORS.map(c=><button key={c} onClick={()=>setRoleForm(p=>({...p,color:c}))}
                      className="w-8 h-8 rounded-lg border-2 transition-all" style={{background:c,borderColor:roleForm.color===c?'#fff':'transparent'}}/>)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border border-white/[0.1] shrink-0" style={{background:roleForm.color}}/>
                    <input type="color" value={roleForm.color} onChange={e=>setRoleForm(p=>({...p,color:e.target.value}))} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"/>
                    <input value={roleForm.color} onChange={e=>setRoleForm(p=>({...p,color:e.target.value}))} className={`flex-1 ${gi} rounded-xl px-3 py-2 text-sm font-mono`}/>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Uprawnienia</label>
                  <div className="flex flex-col gap-2">
                    {PERMISSIONS.map(perm=>{
                      const chk=roleForm.permissions.includes(perm.id);
                      return <button key={perm.id} onClick={()=>setRoleForm(p=>({...p,permissions:chk?p.permissions.filter(x=>x!==perm.id):[...p.permissions,perm.id]}))}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${chk?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                        <div className="flex items-center gap-2"><Shield size={13} className={chk?'text-indigo-400':'text-zinc-600'}/>{perm.label}</div>
                        {chk&&<Check size={13} className="text-indigo-400"/>}
                      </button>;
                    })}
                  </div>
                </div>
                <button onClick={handleSaveRole} disabled={!roleForm.name.trim()} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                  {editingRole?'Zapisz zmiany':'Utwórz rolę'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST CONTAINER ─────────────────────────────────────────────── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none" style={{minWidth:'20rem',maxWidth:'28rem'}}>
        <AnimatePresence>
          {toasts.map(t => {
            const toastIcon = t.type==='success'?<CheckCircle2 size={15}/>:t.type==='error'?<AlertCircle size={15}/>:t.type==='warn'?<AlertTriangle size={15}/>:<Info size={15}/>;
            const toastCls = t.type==='success'?'bg-emerald-500/15 border-emerald-500/30 text-emerald-400':t.type==='error'?'bg-rose-500/15 border-rose-500/30 text-rose-400':t.type==='warn'?'bg-amber-500/15 border-amber-500/30 text-amber-400':'bg-zinc-900/95 border-white/[0.1] text-zinc-300';
            return (
              <motion.div key={t.id} initial={{opacity:0,y:-16,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8,scale:0.95}} transition={{duration:0.2}}
                className={`pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl ${toastCls}`}>
                <span className="shrink-0">{toastIcon}</span>
                <span className="flex-1 text-sm font-medium">{t.msg}</span>
                {t.onConfirm && <>
                  <button onClick={()=>{t.onConfirm!();rmToast(t.id);}} className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors">Tak</button>
                  <button onClick={()=>rmToast(t.id)} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/15 transition-colors">Nie</button>
                </>}
                {!t.onConfirm && <button onClick={()=>rmToast(t.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"><X size={14}/></button>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── MINIMIZED CALL WIDGET ────────────────────────────────────────── */}
      <AnimatePresence>
        {activeCall && !showCallPanel && (
          <motion.div initial={{opacity:0,scale:0.8,y:20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.8,y:20}}
            className={`fixed bottom-5 right-5 z-[150] ${gm} rounded-2xl p-3 flex items-center gap-3 min-w-56 shadow-2xl`}>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {activeCall.type==='voice_channel'?activeCall.channelName:activeCall.username}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">{fmtDur(callDuration)}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={toggleMute} title="Mikrofon" className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${activeCall.isMuted?'bg-rose-500 text-white':'bg-white/[0.06] text-zinc-400 hover:text-white'}`}>
                {activeCall.isMuted?<MicOff size={13}/>:<Mic size={13}/>}
              </button>
              <button onClick={()=>setShowCallPanel(true)} title="Powróć do rozmowy" className="w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center text-white transition-colors">
                <Phone size={13}/>
              </button>
              <button onClick={hangupCall} title="Rozłącz" className="w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-400 flex items-center justify-center text-white transition-colors">
                <PhoneOff size={13}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INCOMING CALL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div initial={{opacity:0,x:80}} animate={{opacity:1,x:0}} exit={{opacity:0,x:80}}
            className={`fixed top-20 right-5 z-[160] ${gm} rounded-2xl p-4 min-w-64 shadow-2xl border border-indigo-500/20`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative shrink-0">
                <img src={incomingCall.from.avatar_url||`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(incomingCall.from.username)}&size=40`} className="w-10 h-10 rounded-full object-cover" alt=""/>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                  {incomingCall.type==='video'?<Video size={9} className="text-white"/>:<Phone size={9} className="text-white"/>}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{incomingCall.from.username}</p>
                <p className="text-xs text-zinc-500 animate-pulse">{incomingCall.type==='video'?'Połączenie wideo...':'Połączenie głosowe...'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{
                acceptCall(incomingCall.conversation_id, incomingCall.from.id);
                setActiveCall({type: incomingCall.type==='video'?'dm_video':'dm_voice', userId: incomingCall.from.id, username: incomingCall.from.username, isMuted:false,isDeafened:false,isCameraOn:false,isScreenSharing:false});
                setActiveDmUserId(incomingCall.from.id); setActiveView('dms'); setShowCallPanel(true); setIncomingCall(null);
              }} className="flex-1 h-9 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-white font-semibold flex items-center justify-center gap-1.5 text-sm transition-colors">
                <Phone size={14}/> Odbierz
              </button>
              <button onClick={()=>{rejectCall(incomingCall.from.id); setIncomingCall(null);}}
                className="flex-1 h-9 bg-rose-500 hover:bg-rose-400 rounded-xl text-white font-semibold flex items-center justify-center gap-1.5 text-sm transition-colors">
                <PhoneOff size={14}/> Odrzuć
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
