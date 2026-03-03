import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Hash, Volume2, Video, Settings, Plus, Search, Bell, Users,
  Mic, MicOff, VolumeX, Smile, Paperclip, Send, Image, Reply,
  Menu, X, Edit3, MessageCircle, Minimize2, Maximize2,
  Shield, Trash2, Settings2, UserPlus, Check, X as XIcon,
  LogOut, Loader2, Lock, Phone, PhoneOff, MessageSquare, Upload, MoreHorizontal, ScreenShare,
  CheckCircle2, AlertCircle, Info, AlertTriangle, PartyPopper, Sparkles, Zap, Globe,
  Eye, EyeOff
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
  playDmNotification, startRing, stopRing,
  startIncomingRing, stopIncomingRing,
  playVoiceJoin, playVoiceLeave,
  playCallAccepted, playCallEnded,
} from './sounds';
import {
  makePeerConnection, attachRemoteAudio, detachRemoteAudio, muteAllRemote,
  setOutputDevice, watchSpeaking, getMediaDevices,
} from './webrtc';

// ─── Glass constants ──────────────────────────────────────────────────────────
const gp = 'bg-[#16161e]/90 backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/40';
const gm = 'bg-[#16161e]/95 backdrop-blur-2xl border border-white/[0.09] shadow-2xl shadow-black/50 rounded-3xl';
const gi = 'bg-white/[0.05] border border-white/[0.08] text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all rounded-xl';
const gb = 'bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] text-zinc-400 hover:text-white hover:border-white/[0.12] transition-all active:scale-95';

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

const STATUS_OPTIONS = [
  { value: 'online'  as const, label: 'Dostępny',         color: 'bg-emerald-500', desc: 'Widoczny dla wszystkich' },
  { value: 'idle'    as const, label: 'Zaraz wracam',      color: 'bg-amber-500',   desc: 'Chwilowo nieobecny' },
  { value: 'dnd'     as const, label: 'Nie przeszkadzać',  color: 'bg-rose-500',    desc: 'Wyciszam powiadomienia' },
  { value: 'offline' as const, label: 'Niewidoczny',       color: 'bg-zinc-500',    desc: 'Wyświetl się jako offline' },
] as const;
const IDLE_MS = 10 * 60 * 1000; // 10 min braku aktywności → idle

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
// ─── Emoji Picker ─────────────────────────────────────────────────────────────
const EMOJI_CATS = [
  { icon: '😊', label: 'Emotki', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬'] },
  { icon: '👋', label: 'Gesty', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃'] },
  { icon: '❤️', label: 'Serca', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','❤️‍🔥','❤️‍🩹','💯','🔥','⭐','🌟','✨','💥','🎉','🎊','🏆','🥇','🎯'] },
  { icon: '🐶', label: 'Zwierzęta', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🦈','🐊','🐘','🦒','🦓','🦛','🐪','🦘','🐕','🐈','🐓','🦚','🦜'] },
  { icon: '🍕', label: 'Jedzenie', emojis: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍑','🍒','🥝','🍅','🥑','🥦','🌽','🥕','🧄','🍆','🥔','🍞','🧀','🥚','🍳','🥞','🍔','🍟','🍕','🌮','🌯','🥙','🍣','🍜','🍛','🍲','🍦','🍧','🍨','🍰','🎂','🍩','🍪','🍫','🍬','🍭','☕','🧋','🍵','🥤','🍺','🍷','🥂','🍸','🍾'] },
  { icon: '⚽', label: 'Aktywność', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🥊','🎯','🎮','🕹️','🎲','🎰','🎭','🎬','🎤','🎧','🎸','🎹','🎷','🎺','🥁','🎨','🖼️','🎠','🎡','🎢','🎪','🎟️'] },
  { icon: '✈️', label: 'Podróże', emojis: ['✈️','🚀','🛸','🚁','🚂','🚗','🚕','🚙','🚌','🏎️','🚲','🛴','🛵','⛵','🛥️','🚢','🌍','🌎','🌏','🏔️','🌋','🏖️','🏝️','🏙️','🌃','🌆','🌄','🌅','🌉','⛺','🏠','🏡','🏢','🏰','🗼','🗽','⛪','🕌','🕍'] },
  { icon: '💡', label: 'Przedmioty', emojis: ['💡','🔦','💰','💎','💍','🔑','🗝️','🔒','🔓','⚙️','🔧','🔩','🧲','🪛','⛏️','🗡️','🛡️','💊','🩺','🧬','🔭','🔬','📱','💻','🖥️','⌨️','🖱️','📷','📸','📺','📻','📚','📖','✏️','📝','📌','📎','📦','💌','📬','🗒️','📅'] },
  { icon: '#️⃣', label: 'Symbole', emojis: ['✅','❌','⚠️','❓','❗','‼️','💤','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔶','🔷','🔸','🔹','🔺','🔻','♻️','🚫','⛔','🔞','💯','🆕','🆗','🆙','🆒','🆓','🆖','📶','🔊','🔇','🔔','🔕','🔈','📣','📢','🔐','🗑️','⌛','⏳','⏰','📍','🏷️'],},
] as const;

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [cat, setCat] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 right-0 w-80 bg-[#1a1a26] border border-white/[0.1] rounded-3xl shadow-2xl shadow-black/60 overflow-hidden z-50">
      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b border-white/[0.07] p-1.5 gap-0.5"
        style={{ scrollbarWidth: 'none' }}>
        {EMOJI_CATS.map((c, i) => (
          <button key={i} onClick={() => setCat(i)} title={c.label}
            className={`text-base px-2 py-1.5 rounded-xl shrink-0 transition-colors ${cat === i ? 'bg-indigo-500/20 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]'}`}>
            {c.icon}
          </button>
        ))}
      </div>
      {/* Category label */}
      <div className="px-3 pt-2 pb-0.5">
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{EMOJI_CATS[cat].label}</p>
      </div>
      {/* Emoji grid */}
      <div className="p-2 grid grid-cols-9 gap-0.5 max-h-52 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
        {(EMOJI_CATS[cat].emojis as readonly string[]).map(emoji => (
          <button key={emoji} onClick={() => { onSelect(emoji); }}
            className="text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.1] transition-colors hover:scale-110 active:scale-95">
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

const AUTH_FEATURES = [
  { icon: '💬', title: 'Wiadomości w czasie rzeczywistym', desc: 'Tekst, głos i wideo — wszystko w jednym miejscu',
    grad: 'from-indigo-500 to-blue-500', iconBg: 'bg-indigo-500/15', border: 'border-indigo-500/25', glow: 'hover:shadow-indigo-500/10' },
  { icon: '🎙️', title: 'Kanały głosowe i wideo', desc: 'Dołącz do rozmów z jednym kliknięciem',
    grad: 'from-violet-500 to-purple-500', iconBg: 'bg-violet-500/15', border: 'border-violet-500/25', glow: 'hover:shadow-violet-500/10' },
  { icon: '🛡️', title: 'Role i uprawnienia', desc: 'Pełna kontrola nad serwerem i członkami',
    grad: 'from-emerald-500 to-teal-500', iconBg: 'bg-emerald-500/15', border: 'border-emerald-500/25', glow: 'hover:shadow-emerald-500/10' },
  { icon: '🚀', title: 'Szybkie i niezawodne', desc: 'Socket.IO + PostgreSQL dla stale aktualnych danych',
    grad: 'from-amber-500 to-orange-500', iconBg: 'bg-amber-500/15', border: 'border-amber-500/25', glow: 'hover:shadow-amber-500/10' },
];

function AuthScreen({ onAuth }: { onAuth: (u: UserProfile, t: string, isNew: boolean) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  // Registration: 'form' = fill details, 'verify' = enter code
  const [regStep, setRegStep] = useState<'form' | 'verify'>('form');
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '', confirm: '' });
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-format code as user types: "AB1XYZ789" → "AB-1XY-Z78" (xx-xxx-xxx)
  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    let formatted = raw;
    if (raw.length > 2) formatted = raw.slice(0, 2) + '-' + raw.slice(2);
    if (raw.length > 5) formatted = raw.slice(0, 2) + '-' + raw.slice(2, 5) + '-' + raw.slice(5);
    setVerifyCode(formatted);
  };

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); setError(''); setInfo(''); setRegStep('form'); setVerifyCode('');
  };

  // Step 1: send verification code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true);
    if (form.password !== form.confirm) {
      setError('Hasła nie pasują do siebie'); setLoading(false); return;
    }
    try {
      await auth.sendCode(form.email);
      setRegStep('verify');
      setInfo(`Kod weryfikacyjny wysłany na ${form.email}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  // Step 2: register with code
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await auth.register({
        username: form.username, email: form.email,
        password: form.password, code: verifyCode.trim(),
      });
      setToken(res.token); onAuth(res.user, res.token, true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  // Login submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await auth.login({ login: form.login, password: form.password });
      setToken(res.token); onAuth(res.user, res.token, false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.25) 0%,transparent 55%),radial-gradient(ellipse at 80% 20%,rgba(139,92,246,.18) 0%,transparent 50%),radial-gradient(ellipse at 60% 90%,rgba(79,70,229,.12) 0%,transparent 45%),#09090b' }}>

      {/* Decorative animated blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div animate={{ x: [0,40,-15,0], y: [0,-30,10,0], scale: [1,1.1,0.95,1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl"/>
        <motion.div animate={{ x: [0,-50,20,0], y: [0,25,-15,0], scale: [1,0.9,1.05,1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-3xl"/>
        <motion.div animate={{ x: [0,20,-30,0], y: [0,-20,15,0], scale: [1,1.15,0.9,1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute top-1/3 right-1/4 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl"/>
        <motion.div animate={{ x: [0,-15,30,0], y: [0,30,-10,0], scale: [1,0.95,1.1,1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"/>
        {/* Floating particles */}
        {[
          {x:'15%',y:'20%',size:3,dur:4,delay:0,color:'bg-indigo-400/40'},
          {x:'75%',y:'15%',size:2,dur:6,delay:1,color:'bg-purple-400/40'},
          {x:'85%',y:'60%',size:4,dur:5,delay:2,color:'bg-violet-400/30'},
          {x:'10%',y:'70%',size:2,dur:7,delay:0.5,color:'bg-blue-400/40'},
          {x:'50%',y:'80%',size:3,dur:4.5,delay:3,color:'bg-indigo-400/30'},
          {x:'30%',y:'40%',size:2,dur:8,delay:1.5,color:'bg-purple-400/30'},
        ].map((p,i) => (
          <motion.div key={i}
            animate={{ y: [0,-12,0], opacity: [0.4,1,0.4] }}
            transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
            className={`absolute rounded-full ${p.color}`}
            style={{ left: p.x, top: p.y, width: p.size*4, height: p.size*4 }}/>
        ))}
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

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {AUTH_FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.08, type: 'spring', stiffness: 200 }}
                whileHover={{ y: -3, scale: 1.02 }}
                className={`flex flex-col gap-3 border ${f.border} rounded-2xl p-4 cursor-default
                  bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 shadow-lg ${f.glow} hover:shadow-lg`}>
                <div className={`w-10 h-10 rounded-xl ${f.iconBg} flex items-center justify-center text-xl`}>
                  {f.icon}
                </div>
                <div>
                  <p className={`text-sm font-bold bg-gradient-to-r ${f.grad} bg-clip-text text-transparent`}>{f.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="flex items-center gap-6 mt-8">
          {[
            { val: '100%', label: 'Open Source', color: 'text-indigo-400' },
            { val: 'E2E', label: 'Szyfrowanie', color: 'text-violet-400' },
            { val: '∞', label: 'Wiadomości', color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label}>
              <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
              <p className="text-xs text-zinc-600">{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <p className="text-xs text-zinc-700 mt-4">© 2025 Cordyn. Wszelkie prawa zastrzeżone.</p>
      </motion.div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        {/* Glow behind form card */}
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full scale-150 pointer-events-none"/>
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`relative w-full max-w-sm ${gm} p-8 shadow-2xl shadow-indigo-900/30`}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-6">
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
              <button key={t} onClick={() => switchTab(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  tab===t ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-400 hover:text-white'}`}>
                {t === 'login' ? 'Logowanie' : 'Rejestracja'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── LOGIN FORM ── */}
            {tab === 'login' && (
              <motion.form key="login-form" onSubmit={handleLogin}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }} className="flex flex-col gap-3.5">
                <div className="relative">
                  <MessageSquare size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                  <input required value={form.login} onChange={set('login')} placeholder="Login lub email"
                    className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`} />
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                  <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                    placeholder="Hasło" minLength={6}
                    className={`${gi} rounded-xl pl-10 pr-10 py-3 text-sm w-full`} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showPass ? <Eye size={15}/> : <EyeOff size={15}/>}
                  </button>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 overflow-hidden">
                      <AlertCircle size={15} className="shrink-0"/><span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button type="submit" disabled={loading}
                  className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 mt-1">
                  {loading ? <><Loader2 size={17} className="animate-spin"/> Logowanie...</> : 'Zaloguj się →'}
                </button>
              </motion.form>
            )}

            {/* ── REGISTER STEP 1: fill form ── */}
            {tab === 'register' && regStep === 'form' && (
              <motion.form key="reg-form" onSubmit={handleSendCode}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }} className="flex flex-col gap-3.5">
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
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                  <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                    placeholder="Hasło" minLength={6}
                    className={`${gi} rounded-xl pl-10 pr-10 py-3 text-sm w-full`} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showPass ? <Eye size={15}/> : <EyeOff size={15}/>}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                  <input required type={showPass ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')}
                    placeholder="Potwierdź hasło" minLength={6}
                    className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`} />
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 overflow-hidden">
                      <AlertCircle size={15} className="shrink-0"/><span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button type="submit" disabled={loading}
                  className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 mt-1">
                  {loading ? <><Loader2 size={17} className="animate-spin"/> Wysyłanie kodu...</> : <>Wyślij kod weryfikacyjny →</>}
                </button>
              </motion.form>
            )}

            {/* ── REGISTER STEP 2: enter code ── */}
            {tab === 'register' && regStep === 'verify' && (
              <motion.form key="verify-form" onSubmit={handleRegister}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }} className="flex flex-col gap-3.5">

                {/* Email indicator */}
                <div className="flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <span className="text-base">✉️</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-indigo-300 font-medium">Kod wysłany na:</p>
                    <p className="text-sm text-white font-semibold truncate">{form.email}</p>
                  </div>
                </div>

                {/* Code input */}
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none text-sm font-mono">#</div>
                  <input
                    required
                    value={verifyCode}
                    onChange={handleCodeInput}
                    placeholder="xx-xxx-xxx"
                    maxLength={10}
                    className={`${gi} rounded-xl pl-9 pr-4 py-3 text-sm w-full font-mono tracking-widest text-center`}
                  />
                </div>
                <p className="text-xs text-zinc-600 text-center -mt-1">Sprawdź skrzynkę mailową · Ważny przez 15 minut</p>

                <AnimatePresence>
                  {(error || info) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2.5 overflow-hidden border ${
                        error
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      }`}>
                      <AlertCircle size={15} className="shrink-0"/>
                      <span>{error || info}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button type="submit" disabled={loading}
                  className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 mt-1">
                  {loading ? <><Loader2 size={17} className="animate-spin"/> Tworzenie konta...</> : 'Zarejestruj się →'}
                </button>

                <button type="button" onClick={() => { setRegStep('form'); setError(''); setInfo(''); setVerifyCode(''); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center">
                  ← Zmień dane / wyślij kod ponownie
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-xs text-zinc-700 text-center mt-5">
            {tab === 'login' ? 'Nie masz konta? ' : 'Masz już konto? '}
            <button onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              {tab === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}
            </button>
          </p>
        </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─── WelcomeModal ─────────────────────────────────────────────────────────────
const WELCOME_TIPS = [
  { icon: <MessageCircle size={18}/>, color: 'text-indigo-400', bg: 'bg-indigo-500/10', title: 'Wiadomości & kanały głosowe', desc: 'Dołącz do serwera lub napisz do znajomego — tekst, głos i wideo w jednym miejscu.' },
  { icon: <Users size={18}/>, color: 'text-violet-400', bg: 'bg-violet-500/10', title: 'Znajomi & zaproszenia', desc: 'Wyszukaj znajomych po nazwie użytkownika i zaproś ich — ikona 👤 w pasku bocznym.' },
  { icon: <Zap size={18}/>, color: 'text-amber-400', bg: 'bg-amber-500/10', title: 'Stwórz własny serwer', desc: 'Kliknij „+" w pasku serwerów, nadaj nazwę i zaproś ludzi kodem zaproszenia.' },
  { icon: <Globe size={18}/>, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Dostosuj profil', desc: 'Zmień avatar, baner, bio i status — ikonka ⚙️ przy swoim niku na dole.' },
];

function WelcomeModal({ username, onClose }: { username: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative w-full max-w-lg bg-[#16161e] border border-white/[0.1] rounded-3xl shadow-2xl shadow-indigo-900/30">

        {/* Top gradient banner — rounded-t-3xl + overflow-hidden only on banner */}
        <div className="relative h-36 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 overflow-hidden rounded-t-3xl">
          {/* Animated circles in banner */}
          <motion.div animate={{ scale: [1,1.2,1], opacity:[0.3,0.5,0.3] }} transition={{ duration:4, repeat:Infinity }}
            className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10"/>
          <motion.div animate={{ scale: [1,1.3,1], opacity:[0.2,0.4,0.2] }} transition={{ duration:6, repeat:Infinity, delay:1 }}
            className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10"/>
          {/* Sparkle */}
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            className="absolute top-4 right-6 text-white/30">
            <Sparkles size={20}/>
          </motion.div>
        </div>

        {/* Party icon — outside banner so overflow-hidden doesn't clip it */}
        <div className="absolute top-[112px] left-1/2 -translate-x-1/2
          w-16 h-16 rounded-2xl bg-[#16161e] border-4 border-[#16161e]
          flex items-center justify-center shadow-xl z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
            flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/40">
            🎉
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pt-12 pb-8">
          {/* Heading */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white mb-1">
              Witaj, <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">{username}</span>! 🎉
            </h2>
            <p className="text-sm text-zinc-400">Twoje konto jest gotowe. Oto kilka wskazówek na start:</p>
          </div>

          {/* Tips */}
          <div className="flex flex-col gap-3 mb-7">
            {WELCOME_TIPS.map((tip, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors">
                <div className={`w-8 h-8 rounded-xl ${tip.bg} ${tip.color} flex items-center justify-center shrink-0 mt-0.5`}>
                  {tip.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{tip.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{tip.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-bold text-white text-sm
              bg-gradient-to-r from-indigo-500 to-violet-600
              hover:from-indigo-400 hover:to-violet-500
              shadow-lg shadow-indigo-500/30 transition-all duration-200 flex items-center justify-center gap-2">
            <PartyPopper size={16}/>
            Zacznij przygodę z Cordyn!
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
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
  const [isConnected, setIsConnected]         = useState(true);

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [addFriendVal, setAddFriendVal]       = useState('');
  const [friendSearchResult, setFriendSearchResult] = useState<UserProfile | null>(null);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
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
  const [createSrvIconFile, setCreateSrvIconFile]     = useState<File|null>(null);
  const [createSrvIconPreview, setCreateSrvIconPreview] = useState<string|null>(null);
  const createSrvIconRef = useRef<HTMLInputElement>(null);
  const msgInputRef      = useRef<HTMLInputElement>(null);
  const [srvContextMenu, setSrvContextMenu]   = useState<{ x: number; y: number; srv: ServerData } | null>(null);
  const [deleteSrvConfirm, setDeleteSrvConfirm] = useState<{ id: string; name: string } | null>(null);

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
  const localStreamRef          = useRef<MediaStream|null>(null);
  const screenStreamRef         = useRef<MediaStream|null>(null);
  const remoteScreenStreamsRef  = useRef(new Map<string, MediaStream>());
  const peerConnsRef            = useRef(new Map<string, RTCPeerConnection>());
  const speakStopRef     = useRef(new Map<string, ()=>void>()); // speaking detection cleanup
  const currentUserRef      = useRef(currentUser);
  const activeCallRef       = useRef(activeCall);
  const activeDmUserIdRef   = useRef(activeDmUserId);
  const activeViewRef       = useRef(activeView);
  const activeServerRef     = useRef(activeServer);
  const callDurationRef     = useRef(0);
  const voiceHandlerRef     = useRef<Record<string, (...a: any[]) => void>>({});
  // DM unread counts (keyed by other_user_id)
  const [unreadDms, setUnreadDms]             = useState<Record<string, number>>({});
  // Channel unread counts (keyed by channel_id)
  const [unreadChs, setUnreadChs]             = useState<Record<string, number>>({});
  // DM partner full profile (for BIO panel)
  const [dmPartnerProfile, setDmPartnerProfile] = useState<UserProfile | null>(null);
  // Messages loading
  const [msgsLoading, setMsgsLoading]           = useState(false);

  // Screen share state
  const [sharingUserId, setSharingUserId]     = useState<string|null>(null);
  const [screenShareTick, setScreenShareTick] = useState(0); // forces re-render when remote screen streams change

  // Voice state of other participants (muted/deafened) - keyed by user id
  const [voiceUserStates, setVoiceUserStates] = useState<Record<string, { muted: boolean; deafened: boolean }>>({});

  // WebRTC state
  const [speakingUsers, setSpeakingUsers]     = useState(new Set<string>());
  const [devices, setDevices]                 = useState<MediaDeviceInfo[]>([]);
  const [selMic, setSelMic]                   = useState(() => localStorage.getItem('cordis_mic') || '');
  const [selSpeaker, setSelSpeaker]           = useState(() => localStorage.getItem('cordis_speaker') || '');
  const [selCamera, setSelCamera]             = useState(() => localStorage.getItem('cordis_camera') || '');
  const [devicesOpen, setDevicesOpen]         = useState(false);

  // App preferences — initialized from currentUser (DB), updated via users.updateMe()
  const [accentColor, setAccentColor]         = useState<string>('indigo');
  const [compactMessages, setCompactMessages] = useState<boolean>(false);

  // Status system
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [isMicMuted, setIsMicMuted]           = useState(false);
  const myStatusRef                            = useRef<string>('online');
  const autoIdledRef                           = useRef(false); // true if idle was set automatically
  const idleTimerRef                           = useRef<ReturnType<typeof setTimeout>|null>(null);
  const statusPickerRef                        = useRef<HTMLDivElement>(null);

  // App Settings
  const [appSettOpen, setAppSettOpen]         = useState(false);
  const [appSettTab, setAppSettTab]           = useState<'account'|'appearance'|'devices'|'privacy'>('account');

  // Typing indicator
  const [typingUsers, setTypingUsers]         = useState<Record<string,string>>({});
  const typingTimersRef                        = useRef<Record<string,ReturnType<typeof setTimeout>>>({});
  const typingEmitTimerRef                     = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Server activity log
  const [serverActivity, setServerActivity]   = useState<{id:string;icon:string;text:string;time:string}[]>([]);

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthLoading(false); return; }
    auth.me().then(u => { setCurrentUser(u); setEditProf({...u}); setIsAuthenticated(true); applyUserPrefs(u); })
      .catch(() => clearToken()).finally(() => setAuthLoading(false));
  }, []);

  // ── Socket ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const sock = connectSocket();
    sock.on('new_message', (msg: any) => {
      const chId = msg.channel_id;
      if (chId && chId !== prevChRef.current) {
        // Message in a channel we're not viewing — increment unread count
        setUnreadChs(p => ({ ...p, [chId]: (p[chId] || 0) + 1 }));
      } else {
        setChannelMsgs(p => [...p, msg as MessageFull]);
      }
    });
    sock.on('new_dm', (msg: DmMessageFull) => {
      const myId = currentUserRef.current?.id;
      // "This DM belongs to the currently open conversation" — regardless of which view is active.
      // activeDmUserIdRef holds the OTHER user's id; for received msgs the sender is the other user,
      // for sent msgs (sender === me) the recipient is activeDmUserId.
      const isOpenConversation =
        activeDmUserIdRef.current === msg.sender_id ||
        (msg.sender_id === myId && !!activeDmUserIdRef.current);
      // "User is actively looking at this DM right now"
      const isActivelyViewing = activeViewRef.current === 'dms' && isOpenConversation;

      // Always add to dmMsgs if this conversation is open (even if in server view)
      // so switching back shows messages without a reload
      if (isOpenConversation) {
        setDmMsgs(p => p.some(m => m.id === msg.id) ? p : [...p, msg]);
      }
      // Always refresh sidebar conversation list (updates last_message + shows new convs)
      dmsApi.conversations().then(setDmConvs).catch(console.error);
      // Toast + unread count + sound only when NOT actively viewing this DM
      if (msg.sender_id !== myId && !isActivelyViewing) {
        const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content;
        autoToast(`💬 ${msg.sender_username}: ${preview}`, 'info');
        setUnreadDms(p => ({ ...p, [msg.sender_id]: (p[msg.sender_id] || 0) + 1 }));
        playDmNotification();
      }
    });
    sock.on('message_deleted', ({ id }) => setChannelMsgs(p => p.filter(m => m.id !== id)));
    sock.on('message_updated', ({ id, content, edited }) =>
      setChannelMsgs(p => p.map(m => m.id === id ? { ...m, content, edited } : m)));
    sock.on('user_status', ({ user_id, status }) => {
      setFriends(p => p.map(f => f.id === user_id ? { ...f, status } : f));
      setDmConvs(p => p.map(d => d.other_user_id === user_id ? { ...d, other_status: status } : d));
      setMembers(p => p.map(m => m.id === user_id ? { ...m, status } : m));
    });
    // Voice channel events (route through voiceHandlerRef for fresh closures)
    sock.on('voice_user_joined', (d: any) => {
      voiceHandlerRef.current.onUserJoined?.(d);
    });
    sock.on('voice_user_left', (d: any) => {
      voiceHandlerRef.current.onUserLeft?.(d);
    });
    sock.on('server_activity' as any, (act: any) => {
      if (activeServerRef.current === act.server_id) {
        setServerActivity(p => [...p, act].slice(-20));
      }
    });
    // Typing indicators (server channels only)
    sock.on('user_typing', ({user_id, username, channel_id}: any) => {
      // Ignore typing events if not in server view or wrong channel
      if (activeViewRef.current !== 'servers') return;
      if (channel_id !== prevChRef.current) return;
      clearTimeout(typingTimersRef.current[user_id]);
      setTypingUsers(p => ({...p, [user_id]: username}));
      typingTimersRef.current[user_id] = setTimeout(() =>
        setTypingUsers(p => { const n={...p}; delete n[user_id]; return n; }), 3500);
    });
    sock.on('user_stop_typing', ({user_id}: any) => {
      clearTimeout(typingTimersRef.current[user_id]);
      setTypingUsers(p => { const n={...p}; delete n[user_id]; return n; });
    });
    // Friend notifications
    sock.on('friend_request', ({ from }: { from: { id: string; username: string } }) => {
      friendsApi.requests().then(setFriendReqs).catch(console.error);
      autoToast(`${from.username} chce dodać Cię do znajomych!`, 'info');
    });
    sock.on('friend_accepted', ({ user: u }: { user: { id: string; username: string } }) => {
      friendsApi.list().then(setFriends).catch(console.error);
      friendsApi.requests().then(setFriendReqs).catch(console.error);
      autoToast(`${u.username} zaakceptował(a) Twoje zaproszenie! 🎉`, 'success');
    });
    // WebRTC signaling
    sock.on('webrtc_offer',  (d: any) => voiceHandlerRef.current.onOffer?.(d));
    sock.on('webrtc_answer', (d: any) => voiceHandlerRef.current.onAnswer?.(d));
    sock.on('webrtc_ice',    (d: any) => voiceHandlerRef.current.onIce?.(d));
    // Voice state of other participants (muted/deafened)
    sock.on('voice_user_state' as any, ({ user_id, muted, deafened }: { user_id: string; muted: boolean; deafened: boolean }) => {
      setVoiceUserStates(p => ({ ...p, [user_id]: { muted, deafened } }));
    });
    // Screen share signaling
    sock.on('screen_share_start' as any, ({ from }: { from: string }) => {
      setSharingUserId(from);
    });
    sock.on('screen_share_stop' as any, ({ from }: { from: string }) => {
      setSharingUserId(null);
      remoteScreenStreamsRef.current.delete(from);
      setScreenShareTick(t => t + 1);
    });
    // DM call events
    sock.on('call_invite', ({ from, type, conversation_id }: any) => {
      setIncomingCall({ from, type, conversation_id });
      startIncomingRing();
    });
    const autoToast = (msg: string, type: Toast['type']) => {
      const id = Math.random().toString(36).slice(2);
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    };
    sock.on('call_accepted', () => {
      stopRing();
      playCallAccepted();
      autoToast('Połączenie zaakceptowane', 'success');
      // Caller initiates WebRTC after recipient accepts
      voiceHandlerRef.current.onCallAccepted?.();
    });
    sock.on('call_rejected', () => {
      stopRing();
      playCallEnded();
      setActiveCall(null); setShowCallPanel(false);
      autoToast('Połączenie odrzucone', 'error');
    });
    sock.on('call_ended', () => {
      // System message is sent by the person who hangs up via dmsApi.sendSystem
      // and arrives here via new_dm socket — no local insertion needed
      stopIncomingRing();
      stopRing();
      playCallEnded();
      setActiveCall(null); setShowCallPanel(false); setCallDuration(0);
      autoToast('Rozmowa zakończona', 'info');
    });
    // ── Real-time server/channel/member/user events ─────────────────
    sock.on('channel_created' as any, (ch: any) => {
      if (ch.server_id !== activeServerRef.current) return;
      setServerFull(p => {
        if (!p) return p;
        return {
          ...p,
          categories: p.categories.map(cat =>
            cat.id === ch.category_id
              ? { ...cat, channels: [...cat.channels.filter((c: any) => c.id !== ch.id), { ...ch, allowed_roles: [] }] }
              : cat
          ),
        };
      });
    });
    sock.on('channel_updated' as any, (ch: any) => {
      if (ch.server_id !== activeServerRef.current) return;
      setServerFull(p => {
        if (!p) return p;
        return {
          ...p,
          categories: p.categories.map(cat => ({
            ...cat,
            channels: cat.channels.map((c: any) => c.id === ch.id ? { ...c, ...ch } : c),
          })),
        };
      });
    });
    sock.on('channel_deleted' as any, ({ channel_id, server_id }: any) => {
      if (server_id !== activeServerRef.current) return;
      setServerFull(p => {
        if (!p) return p;
        return {
          ...p,
          categories: p.categories.map(cat => ({
            ...cat,
            channels: cat.channels.filter((c: any) => c.id !== channel_id),
          })),
        };
      });
      if (prevChRef.current === channel_id) { setActiveChannel(''); prevChRef.current = ''; }
    });
    sock.on('category_created' as any, (cat: any) => {
      if (cat.server_id !== activeServerRef.current) return;
      setServerFull(p => p ? { ...p, categories: [...p.categories, { ...cat, channels: [] }] } : p);
    });
    sock.on('server_updated' as any, (srv: any) => {
      setServerFull(p => p && p.id === srv.id ? { ...p, ...srv } : p);
      setServerList(p => p.map(s => s.id === srv.id ? { ...s, name: srv.name, icon_url: srv.icon_url } : s));
    });
    sock.on('member_joined' as any, ({ server_id, user }: any) => {
      if (server_id !== activeServerRef.current) return;
      setMembers(p => p.some(m => m.id === user.id) ? p : [...p, user]);
    });
    sock.on('member_left' as any, ({ server_id, user_id }: any) => {
      if (server_id !== activeServerRef.current) return;
      setMembers(p => p.filter(m => m.id !== user_id));
    });
    sock.on('user_updated' as any, (u: any) => {
      setFriends(p => p.map(f => f.id === u.id ? { ...f, ...u } : f));
      setMembers(p => p.map(m => m.id === u.id ? { ...m, ...u } : m));
      setDmConvs(p => p.map(d => d.other_user_id === u.id
        ? { ...d, other_username: u.username ?? d.other_username, other_avatar_url: u.avatar_url ?? d.other_avatar_url }
        : d));
    });

    // ── Reconnection: re-join rooms + refresh data ──────────────────
    sock.on('connect', () => {
      setIsConnected(true);
      // Re-join the current channel room — critical so new_message events arrive
      if (prevChRef.current && activeViewRef.current === 'servers') {
        joinChannel(prevChRef.current);
        messagesApi.list(prevChRef.current).then(setChannelMsgs).catch(console.error);
      }
      // Re-fetch active DM conversation to fill any gap
      if (activeDmUserIdRef.current) {
        dmsApi.messages(activeDmUserIdRef.current).then(setDmMsgs).catch(console.error);
      }
      // Refresh list data
      dmsApi.conversations().then(setDmConvs).catch(console.error);
      // Reload server (roles/channels may have changed while disconnected)
      if (activeServerRef.current) {
        serversApi.get(activeServerRef.current).then(s => {
          setServerFull(s);
        }).catch(console.error);
        serversApi.members(activeServerRef.current).then(setMembers).catch(console.error);
      }
      loadServers();
      loadFriends();
    });
    sock.on('disconnect', () => setIsConnected(false));
    sock.on('connect_error', () => setIsConnected(false));

    loadServers(); loadFriends(); loadDms();
    return () => { disconnectSocket(); };
  }, [isAuthenticated]);

  // ── Server change ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeServer) return;
    setServerFull(null);
    setChannelMsgs([]);
    setServerActivity([]);
    serversApi.activity(activeServer).then(setServerActivity).catch(console.error);
    setTypingUsers({});
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
    // Load current voice channel occupants from Redis (initial state)
    channelsApi.voiceUsers(activeServer).then(vu => {
      setVoiceUsers(prev => ({ ...prev, ...vu }));
    }).catch(console.error);
    serversApi.members(activeServer).then(setMembers).catch(console.error);
    serversApi.roles.list(activeServer).then(setRoles).catch(console.error);
  }, [activeServer]);

  // ── Clear typing users when leaving server view ──────────────────
  useEffect(() => {
    if (activeView !== 'servers') setTypingUsers({});
  }, [activeView]);

  // ── Channel change ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeChannel || activeView !== 'servers') return;
    if (prevChRef.current) leaveChannel(prevChRef.current);
    prevChRef.current = activeChannel;
    joinChannel(activeChannel);
    setTypingUsers({});
    setUnreadChs(p => { const n = {...p}; delete n[activeChannel]; return n; });
    setChannelMsgs([]); setMsgsLoading(true); setSearchQuery('');
    messagesApi.list(activeChannel).then(setChannelMsgs).catch(console.error).finally(()=>setMsgsLoading(false));
    setReplyTo(null);
  }, [activeChannel, activeView]);

  // ── DM change ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDmUserId) return;
    setDmMsgs([]); setMsgsLoading(true); setSearchQuery('');
    dmsApi.messages(activeDmUserId).then(setDmMsgs).catch(console.error).finally(()=>setMsgsLoading(false));
    users.get(activeDmUserId).then(setDmPartnerProfile).catch(console.error);
    setReplyTo(null);
  }, [activeDmUserId]);

  // ── Call duration timer ─────────────────────────────────────────
  useEffect(() => {
    if (!activeCall) {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      return;
    }
    setCallDuration(0);
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => { if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.type, activeCall?.channelId, activeCall?.userId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [channelMsgs, dmMsgs, typingUsers]);

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
  useEffect(() => { currentUserRef.current    = currentUser;    }, [currentUser]);
  useEffect(() => { activeCallRef.current     = activeCall;     }, [activeCall]);
  useEffect(() => { activeDmUserIdRef.current = activeDmUserId; }, [activeDmUserId]);
  useEffect(() => { activeViewRef.current     = activeView;     }, [activeView]);
  useEffect(() => { activeServerRef.current   = activeServer;   }, [activeServer]);
  useEffect(() => { callDurationRef.current   = callDuration;   }, [callDuration]);
  // Sync myStatusRef when currentUser.status changes (e.g. on login)
  useEffect(() => { if (currentUser?.status) myStatusRef.current = currentUser.status; }, [currentUser?.status]);

  // Apply accent CSS variable
  useEffect(() => {
    const map: Record<string,string> = { indigo:'99 102 241', violet:'139 92 246', pink:'236 72 153', blue:'59 130 246', emerald:'16 185 129' };
    document.documentElement.style.setProperty('--accent-rgb', map[accentColor]||map.indigo);
  }, [accentColor]);

  // ── Auto-idle (10 min brak aktywności) ───────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      // If we were auto-idled, come back online on any activity
      if (autoIdledRef.current && myStatusRef.current === 'idle') {
        changeStatus('online');
      }
      idleTimerRef.current = setTimeout(() => {
        if (myStatusRef.current !== 'dnd' && myStatusRef.current !== 'offline') {
          changeStatus('idle', true);
        }
      }, IDLE_MS);
    };
    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('keydown',   resetTimer, { passive: true });
    window.addEventListener('click',     resetTimer, { passive: true });
    resetTimer();
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown',   resetTimer);
      window.removeEventListener('click',     resetTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Set online on login, offline/invisible on logout ────────────
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      // Only push online if user was previously offline/not set
      if (!currentUser.status || currentUser.status === 'offline') {
        changeStatus('online');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Close status picker on outside click ────────────────────────
  useEffect(() => {
    if (!statusPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (statusPickerRef.current && !statusPickerRef.current.contains(e.target as Node)) {
        setStatusPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusPickerOpen]);

  // ── Enumerate devices ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    getMediaDevices().then(setDevices).catch(() => {});
    navigator.mediaDevices?.addEventListener('devicechange', () =>
      getMediaDevices().then(setDevices).catch(() => {}));
  }, [isAuthenticated]);

  // ── Persist selected devices across sessions ─────────────────────
  useEffect(() => { if (selMic)     localStorage.setItem('cordis_mic',     selMic);     }, [selMic]);
  useEffect(() => { if (selSpeaker) localStorage.setItem('cordis_speaker', selSpeaker); }, [selSpeaker]);
  useEffect(() => { if (selCamera)  localStorage.setItem('cordis_camera',  selCamera);  }, [selCamera]);

  // ── WebRTC voice signaling handlers ─────────────────────────────
  // These are updated via ref so socket callbacks always get latest version
  const closePeer = (userId: string) => {
    const pc = peerConnsRef.current.get(userId);
    if (pc) { pc.close(); peerConnsRef.current.delete(userId); }
    detachRemoteAudio(userId);
    remoteScreenStreamsRef.current.delete(userId);
    setScreenShareTick(t => t + 1);
    const stop = speakStopRef.current.get(userId);
    if (stop) { stop(); speakStopRef.current.delete(userId); }
    setSpeakingUsers(p => { const n = new Set(p); n.delete(userId); return n; });
    setVoiceUserStates(p => { const n = {...p}; delete n[userId]; return n; });
  };
  const openPeer = async (remoteUserId: string, isInitiator: boolean, sdpOffer?: RTCSessionDescriptionInit) => {
    const existing = peerConnsRef.current.get(remoteUserId);
    if (existing) return existing;
    const pc = makePeerConnection(
      (c) => getSocket().emit('webrtc_ice', { to: remoteUserId, candidate: c }),
      (e) => {
        const stream = e.streams[0]; if (!stream) return;
        if (e.track.kind === 'video') {
          // Remote screen share track
          remoteScreenStreamsRef.current.set(remoteUserId, stream);
          setScreenShareTick(t => t + 1);
        } else {
          // Remote audio track
          attachRemoteAudio(remoteUserId, stream);
          const stop = watchSpeaking(stream, (s) =>
            setSpeakingUsers(p => { const n = new Set(p); s ? n.add(remoteUserId) : n.delete(remoteUserId); return n; }));
          const old = speakStopRef.current.get(remoteUserId); if (old) old();
          speakStopRef.current.set(remoteUserId, stop);
        }
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
      onOffer: async ({ from, sdp }: any) => {
        const existing = peerConnsRef.current.get(from);
        if (existing) {
          // Renegotiation (e.g. remote peer added screen share track)
          await existing.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await existing.createAnswer();
          await existing.setLocalDescription(answer);
          getSocket().emit('webrtc_answer', { to: from, sdp: answer });
        } else {
          await openPeer(from, false, sdp);
        }
      },
      onAnswer: async ({ from, sdp }: any) => {
        const pc = peerConnsRef.current.get(from);
        if (pc && pc.signalingState !== 'stable')
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      },
      onIce: async ({ from, candidate }: any) => {
        const pc = peerConnsRef.current.get(from);
        if (pc) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      },
      // Called when the DM call recipient accepts — caller initiates WebRTC
      onCallAccepted: async () => {
        const call = activeCallRef.current;
        if (!call?.userId) return;
        await openPeer(call.userId, true);
      },
    };
  }); // runs every render to keep closures fresh

  // ── Loaders ─────────────────────────────────────────────────────
  const loadServers = () => serversApi.list().then(list => {
    setServerList(list);
    if (list.length > 0 && !activeServerRef.current) { setActiveServer(list[0].id); setActiveView('servers'); }
  }).catch(console.error);
  const loadFriends = () => { friendsApi.list().then(setFriends).catch(console.error); friendsApi.requests().then(setFriendReqs).catch(console.error); };
  const loadDms    = () => dmsApi.conversations().then(setDmConvs).catch(console.error);

  // Friend search debounce
  useEffect(() => {
    const q = addFriendVal.trim();
    if (q.length < 2) { setFriendSearchResult(null); setFriendSearchLoading(false); return; }
    setFriendSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await users.search(q);
        const exact = results.find(u => u.username.toLowerCase() === q.toLowerCase()) ?? results[0] ?? null;
        setFriendSearchResult(exact);
      } catch { setFriendSearchResult(null); }
      finally { setFriendSearchLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [addFriendVal]);
  const addServerActivity = (entry: {icon:string;text:string}) => {
    const id = Date.now().toString()+Math.random().toString(36).slice(2);
    setServerActivity(p => [{id, ...entry, time: new Date().toISOString()}, ...p].slice(0, 20));
  };

  // ── Privacy helpers (read from currentUser, save to DB) ──────────
  const getPrivacy = (k: 'privacy_status_visible'|'privacy_typing_visible'|'privacy_read_receipts'|'privacy_friend_requests') =>
    currentUser?.[k] ?? (k === 'privacy_read_receipts' ? false : true);
  const togglePrivacy = async (k: 'privacy_status_visible'|'privacy_typing_visible'|'privacy_read_receipts'|'privacy_friend_requests') => {
    const next = !getPrivacy(k);
    const upd = await users.updateMe({ [k]: next }).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); addToast('Ustawienia prywatności zapisane', 'success'); }
    else addToast('Błąd zapisu ustawień', 'error');
  };

  // ── Appearance helpers (save to DB) ──────────────────────────────
  const saveAccentColor = async (color: string) => {
    const upd = await users.updateMe({ accent_color: color }).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); setAccentColor(color); addToast('Kolor akcentu zmieniony', 'success'); }
    else addToast('Błąd zapisu', 'error');
  };
  const saveCompactMessages = async (compact: boolean) => {
    const upd = await users.updateMe({ compact_messages: compact }).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); setCompactMessages(compact); addToast('Układ wiadomości zmieniony', 'success'); }
    else addToast('Błąd zapisu', 'error');
  };

  // ── Status ────────────────────────────────────────────────────────
  const changeStatus = async (s: 'online'|'idle'|'dnd'|'offline', auto = false) => {
    try {
      await users.updateStatus(s);
      myStatusRef.current = s;
      autoIdledRef.current = auto;
      setCurrentUser(p => p ? {...p, status: s} : p);
    } catch { /* silent */ }
  };

  const handleMicToggle = () => {
    if (activeCall) {
      toggleMute();
    } else {
      const next = !isMicMuted;
      setIsMicMuted(next);
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
    }
  };

  // ── Auth ────────────────────────────────────────────────────────
  const applyUserPrefs = (u: UserProfile) => {
    setAccentColor(u.accent_color || 'indigo');
    setCompactMessages(u.compact_messages ?? false);
  };
  const [showWelcome, setShowWelcome] = useState(false);
  const handleAuth = (u: UserProfile, _t: string, isNew = false) => {
    setCurrentUser(u); setEditProf({...u}); setIsAuthenticated(true); applyUserPrefs(u);
    if (isNew) {
      const key = `welcomed_${u.id}`;
      if (!localStorage.getItem(key)) { setShowWelcome(true); localStorage.setItem(key, '1'); }
    }
  };
  const handleLogout = async () => {
    try { await auth.logout(); } catch {}
    clearToken(); disconnectSocket(); setIsAuthenticated(false); setCurrentUser(null);
    setServerList([]); setActiveServer(''); setActiveChannel('');
  };

  // ── Emoji insert at cursor ──────────────────────────────────────
  const insertEmoji = (emoji: string) => {
    const input = msgInputRef.current;
    const pos = input?.selectionStart ?? msgInput.length;
    const newVal = msgInput.slice(0, pos) + emoji + msgInput.slice(pos);
    setMsgInput(newVal);
    setShowEmojiPicker(false);
    setTimeout(() => { input?.focus(); input?.setSelectionRange(pos + emoji.length, pos + emoji.length); }, 0);
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
      if (createSrvIconFile) {
        const iconUrl = await uploadFile(createSrvIconFile, 'servers');
        await serversApi.update(s.id, { icon_url: iconUrl });
        s.icon_url = iconUrl;
      }
      setServerList(p => [...p, s]); setActiveServer(s.id); setActiveView('servers');
      setActiveChannel(''); setCreateSrvOpen(false); setCreateSrvName('');
      setCreateSrvIconFile(null); setCreateSrvIconPreview(null);
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
  const handleLeaveServer = async (serverId: string) => {
    try {
      await serversApi.leave(serverId);
      setServerList(p => p.filter(s => s.id !== serverId));
      if (activeServer === serverId) { setActiveServer(''); setActiveView('friends'); setServerFull(null); setActiveChannel(''); }
      setSrvContextMenu(null);
      addToast('Opuściłeś serwer', 'success');
    } catch (err: any) { addToast(err?.message || 'Błąd opuszczania serwera', 'error'); }
  };
  const handleDeleteServer = async (serverId: string) => {
    try {
      await serversApi.delete(serverId);
      setServerList(p => p.filter(s => s.id !== serverId));
      if (activeServer === serverId) { setActiveServer(''); setActiveView('friends'); setServerFull(null); setActiveChannel(''); }
      setDeleteSrvConfirm(null);
      addToast('Serwer został usunięty', 'success');
    } catch (err: any) { addToast(err?.message || 'Błąd usuwania serwera', 'error'); }
  };
  const handleSaveSrv = async () => {
    if (!activeServer) return;
    try {
      let icon = srvForm.icon_url, banner = srvForm.banner_url;
      if (srvIconFile)   { icon   = await uploadFile(srvIconFile, 'servers');   setSrvIconFile(null); }
      if (srvBannerFile) { banner = await uploadFile(srvBannerFile, 'servers'); setSrvBannerFile(null); }
      const upd = await serversApi.update(activeServer, { name: srvForm.name, description: srvForm.description, icon_url: icon, banner_url: banner });
      setServerList(p => p.map(s => s.id === activeServer ? { ...s, ...upd } : s));
      // Update form with saved URLs so preview doesn't disappear
      setSrvForm(p => ({...p, icon_url: upd.icon_url||icon, banner_url: upd.banner_url||banner}));
      const s = await serversApi.get(activeServer); setServerFull(s);
      addToast('Ustawienia serwera zapisane', 'success');
    } catch (err) { addToast('Błąd zapisu ustawień serwera', 'error'); }
  };

  // ── Channel ─────────────────────────────────────────────────────
  const handleCreateCh = async () => {
    if (!newChName.trim() || !activeServer) return;
    try {
      await channelsApi.create({ server_id: activeServer, name: newChName.trim(), type: newChType, category_id: chCreateCatId || undefined });
      addServerActivity({ icon: newChType==='voice'?'🎙️':'#️⃣', text: `Kanał #${newChName.trim()} został utworzony` });
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
    try {
      await friendsApi.sendRequest(addFriendVal.trim());
      setAddFriendVal(''); setFriendSearchResult(null);
      loadFriends(); addToast('Zaproszenie wysłane!', 'success');
    }
    catch (err: any) { addToast(err?.message || 'Nie znaleziono użytkownika', 'error'); }
  };
  const handleFriendReq = async (id: string, action: 'accept'|'reject') => {
    try {
      await friendsApi.respondRequest(id, action);
      loadFriends();
      addToast(action === 'accept' ? 'Zaproszenie zaakceptowane!' : 'Zaproszenie odrzucone', action === 'accept' ? 'success' : 'info');
    }
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
  const handleSaveProfile = async (opts?: { closeProfileModal?: boolean }) => {
    if (!editProf) return;
    try {
      let bannerUrl = editProf.banner_url;
      if (profBannerFile) { const r = await users.uploadBanner(profBannerFile); bannerUrl = r.banner_url; setProfBannerFile(null); setProfBannerPrev(null); }
      const upd = await users.updateMe({ username: editProf.username, bio: editProf.bio, custom_status: editProf.custom_status, banner_color: editProf.banner_color, banner_url: bannerUrl });
      setCurrentUser(upd); setEditProf({...upd}); setSelUser(upd);
      if (opts?.closeProfileModal !== false) setProfileOpen(false);
      addToast('Profil zaktualizowany', 'success');
    } catch (err) { addToast('Błąd zapisu profilu', 'error'); }
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
    playVoiceJoin();
    setActiveCall({ type: 'voice_channel', channelId: ch.id, channelName: ch.name, serverId: activeServer, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    setShowCallPanel(true);
  };

  const hangupCall = () => {
    if (activeCall?.channelId) {
      leaveVoiceChannel(activeCall.channelId);
      playVoiceLeave();
      // Optimistic: remove self from voiceUsers immediately
      if (currentUser) setVoiceUsers(p => ({ ...p, [activeCall.channelId!]: (p[activeCall.channelId!]||[]).filter(u=>u.id!==currentUser.id) }));
    }
    if (activeCall?.userId) {
      const dur = callDurationRef.current;
      const icon = activeCall.type === 'dm_video' ? '📹' : '📞';
      const typeName = activeCall.type === 'dm_video' ? 'wideo' : 'głosowa';
      const content = `${icon} Rozmowa ${typeName} zakończona · ${fmtDur(dur)}`;
      endCall(activeCall.userId);
      stopRing();
      stopIncomingRing();
      playCallEnded();
      // Persist system message to DB (will come back via new_dm socket to both parties)
      dmsApi.sendSystem(activeCall.userId, content).catch(console.error);
    }
    cleanupWebRTC();
    setActiveCall(null); setShowCallPanel(false); setCallDuration(0);
  };

  const startDmCall = async (userId: string, username: string, type: 'voice'|'video') => {
    await acquireMic(selMic || undefined);
    sendCallInvite(userId, type);
    startRing();
    setActiveCall({ type: type === 'voice' ? 'dm_voice' : 'dm_video', userId, username, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    setActiveDmUserId(userId); setActiveView('dms'); setShowCallPanel(true); setProfileOpen(false);
  };

  const toggleMute = () => {
    const muted = !activeCall?.isMuted;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    setActiveCall(p => p ? {...p, isMuted: muted} : p);
    const call = activeCallRef.current;
    if (call?.channelId) getSocket().emit('voice_state' as any, { muted, deafened: call.isDeafened, channel_id: call.channelId });
    if (call?.userId)    getSocket().emit('voice_state' as any, { muted, deafened: call.isDeafened, to_user_id: call.userId });
  };
  const toggleDeafen = () => {
    const deaf = !activeCall?.isDeafened;
    muteAllRemote(deaf);
    setActiveCall(p => p ? {...p, isDeafened: deaf} : p);
    const call = activeCallRef.current;
    if (call?.channelId) getSocket().emit('voice_state' as any, { muted: call.isMuted, deafened: deaf, channel_id: call.channelId });
    if (call?.userId)    getSocket().emit('voice_state' as any, { muted: call.isMuted, deafened: deaf, to_user_id: call.userId });
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
    const emitScreenStop = () => {
      const c = activeCallRef.current;
      if (c?.userId)    getSocket().emit('screen_share_stop' as any, { to_user_id: c.userId });
      if (c?.channelId) getSocket().emit('screen_share_stop' as any, { channel_id: c.channelId });
    };
    if (activeCall?.isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setActiveCall(p => p ? {...p, isScreenSharing: false} : p);
      emitScreenStop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = stream;
        // Add ALL tracks (video + audio) to every peer connection BEFORE renegotiating
        stream.getTracks().forEach(t => {
          peerConnsRef.current.forEach((pc) => { pc.addTrack(t, stream); });
        });
        // Renegotiate once per peer (after all tracks are added)
        peerConnsRef.current.forEach(async (pc, peerId) => {
          try {
            if (pc.signalingState === 'stable') {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              getSocket().emit('webrtc_offer', { to: peerId, sdp: offer });
            }
          } catch {}
        });
        // Stop screen share when video track ends (user clicks browser stop button)
        stream.getVideoTracks().forEach(t => {
          t.onended = () => {
            screenStreamRef.current = null;
            setActiveCall(p => p ? {...p, isScreenSharing: false} : p);
            emitScreenStop();
          };
        });
        setActiveCall(p => p ? {...p, isScreenSharing: true} : p);
        const call = activeCallRef.current;
        if (call?.userId)    getSocket().emit('screen_share_start' as any, { to_user_id: call.userId });
        if (call?.channelId) getSocket().emit('screen_share_start' as any, { channel_id: call.channelId });
      } catch { addToast('Nie można udostępnić ekranu', 'error'); }
    }
  };

  // ──────────────────────────────────────────────────────────────────
  if (authLoading) return <div className="fixed inset-0 bg-[#0c0c11] flex items-center justify-center"><Loader2 size={32} className="text-indigo-400 animate-spin" /></div>;
  if (!isAuthenticated) return <AuthScreen onAuth={(u, t, isNew) => handleAuth(u, t, isNew)} />;

  const allChs   = serverFull?.categories.flatMap(c => c.channels) ?? [];
  const activeCh = allChs.find(c => c.id === activeChannel);
  const activeDm = dmConvs.find(d => d.other_user_id === activeDmUserId);
  const isAdmin  = !!(serverFull?.my_role && ['Owner','Admin'].includes(serverFull.my_role));
  const incoming = friendReqs.filter(r => r.direction === 'incoming');
  const outgoing = friendReqs.filter(r => r.direction === 'outgoing');
  const allMessages = activeView === 'servers' ? channelMsgs : dmMsgs;
  const messages = searchQuery.trim()
    ? allMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : allMessages;

  // Highlight matching text in search results
  const hlText = (text: string) => {
    const q = searchQuery.trim();
    if (!q) return <>{text}</>;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return <>{parts.map((p, i) =>
      p.toLowerCase() === q.toLowerCase()
        ? <mark key={i} className="bg-yellow-400/25 text-yellow-200 rounded px-0.5">{p}</mark>
        : p
    )}</>;
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full text-zinc-300 font-sans overflow-hidden relative bg-[#0c0c11]">

      {/* TOP NAV — browser-tab style */}
      <nav className="h-12 border-b border-white/[0.06] flex items-center justify-between shrink-0 z-30 relative bg-[#12121a]">
        {/* Left: mobile toggle + server tabs */}
        <div className="flex items-center h-full overflow-x-auto">
          <button onClick={() => setIsMobileOpen(v => !v)} className="md:hidden w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-white ml-2 shrink-0">
            {isMobileOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          {/* Friends / DM quick icons */}
          <div className="hidden md:flex items-center h-full pl-2 gap-0.5 pr-2 border-r border-white/[0.06]">
            {([{v:'friends' as const,i:<Users size={15}/>,label:'Znajomi'},{v:'dms' as const,i:<MessageCircle size={15}/>,label:'Wiadomości'}]).map(({v,i,label}) => {
              const totalUnreadDms = v==='dms' ? Object.values(unreadDms).reduce((a,b)=>a+b,0) : 0;
              return (
              <button key={v} title={label} onClick={() => { setActiveView(v); setActiveServer(''); setActiveChannel(''); }}
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 relative ${activeView===v?'bg-indigo-500/25 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.2)]':'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06]'}`}>
                {i}
                {v==='friends' && incoming.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">{incoming.length}</span>
                )}
                {v==='dms' && totalUnreadDms > 0 && activeView!=='dms' && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none shadow-[0_0_6px_rgba(239,68,68,0.6)]">
                    {totalUnreadDms > 99 ? '99+' : totalUnreadDms}
                  </span>
                )}
              </button>
              );
            })}
          </div>
          {/* Server tabs */}
          <div className="hidden md:flex items-center h-full">
            {serverList.map(srv => {
              const isActive = activeServer===srv.id&&activeView==='servers';
              return (
                <button key={srv.id}
                  onClick={() => { if(activeServer===srv.id&&activeView==='servers') return; setActiveServer(srv.id); setActiveView('servers'); setActiveChannel(''); setServerFull(null); }}
                  onContextMenu={e => { e.preventDefault(); setSrvContextMenu({ x: e.clientX, y: e.clientY, srv }); }}
                  className={`flex items-center gap-2 h-full px-4 text-sm font-medium transition-all duration-200 border-r border-white/[0.05] whitespace-nowrap relative group ${isActive?'text-white bg-[#0c0c11]':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'}`}>
                  {isActive&&<motion.span layoutId="nav-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"/>}
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 overflow-hidden transition-all duration-200 ${isActive?'bg-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.3)]':'bg-zinc-800'}`}>
                    {srv.icon_url ? <img src={srv.icon_url} className="w-full h-full object-cover" alt=""/> : srv.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[120px] truncate">{srv.name}</span>
                </button>
              );
            })}
            <button onClick={() => setCreateSrvOpen(true)}
              className="flex items-center justify-center w-9 h-full text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 border-r border-white/[0.05]">
              <Plus size={15}/>
            </button>
          </div>
        </div>
        {/* Center: branding */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <span className="text-white font-bold tracking-tight text-sm bg-clip-text">Cordis</span>
        </div>
        {/* Right: search + bell + settings + avatar */}
        <div className="flex items-center gap-1.5 pr-3">
          <div className="relative group hidden sm:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-zinc-400 transition-colors"/>
            <input placeholder="Szukaj w wiadomościach..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.07] text-white placeholder-zinc-600 outline-none focus:border-indigo-500/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] rounded-xl pl-8 pr-10 py-1.5 text-xs w-44 focus:w-56 transition-all duration-300"/>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono hidden lg:flex items-center gap-0.5"><span className="border border-zinc-700 rounded px-1 py-0.5">⌘</span><span className="border border-zinc-700 rounded px-1 py-0.5">K</span></span>
          </div>
          <button className="relative w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
            <Bell size={15}/>
            {incoming.length>0&&<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full border border-[#12121a]"/>}
          </button>
          <button onClick={() => { setAppSettTab('account'); setAppSettOpen(true); }} title="Ustawienia"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
            <Settings size={15}/>
          </button>
          <button onClick={openOwnProfile} className="w-7 h-7 rounded-full border-2 border-white/[0.08] overflow-hidden hover:border-indigo-500/50 transition-all shrink-0 shadow-sm">
            <img src={currentUser ? ava(currentUser) : ''} alt="" className="w-full h-full object-cover"/>
          </button>
        </div>
      </nav>

      {isMobileOpen&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsMobileOpen(false)}/>}

      {/* WORKSPACE */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* LEFT */}
        <aside className={`absolute md:relative z-30 md:z-0 w-60 shrink-0 flex flex-col bg-[#12121a] border-r border-white/[0.06] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] h-full ${isMobileOpen?'translate-x-0':'-translate-x-[120%] md:translate-x-0'}`}>
          {/* mobile server row */}
          <div className="md:hidden p-2 border-b border-white/[0.05] flex gap-1.5 overflow-x-auto">
            {([{v:'friends' as const,i:<Users size={16}/>},{v:'dms' as const,i:<MessageCircle size={16}/>}]).map(({v,i}) => (
              <button key={v} onClick={() => { setActiveView(v); setIsMobileOpen(false); }}
                className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl ${activeView===v?'bg-indigo-500 text-white':`${gb}`}`}>{i}</button>
            ))}
            <div className="w-px h-7 bg-white/[0.07] self-center mx-0.5"/>
            {serverList.map(s => (
              <button key={s.id}
                onClick={() => { if(activeServer===s.id&&activeView==='servers') return; setActiveServer(s.id); setActiveView('servers'); setActiveChannel(''); setServerFull(null); setIsMobileOpen(false); }}
                onContextMenu={e=>{ e.preventDefault(); setSrvContextMenu({x:e.clientX,y:e.clientY,srv:s}); }}
                className={`w-10 h-10 shrink-0 rounded-xl overflow-hidden border ${activeServer===s.id&&activeView==='servers'?'border-indigo-500/40':'border-white/[0.05]'}`}>
                <span className="text-sm font-bold text-white flex w-full h-full items-center justify-center bg-zinc-800">{s.name.charAt(0)}</span>
              </button>
            ))}
            <button onClick={() => setCreateSrvOpen(true)} className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl ${gb}`}><Plus size={16}/></button>
          </div>

          {/* servers */}
          {activeView==='servers'&&<>
            <div className="px-4 py-4 border-b border-white/[0.06] cursor-pointer hover:bg-white/[0.03] transition-colors group"
              onClick={() => { if(isAdmin){setSrvSettTab('overview');setSrvSettOpen(true);} }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white truncate">{serverFull?.name||serverList.find(s=>s.id===activeServer)?.name||'Serwer'}</h2>
                {isAdmin&&<Settings2 size={13} className="text-zinc-700 group-hover:text-indigo-400 transition-colors shrink-0"/>}
              </div>
              {serverFull?.description
                ? <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{serverFull.description}</p>
                : <p className="text-[11px] text-zinc-700 mt-0.5">{isAdmin?'Kliknij — ustawienia':'Witaj!'}</p>}
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
                      <div className="flex items-center justify-between px-3 pt-4 pb-1.5 group/cat">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{cat.name}</span>
                        {isAdmin&&<Plus size={12} className="text-zinc-700 hover:text-zinc-300 cursor-pointer opacity-0 group-hover/cat:opacity-100 transition-all"
                          onClick={() => { setChCreateCatId(cat.id); setChCreateOpen(true); setNewChName(''); setNewChType('text'); }}/>}
                      </div>
                      {textChs.map(ch => {
                        const isAct = activeChannel===ch.id;
                        const unread = unreadChs[ch.id] || 0;
                        return (
                          <div key={ch.id} className="px-2">
                            <button onClick={() => { setActiveChannel(ch.id); setIsMobileOpen(false); }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl mb-0.5 group/ch transition-all duration-150 ${
                                isAct
                                  ? 'bg-indigo-500/15 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)] border border-indigo-500/20'
                                  : unread > 0
                                    ? 'text-white hover:bg-white/[0.06] border border-transparent'
                                    : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300 border border-transparent'}`}>
                              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                                <Hash size={14} className={`shrink-0 transition-colors ${isAct?'text-indigo-400':unread>0?'text-indigo-400/70':'text-zinc-600'}`}/>
                                <span className={`text-[13px] truncate transition-colors ${unread>0&&!isAct?'font-semibold':'font-medium'}`}>{ch.name}</span>
                                {ch.is_private&&<Lock size={9} className="text-zinc-700 shrink-0"/>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {unread > 0 && !isAct && (
                                  <span className="min-w-[18px] h-[18px] bg-indigo-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1 leading-none shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                                    {unread > 99 ? '99+' : unread}
                                  </span>
                                )}
                                {isAdmin&&<div className="flex gap-0.5 opacity-0 group-hover/ch:opacity-100 transition-opacity">
                                  <button onClick={e=>{e.stopPropagation();openChEdit(ch);}} className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white/10 hover:text-zinc-200 transition-colors"><Settings2 size={10}/></button>
                                  <button onClick={e=>{e.stopPropagation();handleDeleteCh(ch.id);}} className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-colors"><Trash2 size={10}/></button>
                                </div>}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </>}

                    {/* Voice channels — VOICE ROOMS */}
                    {voiceChs.length>0&&<>
                      <div className="flex items-center justify-between px-3 pt-4 pb-1.5 group/vcat">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Voice Rooms</span>
                        {isAdmin&&<Plus size={12} className="text-zinc-700 hover:text-zinc-300 cursor-pointer opacity-0 group-hover/vcat:opacity-100 transition-all"
                          onClick={() => { setChCreateCatId(cat.id); setChCreateOpen(true); setNewChName(''); setNewChType('voice'); }}/>}
                      </div>
                      {voiceChs.map(ch => {
                        const isActiveVoice = activeCall?.channelId===ch.id;
                        const chVoiceUsers  = voiceUsers[ch.id]||[];
                        const hasUsers = chVoiceUsers.length>0;
                        return (
                          <div key={ch.id} className="px-2">
                            <button onClick={() => joinVoiceCh(ch)}
                              className={`w-full px-3 py-2 rounded-2xl mb-0.5 group/ch transition-all duration-150 ${
                                isActiveVoice?'bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.1)]':'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300 border border-transparent'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Volume2 size={13} className={`shrink-0 ${isActiveVoice?'text-emerald-400':hasUsers?'text-zinc-400':'text-zinc-600'}`}/>
                                  <span className="text-[13px] font-medium truncate">{ch.name}</span>
                                </div>
                                {/* Stacked avatars for voice users */}
                                {hasUsers&&(
                                  <div className="flex -space-x-1.5 shrink-0">
                                    {chVoiceUsers.slice(0,3).map(u=>(
                                      <img key={u.id} src={ava(u)} className={`w-4 h-4 rounded-full border ${isActiveVoice?'border-emerald-900':'border-[#12121a]'} object-cover`} alt="" title={u.username}/>
                                    ))}
                                    {chVoiceUsers.length>3&&<div className="w-4 h-4 rounded-full border border-[#12121a] bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-white">+{chVoiceUsers.length-3}</div>}
                                  </div>
                                )}
                              </div>
                              {/* speaking users list */}
                              {hasUsers&&<div className="mt-1 flex flex-col gap-0.5">
                                {chVoiceUsers.map(u=>{
                                  const isSpeaking = speakingUsers.has(u.id);
                                  const isSelf     = u.id === currentUser?.id && activeCall?.channelId === ch.id;
                                  const isMuted    = isSelf ? !!activeCall?.isMuted    : !!(voiceUserStates[u.id]?.muted);
                                  const isDeafened = isSelf ? !!activeCall?.isDeafened : !!(voiceUserStates[u.id]?.deafened);
                                  return (
                                    <div key={u.id} className="flex items-center gap-1.5 pl-5">
                                      <div className={`relative shrink-0 ${isSpeaking&&!isMuted?'ring-1 ring-emerald-500 rounded-full':''}`}>
                                        <img src={ava(u)} className="w-3.5 h-3.5 rounded-full object-cover" alt=""/>
                                      </div>
                                      <span className={`text-[11px] truncate ${isSpeaking&&!isMuted?'text-emerald-400':isMuted?'text-rose-400/70':'text-zinc-500'}`}>{u.username}</span>
                                      {isMuted    && <MicOff  size={8} className="text-rose-400 shrink-0"/>}
                                      {isDeafened && <VolumeX size={8} className="text-rose-400 shrink-0"/>}
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
            <div className="px-4 py-4 border-b border-white/[0.06]"><h2 className="text-sm font-bold text-white">Wiadomości prywatne</h2></div>
            <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar flex flex-col gap-0.5">
              {dmConvs.map(dm => {
                const unread = unreadDms[dm.other_user_id] || 0;
                const isActive = activeDmUserId===dm.other_user_id;
                return (
                  <button key={dm.id} onClick={() => { setActiveDmUserId(dm.other_user_id); setIsMobileOpen(false); setUnreadDms(p => ({ ...p, [dm.other_user_id]: 0 })); }}
                    className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-2xl transition-all duration-150 ${isActive?'bg-indigo-500/12 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.12)]':'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200 border border-transparent'}`}>
                    <div className="relative shrink-0">
                      <img src={ava({avatar_url:dm.other_avatar,username:dm.other_username})} className="w-9 h-9 rounded-2xl object-cover" alt=""/>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${sc(dm.other_status)} border-2 border-[#12121a] rounded-full`}/>
                    </div>
                    <div className="flex-1 truncate text-left min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${isActive?'text-indigo-200':unread>0?'text-white':'text-zinc-300'}`}>{dm.other_username}</p>
                      {dm.last_message&&<p className={`text-[11px] truncate mt-0.5 ${unread>0?'text-zinc-300 font-medium':'text-zinc-600'}`}>{dm.last_message}</p>}
                    </div>
                    {unread > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1 leading-none shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                );
              })}
              {dmConvs.length===0&&<p className="text-xs text-zinc-700 px-3 py-4">Brak wiadomości</p>}
            </div>
          </>}

          {activeView==='friends'&&<div className="p-3.5 border-b border-white/[0.05]"><h2 className="text-sm font-bold text-white">Znajomi</h2></div>}

          {/* USER BAR — bottom of sidebar */}
          <div className="shrink-0 px-3 py-3 border-t border-white/[0.06] bg-[#0e0e16] relative" ref={statusPickerRef}>

            {/* Status picker popup */}
            <AnimatePresence>
              {statusPickerOpen&&(
                <motion.div initial={{opacity:0,y:6,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:6,scale:0.95}}
                  transition={{duration:0.15,ease:[0.16,1,0.3,1]}}
                  className="absolute bottom-full left-3 right-3 mb-2 bg-[#1a1a26] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-50 p-1">

                  {/* Call status row — auto, shown when in call */}
                  {activeCall&&(
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 flex items-center justify-center">
                        <Phone size={6} className="text-white"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-rose-400 leading-tight">W trakcie rozmowy</p>
                        <p className="text-[10px] text-zinc-600">Ustawiany automatycznie</p>
                      </div>
                    </div>
                  )}

                  {STATUS_OPTIONS.map(opt=>{
                    const isCurrent = (currentUser?.status||'online')===opt.value && !activeCall;
                    return (
                      <button key={opt.value} onClick={()=>{ changeStatus(opt.value); setStatusPickerOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left group ${isCurrent?'bg-white/[0.06]':'hover:bg-white/[0.05]'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${opt.color} shrink-0`}/>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-zinc-200 leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-zinc-600">{opt.desc}</p>
                        </div>
                        {isCurrent&&<Check size={12} className="text-indigo-400 shrink-0"/>}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2.5 px-2 py-2 rounded-2xl hover:bg-white/[0.05] transition-colors cursor-default">
              {/* Avatar + status dot — click opens picker */}
              <div className="relative shrink-0 cursor-pointer" onClick={()=>setStatusPickerOpen(p=>!p)} title="Zmień status">
                <img src={currentUser?ava(currentUser):''} className="w-8 h-8 rounded-full object-cover" alt=""/>
                {/* Status dot — red phone when in call, else normal status */}
                {activeCall ? (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-[#0e0e16] rounded-full flex items-center justify-center">
                    <Phone size={6} className="text-white"/>
                  </div>
                ) : (
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(currentUser?.status??'offline')} border-2 border-[#0e0e16] rounded-full`}/>
                )}
              </div>

              {/* Name + status label */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={openOwnProfile}>
                <p className="text-[13px] font-semibold text-white leading-tight truncate hover:text-zinc-300 transition-colors">{currentUser?.username}</p>
                <p className="text-[11px] truncate leading-tight mt-0.5">
                  {activeCall ? (
                    <span className="text-rose-400">W trakcie rozmowy</span>
                  ) : currentUser?.custom_status ? (
                    <span className="text-zinc-500">{currentUser.custom_status}</span>
                  ) : (
                    <span className={`${sc(currentUser?.status??'offline').replace('bg-','text-')}`}>
                      {STATUS_OPTIONS.find(o=>o.value===(currentUser?.status||'online'))?.label||'Dostępny'}
                    </span>
                  )}
                </p>
              </div>

              {/* Mic + Settings buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button title={isMicMuted||activeCall?.isMuted?'Włącz mikrofon':'Wycisz mikrofon'}
                  onClick={handleMicToggle}
                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                    (isMicMuted||(activeCall?.isMuted??false))
                      ? 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07]'}`}>
                  {(isMicMuted||(activeCall?.isMuted??false))?<MicOff size={13}/>:<Mic size={13}/>}
                </button>
                <button title="Ustawienia aplikacji" onClick={()=>{setAppSettTab('account');setAppSettOpen(true);}}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07] transition-all"><Settings size={13}/></button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className="flex-1 flex flex-col bg-[#0c0c11] overflow-hidden min-w-0">
          {showCallPanel && activeCall ? (
            /* ── CALL PANEL ─────────────────────────────────────────── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Call header */}
              <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-5 bg-[#0c0c11]/90 backdrop-blur-md shrink-0">
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
              {/* Participants + screen share area */}
              {(()=>{
                const remoteScreenEntries = [...remoteScreenStreamsRef.current.entries()];
                const hasScreenShare = (activeCall.isScreenSharing && !!screenStreamRef.current) || remoteScreenEntries.length > 0;

                // Participant avatar block (shared between layouts)
                const selfBlock = currentUser ? (()=>{
                  const selfSpeaking = speakingUsers.has(currentUser.id) && !activeCall.isMuted;
                  return (
                    <div key="self" className="flex flex-col items-center gap-2">
                      <div className={`relative p-1 rounded-2xl border-2 transition-all duration-150 ${selfSpeaking?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':activeCall.isMuted?'border-rose-500/40':'border-white/10'}`}>
                        <img src={ava(currentUser)} className={`${hasScreenShare?'w-14 h-14':'w-24 h-24'} rounded-xl object-cover`} alt=""/>
                        <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${activeCall.isMuted?'bg-rose-500':'bg-emerald-500'}`}>
                          {activeCall.isMuted?<MicOff size={9} className="text-white"/>:<Mic size={9} className="text-white"/>}
                        </div>
                      </div>
                      <p className={`text-xs font-bold ${selfSpeaking?'text-emerald-400':'text-white'}`}>{currentUser.username} <span className="text-zinc-600">(Ty)</span></p>
                    </div>
                  );
                })() : null;

                const channelParticipants = activeCall.channelId ? (voiceUsers[activeCall.channelId]||[]).filter(u=>u.id!==currentUser?.id).map(u=>{
                  const isSpeaking = speakingUsers.has(u.id);
                  const uMuted    = voiceUserStates[u.id]?.muted    ?? false;
                  const uDeafened = voiceUserStates[u.id]?.deafened ?? false;
                  return (
                    <div key={u.id} className="flex flex-col items-center gap-2">
                      <div className={`relative p-1 rounded-2xl border-2 transition-all duration-150 ${isSpeaking&&!uMuted?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':uMuted?'border-rose-500/40':'border-white/10'}`}>
                        <img src={ava(u)} className={`${hasScreenShare?'w-14 h-14':'w-24 h-24'} rounded-xl object-cover`} alt=""/>
                        <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${uMuted?'bg-rose-500':isSpeaking?'bg-emerald-500':'bg-zinc-700'}`}>
                          {uMuted ? <MicOff size={9} className="text-white"/> : <Mic size={9} className="text-white"/>}
                        </div>
                        {uDeafened && <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center"><VolumeX size={8} className="text-white"/></div>}
                      </div>
                      <p className={`text-xs font-bold ${isSpeaking&&!uMuted?'text-emerald-400':uMuted?'text-rose-400':'text-white'}`}>{u.username}</p>
                    </div>
                  );
                }) : [];

                const dmPartnerBlock = activeCall.userId && activeCall.username ? (()=>{
                  const partnerSpeaking = speakingUsers.has(activeCall.userId!);
                  const pMuted    = voiceUserStates[activeCall.userId!]?.muted    ?? false;
                  const pDeafened = voiceUserStates[activeCall.userId!]?.deafened ?? false;
                  return (
                    <div key="partner" className="flex flex-col items-center gap-2">
                      <div className={`relative p-1 rounded-2xl border-2 transition-all duration-150 ${partnerSpeaking&&!pMuted?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':pMuted?'border-rose-500/40':'border-white/10'}`}>
                        <div className={`${hasScreenShare?'w-14 h-14':'w-24 h-24'} rounded-xl bg-zinc-800 border border-white/[0.06] flex items-center justify-center font-bold text-zinc-600 ${hasScreenShare?'text-2xl':'text-4xl'}`}>
                          {activeCall.username.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${pMuted?'bg-rose-500':partnerSpeaking?'bg-emerald-500':'bg-zinc-700'}`}>
                          {pMuted ? <MicOff size={9} className="text-white"/> : <Mic size={9} className="text-white"/>}
                        </div>
                        {pDeafened && <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center"><VolumeX size={8} className="text-white"/></div>}
                      </div>
                      <p className={`text-xs font-bold ${partnerSpeaking&&!pMuted?'text-emerald-400':pMuted?'text-rose-400':'text-white'}`}>{activeCall.username}</p>
                    </div>
                  );
                })() : null;

                const allParticipants = [selfBlock, ...channelParticipants, dmPartnerBlock].filter(Boolean);

                if (hasScreenShare) {
                  // ── SCREEN SHARE LAYOUT ──────────────────────────────────────
                  // Active screen share = big video on top, participants strip below
                  const screenStream = activeCall.isScreenSharing && screenStreamRef.current
                    ? screenStreamRef.current
                    : remoteScreenEntries[0]?.[1] ?? null;
                  const screenOwner = activeCall.isScreenSharing ? 'Ty' : (sharingUserId ? (activeCall.username || 'Rozmówca') : 'Rozmówca');
                  return (
                    <div className="flex-1 flex flex-col gap-3 p-4 overflow-hidden min-h-0">
                      {/* Screen share video — main area */}
                      <div className="relative flex-1 bg-black rounded-xl overflow-hidden min-h-0 group">
                        {screenStream && (
                          <video
                            ref={el => { if (el && el.srcObject !== screenStream) { el.srcObject = screenStream; el.play().catch(()=>{}); } }}
                            className="w-full h-full object-contain"
                            autoPlay playsInline muted={activeCall.isScreenSharing}
                          />
                        )}
                        {/* Label */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1">
                          <ScreenShare size={12} className="text-indigo-400"/>
                          <span className="text-xs text-white font-medium">{screenOwner} udostępnia ekran</span>
                        </div>
                        {/* Fullscreen button */}
                        <button
                          onClick={() => { const el = document.querySelector('#screen-share-video') as HTMLVideoElement; el?.requestFullscreen?.(); }}
                          className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Pełny ekran">
                          <Maximize2 size={14}/>
                        </button>
                      </div>
                      {/* Participants strip */}
                      <div className="shrink-0 flex items-center justify-center gap-4 py-1">
                        {allParticipants}
                      </div>
                    </div>
                  );
                }

                // ── NORMAL GRID LAYOUT ───────────────────────────────────────
                return (
                  <div className="flex-1 flex flex-wrap items-center justify-center gap-6 p-8 overflow-y-auto">
                    {allParticipants}
                  </div>
                );
              })()}
              {/* Call controls */}
              <div className="shrink-0 border-t border-white/[0.06] bg-[#0c0c11]/80 backdrop-blur-sm">
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
          ) : activeView==='dms' && !activeDmUserId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4}}
                className="w-full max-w-sm flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center mb-5 shadow-[0_0_40px_-8px_rgba(99,102,241,0.4)]">
                  <MessageCircle size={34} className="text-indigo-400"/>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Wiadomości prywatne</h2>
                <p className="text-sm text-zinc-500 mb-8 leading-relaxed max-w-xs">Wybierz znajomego, do którego chcesz napisać, lub zaproś nowych znajomych do Cordyna.</p>
                {friends.length>0 ? (
                  <div className="w-full">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 text-left">Znajomi</h3>
                    <div className="flex flex-col gap-1">
                      {[...friends].sort((a,b)=>{const o=(s:string)=>['online','idle','dnd'].includes(s)?0:1;return o(a.status)-o(b.status);}).map(f=>(
                        <button key={f.id} onClick={()=>openDm(f.id)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-all group text-left w-full">
                          <div className="relative shrink-0">
                            <img src={ava(f)} className="w-9 h-9 rounded-xl object-cover" alt=""/>
                            <div className={`absolute -bottom-px -right-px w-2.5 h-2.5 ${sc(f.status)} border-2 border-[#0c0c11] rounded-full`}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors truncate">{f.username}</p>
                            {f.custom_status&&<p className="text-xs text-zinc-600 truncate">{f.custom_status}</p>}
                          </div>
                          <MessageCircle size={14} className="text-zinc-700 group-hover:text-indigo-400 transition-colors shrink-0"/>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button onClick={()=>setActiveView('friends')}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2">
                    <UserPlus size={15}/>
                    Zaproś znajomych
                  </button>
                )}
              </motion.div>
            </div>
          ) : activeView==='friends' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-14 border-b border-white/[0.06] flex items-center px-5 shrink-0 bg-[#0c0c11]/90 backdrop-blur-sm z-10">
                <Users size={17} className="text-indigo-400 mr-2.5"/>
                <h1 className="text-sm font-bold text-white">Znajomi</h1>
                {incoming.length > 0 && <span className="ml-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full leading-none shadow-lg shadow-rose-500/30">{incoming.length} nowe</span>}
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <div className="max-w-2xl mx-auto">

                  {/* ── Dodaj znajomego ── */}
                  <div className="mb-8">
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Dodaj znajomego</h2>
                    <div className="flex gap-2">
                      <input value={addFriendVal} onChange={e=>setAddFriendVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddFriend()} placeholder="Wpisz dokładną nazwę użytkownika..." className={`flex-1 ${gi} px-4 py-2.5 text-sm`}/>
                      <button onClick={handleAddFriend} disabled={!addFriendVal.trim()} className="bg-indigo-500 hover:bg-indigo-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 text-sm shrink-0 shadow-lg shadow-indigo-500/20"><UserPlus size={15}/> Dodaj</button>
                    </div>
                    {/* Podpowiedź wyszukiwarki */}
                    {friendSearchLoading && addFriendVal.trim().length >= 2 && (
                      <div className="mt-2 px-4 py-3 bg-white/[0.03] border border-white/[0.05] rounded-xl flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-zinc-500 shrink-0"/>
                        <span className="text-xs text-zinc-500">Szukam użytkownika...</span>
                      </div>
                    )}
                    {!friendSearchLoading && friendSearchResult && addFriendVal.trim().length >= 2 && (
                      <div className="mt-2 px-4 py-3 bg-white/[0.04] border border-indigo-500/25 rounded-xl flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img src={ava(friendSearchResult)} className="w-10 h-10 rounded-full object-cover" alt=""/>
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(friendSearchResult.status)} border-2 border-zinc-950 rounded-full`}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{friendSearchResult.username}</p>
                          <p className="text-xs text-zinc-500">{friendSearchResult.custom_status || friendSearchResult.status}</p>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide shrink-0">Znaleziono ✓</span>
                      </div>
                    )}
                    {!friendSearchLoading && !friendSearchResult && addFriendVal.trim().length >= 2 && (
                      <div className="mt-2 px-4 py-3 bg-white/[0.03] border border-white/[0.05] rounded-xl">
                        <p className="text-xs text-zinc-600">Nie znaleziono użytkownika „{addFriendVal.trim()}"</p>
                      </div>
                    )}
                  </div>

                  {/* ── Przychodzące zaproszenia ── */}
                  {incoming.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Przychodzące zaproszenia — {incoming.length}</h2>
                      <div className="flex flex-col gap-2">
                      {incoming.map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-rose-500/5 border border-rose-500/15 p-3.5 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <img src={ava({avatar_url: r.from_avatar, username: r.from_username})} className="w-10 h-10 rounded-2xl object-cover" alt=""/>
                            <div>
                              <p className="font-semibold text-white text-sm">{r.from_username}</p>
                              <p className="text-xs text-zinc-600">Chce dodać Cię do znajomych</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={()=>handleFriendReq(r.id,'accept')} title="Akceptuj" className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 active:scale-90 flex items-center justify-center transition-all"><Check size={15}/></button>
                            <button onClick={()=>handleFriendReq(r.id,'reject')} title="Odrzuć" className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 active:scale-90 flex items-center justify-center transition-all"><XIcon size={15}/></button>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  )}

                  {/* ── Wysłane zaproszenia ── */}
                  {outgoing.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Wysłane zaproszenia — {outgoing.length}</h2>
                      <div className="flex flex-col gap-2">
                      {outgoing.map(r => (
                        <div key={r.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] p-3.5 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <img src={ava({avatar_url: r.from_avatar, username: r.from_username})} className="w-10 h-10 rounded-2xl object-cover opacity-70" alt=""/>
                            <div>
                              <p className="font-semibold text-zinc-300 text-sm">{r.from_username}</p>
                              <p className="text-xs text-zinc-600">Oczekuje na odpowiedź</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wide">Oczekujące</span>
                        </div>
                      ))}
                      </div>
                    </div>
                  )}

                  {/* ── Lista znajomych ── */}
                  <div>
                    <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Wszyscy znajomi — {friends.length}</h2>
                    <div className="flex flex-col gap-1.5">
                    {friends.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.07] p-3.5 rounded-2xl transition-all duration-150 group">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={()=>openProfile(f)}>
                          <div className="relative"><img src={ava(f)} className="w-10 h-10 rounded-2xl object-cover" alt=""/><div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${sc(f.status)} border-2 border-[#0c0c11] rounded-full`}/></div>
                          <div><p className="font-semibold text-white text-sm">{f.username}</p><p className="text-xs text-zinc-600">{f.custom_status||f.status}</p></div>
                        </div>
                        <button onClick={()=>openDm(f.id)} title="Wyślij wiadomość" className={`w-8 h-8 rounded-xl ${gb} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-90`}><MessageCircle size={15}/></button>
                      </div>
                    ))}
                    </div>
                    {friends.length===0&&<p className="text-sm text-zinc-700 py-4">Brak znajomych. Dodaj kogoś powyżej!</p>}
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-5 bg-[#0c0c11]/95 backdrop-blur-sm z-10 shrink-0 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {activeView==='dms' ? (activeDm ? (
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img src={ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})} className="w-8 h-8 rounded-2xl object-cover shadow-sm" alt=""/>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${sc(activeDm.other_status)} border-2 border-[#0c0c11] rounded-full`}/>
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm leading-tight">{activeDm.other_username}</h3>
                        <p className="text-[11px] text-zinc-500 leading-tight capitalize">{activeDm.other_status||'offline'}</p>
                      </div>
                    </div>
                  ) : <h3 className="font-bold text-white text-sm">Wiadomości</h3>) : (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                        <Hash size={14} className="text-indigo-400"/>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">{activeCh?.name||activeChannel}</h3>
                        {activeCh?.description&&<p className="text-[11px] text-zinc-500 truncate hidden lg:block">{activeCh.description}</p>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeView==='dms'&&activeDm&&<>
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'voice')} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-150 active:scale-95"><Phone size={15}/></button>
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'video')} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all duration-150 active:scale-95"><Video size={15}/></button>
                    <div className="w-px h-4 bg-white/[0.06] mx-1"/>
                  </>}
                  {activeView==='servers'&&members.length>0&&(
                  <div className="hidden md:flex -space-x-2 mr-1">
                    {members.slice(0,4).map(m=>(
                      <img key={m.id} src={ava(m)} className="w-6 h-6 rounded-full border-2 border-[#0c0c11] object-cover hover:scale-110 transition-transform cursor-pointer" alt="" title={m.username}/>
                    ))}
                    {members.length>4&&<div className="w-6 h-6 rounded-full border-2 border-[#0c0c11] bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white">+{members.length-4}</div>}
                  </div>
                  )}
                  <button className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07] transition-all duration-150"><MoreHorizontal size={15}/></button>
                </div>
              </header>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 custom-scrollbar flex flex-col">
                {/* Loading skeleton */}
                {msgsLoading&&(
                  <div className="mt-auto flex flex-col gap-3 pb-2">
                    {[1,2,3,4].map(i=>(
                      <div key={i} className="flex gap-3.5 items-start animate-pulse">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.06] shrink-0"/>
                        <div className="flex flex-col gap-2 flex-1">
                          <div className="h-3 bg-white/[0.06] rounded-full w-24"/>
                          <div className={`h-3.5 bg-white/[0.05] rounded-full`} style={{width:`${50+i*12}%`}}/>
                          {i%2===0&&<div className="h-3.5 bg-white/[0.04] rounded-full w-2/3"/>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <AnimatePresence mode="wait" initial={false}>
                <motion.div key={`${activeServer}-${activeChannel}-${activeDmUserId}`}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="mt-auto flex flex-col gap-1">
                  {searchQuery.trim()&&(
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
                      <Search size={12} className="shrink-0"/>
                      <span>Wyniki wyszukiwania: <strong className="text-white">„{searchQuery}"</strong> — {messages.length} {messages.length===1?'wiadomość':messages.length<5?'wiadomości':'wiadomości'}</span>
                      <button onClick={()=>setSearchQuery('')} className="ml-auto text-indigo-400 hover:text-white transition-colors"><X size={12}/></button>
                    </div>
                  )}
                  {!msgsLoading&&!searchQuery.trim()&&<div className="text-center py-8 mb-3">
                    {activeView==='dms'&&activeDm ? (
                      <>
                        <img src={ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})} className="w-20 h-20 rounded-2xl mx-auto mb-4 border-4 border-zinc-950 object-cover shadow-2xl" alt=""/>
                        <h1 className="text-2xl font-bold text-white mb-1">{activeDm.other_username}</h1>
                        <p className="text-sm text-zinc-500">Początek Twojej rozmowy z <span className="text-zinc-400 font-medium">{activeDm.other_username}</span>.</p>
                      </>
                    ) : (
                      <>
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/20 mb-4 shadow-2xl">
                          <Hash size={30} className="text-indigo-400"/>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1"># {activeCh?.name||activeChannel}</h1>
                        <p className="text-sm text-zinc-500">Początek kanału <span className="text-zinc-400 font-medium">#{activeCh?.name||activeChannel}</span>.</p>
                      </>
                    )}
                  </div>}

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
                    // System message (call ended, etc.)
                    if (msg.sender_id === '__system__') {
                      return (
                        <React.Fragment key={msg.id}>
                          {showSep&&(
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-white/[0.07]"/>
                              <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest shrink-0">{sepLabel}</span>
                              <div className="flex-1 h-px bg-white/[0.07]"/>
                            </div>
                          )}
                          <div className="flex items-center justify-center my-3">
                            <div className="px-4 py-2 bg-white/[0.04] border border-white/[0.06] rounded-full text-xs text-zinc-500 flex items-center gap-2">
                              <Phone size={11} className="shrink-0 text-rose-400"/>
                              <span>{msg.content}</span>
                              <span className="text-zinc-700">{ft(msg.created_at)}</span>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    }
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
                          transition={{ delay: Math.min(idx * 0.012, 0.08), duration: 0.18, ease: 'easeOut' }}
                          className={`flex gap-3.5 group hover:bg-white/[0.03] px-3 rounded-2xl -mx-3 transition-all duration-100 ${compactMessages?'py-1':'py-2.5'}`}>
                          <img src={ava({avatar_url:msg.sender_avatar,username:msg.sender_username})} alt=""
                            onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar,status:(msg as MessageFull).sender_status})}
                            className="w-10 h-10 rounded-2xl object-cover shrink-0 cursor-pointer hover:opacity-80 hover:scale-105 transition-all mt-0.5"/>
                          <div className="flex-1 min-w-0">
                            {msg.reply_to_id&&msg.reply_content&&(
                              <div className="flex items-center gap-1.5 mb-1.5 text-xs text-zinc-500 border-l-2 border-zinc-600/50 pl-2.5 py-0.5">
                                <Reply size={9} className="text-zinc-500 shrink-0"/>
                                <span className="font-semibold text-zinc-500">{msg.reply_username}</span>
                                <span className="truncate text-zinc-600">{msg.reply_content}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="font-bold text-sm cursor-pointer hover:underline transition-opacity hover:opacity-80"
                                style={{ color: (msg as MessageFull).sender_role_color || '#ffffff' }}
                                onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar})}>
                                {msg.sender_username}
                              </span>
                              {(msg as MessageFull).sender_role&&(
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                  style={{
                                    color: (msg as MessageFull).sender_role_color || '#a1a1aa',
                                    background: `${(msg as MessageFull).sender_role_color || '#a1a1aa'}18`,
                                    border: `1px solid ${(msg as MessageFull).sender_role_color || '#a1a1aa'}30`,
                                  }}>
                                  {(msg as MessageFull).sender_role}
                                </span>
                              )}
                              <span className="text-[11px] text-zinc-600">{ft(msg.created_at)}</span>
                              {(msg as MessageFull).edited&&<span className="text-[10px] text-zinc-700 italic">(edytowano)</span>}
                            </div>
                            <p className="text-sm text-zinc-200 leading-relaxed break-words">{hlText(msg.content)}</p>
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
                  {/* Typing indicator — Discord-style at bottom of messages */}
                  {(()=>{
                    const typers = Object.entries(typingUsers).filter(([uid]) => uid !== currentUser?.id).map(([,n]) => n);
                    if (!typers.length) return null;
                    const txt = typers.length===1 ? `${typers[0]} pisze` : typers.length===2 ? `${typers[0]} i ${typers[1]} piszą` : `${typers.slice(0,-1).join(', ')} i ${typers.slice(-1)[0]} piszą`;
                    return (
                      <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:4}} transition={{duration:0.15}}
                        className="flex items-center gap-2 px-4 py-2">
                        <span className="flex gap-[3px] items-end pb-0.5">
                          {[0,1,2].map(i=>(
                            <span key={i} className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce inline-block" style={{animationDelay:`${i*160}ms`,animationDuration:'0.8s'}}/>
                          ))}
                        </span>
                        <span className="text-[12px] text-zinc-400 font-medium">{txt}</span>
                      </motion.div>
                    );
                  })()}
                  <div ref={bottomRef}/>
                </motion.div>
                </AnimatePresence>
              </div>

              {/* Input */}
              <div className="shrink-0 px-4 md:px-6 pb-5 pt-3 bg-[#0c0c11] border-t border-white/[0.05]">
                {/* Reply / attach previews */}
                <AnimatePresence>
                  {replyTo&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                      className="flex items-center justify-between bg-[#1a1a26]/70 border border-white/[0.07] rounded-xl px-3 py-1.5 mb-2 text-xs overflow-hidden">
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
                {(()=>{
                  const isDmView = activeView==='dms' && !!activeDmUserId;
                  const isFriend = !isDmView || friends.some(f => f.id === activeDmUserId);
                  if (!isFriend) return (
                    <div className="flex items-center justify-center gap-2.5 py-3 px-4 bg-zinc-900/60 border border-white/[0.06] rounded-xl text-zinc-500 text-sm">
                      <Lock size={14} className="text-zinc-600 shrink-0"/>
                      <span>Możesz pisać tylko do znajomych — dodaj tę osobę do znajomych, aby wysłać wiadomość.</span>
                    </div>
                  );
                  return (
                    <form onSubmit={handleSend}>
                      <div className="flex items-center gap-3 bg-[#1a1a26] border border-white/[0.08] rounded-2xl px-4 py-3.5 hover:border-white/[0.12] focus-within:border-indigo-500/40 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all duration-200">
                        <input type="file" ref={attachRef} onChange={handleAttach} accept="image/*" className="hidden"/>
                        <button type="button" onClick={()=>attachRef.current?.click()}
                          className="w-7 h-7 flex items-center justify-center rounded-xl text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all shrink-0 active:scale-90">
                          <Plus size={16}/>
                        </button>
                        <input ref={msgInputRef} type="text" value={msgInput}
                          onChange={e=>{
                            const v=e.target.value; setMsgInput(v);
                            if(activeChannel&&activeView==='servers'){
                              if(v.trim()){
                                getSocket()?.emit('typing_start',activeChannel);
                                if(typingEmitTimerRef.current) clearTimeout(typingEmitTimerRef.current);
                                typingEmitTimerRef.current=setTimeout(()=>getSocket()?.emit('typing_stop',activeChannel),2000);
                              } else {
                                if(typingEmitTimerRef.current){clearTimeout(typingEmitTimerRef.current);typingEmitTimerRef.current=null;}
                                getSocket()?.emit('typing_stop',activeChannel);
                              }
                            }
                          }}
                          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey) handleSend(e as any); }}
                          placeholder={activeView==='dms'&&activeDm?`Wiadomość do ${activeDm.other_username}...`:`Wiadomość w #${activeCh?.name||''}...`}
                          className="flex-1 bg-transparent text-[13px] text-zinc-200 placeholder-zinc-600 outline-none min-w-0"/>
                        <div className="relative shrink-0">
                          <button type="button" onClick={() => setShowEmojiPicker(v => !v)}
                            className={`transition-all active:scale-90 ${showEmojiPicker ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                            <Smile size={17}/>
                          </button>
                          {showEmojiPicker && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmojiPicker(false)}/>}
                        </div>
                        <button type="submit" disabled={(!msgInput.trim()&&!attachFile)||sending}
                          className="w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all duration-150 active:scale-90 shrink-0 shadow-lg shadow-indigo-500/25">
                          {sending?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>}
                        </button>
                      </div>
                    </form>
                  );
                })()}
              </div>
            </>
          )}
        </section>

        {/* RIGHT — Live voice + Activity */}
        <aside className="hidden xl:flex w-64 shrink-0 flex-col gap-0 bg-[#12121a] border-l border-white/[0.06] overflow-y-auto custom-scrollbar">
          {/* ─ LIVE VOICE BLOCK ─ */}
          {activeView==='servers'&&(()=>{
            // find first voice channel on current server with users
            const allVoiceChs = serverFull?.categories.flatMap(c=>c.channels.filter(ch=>ch.type==='voice'))||[];
            const liveCh = allVoiceChs.find(ch=>(voiceUsers[ch.id]||[]).length>0);
            const liveUsers = liveCh ? (voiceUsers[liveCh.id]||[]) : [];
            // Only show call block if the active call belongs to THIS server
            const callOnThisServer = activeCall?.channelId && activeCall?.serverId===activeServer;
            if(!liveCh&&!callOnThisServer) return null;
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
          {activeView==='servers'&&(
            <div className="px-4 py-4 border-b border-white/[0.07] shrink-0">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Aktywność</h3>
              {serverActivity.length>0 ? (
                <div className="flex flex-col gap-1.5">
                  {serverActivity.slice(0,8).map(a=>(
                    <div key={a.id} className="flex items-start gap-2.5 bg-white/[0.03] rounded-2xl px-3 py-2.5 border border-white/[0.05] hover:bg-white/[0.05] transition-colors">
                      <span className="text-sm shrink-0 leading-none mt-0.5">{a.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-zinc-300 leading-snug">{a.text}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{ft(a.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-700 italic">Brak aktywności na serwerze</p>
              )}
            </div>
          )}

          {/* ─ MEMBERS ONLINE / OFFLINE ─ */}
          {activeView==='servers'&&members.length>0&&(()=>{
            const online  = members.filter(m=>m.status==='online'||m.status==='idle'||m.status==='dnd');
            const offline = members.filter(m=>m.status==='offline'||!m.status);
            return (
              <div className="px-3 py-4 flex-1 overflow-y-auto custom-scrollbar">
                {online.length>0&&(
                  <div className="mb-5">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2.5 px-1">
                      Online — {online.length}
                    </h3>
                    <div className="flex flex-col gap-0.5">
                      {online.map(m=>(
                        <div key={m.id} className="flex items-center gap-2.5 cursor-pointer group px-2.5 py-2 rounded-xl hover:bg-white/[0.06] transition-all" onClick={()=>openProfile(m)}>
                          <div className="relative shrink-0">
                            <img src={ava(m)} className="w-8 h-8 rounded-xl object-cover" alt=""/>
                            <div className={`absolute -bottom-px -right-px w-2.5 h-2.5 ${sc(m.status)} border-2 border-[#111111] rounded-full`}/>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold truncate group-hover:opacity-90 transition-colors leading-tight"
                              style={{ color: m.roles?.[0]?.color || '#d4d4d8' }}>
                              {m.username}
                            </p>
                            {m.role_name&&<p className="text-[10px] text-zinc-600 truncate leading-tight">{m.role_name}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {offline.length>0&&(
                  <div>
                    <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2.5 px-1">
                      Offline — {offline.length}
                    </h3>
                    <div className="flex flex-col gap-0.5">
                      {offline.map(m=>(
                        <div key={m.id} className="flex items-center gap-2.5 cursor-pointer group px-2.5 py-2 rounded-xl hover:bg-white/[0.05] transition-all" onClick={()=>openProfile(m)}>
                          <div className="relative shrink-0">
                            <img src={ava(m)} className="w-8 h-8 rounded-xl object-cover opacity-35" alt=""/>
                            <div className="absolute -bottom-px -right-px w-2.5 h-2.5 bg-zinc-600 border-2 border-[#111111] rounded-full"/>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium truncate group-hover:opacity-70 transition-colors leading-tight"
                              style={{ color: m.roles?.[0]?.color ? `${m.roles[0].color}80` : '#52525b' }}>
                              {m.username}
                            </p>
                            {m.role_name&&<p className="text-[10px] text-zinc-700 truncate leading-tight">{m.role_name}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─ DM PARTNER BIO PANEL ─ */}
          {activeView==='dms'&&activeDm&&dmPartnerProfile&&(
            <div className="flex flex-col">
              {/* Banner */}
              <div className="h-20 relative overflow-hidden shrink-0">
                {dmPartnerProfile.banner_url ? (
                  <img src={dmPartnerProfile.banner_url} className="w-full h-full object-cover" alt=""/>
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${dmPartnerProfile.banner_color||'from-indigo-600 via-purple-600 to-pink-600'}`}/>
                )}
              </div>
              {/* Avatar */}
              <div className="px-4 pb-4 border-b border-white/[0.07]">
                <div className="relative inline-block -mt-7 mb-3">
                  <img src={ava(dmPartnerProfile)} className="w-14 h-14 rounded-2xl border-4 border-[#111111] object-cover" alt=""/>
                  <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 ${sc(activeDm.other_status)} border-2 border-[#111111] rounded-full`}/>
                </div>
                <h3 className="text-sm font-bold text-white leading-tight">{dmPartnerProfile.username}</h3>
                {activeDm.other_custom_status&&(
                  <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{activeDm.other_custom_status}</p>
                )}
              </div>
              {/* Info */}
              <div className="p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1">
                {dmPartnerProfile.bio&&(
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">O mnie</h4>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">{dmPartnerProfile.bio}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Dołączył/a</h4>
                  <p className="text-[12px] text-zinc-400">
                    {new Date(dmPartnerProfile.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {typeof dmPartnerProfile.mutual_friends_count === 'number' && dmPartnerProfile.mutual_friends_count > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Wspólni znajomi</h4>
                    <p className="text-[12px] text-zinc-400 flex items-center gap-1.5">
                      <Users size={11} className="text-indigo-400"/>
                      {dmPartnerProfile.mutual_friends_count} wspólnych znajomych
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* ── MODALS ─────────────────────────────────────────────────────── */}

      {/* Server context menu */}
      {srvContextMenu&&(
        <>
          <div className="fixed inset-0 z-[90]" onClick={()=>setSrvContextMenu(null)}/>
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
            style={{position:'fixed',left:srvContextMenu.x,top:srvContextMenu.y}}
            className="z-[91] bg-[#1a1a26] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 py-1.5 min-w-[180px] overflow-hidden">
            {(srvContextMenu.srv.owner_id===currentUser?.id ||
              (srvContextMenu.srv.id===activeServer && (serverFull?.my_role==='Admin'||serverFull?.my_role==='Owner'))) && (<>
              <button onClick={()=>{ setSrvContextMenu(null); setSrvSettTab('overview'); setSrvSettOpen(true); setActiveServer(srvContextMenu.srv.id); setActiveView('servers'); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors text-left">
                <Settings2 size={13} className="text-zinc-500 shrink-0"/>
                Ustawienia serwera
              </button>
              <div className="mx-3 my-1 h-px bg-white/[0.06]"/>
            </>)}
            {srvContextMenu.srv.owner_id===currentUser?.id ? (
              <button onClick={()=>{ setDeleteSrvConfirm({id:srvContextMenu.srv.id,name:srvContextMenu.srv.name}); setSrvContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-rose-400 hover:bg-rose-500/10 transition-colors text-left">
                <Trash2 size={13} className="shrink-0"/>
                Usuń serwer
              </button>
            ) : (
              <button onClick={()=>handleLeaveServer(srvContextMenu.srv.id)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-rose-400 hover:bg-rose-500/10 transition-colors text-left">
                <LogOut size={13} className="shrink-0"/>
                Opuść serwer
              </button>
            )}
          </motion.div>
        </>
      )}

      {/* Delete server confirmation */}
      <AnimatePresence>
        {deleteSrvConfirm&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[92] p-4"
            onClick={()=>setDeleteSrvConfirm(null)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-2xl w-full max-w-sm p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-rose-400"/>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Usuń serwer</h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Ta operacja jest nieodwracalna</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                Czy na pewno chcesz usunąć serwer <span className="font-semibold text-white">{deleteSrvConfirm.name}</span>?
                Wszystkie kanały, wiadomości i dane zostaną trwale usunięte.
              </p>
              <div className="flex gap-2.5">
                <button onClick={()=>setDeleteSrvConfirm(null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${gb} transition-all`}>
                  Anuluj
                </button>
                <button onClick={()=>handleDeleteServer(deleteSrvConfirm.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-white transition-all">
                  Usuń serwer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={()=>{ setCreateSrvOpen(false); setCreateSrvIconFile(null); setCreateSrvIconPreview(null); setCreateSrvName(''); setJoinCode(''); }}>
            <motion.div initial={{scale:0.93,opacity:0,y:16}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.93,opacity:0,y:16}} transition={{type:'spring',stiffness:380,damping:32}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl w-full max-w-sm overflow-hidden`}>

              {/* Mode tabs */}
              <div className="flex border-b border-white/[0.06]">
                {(['create','join'] as const).map(m=>(
                  <button key={m} onClick={()=>setCreateSrvMode(m)}
                    className={`flex-1 py-4 text-sm font-bold transition-all relative ${createSrvMode===m?'text-white':'text-zinc-500 hover:text-zinc-300'}`}>
                    {m==='create'?'Utwórz serwer':'Dołącz do serwera'}
                    {createSrvMode===m&&<motion.div layoutId="srv-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" transition={{type:'spring',stiffness:400,damping:30}}/>}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {createSrvMode==='create' ? (
                  <motion.div key="create" initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:16}} transition={{duration:0.18}}
                    className="flex flex-col">
                    {/* Gradient preview banner with avatar */}
                    <div className="relative h-28 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 overflow-hidden">
                      <motion.div animate={{scale:[1,1.15,1]}} transition={{duration:6,repeat:Infinity,ease:'easeInOut'}}
                        className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10"/>
                      <motion.div animate={{scale:[1,1.2,1]}} transition={{duration:8,repeat:Infinity,ease:'easeInOut',delay:2}}
                        className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10"/>
                      {/* Icon centered in banner */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button onClick={()=>createSrvIconRef.current?.click()}
                          className="relative w-20 h-20 rounded-2xl overflow-hidden group cursor-pointer border-4 border-white/20 hover:border-white/50 transition-all shadow-2xl"
                          style={{background: createSrvIconPreview ? 'transparent' : 'rgba(0,0,0,0.4)'}}>
                          {createSrvIconPreview
                            ? <img src={createSrvIconPreview} className="w-full h-full object-cover" alt=""/>
                            : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white/70 group-hover:text-white transition-colors">
                                <Upload size={20}/>
                                <span className="text-[10px] font-bold">Logo</span>
                              </div>
                          }
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Upload size={16} className="text-white"/>
                          </div>
                        </button>
                      </div>
                    </div>
                    <input ref={createSrvIconRef} type="file" accept="image/*" className="hidden"
                      onChange={e=>{ const f=e.target.files?.[0]; if(f){setCreateSrvIconFile(f);setCreateSrvIconPreview(URL.createObjectURL(f));} e.target.value=''; }}/>

                    <div className="p-6 flex flex-col gap-5">
                      {/* Server name */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Nazwa serwera</label>
                        <input
                          value={createSrvName}
                          onChange={e=>setCreateSrvName(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter' && createSrvName.trim()) handleCreateServer(); }}
                          placeholder="Mój świetny serwer..."
                          className={`${gi} rounded-2xl px-4 py-3 text-sm w-full`}
                          autoFocus
                        />
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-2.5">
                        <button onClick={()=>{ setCreateSrvOpen(false); setCreateSrvIconFile(null); setCreateSrvIconPreview(null); setCreateSrvName(''); }}
                          className={`flex-1 ${gb} py-2.5 rounded-2xl text-sm font-semibold transition-all`}>Anuluj</button>
                        <button onClick={handleCreateServer} disabled={!createSrvName.trim()}
                          className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-2xl transition-all shadow-lg shadow-indigo-500/25">
                          Utwórz →
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="join" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.18}}
                    className="p-6 flex flex-col gap-5">
                    {/* Illustration */}
                    <div className="flex flex-col items-center gap-3 py-2">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-indigo-500/25 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                        <Users size={28} className="text-indigo-400"/>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">Masz zaproszenie?</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Wpisz kod zaproszenia poniżej</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Kod zaproszenia</label>
                      <input
                        value={joinCode}
                        onChange={e=>setJoinCode(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter' && joinCode.trim()) handleJoinServer(); }}
                        placeholder="abc123xyz..."
                        className={`${gi} rounded-2xl px-4 py-3 text-sm w-full font-mono tracking-wider`}
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-2.5">
                      <button onClick={()=>{ setCreateSrvOpen(false); setJoinCode(''); }}
                        className={`flex-1 ${gb} py-2.5 rounded-2xl text-sm font-semibold transition-all`}>Anuluj</button>
                      <button onClick={handleJoinServer} disabled={!joinCode.trim()}
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-2xl transition-all shadow-lg shadow-indigo-500/25">
                        Dołącz →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{background:r.color}}/>
                          <span className="text-sm font-semibold text-white truncate">{r.name}</span>
                          {r.is_default&&(
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 text-amber-400 bg-amber-500/10 border border-amber-500/20">
                              Domyślny
                            </span>
                          )}
                          <span className="text-xs text-zinc-600 shrink-0">{(r.permissions||[]).length} uprawnień</span>
                        </div>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={()=>openEditRole(r)} className={`w-7 h-7 ${gb} rounded-lg flex items-center justify-center`}><Edit3 size={12}/></button>
                          {!r.is_default&&(
                            <button onClick={()=>handleDeleteRole(r.id)} className="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center"><Trash2 size={12}/></button>
                          )}
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
                                {roles.map(r=><option key={r.id} value={r.name}>{r.name}{r.is_default?' ★':''}</option>)}
                                {!roles.some(r=>r.name==='Member')&&<option value="Member">Member</option>}
                                {!roles.some(r=>r.name==='Admin')&&<option value="Admin">Admin</option>}
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
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Status niestandardowy</label>
                        <div className="relative">
                          <input value={editProf?.custom_status||''} onChange={e=>setEditProf((p:any)=>({...p,custom_status:e.target.value}))} placeholder="Np. Pracuję, Na przerwie..." className={`w-full ${gi} rounded-xl px-4 py-3 text-sm pr-10`}/>
                          {editProf?.custom_status&&(
                            <button type="button" onClick={()=>setEditProf((p:any)=>({...p,custom_status:''}))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors">
                              <X size={14}/>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-700 mt-1">Ten tekst pojawi się pod Twoją nazwą w pasku bocznym</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1.5 block font-bold">Bio</label>
                        <textarea value={editProf?.bio||''} onChange={e=>setEditProf((p:any)=>({...p,bio:e.target.value}))} rows={3} placeholder="Napisz coś o sobie..." className={`w-full ${gi} rounded-xl px-4 py-3 text-sm resize-none`}/>
                      </div>
                      <button onClick={()=>handleSaveProfile({ closeProfileModal: false })}
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

                      {/* Accent color */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 block font-bold">Kolor akcentu</label>
                        <div className="grid grid-cols-5 gap-2">
                          {([
                            {key:'indigo',  label:'Indigo',    hex:'#6366f1', cls:'bg-indigo-500'},
                            {key:'violet',  label:'Fioletowy', hex:'#8b5cf6', cls:'bg-violet-500'},
                            {key:'pink',    label:'Różowy',    hex:'#ec4899', cls:'bg-pink-500'},
                            {key:'blue',    label:'Niebieski', hex:'#3b82f6', cls:'bg-blue-500'},
                            {key:'emerald', label:'Zielony',   hex:'#10b981', cls:'bg-emerald-500'},
                          ] as const).map(c=>(
                            <button key={c.key} onClick={()=>saveAccentColor(c.key)}
                              title={c.label}
                              className={`h-10 rounded-xl ${c.cls} border-2 transition-all hover:scale-105 flex items-center justify-center ${accentColor===c.key?'border-white scale-105':'border-transparent'}`}>
                              {accentColor===c.key&&<Check size={14} className="text-white"/>}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-700 mt-2">Zmiana dotyczy podświetlenia UI — pełny motyw wkrótce</p>
                      </div>

                      {/* Message density */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 block font-bold">Gęstość wiadomości</label>
                        <div className="flex flex-col gap-2">
                          {([
                            {key:false, label:'Komfortowy', desc:'Większe odstępy, łatwiejsze czytanie'},
                            {key:true,  label:'Kompaktowy',  desc:'Mniejsze odstępy, więcej wiadomości'},
                          ] as const).map(opt=>(
                            <button key={String(opt.key)} onClick={()=>saveCompactMessages(opt.key)}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${compactMessages===opt.key?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                              <div className="text-left">
                                <p className="font-semibold">{opt.label}</p>
                                <p className="text-[11px] text-zinc-600 mt-0.5">{opt.desc}</p>
                              </div>
                              {compactMessages===opt.key&&<Check size={13} className="text-indigo-400 shrink-0"/>}
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
                      {([
                        {key:'privacy_status_visible',  label:'Status widoczny dla innych',     desc:'Inni widzą czy jesteś online/offline/zaraz wracam'},
                        {key:'privacy_typing_visible',  label:'Podgląd "pisze..."',              desc:'Inni widzą animację gdy piszesz wiadomość'},
                        {key:'privacy_read_receipts',   label:'Potwierdzenia odczytu',           desc:'Nadawca widzi że przeczytałeś wiadomość prywatną'},
                        {key:'privacy_friend_requests', label:'Zaproszenia od nieznajomych',     desc:'Osoby spoza twoich serwerów mogą cię zaprosić'},
                      ] as const).map(opt=>{
                        const on = getPrivacy(opt.key);
                        return (
                          <div key={opt.key} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-3.5 hover:border-white/[0.09] transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-sm font-medium text-white">{opt.label}</p>
                              <p className="text-xs text-zinc-600 mt-0.5">{opt.desc}</p>
                            </div>
                            <button onClick={()=>togglePrivacy(opt.key)}
                              className={`w-11 h-6 rounded-full transition-all shrink-0 relative ${on?'bg-indigo-500':'bg-zinc-700'}`}>
                              <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"
                                style={{left: on ? 'calc(100% - 1.375rem)' : '0.125rem'}}/>
                            </button>
                          </div>
                        );
                      })}
                      <div className="mt-2 p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                        <h4 className="text-sm font-bold text-rose-400 mb-1">Strefa zagrożenia</h4>
                        <p className="text-xs text-zinc-500 mb-3">Trwałe akcje których nie można cofnąć</p>
                        <button onClick={()=>addToast('Usuń konto — skontaktuj się z administratorem','warn')}
                          className="text-sm font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 px-4 py-2 rounded-xl transition-all">
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

      {/* ── RECONNECTING BANNER ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isAuthenticated && !isConnected && (
          <motion.div initial={{opacity:0,y:-40}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-40}} transition={{duration:0.3,ease:[0.16,1,0.3,1]}}
            className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500/95 backdrop-blur-sm text-black text-xs font-bold tracking-wide uppercase">
            <div className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin shrink-0"/>
            Łączenie z serwerem…
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST CONTAINER ─────────────────────────────────────────────── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none" style={{minWidth:'20rem',maxWidth:'28rem'}}>
        <AnimatePresence>
          {toasts.map(t => {
            const toastIcon = t.type==='success'?<CheckCircle2 size={15}/>:t.type==='error'?<AlertCircle size={15}/>:t.type==='warn'?<AlertTriangle size={15}/>:<Info size={15}/>;
            const toastCls = t.type==='success'?'bg-emerald-950/90 border-emerald-500/30 text-emerald-300 shadow-emerald-900/30':t.type==='error'?'bg-rose-950/90 border-rose-500/30 text-rose-300 shadow-rose-900/30':t.type==='warn'?'bg-amber-950/90 border-amber-500/30 text-amber-300 shadow-amber-900/30':'bg-[#1a1a26]/95 border-white/[0.1] text-zinc-300 shadow-black/50';
            return (
              <motion.div key={t.id} initial={{opacity:0,y:-20,scale:0.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,scale:0.9,y:-12}} transition={{duration:0.25,ease:[0.16,1,0.3,1]}}
                className={`pointer-events-auto w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-2xl ${toastCls}`}>
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
          <motion.div initial={{opacity:0,scale:0.85,y:24}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.85,y:20}}
            transition={{duration:0.3,ease:[0.16,1,0.3,1]}}
            className={`fixed bottom-6 right-6 z-[150] ${gm} p-4 flex items-center gap-3 min-w-60 shadow-2xl border-indigo-500/10`}>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]"/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {activeCall.type==='voice_channel'?activeCall.channelName:activeCall.username}
              </p>
              <p className="text-[10px] text-emerald-400/80 font-mono">{fmtDur(callDuration)}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={toggleMute} title="Mikrofon" className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${activeCall.isMuted?'bg-rose-500 text-white shadow-lg shadow-rose-500/30':'bg-white/[0.07] text-zinc-400 hover:text-white hover:bg-white/[0.12]'}`}>
                {activeCall.isMuted?<MicOff size={13}/>:<Mic size={13}/>}
              </button>
              <button onClick={()=>setShowCallPanel(true)} title="Powróć do rozmowy" className="w-8 h-8 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:scale-90 flex items-center justify-center text-white transition-all shadow-lg shadow-indigo-500/30">
                <Phone size={13}/>
              </button>
              <button onClick={hangupCall} title="Rozłącz" className="w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-400 active:scale-90 flex items-center justify-center text-white transition-all shadow-lg shadow-rose-500/30">
                <PhoneOff size={13}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── INCOMING CALL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div initial={{opacity:0,x:100,scale:0.95}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:80,scale:0.95}}
            transition={{duration:0.35,ease:[0.16,1,0.3,1]}}
            className={`fixed top-20 right-6 z-[160] ${gm} p-5 min-w-[17rem] shadow-2xl border-indigo-500/25`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative shrink-0">
                <img src={incomingCall.from.avatar_url||`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(incomingCall.from.username)}&size=40`} className="w-11 h-11 rounded-2xl object-cover shadow-lg" alt=""/>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/40">
                  {incomingCall.type==='video'?<Video size={10} className="text-white"/>:<Phone size={10} className="text-white"/>}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{incomingCall.from.username}</p>
                <p className="text-xs text-zinc-500 animate-pulse">{incomingCall.type==='video'?'Połączenie wideo...':'Połączenie głosowe...'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={async ()=>{
                // Acquire mic before notifying caller — ensures localStreamRef is set when offer arrives
                stopIncomingRing();
                playCallAccepted();
                await acquireMic(selMic || undefined);
                acceptCall(incomingCall.conversation_id, incomingCall.from.id);
                setActiveCall({type: incomingCall.type==='video'?'dm_video':'dm_voice', userId: incomingCall.from.id, username: incomingCall.from.username, isMuted:false,isDeafened:false,isCameraOn:false,isScreenSharing:false});
                setActiveDmUserId(incomingCall.from.id); setActiveView('dms'); setShowCallPanel(true); setIncomingCall(null);
              }} className="flex-1 h-9 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-white font-semibold flex items-center justify-center gap-1.5 text-sm transition-colors">
                <Phone size={14}/> Odbierz
              </button>
              <button onClick={()=>{stopIncomingRing(); playCallEnded(); rejectCall(incomingCall.from.id); setIncomingCall(null);}}
                className="flex-1 h-9 bg-rose-500 hover:bg-rose-400 rounded-xl text-white font-semibold flex items-center justify-center gap-1.5 text-sm transition-colors">
                <PhoneOff size={14}/> Odrzuć
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Welcome Modal (nowy użytkownik) ────────────────────────── */}
      <AnimatePresence>
        {showWelcome && currentUser && (
          <WelcomeModal username={currentUser.username} onClose={() => setShowWelcome(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}
