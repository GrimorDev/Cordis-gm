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
  getSocket,
} from './socket';
import {
  makePeerConnection, attachRemoteAudio, detachRemoteAudio, muteAllRemote,
  setOutputDevice, watchSpeaking, getMediaDevices,
} from './webrtc';

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
const AUTH_FEATURES = [
  { icon: '💬', title: 'Wiadomości w czasie rzeczywistym', desc: 'Tekst, głos i wideo — wszystko w jednym miejscu' },
  { icon: '🎙️', title: 'Kanały głosowe i wideo', desc: 'Dołącz do rozmów z jednym kliknięciem' },
  { icon: '🛡️', title: 'Role i uprawnienia', desc: 'Pełna kontrola nad serwerem i członkami' },
  { icon: '🚀', title: 'Szybkie i niezawodne', desc: 'Socket.IO + PostgreSQL dla stale aktualnych danych' },
];

function AuthScreen({ onAuth }: { onAuth: (u: UserProfile, t: string) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    if (tab === 'register' && form.password !== form.confirm) {
      setError('Hasła nie pasują do siebie'); setLoading(false); return;
    }
    try {
      const res = tab === 'login'
        ? await auth.login({ login: form.login, password: form.password })
        : await auth.register({ username: form.username, email: form.email, password: form.password });
      setToken(res.token); onAuth(res.user, res.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.25) 0%,transparent 55%),radial-gradient(ellipse at 80% 20%,rgba(139,92,246,.18) 0%,transparent 50%),radial-gradient(ellipse at 60% 90%,rgba(79,70,229,.12) 0%,transparent 45%),#09090b' }}>

      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"/>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-3xl"/>
      </div>

      {/* Left panel — branding */}
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
        className="hidden lg:flex flex-col justify-between w-[52%] p-12 relative">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
            <img src="/cordyn.png" alt="Cordyn" className="w-8 h-8 object-contain"/>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Cordyn</span>
        </div>

        {/* Hero text */}
        <div className="flex-1 flex flex-col justify-center max-w-lg">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
              <span className="text-sm text-indigo-300 font-medium">Platforma dla twórców i społeczności</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              Twoja przestrzeń.<br/>
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Twoje zasady.
              </span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed mb-10">
              Buduj społeczności, komunikuj się w czasie rzeczywistym i zarządzaj serwerami z pełną kontrolą.
            </p>
          </motion.div>

          {/* Feature list */}
          <div className="grid grid-cols-1 gap-3">
            {AUTH_FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className="flex items-start gap-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 hover:bg-white/[0.05] transition-colors">
                <span className="text-2xl shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-zinc-700">© 2025 Cordyn. Wszelkie prawa zastrzeżone.</p>
      </motion.div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`w-full max-w-sm ${gm} p-8`}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <img src="/cordyn.png" alt="Cordyn" className="w-8 h-8 object-contain"/>
            <span className="text-lg font-bold text-white">Cordyn</span>
          </div>

          {/* Header */}
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-white mb-1">
              {tab === 'login' ? 'Witaj z powrotem!' : 'Dołącz do Cordyn'}
            </h2>
            <p className="text-sm text-zinc-500">
              {tab === 'login'
                ? 'Zaloguj się na swoje konto, by kontynuować'
                : 'Utwórz konto i zacznij budować społeczność'}
            </p>
          </div>

          {/* Tab switch */}
          <div className="flex bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1 mb-6">
            {(['login','register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  tab===t ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-400 hover:text-white'}`}>
                {t === 'login' ? 'Logowanie' : 'Rejestracja'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <AnimatePresence mode="wait">
              {tab === 'register' ? (
                <motion.div key="reg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-3.5 overflow-hidden">
                  <div className="relative">
                    <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                    <input required value={form.username} onChange={set('username')} placeholder="Nazwa użytkownika"
                      pattern="[a-zA-Z0-9_]+" minLength={2} maxLength={32}
                      className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`} />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">@</span>
                    <input required type="email" value={form.email} onChange={set('email')} placeholder="Adres email"
                      className={`${gi} rounded-xl pl-9 pr-4 py-3 text-sm w-full`} />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="relative">
                    <MessageSquare size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                    <input required value={form.login} onChange={set('login')} placeholder="Login lub email"
                      className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
              <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                placeholder="Hasło" minLength={6}
                className={`${gi} rounded-xl pl-10 pr-10 py-3 text-sm w-full`} />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                {showPass ? <VolumeX size={15}/> : <VolumeX size={15} className="opacity-50"/>}
              </button>
            </div>

            {tab === 'register' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="relative overflow-hidden">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                <input required type={showPass ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')}
                  placeholder="Potwierdź hasło" minLength={6}
                  className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`} />
              </motion.div>
            )}

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 overflow-hidden">
                  <AlertCircle size={15} className="shrink-0"/>
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading}
              className="relative overflow-hidden bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 mt-1">
              {loading
                ? <><Loader2 size={17} className="animate-spin"/> Ładowanie...</>
                : tab === 'login' ? 'Zaloguj się →' : 'Utwórz konto →'
              }
            </button>
          </form>

          <p className="text-xs text-zinc-700 text-center mt-5">
            {tab === 'login' ? 'Nie masz konta? ' : 'Masz już konto? '}
            <button onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              {tab === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}
            </button>
          </p>
        </motion.div>
      </div>
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

  const bottomRef        = useRef<HTMLDivElement>(null);
  const prevChRef        = useRef('');
  const attachRef        = useRef<HTMLInputElement>(null);
  const callTimerRef     = useRef<ReturnType<typeof setInterval>|null>(null);
  // WebRTC refs
  const localStreamRef   = useRef<MediaStream|null>(null);
  const screenStreamRef  = useRef<MediaStream|null>(null);
  const peerConnsRef     = useRef(new Map<string, RTCPeerConnection>());
  const speakStopRef     = useRef(new Map<string, ()=>void>()); // speaking detection cleanup
  const currentUserRef   = useRef(currentUser);
  const activeCallRef    = useRef(activeCall);
  const voiceHandlerRef  = useRef<Record<string, (...a: any[]) => void>>({});
  // WebRTC state
  const [speakingUsers, setSpeakingUsers]     = useState(new Set<string>());
  const [devices, setDevices]                 = useState<MediaDeviceInfo[]>([]);
  const [selMic, setSelMic]                   = useState('');
  const [selSpeaker, setSelSpeaker]           = useState('');
  const [selCamera, setSelCamera]             = useState('');
  const [devicesOpen, setDevicesOpen]         = useState(false);

  // App Settings
  const [appSettOpen, setAppSettOpen]         = useState(false);
  const [appSettTab, setAppSettTab]           = useState<'account'|'appearance'|'devices'|'privacy'>('account');

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
    // Voice channel events (route through voiceHandlerRef for fresh closures)
    sock.on('voice_user_joined', (d: any) => voiceHandlerRef.current.onUserJoined?.(d));
    sock.on('voice_user_left',   (d: any) => voiceHandlerRef.current.onUserLeft?.(d));
    // WebRTC signaling
    sock.on('webrtc_offer',  (d: any) => voiceHandlerRef.current.onOffer?.(d));
    sock.on('webrtc_answer', (d: any) => voiceHandlerRef.current.onAnswer?.(d));
    sock.on('webrtc_ice',    (d: any) => voiceHandlerRef.current.onIce?.(d));
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
    // Izolacja per-serwer: czyść cały stan poprzedniego serwera
    setSrvBannerFile(null);
    setSrvIconFile(null);
    setSrvSettOpen(false);     // zamknij ustawienia poprzedniego serwera
    setInviteCode(null);       // kod zaproszenia jest per-serwer
    setEditingRole(null);      // edytowana rola jest per-serwer
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

  // ── Sync refs ───────────────────────────────────────────────────
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activeCallRef.current  = activeCall;  }, [activeCall]);

  // ── Enumerate devices ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    getMediaDevices().then(setDevices).catch(() => {});
    navigator.mediaDevices?.addEventListener('devicechange', () =>
      getMediaDevices().then(setDevices).catch(() => {}));
  }, [isAuthenticated]);

  // ── WebRTC voice signaling handlers ─────────────────────────────
  // These are updated via ref so socket callbacks always get latest version
  const closePeer = (userId: string) => {
    const pc = peerConnsRef.current.get(userId);
    if (pc) { pc.close(); peerConnsRef.current.delete(userId); }
    detachRemoteAudio(userId);
    const stop = speakStopRef.current.get(userId);
    if (stop) { stop(); speakStopRef.current.delete(userId); }
    setSpeakingUsers(p => { const n = new Set(p); n.delete(userId); return n; });
  };
  const openPeer = async (remoteUserId: string, isInitiator: boolean, sdpOffer?: RTCSessionDescriptionInit) => {
    const existing = peerConnsRef.current.get(remoteUserId);
    if (existing) return existing;
    const pc = makePeerConnection(
      (c) => getSocket().emit('webrtc_ice', { to: remoteUserId, candidate: c }),
      (e) => {
        const stream = e.streams[0]; if (!stream) return;
        attachRemoteAudio(remoteUserId, stream);
        const stop = watchSpeaking(stream, (s) =>
          setSpeakingUsers(p => { const n = new Set(p); s ? n.add(remoteUserId) : n.delete(remoteUserId); return n; }));
        const old = speakStopRef.current.get(remoteUserId); if (old) old();
        speakStopRef.current.set(remoteUserId, stop);
      },
    );
    peerConnsRef.current.set(remoteUserId, pc);
    if (localStreamRef.current)
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    if (screenStreamRef.current)
      screenStreamRef.current.getTracks().forEach(t => pc.addTrack(t, screenStreamRef.current!));
    if (isInitiator) {
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      getSocket().emit('webrtc_offer', { to: remoteUserId, sdp: offer });
    } else if (sdpOffer) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
      getSocket().emit('webrtc_answer', { to: remoteUserId, sdp: answer });
    }
    return pc;
  };
  useEffect(() => {
    voiceHandlerRef.current = {
      onUserJoined: async ({ channel_id, user }: any) => {
        setVoiceUsers(p => ({ ...p, [channel_id]: [...(p[channel_id]||[]).filter((u:VoiceUser)=>u.id!==user.id), user] }));
        const me = currentUserRef.current; const call = activeCallRef.current;
        if (me && user.id !== me.id && call?.channelId === channel_id) {
          await openPeer(user.id, true);
        }
      },
      onUserLeft: ({ channel_id, user_id }: any) => {
        setVoiceUsers(p => ({ ...p, [channel_id]: (p[channel_id]||[]).filter((u:VoiceUser)=>u.id!==user_id) }));
        closePeer(user_id);
      },
      onOffer:  ({ from, sdp }: any) => openPeer(from, false, sdp),
      onAnswer: async ({ from, sdp }: any) => {
        const pc = peerConnsRef.current.get(from);
        if (pc && pc.signalingState !== 'stable')
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      },
      onIce: async ({ from, candidate }: any) => {
        const pc = peerConnsRef.current.get(from);
        if (pc) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      },
    };
  }); // runs every render to keep closures fresh

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
  const cleanupWebRTC = () => {
    // Stop all peer connections
    peerConnsRef.current.forEach((pc, uid) => { pc.close(); detachRemoteAudio(uid); });
    peerConnsRef.current.clear();
    // Stop local tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop()); localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop()); screenStreamRef.current = null;
    // Stop speaking detection
    speakStopRef.current.forEach(fn => fn()); speakStopRef.current.clear();
    setSpeakingUsers(new Set());
  };

  const acquireMic = async (deviceId?: string): Promise<MediaStream|null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      // Replace old stream
      const old = speakStopRef.current.get('self'); if (old) { old(); speakStopRef.current.delete('self'); }
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = stream;
      // Self speaking detection
      if (currentUserRef.current?.id) {
        const uid = currentUserRef.current.id;
        const stop = watchSpeaking(stream, s =>
          setSpeakingUsers(p => { const n = new Set(p); s ? n.add(uid) : n.delete(uid); return n; }));
        speakStopRef.current.set('self', stop);
      }
      // Pipe to existing peer connections
      peerConnsRef.current.forEach(pc =>
        stream.getTracks().forEach(t => { if (!pc.getSenders().find(s=>s.track?.kind===t.kind)) pc.addTrack(t, stream); }));
      // Re-enumerate after permission granted — now we get real device labels
      getMediaDevices().then(setDevices).catch(() => {});
      return stream;
    } catch (err: any) {
      const msg = err?.name === 'NotFoundError' ? 'Nie znaleziono mikrofonu'
        : err?.name === 'NotAllowedError' ? 'Brak uprawnień do mikrofonu — zezwól w przeglądarce'
        : 'Brak dostępu do mikrofonu';
      addToast(msg, 'error'); return null;
    }
  };

  const joinVoiceCh = async (ch: ChannelData) => {
    if (activeCall?.channelId && activeCall.channelId !== ch.id) {
      leaveVoiceChannel(activeCall.channelId);
      // Optimistic: remove self from old channel
      if (currentUser) setVoiceUsers(p => ({ ...p, [activeCall.channelId!]: (p[activeCall.channelId!]||[]).filter(u=>u.id!==currentUser.id) }));
      cleanupWebRTC();
    }
    await acquireMic(selMic || undefined);
    joinVoiceChannel(ch.id);
    setActiveCall({ type: 'voice_channel', channelId: ch.id, channelName: ch.name, serverId: activeServer, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    setShowCallPanel(true);
  };

  const hangupCall = () => {
    if (activeCall?.channelId) {
      leaveVoiceChannel(activeCall.channelId);
      // Optimistic: remove self from voiceUsers immediately
      if (currentUser) setVoiceUsers(p => ({ ...p, [activeCall.channelId!]: (p[activeCall.channelId!]||[]).filter(u=>u.id!==currentUser.id) }));
    }
    if (activeCall?.userId) endCall(activeCall.userId);
    cleanupWebRTC();
    setActiveCall(null); setShowCallPanel(false); setCallDuration(0);
  };

  const startDmCall = async (userId: string, username: string, type: 'voice'|'video') => {
    await acquireMic(selMic || undefined);
    sendCallInvite(userId, type);
    setActiveCall({ type: type === 'voice' ? 'dm_voice' : 'dm_video', userId, username, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    setActiveDmUserId(userId); setActiveView('dms'); setShowCallPanel(true); setProfileOpen(false);
  };

  const toggleMute = () => {
    const muted = !activeCall?.isMuted;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    setActiveCall(p => p ? {...p, isMuted: muted} : p);
  };
  const toggleDeafen = () => {
    const deaf = !activeCall?.isDeafened;
    muteAllRemote(deaf);
    setActiveCall(p => p ? {...p, isDeafened: deaf} : p);
  };
  const toggleCamera = async () => {
    if (activeCall?.isCameraOn) {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.stop(); });
      localStreamRef.current = localStreamRef.current ?
        new MediaStream(localStreamRef.current.getAudioTracks()) : null;
      setActiveCall(p => p ? {...p, isCameraOn: false} : p);
    } else {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: selCamera ? { deviceId: { exact: selCamera } } : true });
        vs.getVideoTracks().forEach(t => {
          localStreamRef.current?.addTrack(t);
          peerConnsRef.current.forEach(pc => { if (!pc.getSenders().find(s=>s.track?.kind==='video')) pc.addTrack(t, localStreamRef.current!); });
        });
        setActiveCall(p => p ? {...p, isCameraOn: true} : p);
      } catch { addToast('Brak dostępu do kamery', 'error'); }
    }
  };
  const toggleScreen = async () => {
    if (activeCall?.isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setActiveCall(p => p ? {...p, isScreenSharing: false} : p);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        stream.getVideoTracks().forEach(t => {
          peerConnsRef.current.forEach(pc => pc.addTrack(t, stream));
          t.onended = () => { screenStreamRef.current = null; setActiveCall(p => p ? {...p, isScreenSharing: false} : p); };
        });
        setActiveCall(p => p ? {...p, isScreenSharing: true} : p);
      } catch { addToast('Nie można udostępnić ekranu', 'error'); }
    }
  };

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
    <div className="flex flex-col h-[100dvh] w-full text-zinc-300 font-sans overflow-hidden relative bg-[#0a0a0a]">

      {/* TOP NAV — browser-tab style */}
      <nav className="h-11 border-b border-white/[0.07] flex items-center justify-between shrink-0 z-30 relative bg-[#111111]">
        {/* Left: mobile toggle + server tabs */}
        <div className="flex items-center h-full overflow-x-auto">
          <button onClick={() => setIsMobileOpen(v => !v)} className="md:hidden w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-white ml-2 shrink-0">
            {isMobileOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          {/* Friends / DM quick icons */}
          <div className="hidden md:flex items-center h-full pl-2 gap-0.5 pr-2 border-r border-white/[0.07]">
            {([{v:'friends' as const,i:<Users size={15}/>,label:'Znajomi'},{v:'dms' as const,i:<MessageCircle size={15}/>,label:'Wiadomości'}]).map(({v,i,label}) => (
              <button key={v} title={label} onClick={() => { setActiveView(v); setActiveServer(''); setActiveChannel(''); }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${activeView===v?'bg-indigo-500/20 text-indigo-400':'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06]'}`}>
                {i}
              </button>
            ))}
          </div>
          {/* Server tabs */}
          <div className="hidden md:flex items-center h-full">
            {serverList.map(srv => {
              const isActive = activeServer===srv.id&&activeView==='servers';
              return (
                <button key={srv.id} onClick={() => { setActiveServer(srv.id); setActiveView('servers'); setActiveChannel(''); setServerFull(null); }}
                  className={`flex items-center gap-2 h-full px-4 text-sm font-medium transition-all border-r border-white/[0.05] whitespace-nowrap relative group ${isActive?'text-white bg-[#0a0a0a]':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'}`}>
                  {isActive&&<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"/>}
                  <span className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-white shrink-0 overflow-hidden">
                    {srv.icon_url ? <img src={srv.icon_url} className="w-full h-full object-cover" alt=""/> : srv.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[120px] truncate">{srv.name}</span>
                </button>
              );
            })}
            <button onClick={() => setCreateSrvOpen(true)}
              className="flex items-center justify-center w-9 h-full text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all border-r border-white/[0.05]">
              <Plus size={15}/>
            </button>
          </div>
        </div>
        {/* Center: branding */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none select-none">
          <img src="/cordyn.png" alt="Cordyn" className="w-5 h-5 rounded-md object-contain opacity-80"/>
          <span className="text-white font-bold tracking-tight text-sm">Cordyn</span>
        </div>
        {/* Right: search + bell + settings + avatar */}
        <div className="flex items-center gap-1.5 pr-3">
          <div className="relative group hidden sm:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-zinc-400 transition-colors"/>
            <input placeholder="Szukaj..." className="bg-white/[0.05] border border-white/[0.07] text-white placeholder-zinc-600 outline-none focus:border-white/20 rounded-lg pl-8 pr-10 py-1.5 text-xs w-44 transition-all"/>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono hidden lg:flex items-center gap-0.5"><span className="border border-zinc-700 rounded px-1 py-0.5">⌘</span><span className="border border-zinc-700 rounded px-1 py-0.5">K</span></span>
          </div>
          <button className="relative w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
            <Bell size={15}/>
            {incoming.length>0&&<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-[#111]"/>}
          </button>
          <button onClick={() => { setAppSettTab('account'); setAppSettOpen(true); }} title="Ustawienia"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
            <Settings size={15}/>
          </button>
          <button onClick={openOwnProfile} className="w-7 h-7 rounded-full border border-white/[0.1] overflow-hidden hover:border-white/30 transition-all shrink-0">
            <img src={currentUser ? ava(currentUser) : ''} alt="" className="w-full h-full object-cover"/>
          </button>
        </div>
      </nav>

      {isMobileOpen&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsMobileOpen(false)}/>}

      {/* WORKSPACE */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* LEFT */}
        <aside className={`absolute md:relative z-30 md:z-0 w-56 shrink-0 flex flex-col bg-[#111111] border-r border-white/[0.07] transition-transform duration-300 h-full ${isMobileOpen?'translate-x-0':'-translate-x-[120%] md:translate-x-0'}`}>
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
            <div className="px-4 py-3 border-b border-white/[0.07] cursor-pointer hover:bg-white/[0.03] transition-colors group"
              onClick={() => { if(isAdmin){setSrvSettTab('overview');setSrvSettOpen(true);} }}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white truncate">{serverFull?.name||serverList.find(s=>s.id===activeServer)?.name||'Serwer'}</h2>
                {isAdmin&&<Settings2 size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0"/>}
              </div>
              {serverFull?.description&&<p className="text-[11px] text-zinc-600 mt-0.5 truncate">{serverFull.description}</p>}
              {!serverFull?.description&&<p className="text-[11px] text-zinc-700 mt-0.5">{isAdmin?'Kliknij — ustawienia serwera':'Witaj!'}</p>}
            </div>
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
              <AnimatePresence mode="wait">
              {serverFull && <motion.div key={activeServer}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
              {serverFull?.categories.map((cat, catIdx) => {
                const textChs  = cat.channels.filter(c=>c.type==='text');
                const voiceChs = cat.channels.filter(c=>c.type==='voice');
                return (
                  <motion.div key={cat.id} className="mb-1"
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: catIdx * 0.04, duration: 0.18 }}>

                    {/* Text channels — SPACES */}
                    {textChs.length>0&&<>
                      <div className="flex items-center justify-between px-4 pt-3 pb-1 group/cat">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{cat.name}</span>
                        {isAdmin&&<Plus size={11} className="text-zinc-700 hover:text-zinc-400 cursor-pointer opacity-0 group-hover/cat:opacity-100 transition-opacity"
                          onClick={() => { setChCreateCatId(cat.id); setChCreateOpen(true); setNewChName(''); setNewChType('text'); }}/>}
                      </div>
                      {textChs.map(ch => {
                        const isAct = activeChannel===ch.id;
                        return (
                          <div key={ch.id} className="px-2">
                            <button onClick={() => { setActiveChannel(ch.id); setIsMobileOpen(false); }}
                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md mb-0.5 group/ch transition-all ${
                                isAct?'bg-white/[0.08] text-white':'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'}`}>
                              <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                <Hash size={13} className={`shrink-0 ${isAct?'text-zinc-300':'text-zinc-600'}`}/>
                                <span className="text-[13px] font-medium truncate">{ch.name}</span>
                                {ch.is_private&&<Lock size={9} className="text-zinc-700 shrink-0"/>}
                              </div>
                              {isAdmin&&<div className="flex gap-0.5 opacity-0 group-hover/ch:opacity-100 transition-opacity shrink-0">
                                <button onClick={e=>{e.stopPropagation();openChEdit(ch);}} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"><Settings2 size={10}/></button>
                                <button onClick={e=>{e.stopPropagation();handleDeleteCh(ch.id);}} className="w-5 h-5 flex items-center justify-center rounded hover:bg-rose-500/20 hover:text-rose-400"><Trash2 size={10}/></button>
                              </div>}
                            </button>
                          </div>
                        );
                      })}
                    </>}

                    {/* Voice channels — VOICE ROOMS */}
                    {voiceChs.length>0&&<>
                      <div className="flex items-center justify-between px-4 pt-3 pb-1 group/vcat">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Voice Rooms</span>
                        {isAdmin&&<Plus size={11} className="text-zinc-700 hover:text-zinc-400 cursor-pointer opacity-0 group-hover/vcat:opacity-100 transition-opacity"
                          onClick={() => { setChCreateCatId(cat.id); setChCreateOpen(true); setNewChName(''); setNewChType('voice'); }}/>}
                      </div>
                      {voiceChs.map(ch => {
                        const isActiveVoice = activeCall?.channelId===ch.id;
                        const chVoiceUsers  = voiceUsers[ch.id]||[];
                        const hasUsers = chVoiceUsers.length>0;
                        return (
                          <div key={ch.id} className="px-2">
                            <button onClick={() => joinVoiceCh(ch)}
                              className={`w-full px-2 py-1.5 rounded-md mb-0.5 group/ch transition-all ${
                                isActiveVoice?'bg-emerald-500/10 text-emerald-400':'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Volume2 size={13} className={`shrink-0 ${isActiveVoice?'text-emerald-400':hasUsers?'text-zinc-400':'text-zinc-600'}`}/>
                                  <span className="text-[13px] font-medium truncate">{ch.name}</span>
                                </div>
                                {/* Stacked avatars for voice users */}
                                {hasUsers&&(
                                  <div className="flex -space-x-1.5 shrink-0">
                                    {chVoiceUsers.slice(0,3).map(u=>(
                                      <img key={u.id} src={ava(u)} className={`w-4 h-4 rounded-full border ${isActiveVoice?'border-emerald-900':'border-[#111]'} object-cover`} alt="" title={u.username}/>
                                    ))}
                                    {chVoiceUsers.length>3&&<div className="w-4 h-4 rounded-full border border-[#111] bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-white">+{chVoiceUsers.length-3}</div>}
                                  </div>
                                )}
                              </div>
                              {/* speaking users list */}
                              {hasUsers&&<div className="mt-1 flex flex-col gap-0.5">
                                {chVoiceUsers.map(u=>{
                                  const isSpeaking=speakingUsers.has(u.id);
                                  const isMuted=u.id===currentUser?.id&&activeCall?.channelId===ch.id&&activeCall.isMuted;
                                  return (
                                    <div key={u.id} className="flex items-center gap-1.5 pl-5">
                                      <div className={`relative shrink-0 ${isSpeaking?'ring-1 ring-emerald-500 rounded-full':''}`}>
                                        <img src={ava(u)} className="w-3.5 h-3.5 rounded-full object-cover" alt=""/>
                                      </div>
                                      <span className={`text-[11px] truncate ${isSpeaking?'text-emerald-400':'text-zinc-500'}`}>{u.username}</span>
                                      {isMuted&&<MicOff size={8} className="text-rose-400 shrink-0"/>}
                                    </div>
                                  );
                                })}
                              </div>}
                            </button>
                          </div>
                        );
                      })}
                    </>}
                  </motion.div>
                );
              })}
              </motion.div>}
              </AnimatePresence>
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

          {/* USER BAR — bottom of sidebar */}
          <div className="shrink-0 px-3 py-2.5 border-t border-white/[0.07] bg-[#0f0f0f]">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0 cursor-pointer" onClick={openOwnProfile}>
                <img src={currentUser?ava(currentUser):''} className="w-8 h-8 rounded-full object-cover" alt=""/>
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(currentUser?.status??'offline')} border-2 border-[#0f0f0f] rounded-full`}/>
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={openOwnProfile}>
                <p className="text-[13px] font-semibold text-white leading-tight truncate hover:text-zinc-300 transition-colors">{currentUser?.username}</p>
                {(currentUser?.custom_status||currentUser?.status)&&
                  <p className="text-[11px] text-zinc-500 truncate leading-tight mt-0.5">{currentUser?.custom_status||currentUser?.status}</p>}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button title="Wycisz mikrofon" className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07] transition-all"><Mic size={13}/></button>
                <button title="Ustawienia aplikacji" onClick={()=>{setAppSettTab('account');setAppSettOpen(true);}}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07] transition-all"><Settings size={13}/></button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden min-w-0">
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
                {currentUser&&(()=>{
                  const selfSpeaking = speakingUsers.has(currentUser.id) && !activeCall.isMuted;
                  return (
                    <div className="flex flex-col items-center gap-3">
                      <div className={`relative p-1 rounded-3xl border-2 transition-all duration-150 ${selfSpeaking?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':activeCall.isMuted?'border-rose-500/40':'border-white/10'}`}>
                        <img src={ava(currentUser)} className="w-24 h-24 rounded-2xl object-cover" alt=""/>
                        <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${activeCall.isMuted?'bg-rose-500':'bg-emerald-500'}`}>
                          {activeCall.isMuted?<MicOff size={11} className="text-white"/>:<Mic size={11} className="text-white"/>}
                        </div>
                        {activeCall.isCameraOn&&<div className="absolute top-2 left-2 bg-indigo-500 rounded-full p-0.5"><Video size={9} className="text-white"/></div>}
                      </div>
                      <div className="text-center"><p className={`text-sm font-bold ${selfSpeaking?'text-emerald-400':'text-white'}`}>{currentUser.username}</p><p className="text-[10px] text-zinc-600">Ty</p></div>
                    </div>
                  );
                })()}
                {/* Other participants (voice channel only) */}
                {activeCall.channelId&&(voiceUsers[activeCall.channelId]||[]).filter(u=>u.id!==currentUser?.id).map(u=>{
                  const isSpeaking = speakingUsers.has(u.id);
                  return (
                    <div key={u.id} className="flex flex-col items-center gap-3">
                      <div className={`relative p-1 rounded-3xl border-2 transition-all duration-150 ${isSpeaking?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':'border-white/10'}`}>
                        <img src={ava(u)} className="w-24 h-24 rounded-2xl object-cover" alt=""/>
                        <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${isSpeaking?'bg-emerald-500':'bg-zinc-700'}`}>
                          <Mic size={11} className="text-white"/>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${isSpeaking?'text-emerald-400':'text-white'}`}>{u.username}</p>
                    </div>
                  );
                })}
                {/* DM call partner */}
                {activeCall.userId&&activeCall.username&&(()=>{
                  const partnerSpeaking = speakingUsers.has(activeCall.userId!);
                  return (
                    <div className="flex flex-col items-center gap-3">
                      <div className={`relative p-1 rounded-3xl border-2 transition-all duration-150 ${partnerSpeaking?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':'border-white/10'}`}>
                        <div className="w-24 h-24 rounded-2xl bg-zinc-800 border border-white/[0.06] flex items-center justify-center text-4xl font-bold text-zinc-600">
                          {activeCall.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${partnerSpeaking?'bg-emerald-500':'bg-zinc-700'}`}>
                          <Mic size={11} className="text-white"/>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${partnerSpeaking?'text-emerald-400':'text-white'}`}>{activeCall.username}</p>
                    </div>
                  );
                })()}
              </div>
              {/* Call controls */}
              <div className="shrink-0 border-t border-white/[0.05] bg-zinc-950/40">
                {/* Device settings panel */}
                <AnimatePresence>
                  {devicesOpen&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                      className="overflow-hidden border-b border-white/[0.05]">
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Mikrofon</label>
                          <select value={selMic} onChange={async e=>{setSelMic(e.target.value);if(localStreamRef.current)await acquireMic(e.target.value||undefined);}}
                            className="w-full bg-zinc-800/80 border border-white/[0.07] text-white text-xs rounded-lg px-2.5 py-2 outline-none">
                            <option value="">Domyślny</option>
                            {devices.filter(d=>d.kind==='audioinput').map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||`Mikrofon ${d.deviceId.slice(0,6)}`}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Głośnik</label>
                          <select value={selSpeaker} onChange={async e=>{setSelSpeaker(e.target.value);await setOutputDevice(e.target.value);}}
                            className="w-full bg-zinc-800/80 border border-white/[0.07] text-white text-xs rounded-lg px-2.5 py-2 outline-none">
                            <option value="">Domyślny</option>
                            {devices.filter(d=>d.kind==='audiooutput').map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||`Głośnik ${d.deviceId.slice(0,6)}`}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Kamera</label>
                          <select value={selCamera} onChange={e=>setSelCamera(e.target.value)}
                            className="w-full bg-zinc-800/80 border border-white/[0.07] text-white text-xs rounded-lg px-2.5 py-2 outline-none">
                            <option value="">Domyślna</option>
                            {devices.filter(d=>d.kind==='videoinput').map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||`Kamera ${d.deviceId.slice(0,6)}`}</option>)}
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="p-5 flex items-center justify-center gap-3">
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
                  <button onClick={async()=>{
                    if (!devicesOpen) {
                      // Request mic permission so we get real device labels
                      await getMediaDevices().then(setDevices).catch(()=>{});
                    }
                    setDevicesOpen(v=>!v);
                  }} title="Ustawienia urządzeń"
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${devicesOpen?'bg-zinc-700 text-white':gb}`}>
                    <Settings size={18}/>
                  </button>
                  <button onClick={hangupCall} title="Rozłącz"
                    className="w-12 h-12 rounded-2xl bg-rose-500 hover:bg-rose-400 flex items-center justify-center text-white transition-colors">
                    <PhoneOff size={18}/>
                  </button>
                </div>
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
              <header className="h-12 border-b border-white/[0.07] flex items-center justify-between px-5 bg-[#0a0a0a] z-10 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {activeView==='dms' ? (activeDm ? (
                    <div className="flex items-center gap-2.5">
                      <div className="relative"><img src={ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})} className="w-7 h-7 rounded-full object-cover" alt=""/><div className={`absolute bottom-0 right-0 w-2 h-2 ${sc(activeDm.other_status)} border border-[#0a0a0a] rounded-full`}/></div>
                      <h3 className="font-bold text-white text-sm">{activeDm.other_username}</h3>
                    </div>
                  ) : <h3 className="font-bold text-white text-sm">Wiadomości</h3>) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <Hash size={16} className="text-zinc-500 shrink-0"/>
                      <h3 className="font-bold text-white text-sm truncate">{activeCh?.name||activeChannel}</h3>
                      {activeCh?.description&&<span className="text-zinc-600 text-xs hidden lg:block">— {activeCh.description}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeView==='dms'&&activeDm&&<>
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'voice')} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"><Phone size={14}/></button>
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'video')} className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"><Video size={14}/></button>
                    <div className="w-px h-4 bg-white/[0.07]"/>
                  </>}
                  {/* Member avatars stacked */}
                  <div className="hidden md:flex -space-x-2">
                    {members.slice(0,4).map(m=>(
                      <img key={m.id} src={ava(m)} className="w-6 h-6 rounded-full border-2 border-[#0a0a0a] object-cover" alt="" title={m.username}/>
                    ))}
                    {members.length>4&&<div className="w-6 h-6 rounded-full border-2 border-[#0a0a0a] bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white">+{members.length-4}</div>}
                  </div>
                  <button className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"><MoreHorizontal size={14}/></button>
                </div>
              </header>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar flex flex-col">
                <AnimatePresence mode="wait" initial={false}>
                <motion.div key={`${activeServer}-${activeChannel}-${activeDmUserId}`}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="mt-auto flex flex-col gap-0.5">
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
                    // Date separator
                    const msgDate = new Date(msg.created_at).toDateString();
                    const prevDate = idx>0 ? new Date(messages[idx-1].created_at).toDateString() : null;
                    const showSep = idx===0 || msgDate!==prevDate;
                    const sepLabel = (() => {
                      const d=new Date(msg.created_at), today=new Date(), yesterday=new Date();
                      yesterday.setDate(yesterday.getDate()-1);
                      if(d.toDateString()===today.toDateString()) return 'Dzisiaj';
                      if(d.toDateString()===yesterday.toDateString()) return 'Wczoraj';
                      return d.toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric'});
                    })();
                    return (
                      <React.Fragment key={msg.id}>
                        {showSep&&(
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-white/[0.07]"/>
                            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest shrink-0">{sepLabel}</span>
                            <div className="flex-1 h-px bg-white/[0.07]"/>
                          </div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.012, 0.08), duration: 0.12 }}
                          className="flex gap-3 group hover:bg-white/[0.02] px-3 py-1.5 rounded-xl -mx-3 transition-colors">
                          <img src={ava({avatar_url:msg.sender_avatar,username:msg.sender_username})} alt=""
                            onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar,status:(msg as MessageFull).sender_status})}
                            className="w-9 h-9 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity mt-0.5"/>
                          <div className="flex-1 min-w-0">
                            {msg.reply_to_id&&msg.reply_content&&(
                              <div className="flex items-center gap-1.5 mb-1.5 text-xs text-zinc-500 border-l-2 border-zinc-600/50 pl-2.5 py-0.5">
                                <Reply size={9} className="text-zinc-500 shrink-0"/>
                                <span className="font-semibold text-zinc-500">{msg.reply_username}</span>
                                <span className="truncate text-zinc-600">{msg.reply_content}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="font-bold text-white text-sm cursor-pointer hover:underline"
                                onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar})}>
                                {msg.sender_username}
                              </span>
                              {(msg as MessageFull).sender_role&&(
                                <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                  {(msg as MessageFull).sender_role}
                                </span>
                              )}
                              <span className="text-[11px] text-zinc-600">{ft(msg.created_at)}</span>
                              {(msg as MessageFull).edited&&<span className="text-[10px] text-zinc-700 italic">(edytowano)</span>}
                            </div>
                            <p className="text-[13px] text-zinc-300 leading-relaxed break-words">{msg.content}</p>
                            {msg.attachment_url&&(
                              <div className="mt-2 max-w-sm">
                                {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment_url) ? (
                                  <img src={msg.attachment_url} alt="attachment" className="rounded-xl max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={()=>window.open(msg.attachment_url!,'_blank')}/>
                                ) : (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-white/[0.08] text-xs text-zinc-400 hover:text-white transition-colors">
                                    <Paperclip size={12}/> {msg.attachment_url.split('/').pop()}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-start mt-1">
                            <button onClick={()=>setReplyTo(msg)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-300 transition-colors"><Reply size={11}/></button>
                            {isOwn&&<button onClick={()=>confirmAction('Usunąć wiadomość?', () => { if(activeView==='servers') messagesApi.delete(msg.id).catch(console.error); else dmsApi.deleteMessage(msg.id).catch(console.error); })} className="w-6 h-6 flex items-center justify-center rounded hover:bg-rose-500/10 text-zinc-600 hover:text-rose-400 transition-colors"><Trash2 size={11}/></button>}
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={bottomRef}/>
                </motion.div>
                </AnimatePresence>
              </div>

              {/* Input */}
              <div className="shrink-0 px-4 pb-4 pt-2 bg-[#0a0a0a] border-t border-white/[0.07]">
                {/* Reply / attach previews */}
                <AnimatePresence>
                  {replyTo&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                      className="flex items-center justify-between bg-zinc-900/70 border border-white/[0.07] rounded-lg px-3 py-1.5 mb-2 text-xs overflow-hidden">
                      <div className="flex items-center gap-1.5 text-zinc-400 truncate">
                        <Reply size={10} className="text-zinc-500 shrink-0"/>
                        <span className="font-semibold text-zinc-300">{replyTo.sender_username}</span>
                        <span className="truncate text-zinc-600">{replyTo.content}</span>
                      </div>
                      <button onClick={()=>setReplyTo(null)} className="text-zinc-600 hover:text-white ml-2 shrink-0"><X size={11}/></button>
                    </motion.div>
                  )}
                  {attachPreview&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="relative inline-block mb-2 overflow-hidden">
                      <img src={attachPreview} alt="" className="h-16 rounded-lg object-cover"/>
                      <button onClick={()=>{setAttachFile(null);setAttachPreview(null);}} className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center"><X size={9} className="text-white"/></button>
                    </motion.div>
                  )}
                  {attachFile&&!attachPreview&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden mb-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/[0.07] text-xs text-zinc-400">
                        <Paperclip size={10}/> {attachFile.name}
                        <button onClick={()=>setAttachFile(null)} className="ml-1 text-zinc-600 hover:text-rose-400"><X size={9}/></button>
                      </div>
                    </motion.div>
                  )}
                  {sendError&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                      className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-1.5 mb-2 text-xs text-rose-400 overflow-hidden">
                      <AlertCircle size={11} className="shrink-0"/>
                      <span className="flex-1">{sendError}</span>
                      <button type="button" onClick={()=>setSendError('')}><X size={10}/></button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Main input row */}
                <form onSubmit={handleSend}>
                  <div className="flex items-center gap-3 bg-zinc-900/80 border border-white/[0.08] rounded-xl px-3 py-2.5 hover:border-white/[0.12] transition-colors focus-within:border-white/[0.15]">
                    <input type="file" ref={attachRef} onChange={handleAttach} accept="image/*" className="hidden"/>
                    <button type="button" onClick={()=>attachRef.current?.click()}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.07] transition-all shrink-0">
                      <Plus size={16}/>
                    </button>
                    <input type="text" value={msgInput} onChange={e=>setMsgInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey) handleSend(e as any); }}
                      placeholder={activeView==='dms'&&activeDm?`Wiadomość do ${activeDm.other_username}...`:`Wiadomość w #${activeCh?.name||''}...`}
                      className="flex-1 bg-transparent text-[13px] text-zinc-200 placeholder-zinc-700 outline-none min-w-0"/>
                    <button type="button" className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"><Smile size={16}/></button>
                    <button type="submit" disabled={(!msgInput.trim()&&!attachFile)||sending}
                      className="w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shrink-0 shadow-lg shadow-sky-500/20">
                      {sending?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </section>

        {/* RIGHT — Live voice + Activity */}
        <aside className="hidden xl:flex w-64 shrink-0 flex-col gap-0 bg-[#111111] border-l border-white/[0.07] overflow-y-auto custom-scrollbar">
          {/* ─ LIVE VOICE BLOCK ─ */}
          {activeView==='servers'&&(()=>{
            // find first voice channel on current server with users
            const allVoiceChs = serverFull?.categories.flatMap(c=>c.channels.filter(ch=>ch.type==='voice'))||[];
            const liveCh = allVoiceChs.find(ch=>(voiceUsers[ch.id]||[]).length>0);
            const liveUsers = liveCh ? (voiceUsers[liveCh.id]||[]) : [];
            if(!liveCh&&!activeCall?.channelId) return null;
            const displayCh = liveCh || activeCh;
            const displayUsers = liveCh ? liveUsers : (activeCall?.channelId?(voiceUsers[activeCall.channelId]||[]):[]);
            if(!displayCh) return null;
            return (
              <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="p-4 border-b border-white/[0.07]">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
                    <span className="text-[12px] font-bold text-white">Live: {displayCh.name}</span>
                  </div>
                  {activeCall&&<span className="text-[11px] font-mono text-emerald-400 font-semibold">{fmtDur(callDuration)}</span>}
                </div>
                {/* Participant thumbnails */}
                {displayUsers.length>0&&(
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {displayUsers.slice(0,3).map(u=>{
                      const isSpeaking=speakingUsers.has(u.id);
                      return (
                        <div key={u.id} className={`relative bg-zinc-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center border ${isSpeaking?'border-emerald-500/60':'border-white/[0.07]'}`}>
                          <img src={ava(u)} className="w-10 h-10 rounded-full object-cover" alt=""/>
                          <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1 flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${sc(u.status)} shrink-0`}/>
                            <span className="text-[10px] font-semibold text-white truncate">{u.username}</span>
                          </div>
                        </div>
                      );
                    })}
                    {displayUsers.length>3&&(
                      <div className="bg-zinc-900 rounded-xl aspect-video flex items-center justify-center border border-white/[0.07]">
                        <span className="text-xs font-bold text-zinc-500">+{displayUsers.length-3} więcej</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Join button */}
                <button onClick={()=>liveCh&&joinVoiceCh(liveCh)}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/[0.08] text-white text-[13px] font-semibold py-2.5 rounded-xl transition-all">
                  <Volume2 size={14} className="text-zinc-300"/>
                  Dołącz
                </button>
              </motion.div>
            );
          })()}

          {/* ─ ACTIVITY FEED ─ */}
          <div className="p-4 flex-1">
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Aktywność</h3>
            {activeView==='servers'&&channelMsgs.length>0 ? (
              <div className="flex flex-col gap-3">
                {channelMsgs.slice(-6).reverse().map(msg=>(
                  <div key={msg.id} className="flex items-start gap-2.5 group cursor-pointer" onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar})}>
                    <img src={ava({avatar_url:msg.sender_avatar,username:msg.sender_username})} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" alt=""/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-snug text-zinc-400">
                        <span className="font-semibold text-zinc-200 group-hover:text-white transition-colors">{msg.sender_username}</span>
                        {' '}napisał w{' '}
                        <span className="text-zinc-300 font-medium">#{activeCh?.name||'kanale'}</span>
                      </p>
                      <p className="text-[11px] text-zinc-600 truncate mt-0.5">"{msg.content.slice(0,50)}{msg.content.length>50?'…':''}"</p>
                      <p className="text-[10px] text-zinc-700 mt-0.5">{ft(msg.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {members.slice(0,8).map(m=>(
                  <div key={m.id} className="flex items-center gap-2.5 cursor-pointer group" onClick={()=>openProfile(m)}>
                    <div className="relative shrink-0">
                      <img src={ava(m)} className="w-6 h-6 rounded-full object-cover" alt=""/>
                      <div className={`absolute bottom-0 right-0 w-2 h-2 ${sc(m.status)} border border-[#111] rounded-full`}/>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-zinc-400 truncate group-hover:text-zinc-200 transition-colors">{m.username}</p>
                      <p className="text-[10px] text-zinc-700 truncate">{m.role_name||m.status}</p>
                    </div>
                  </div>
                ))}
                {!activeServer&&<p className="text-xs text-zinc-700">Wybierz serwer</p>}
              </div>
            )}
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
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl w-full max-w-sm flex flex-col max-h-[90vh]`}>
              {/* Banner wrapper — relative but NO overflow-hidden, so avatar can poke out below */}
              <div className="relative shrink-0">
                {/* Banner — overflow-hidden only on this inner div (clips the image/gradient) */}
                <div className="h-28 relative overflow-hidden rounded-t-3xl">
                  {(currentUser?.id===selUser.id ? (profBannerPrev||currentUser?.banner_url) : selUser.banner_url) ? (
                    <img src={currentUser?.id===selUser.id?(profBannerPrev||currentUser?.banner_url!):selUser.banner_url} className="w-full h-full object-cover" alt=""/>
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-r ${(currentUser?.id===selUser.id ? editProf?.banner_color : selUser?.banner_color)||'from-indigo-600 via-purple-600 to-pink-600'}`}/>
                  )}
                  {currentUser?.id===selUser.id&&(
                    <label className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-xl flex items-center justify-center cursor-pointer transition-colors group">
                      <Upload size={13} className="text-white"/>
                      <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden"/>
                    </label>
                  )}
                </div>
                {/* Avatar — sibling to banner div, NOT inside overflow-hidden → no longer clipped */}
                <div className="absolute bottom-0 left-5 translate-y-1/2 z-10">
                  <div className="relative">
                    <img src={ava(selUser)} className="w-16 h-16 rounded-2xl border-4 border-zinc-900 object-cover" alt=""/>
                    <div className={`absolute bottom-0 right-0 w-4 h-4 ${sc(selUser.status||'offline')} rounded-full border-2 border-zinc-900`}/>
                  </div>
                </div>
              </div>
              {/* Scrollable body */}
              <div className="overflow-y-auto custom-scrollbar flex-1">
                <div className="p-5 pt-12">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight">{selUser.username}</h3>
                      {selUser.custom_status&&<p className="text-sm text-zinc-400 mt-0.5">{selUser.custom_status}</p>}
                    </div>
                    <button onClick={()=>setProfileOpen(false)} className="text-zinc-600 hover:text-white transition-colors shrink-0 ml-2"><X size={17}/></button>
                  </div>
                  {selUser.bio&&<p className="text-sm text-zinc-400 mb-4 bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 leading-relaxed">{selUser.bio}</p>}
                  {currentUser?.id===selUser.id ? (
                    <div className="flex flex-col gap-4">
                      {/* Avatar + banner side by side */}
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Avatar</label>
                          <label className={`flex items-center gap-2 cursor-pointer ${gi} rounded-xl px-3 py-2.5 border text-sm hover:bg-white/[0.06] transition-all`}>
                            <Upload size={14} className="text-zinc-500 shrink-0"/>
                            <span className="text-zinc-500 truncate text-xs">Zmień avatar</span>
                            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
                          </label>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Banner</label>
                          <label className={`flex items-center gap-2 cursor-pointer ${gi} rounded-xl px-3 py-2.5 border text-sm hover:bg-white/[0.06] transition-all`}>
                            <Upload size={14} className="text-zinc-500 shrink-0"/>
                            <span className="text-zinc-500 truncate text-xs">Zmień banner</span>
                            <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden"/>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Nazwa użytkownika</label>
                        <input value={editProf?.username||''} onChange={e=>setEditProf((p:any)=>({...p,username:e.target.value}))} className={`w-full ${gi} rounded-xl px-3 py-2.5 text-sm`}/>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Status</label>
                        <input value={editProf?.custom_status||''} onChange={e=>setEditProf((p:any)=>({...p,custom_status:e.target.value}))} placeholder="Ustaw status..." className={`w-full ${gi} rounded-xl px-3 py-2.5 text-sm`}/>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Bio</label>
                        <textarea value={editProf?.bio||''} onChange={e=>setEditProf((p:any)=>({...p,bio:e.target.value}))} rows={3} placeholder="Napisz coś o sobie..." className={`w-full ${gi} rounded-xl px-3 py-2.5 text-sm resize-none`}/>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block font-bold">Kolor bannera</label>
                        <div className="grid grid-cols-6 gap-2">
                          {GRADIENTS.map(g=>(
                            <button key={g} onClick={()=>setEditProf((p:any)=>({...p,banner_color:g}))}
                              className={`h-8 rounded-lg bg-gradient-to-r ${g} border-2 transition-all ${editProf?.banner_color===g?'border-white scale-105':'border-transparent'}`}/>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleSaveProfile} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors mt-1">Zapisz zmiany</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={()=>openDm(selUser.id)} className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm"><MessageSquare size={14}/> Wiadomość</button>
                      <button onClick={()=>startDmCall(selUser.id,selUser.username,'voice')} className={`w-10 h-10 ${gb} rounded-xl flex items-center justify-center`}><Phone size={15}/></button>
                      <button onClick={()=>startDmCall(selUser.id,selUser.username,'video')} className={`w-10 h-10 ${gb} rounded-xl flex items-center justify-center`}><Video size={15}/></button>
                    </div>
                  )}
                </div>
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

      {/* ── APP SETTINGS ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {appSettOpen&&currentUser&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setAppSettOpen(false)}>
            <motion.div initial={{scale:0.96,opacity:0,y:12}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.96,opacity:0,y:12}}
              transition={{duration:0.25,ease:[0.16,1,0.3,1]}}
              onClick={e=>e.stopPropagation()} className={`${gm} w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden`}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <Settings size={15} className="text-indigo-400"/>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight">Ustawienia</h2>
                    <p className="text-xs text-zinc-600">{currentUser.username}</p>
                  </div>
                </div>
                <button onClick={()=>setAppSettOpen(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={18}/></button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar tabs */}
                <div className="w-48 shrink-0 border-r border-white/[0.06] p-3 flex flex-col gap-0.5">
                  {([
                    {id:'account',label:'Konto',icon:<Users size={14}/>},
                    {id:'appearance',label:'Wygląd',icon:<Image size={14}/>},
                    {id:'devices',label:'Urządzenia',icon:<Mic size={14}/>},
                    {id:'privacy',label:'Prywatność',icon:<Shield size={14}/>},
                  ] as const).map(t=>(
                    <button key={t.id} onClick={()=>setAppSettTab(t.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                        appSettTab===t.id?'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'}`}>
                      <span className={appSettTab===t.id?'text-indigo-400':'text-zinc-600'}>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    <button onClick={()=>{setAppSettOpen(false);auth.logout().then(()=>{clearToken();setIsAuthenticated(false);setCurrentUser(null);}).catch(()=>{clearToken();setIsAuthenticated(false);setCurrentUser(null);});}}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all w-full">
                      <LogOut size={14}/> Wyloguj
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  <AnimatePresence mode="wait">

                  {/* ─── KONTO ─── */}
                  {appSettTab==='account'&&(
                    <motion.div key="account" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.15}}
                      className="flex flex-col gap-5">
                      <h3 className="text-sm font-bold text-white">Informacje o koncie</h3>

                      {/* Avatar + banner preview */}
                      <div className="rounded-2xl overflow-hidden border border-white/[0.07]">
                        <div className="h-20 relative">
                          {(profBannerPrev||currentUser.banner_url) ? (
                            <img src={profBannerPrev||currentUser.banner_url!} className="w-full h-full object-cover" alt=""/>
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-r ${editProf?.banner_color||'from-indigo-600 via-purple-600 to-pink-600'}`}/>
                          )}
                        </div>
                        <div className="bg-zinc-900/80 px-4 pb-4 pt-0 relative">
                          <div className="absolute -top-6 left-4">
                            <img src={ava(currentUser)} className="w-12 h-12 rounded-2xl border-4 border-zinc-900 object-cover" alt=""/>
                          </div>
                          <div className="pt-8">
                            <p className="font-bold text-white">{editProf?.username||currentUser.username}</p>
                            <p className="text-xs text-zinc-500">{currentUser.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Avatar upload */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block font-bold">Avatar</label>
                        <label className={`flex items-center gap-2.5 cursor-pointer ${gi} rounded-xl px-4 py-3 text-sm hover:bg-white/[0.07] transition-all border`}>
                          <Upload size={15} className="text-zinc-500 shrink-0"/>
                          <span className="text-zinc-400">Zmień avatar</span>
                          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
                        </label>
                      </div>

                      {/* Banner */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block font-bold">Banner profilu</label>
                        <label className={`flex items-center gap-2.5 cursor-pointer ${gi} rounded-xl px-4 py-3 text-sm hover:bg-white/[0.07] transition-all border mb-3`}>
                          <Upload size={15} className="text-zinc-500 shrink-0"/>
                          <span className="text-zinc-400">{profBannerPrev?'Zmieniono (niezapisane)':'Zmień banner'}</span>
                          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){setProfBannerFile(f);setProfBannerPrev(URL.createObjectURL(f));}e.target.value='';}} className="hidden"/>
                        </label>
                        <div className="grid grid-cols-6 gap-2">
                          {GRADIENTS.map(g=>(
                            <button key={g} onClick={()=>setEditProf((p:any)=>({...p,banner_color:g}))}
                              className={`h-7 rounded-xl bg-gradient-to-r ${g} border-2 transition-all ${editProf?.banner_color===g?'border-white scale-105':'border-transparent hover:scale-105'}`}/>
                          ))}
                        </div>
                      </div>

                      {/* Fields */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Nazwa użytkownika</label>
                        <input value={editProf?.username||''} onChange={e=>setEditProf((p:any)=>({...p,username:e.target.value}))} className={`w-full ${gi} rounded-xl px-4 py-3 text-sm`}/>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Status</label>
                        <input value={editProf?.custom_status||''} onChange={e=>setEditProf((p:any)=>({...p,custom_status:e.target.value}))} placeholder="Ustaw swój status..." className={`w-full ${gi} rounded-xl px-4 py-3 text-sm`}/>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Bio</label>
                        <textarea value={editProf?.bio||''} onChange={e=>setEditProf((p:any)=>({...p,bio:e.target.value}))} rows={3} placeholder="Napisz coś o sobie..." className={`w-full ${gi} rounded-xl px-4 py-3 text-sm resize-none`}/>
                      </div>
                      <button onClick={async()=>{await handleSaveProfile();setAppSettOpen(false);setTimeout(()=>setAppSettOpen(true),50);setAppSettTab('account');}}
                        className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">
                        Zapisz zmiany
                      </button>
                    </motion.div>
                  )}

                  {/* ─── WYGLĄD ─── */}
                  {appSettTab==='appearance'&&(
                    <motion.div key="appearance" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.15}}
                      className="flex flex-col gap-5">
                      <h3 className="text-sm font-bold text-white">Personalizacja wyglądu</h3>
                      <div className={`${gi} rounded-2xl p-4 border flex items-center gap-3`}>
                        <Info size={16} className="text-indigo-400 shrink-0"/>
                        <p className="text-sm text-zinc-400">Motyw aplikacji oparty jest na ciemnym trybie. Więcej opcji personalizacji wkrótce.</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 block font-bold">Kolor akcentu</label>
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            {name:'Indigo',cls:'bg-indigo-500'},
                            {name:'Fioletowy',cls:'bg-violet-500'},
                            {name:'Różowy',cls:'bg-pink-500'},
                            {name:'Niebieski',cls:'bg-blue-500'},
                            {name:'Zielony',cls:'bg-emerald-500'},
                          ].map(c=>(
                            <button key={c.name} className={`h-10 rounded-xl ${c.cls} border-2 border-transparent hover:border-white/30 transition-all hover:scale-105 flex items-center justify-center`} title={c.name}>
                              {c.name==='Indigo'&&<Check size={14} className="text-white"/>}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-600 mt-2">Wkrótce: pełna zmiana motywu kolorystycznego</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 block font-bold">Rozmiar wiadomości</label>
                        <div className="flex flex-col gap-2">
                          {['Komfortowy','Kompaktowy'].map((s,i)=>(
                            <button key={s} className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${i===0?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                              {s}{i===0&&<Check size={13} className="text-indigo-400"/>}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── URZĄDZENIA ─── */}
                  {appSettTab==='devices'&&(
                    <motion.div key="devices" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.15}}
                      className="flex flex-col gap-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Urządzenia audio/wideo</h3>
                        <button onClick={()=>getMediaDevices().then(setDevices).catch(()=>{})}
                          className={`text-xs ${gb} px-3 py-1.5 rounded-lg flex items-center gap-1.5`}>
                          <Loader2 size={11}/> Odśwież
                        </button>
                      </div>
                      {devices.length===0&&(
                        <div className={`${gi} rounded-2xl p-4 border flex items-center gap-3`}>
                          <AlertCircle size={16} className="text-amber-400 shrink-0"/>
                          <div>
                            <p className="text-sm text-zinc-300 font-medium">Brak dostępu do urządzeń</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Zezwól przeglądarce na dostęp do mikrofonu, aby zobaczyć urządzenia</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block font-bold">Mikrofon ({devices.filter(d=>d.kind==='audioinput').length})</label>
                        <select value={selMic} onChange={e=>setSelMic(e.target.value)} className={`w-full ${gi} rounded-xl px-4 py-3 text-sm`}>
                          <option value="">Domyślny</option>
                          {devices.filter(d=>d.kind==='audioinput').map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||`Mikrofon ${d.deviceId.slice(0,8)}`}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block font-bold">Głośniki ({devices.filter(d=>d.kind==='audiooutput').length})</label>
                        <select value={selSpeaker} onChange={e=>{setSelSpeaker(e.target.value);setOutputDevice(e.target.value).catch(()=>{});}} className={`w-full ${gi} rounded-xl px-4 py-3 text-sm`}>
                          <option value="">Domyślny</option>
                          {devices.filter(d=>d.kind==='audiooutput').map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||`Głośnik ${d.deviceId.slice(0,8)}`}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 block font-bold">Kamera ({devices.filter(d=>d.kind==='videoinput').length})</label>
                        <select value={selCamera} onChange={e=>setSelCamera(e.target.value)} className={`w-full ${gi} rounded-xl px-4 py-3 text-sm`}>
                          <option value="">Domyślna</option>
                          {devices.filter(d=>d.kind==='videoinput').map(d=><option key={d.deviceId} value={d.deviceId}>{d.label||`Kamera ${d.deviceId.slice(0,8)}`}</option>)}
                        </select>
                      </div>
                    </motion.div>
                  )}

                  {/* ─── PRYWATNOŚĆ ─── */}
                  {appSettTab==='privacy'&&(
                    <motion.div key="privacy" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.15}}
                      className="flex flex-col gap-5">
                      <h3 className="text-sm font-bold text-white">Prywatność i bezpieczeństwo</h3>
                      {[
                        {label:'Status widoczny dla znajomych',desc:'Inni widzą czy jesteś online/offline/zajęty',on:true},
                        {label:'Podgląd "pisze..."',desc:'Inni widzą gdy piszesz wiadomość',on:true},
                        {label:'Potwierdzenia odczytu',desc:'Nadawca widzi że przeczytałeś wiadomość',on:false},
                        {label:'Zaproszenia od nieznajomych',desc:'Osoby spoza twoich serwerów mogą dodać cię do znajomych',on:true},
                      ].map(opt=>(
                        <div key={opt.label} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-3.5">
                          <div>
                            <p className="text-sm font-medium text-white">{opt.label}</p>
                            <p className="text-xs text-zinc-600 mt-0.5">{opt.desc}</p>
                          </div>
                          <button className={`w-11 h-6 rounded-full transition-all shrink-0 ml-4 ${opt.on?'bg-indigo-500':'bg-zinc-700'} relative`}>
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${opt.on?'left-5.5':'left-0.5'}`} style={{left:opt.on?'calc(100% - 1.375rem)':'0.125rem'}}/>
                          </button>
                        </div>
                      ))}
                      <div className="mt-2 p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                        <h4 className="text-sm font-bold text-rose-400 mb-1">Strefa zagrożenia</h4>
                        <p className="text-xs text-zinc-500 mb-3">Trwałe akcje których nie można cofnąć</p>
                        <button className="text-sm font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 px-4 py-2 rounded-xl transition-all">
                          Usuń konto
                        </button>
                      </div>
                    </motion.div>
                  )}

                  </AnimatePresence>
                </div>
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
