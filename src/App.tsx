import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Hash, Volume2, Video, Settings, Plus, Search, Bell, Users,
  Mic, MicOff, VolumeX, Smile, Paperclip, Send, Image, Reply,
  Menu, X, Edit3, MessageCircle, Minimize2, Maximize2,
  Shield, Trash2, Settings2, UserPlus, Check, X as XIcon,
  LogOut, Loader2, Lock, Phone, PhoneOff, MessageSquare, Upload, MoreHorizontal, ScreenShare,
  UserX, UserCheck, UserMinus,
  CheckCircle2, AlertCircle, Info, AlertTriangle, PartyPopper, Sparkles, Zap, Globe,
  Eye, EyeOff, Megaphone, FileText, ChevronLeft, ChevronRight, ArrowLeft,
  Clock, Pin, PinOff, Activity, AtSign, BadgeCheck, Crown, LayoutDashboard,
  Code2, FlaskConical, ShieldCheck, Hammer, Award, CalendarDays, Quote,
  GripVertical, BarChart2, Server, Database,
  Music, Gamepad2, ExternalLink, Link2, Link2Off, Film, PhoneIncoming, PhoneMissed,
  type LucideIcon
} from 'lucide-react';
import {
  auth, users, serversApi, channelsApi, messagesApi, dmsApi, friendsApi, forumApi, adminApi,
  gamesApi, spotifyApi, twitchApi, steamApi, twoFactorApi,
  emojisApi, notesApi, pollsApi, automationsApi, dmPinApi, pushApi,
  uploadFile, setToken, clearToken, getToken,
  type UserProfile, type ServerData, type ServerFull, type ServerRole,
  type ChannelData, type MessageFull, type DmConversation,
  type DmMessageFull, type FriendEntry, type FriendRequest,
  type ServerMember, type ForumPost, type ForumReply, type ServerBan,
  type Badge, type AdminStats, type AdminUser, type AdminServer, type AdminOverview,
  type FavoriteGame, type SpotifyData, type SpotifyTrack, type SpotifyJamSession, type SpotifyVoiceDj, type TwitchData, type TwitchStream, type SteamData, type SteamGame,
  type TwoFactorStatus, type LoginResult, ApiError,
  type ServerEmoji, type PollData, type ServerAutomation, type AutomationTrigger, type AutomationAction, type AutomationActionType,
} from './api';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  makePeerConnection, attachRemoteAudio, attachRemoteScreenAudio, detachRemoteAudio,
  muteAllRemote, setRemoteVolume, setRemoteScreenVolume, muteRemoteUser, muteRemoteScreenStream,
  setOutputDevice, watchSpeaking, getMediaDevices, applyNoiseGate, type NoisePipeline,
} from './webrtc';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
// Configure marked once — GFM mode, line-break aware
marked.use({ gfm: true });

// ─── Brand SVG icons ──────────────────────────────────────────────────────────
const SpotifyIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Spotify">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);
const TwitchIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Twitch">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
  </svg>
);
const SteamIcon = ({ size = 14, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Steam">
    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.029 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
  </svg>
);

// ─── Glass constants ──────────────────────────────────────────────────────────
const gp = 'glass-panel';
const gm = 'glass-modal rounded-3xl'; // modals: high opacity, no bleed-through
const gi = 'bg-white/[0.06] border border-white/[0.08] text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all rounded-xl';
const gb = 'glass-panel glass-panel-hover text-zinc-400 hover:text-white transition-all active:scale-95';

const PERMISSIONS = [
  { id: 'administrator',    label: 'Administrator',           desc: 'Pełne uprawnienia — omiija wszystkie inne ograniczenia' },
  { id: 'manage_server',    label: 'Zarządzaj serwerem',      desc: 'Edytuj ustawienia, nazwę, banner serwera' },
  { id: 'manage_channels',  label: 'Zarządzaj kanałami',      desc: 'Twórz, edytuj i usuwaj kanały oraz kategorie' },
  { id: 'manage_roles',     label: 'Zarządzaj rolami',        desc: 'Twórz i edytuj role, przypisuj je członkom' },
  { id: 'kick_members',     label: 'Wyrzucaj członków',       desc: 'Wyrzucaj członków z serwera' },
  { id: 'ban_members',      label: 'Banuj członków',          desc: 'Permanentnie banuj i odbanowuj użytkowników' },
  { id: 'create_invites',   label: 'Twórz zaproszenia',       desc: 'Twórz linki zaproszeniowe (domyślnie wszyscy)' },
  { id: 'send_messages',    label: 'Wysyłaj wiadomości',      desc: 'Wysyłaj wiadomości na kanałach (domyślnie wszyscy)' },
  { id: 'attach_files',     label: 'Wysyłaj pliki',           desc: 'Wysyłaj zdjęcia i załączniki (domyślnie wszyscy)' },
  { id: 'manage_messages',  label: 'Zarządzaj wiadomościami', desc: 'Usuwa wiadomości innych, pisze na kanałach ogłoszeń' },
  { id: 'mention_everyone', label: 'Użyj @everyone',          desc: 'Pinguje wszystkich użytkowników na serwerze' },
  { id: 'pin_messages',     label: 'Przypinaj wiadomości',    desc: 'Przypinaj i odpinaj wiadomości na kanałach' },
  { id: 'read_messages',    label: 'Czytaj wiadomości',       desc: 'Dostęp do czytania wiadomości (domyślnie wszyscy)' },
];
const ROLE_COLORS = ['#5865f2','#eb459e','#ed4245','#faa61a','#57f287','#1abc9c','#3498db','#9b59b6'];
const AVATAR_EFFECTS = [
  { key: 'none',    label: 'Brak',       desc: 'Avatar bez efektów' },
  { key: 'glow',    label: 'Poświata',   desc: 'Subtelna poświata w kolorze akcentu' },
  { key: 'pulse',   label: 'Pulsowanie', desc: 'Pulsująca animowana poświata' },
  { key: 'neon',    label: 'Neon',       desc: 'Ostre neonowe obramowanie' },
  { key: 'rainbow',  label: 'Tęcza',   desc: 'Tęczowa animowana poświata' },
  { key: 'vortex-cw',label: 'Vortex',  desc: 'Dwa wirujące łuki na hover, avatar wciągany do środka' },
  { key: 'portal',   label: 'Portal',  desc: 'Brama Gwiezdna — pierścień + błysk portalu na hover' },
  { key: 'quantum',  label: 'Quantum', desc: 'Dwa pierścienie w przestrzeni 3D wirujące na hover' },
  { key: 'glitch',   label: 'Glitch',  desc: 'Cyfrowa usterka z rozszczepionymi kolorami RGB' },
  { key: 'scan',     label: 'Scan',    desc: 'Cybernetyczne skanowanie z wiązką lasera' },
  { key: 'katana',      label: 'Katana',  desc: 'Cięcie przekątne z czerwoną świecącą klingą na hover' },
  { key: 'liquid-morph', label: 'Liquid',  desc: 'Organiczny płynny kształt z gradientową poświatą' },
  { key: 'radar-sweep',  label: 'Radar',   desc: 'Zielony radar wojskowy z wirującą wiązką na hover' },
  { key: 'vhs',          label: 'VHS',        desc: 'Retro efekt magnetowidu — RGB split + linia śledzenia' },
  { key: 'toxic-slime',  label: 'Toxic Slime', desc: 'Toksyczny zielony śluz kapiący z avatara' },
  { key: 'sakura',       label: 'Sakura',      desc: 'Różowe płatki wiśni opadające wokół avatara' },
  { key: 'demon',        label: 'Demon',       desc: 'Czerwone rogi demona pojawiające się na hover' },
  { key: 'neon-cat',     label: 'Neon Cat',    desc: 'Neonowe uszka kota z falującą animacją' },
];

const GRADIENTS = [
  'from-indigo-600 via-purple-600 to-pink-600',
  'from-rose-500 via-red-500 to-orange-500',
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-blue-600 via-indigo-600 to-violet-600',
  'from-amber-500 via-orange-500 to-red-500',
  'from-zinc-700 via-zinc-600 to-zinc-700',
];
// Deterministic banner gradient from user ID (fallback when no custom banner)
const getBannerGradient = (userId: string): string => {
  const hash = (userId || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
};

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
const fmtGameDur = (startMs: number): string => {
  const sec = Math.floor((Date.now() - startMs) / 1000);
  if (sec < 60) return 'Przed chwilą';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Toast = { id: string; msg: string; type: 'info'|'success'|'error'|'warn'; onConfirm?: ()=>void; onClick?: ()=>void; avatar?: string|null; senderName?: string };
type CallState = {
  type: 'voice_channel' | 'dm_voice' | 'dm_video';
  channelId?: string; channelName?: string; serverId?: string;
  userId?: string; username?: string; avatarUrl?: string | null;
  isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean;
};
type VoiceUser = { id: string; username: string; avatar_url: string|null; status: string };
type NotificationEntry = {
  id: string;
  from_username: string;
  server_id: string;
  server_name: string;
  channel_id: string;
  channel_name: string;
  content: string;
  type: 'mention' | 'everyone';
  created_at: string;
  read: boolean;
};

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

function EmojiPicker({ onSelect, onClose, serverEmojis }: { onSelect: (e: string) => void; onClose: () => void; serverEmojis?: ServerEmoji[] }) {
  const [cat, setCat] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const hasServerEmojis = serverEmojis && serverEmojis.length > 0;
  // cat === -1 means server emojis tab
  const effectiveCat = hasServerEmojis ? cat - 1 : cat;
  return (
    <div ref={ref}
      className="absolute bottom-full mb-2 right-0 w-80 bg-[#0e0e1c] border border-white/[0.12] rounded-3xl shadow-2xl shadow-black/80 overflow-hidden z-50" style={{backdropFilter:'blur(24px)'}}>
      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b border-white/[0.07] p-1.5 gap-0.5"
        style={{ scrollbarWidth: 'none' }}>
        {hasServerEmojis && (
          <button onClick={() => setCat(0)} title="Emoji serwera"
            className={`text-base px-2 py-1.5 rounded-xl shrink-0 transition-colors ${cat === 0 ? 'bg-indigo-500/20 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]'}`}>
            ⭐
          </button>
        )}
        {EMOJI_CATS.map((c, i) => (
          <button key={i} onClick={() => setCat(hasServerEmojis ? i + 1 : i)} title={c.label}
            className={`text-base px-2 py-1.5 rounded-xl shrink-0 transition-colors ${cat === (hasServerEmojis ? i + 1 : i) ? 'bg-indigo-500/20 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]'}`}>
            {c.icon}
          </button>
        ))}
      </div>
      {/* Category label */}
      <div className="px-3 pt-2 pb-0.5">
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          {hasServerEmojis && cat === 0 ? 'Emoji serwera' : EMOJI_CATS[effectiveCat]?.label}
        </p>
      </div>
      {/* Emoji grid */}
      <div className="p-2 gap-0.5 max-h-52 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
        {hasServerEmojis && cat === 0 ? (
          <div className="grid grid-cols-8 gap-1">
            {serverEmojis!.map(e => (
              <button key={e.id} onClick={() => onSelect(`:${e.name}:`)} title={`:${e.name}:`}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.1] transition-colors hover:scale-110 active:scale-95">
                <img src={e.image_url} alt={e.name} className="w-6 h-6 object-contain"/>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-9">
            {(EMOJI_CATS[effectiveCat]?.emojis as readonly string[] | undefined || []).map(emoji => (
              <button key={emoji} onClick={() => { onSelect(emoji); }}
                className="text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.1] transition-colors hover:scale-110 active:scale-95">
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const LANDING_FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Wiadomości w czasie rzeczywistym',
    desc: 'Tekst, obrazy, GIF-y i reakcje — wszystko natychmiastowe dzięki Socket.IO.',
    grad: 'from-indigo-400 to-blue-400',
    glow: 'shadow-indigo-500/20',
    border: 'border-indigo-500/20',
    bg: 'bg-indigo-500/8',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    ),
    title: 'Kanały głosowe i wideo',
    desc: 'Dołącz do rozmów z jednym kliknięciem. WebRTC P2P bez opóźnień.',
    grad: 'from-violet-400 to-purple-400',
    glow: 'shadow-violet-500/20',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/8',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Serwery i społeczności',
    desc: 'Twórz serwery, zarządzaj rolami i kanałami. Pełna kontrola nad uprawnieniami.',
    grad: 'from-emerald-400 to-teal-400',
    glow: 'shadow-emerald-500/20',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/8',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
    title: 'Zaproszenia i znajomi',
    desc: 'Zapraszaj znajomych linkiem. Listy znajomych, wnioski i bezpośrednie wiadomości.',
    grad: 'from-pink-400 to-rose-400',
    glow: 'shadow-pink-500/20',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/8',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: 'Bezpieczeństwo i 2FA',
    desc: 'JWT, szyfrowanie haseł bcrypt, weryfikacja e-mail i dwuetapowe logowanie TOTP.',
    grad: 'from-amber-400 to-orange-400',
    glow: 'shadow-amber-500/20',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/8',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: 'Integracje zewnętrzne',
    desc: 'Spotify JAM, Voice DJ, Twitch i Steam — rozbudowane połączenia z Twoimi platformami.',
    grad: 'from-cyan-400 to-sky-400',
    glow: 'shadow-cyan-500/20',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/8',
  },
];

interface InviteInfo { code: string; server_id: string; server_name: string; icon_url: string | null; creator_username: string; creator_avatar: string | null; }

function AuthScreen({ onAuth, inviteInfo }: { onAuth: (u: UserProfile, t: string, isNew: boolean) => void; inviteInfo?: InviteInfo | null }) {
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<'form' | 'verify'>('form');
  const [form, setForm] = useState({ login: '', username: '', email: '', password: '', confirm: '' });
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [twoFaSession, setTwoFaSession] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaType, setTwoFaType] = useState<'totp' | 'backup'>('totp');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Allow scrolling on landing page (body has overflow:hidden globally for the app)
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = prev || 'hidden';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    let formatted = raw;
    if (raw.length > 2) formatted = raw.slice(0, 2) + '-' + raw.slice(2);
    if (raw.length > 5) formatted = raw.slice(0, 2) + '-' + raw.slice(2, 5) + '-' + raw.slice(5);
    setVerifyCode(formatted);
  };

  const openModal = (tab: 'login' | 'register') => {
    setModalTab(tab);
    setError(''); setInfo(''); setRegStep('form'); setVerifyCode('');
    setTwoFaSession(null); setTwoFaCode('');
    setShowModal(true);
    setMobileMenuOpen(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setError(''); setInfo('');
  };

  const switchTab = (t: 'login' | 'register') => {
    setModalTab(t); setError(''); setInfo(''); setRegStep('form'); setVerifyCode('');
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true);
    if (form.password !== form.confirm) { setError('Hasła nie pasują do siebie'); setLoading(false); return; }
    try {
      await auth.sendCode(form.email);
      setRegStep('verify');
      setInfo(`Kod weryfikacyjny wysłany na ${form.email}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await auth.register({ username: form.username, email: form.email, password: form.password, code: verifyCode.trim() });
      setToken(res.token); onAuth(res.user, res.token, true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await auth.login({ login: form.login, password: form.password });
      if (res.requiresTwoFactor) {
        setTwoFaSession(res.sessionId); setTwoFaCode(''); setTwoFaType('totp');
      } else {
        setToken(res.token); onAuth(res.user, res.token, false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await auth.verify2fa({ sessionId: twoFaSession!, code: twoFaCode.trim(), type: twoFaType });
      setToken(res.token); onAuth(res.user, res.token, false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Błąd połączenia z serwerem');
    } finally { setLoading(false); }
  };

  const INTEGRATIONS = [
    {
      name: 'Spotify',
      desc: 'JAM sessions — słuchaj muzyki razem ze znajomymi w czasie rzeczywistym.',
      color: 'from-green-500/20 to-emerald-500/10',
      border: 'border-green-500/25',
      icon: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      ),
    },
    {
      name: 'Twitch',
      desc: 'Linkuj swój kanał Twitch i pokaż znajomym, kiedy streamujesz.',
      color: 'from-purple-500/20 to-violet-500/10',
      border: 'border-purple-500/25',
      icon: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#9146FF">
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
        </svg>
      ),
    },
    {
      name: 'Steam',
      desc: 'Udostępnij swój profil Steam i pokaż, w co aktualnie grasz.',
      color: 'from-blue-500/20 to-sky-500/10',
      border: 'border-blue-500/25',
      icon: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#1b2838">
          <defs><linearGradient id="steamGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#66C0F4"/><stop offset="100%" stopColor="#1B2838"/></linearGradient></defs>
          <path fill="url(#steamGrad)" d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* ─── LANDING PAGE ───────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">

        {/* ── Sticky Navbar ── */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]"
          style={{ background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(20px)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center">
                <img src="/cordyn_logo.png" alt="Cordyn" className="w-full h-full object-contain"/>
              </div>
              <span className="text-lg font-bold tracking-tight">Cordyn</span>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
              {['Funkcje','Integracje','Bezpieczeństwo'].map(l => (
                <a key={l} href={`#${l.toLowerCase()}`}
                  className="hover:text-white transition-colors cursor-pointer">{l}</a>
              ))}
            </div>

            {/* Desktop CTA buttons */}
            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => openModal('login')}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all">
                Zaloguj się
              </button>
              <button onClick={() => openModal('register')}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-500 hover:bg-indigo-400 text-white transition-all shadow-lg shadow-indigo-500/20">
                Zarejestruj się
              </button>
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all"
              onClick={() => setMobileMenuOpen(v => !v)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>}
              </svg>
            </button>
          </div>

          {/* Mobile menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="md:hidden border-t border-white/[0.06] px-4 py-4 flex flex-col gap-3">
                {['Funkcje','Integracje','Bezpieczeństwo'].map(l => (
                  <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-400 hover:text-white transition-colors py-1">{l}</a>
                ))}
                <div className="flex gap-3 mt-2 pt-3 border-t border-white/[0.06]">
                  <button onClick={() => openModal('login')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-300 bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] transition-all">
                    Zaloguj się
                  </button>
                  <button onClick={() => openModal('register')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-500 hover:bg-indigo-400 text-white transition-all">
                    Zarejestruj się
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* ── Hero Section ── */}
        <section className="relative pt-32 pb-24 px-4 sm:px-6 overflow-hidden">
          {/* Animated bg blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div animate={{ x: [0,50,-20,0], y: [0,-30,15,0], scale: [1,1.1,.95,1] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-3xl"/>
            <motion.div animate={{ x: [0,-50,20,0], y: [0,30,-15,0], scale: [1,.9,1.05,1] }}
              transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
              className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-purple-600/12 rounded-full blur-3xl"/>
            <motion.div animate={{ x: [0,25,-35,0], y: [0,-20,20,0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl"/>
            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-[0.025]"
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '60px 60px' }}/>
            {/* Particles */}
            {[
              {x:'8%',y:'25%',s:3,d:4,dl:0,c:'bg-indigo-400/50'},
              {x:'72%',y:'12%',s:2,d:6,dl:1,c:'bg-purple-400/50'},
              {x:'88%',y:'55%',s:4,d:5,dl:2,c:'bg-violet-400/40'},
              {x:'15%',y:'75%',s:2,d:7,dl:.5,c:'bg-blue-400/50'},
              {x:'55%',y:'82%',s:3,d:4.5,dl:3,c:'bg-indigo-400/40'},
              {x:'35%',y:'38%',s:2,d:8,dl:1.5,c:'bg-pink-400/40'},
              {x:'62%',y:'30%',s:3,d:5.5,dl:2.5,c:'bg-cyan-400/40'},
            ].map((p,i) => (
              <motion.div key={i}
                animate={{ y:[0,-14,0], opacity:[.4,1,.4] }}
                transition={{ duration:p.d, repeat:Infinity, ease:'easeInOut', delay:p.dl }}
                className={`absolute rounded-full ${p.c}`}
                style={{ left:p.x, top:p.y, width:p.s*4, height:p.s*4 }}/>
            ))}
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5 }}
              className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-5 py-2 mb-8">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"/>
              <span className="text-sm text-indigo-300 font-medium">Platforma dla twórców i społeczności</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:.6, delay:.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-6">
              Twoja przestrzeń.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Twoje zasady.
              </span>
            </motion.h1>

            {/* Subtext */}
            <motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.2 }}
              className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Komunikuj się, buduj społeczności i łącz ze znajomymi w czasie rzeczywistym.
              Głos, wideo, Spotify JAM i wiele więcej — wszystko w jednym miejscu.
            </motion.p>

            {/* CTA buttons */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button onClick={() => openModal('register')}
                className="px-8 py-4 rounded-2xl text-base font-bold bg-indigo-500 hover:bg-indigo-400 text-white transition-all shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 active:translate-y-0">
                Zacznij za darmo →
              </button>
              <button onClick={() => openModal('login')}
                className="px-8 py-4 rounded-2xl text-base font-semibold text-zinc-300 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] transition-all hover:-translate-y-0.5">
                Zaloguj się
              </button>
            </motion.div>

            {/* Stats row */}
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.5 }}
              className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {[
                { val:'100%', label:'Open Source', color:'text-indigo-400' },
                { val:'E2E', label:'Szyfrowanie', color:'text-violet-400' },
                { val:'∞', label:'Wiadomości', color:'text-emerald-400' },
                { val:'2FA', label:'Bezpieczeństwo', color:'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* App UI mockup strip */}
          <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} transition={{ duration:.7, delay:.45 }}
            className="relative max-w-5xl mx-auto mt-20">
            <div className="relative rounded-3xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/60"
              style={{ background: 'linear-gradient(180deg,rgba(99,102,241,.08) 0%,rgba(9,9,11,.95) 100%)' }}>
              {/* Fake titlebar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
                <span className="w-3 h-3 rounded-full bg-red-500/70"/>
                <span className="w-3 h-3 rounded-full bg-amber-500/70"/>
                <span className="w-3 h-3 rounded-full bg-emerald-500/70"/>
                <div className="flex-1 mx-4 h-5 rounded-lg bg-white/[0.04] flex items-center px-3">
                  <span className="text-[10px] text-zinc-600">cordyn.app</span>
                </div>
              </div>
              {/* Fake app layout */}
              <div className="flex h-48 sm:h-64">
                {/* Sidebar servers */}
                <div className="w-14 border-r border-white/[0.05] flex flex-col items-center gap-2 py-3 px-2 shrink-0">
                  {['#','C','G','P','M'].map((l,i) => (
                    <div key={i} className={`w-9 h-9 rounded-${i===0?'2xl':'xl'} flex items-center justify-center text-xs font-bold
                      ${i===0?'bg-indigo-500 text-white':'bg-white/[0.06] text-zinc-500 hover:bg-indigo-500/30 hover:text-white'} transition-all`}>
                      {l}
                    </div>
                  ))}
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-base">+</div>
                </div>
                {/* Channel list */}
                <div className="w-44 sm:w-52 border-r border-white/[0.05] flex flex-col py-3 px-2 shrink-0">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2 mb-2">Kanały tekstowe</p>
                  {['ogólny','rozwój','design','random'].map((ch,i) => (
                    <div key={ch} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${i===0?'bg-indigo-500/15 text-white':'text-zinc-500 hover:text-zinc-300'} transition-colors cursor-pointer`}>
                      <span className="text-sm text-zinc-600">#</span>
                      <span className="text-xs font-medium truncate">{ch}</span>
                    </div>
                  ))}
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-2 mb-2 mt-3">Głosowe</p>
                  {['Ogólny','Gaming'].map((ch) => (
                    <div key={ch} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      </svg>
                      <span className="text-xs font-medium truncate">{ch}</span>
                    </div>
                  ))}
                </div>
                {/* Chat */}
                <div className="flex-1 flex flex-col p-3 gap-2 overflow-hidden">
                  {[
                    { u:'Alex', c:'bg-indigo-500', msg:'Hej, ktoś gra dziś wieczorem? 🎮', time:'21:30' },
                    { u:'Kasia', c:'bg-pink-500', msg:'Ja jestem! Wskakuję na głosowy 🎙️', time:'21:31' },
                    { u:'Marek', c:'bg-emerald-500', msg:'Idę, zaraz dołączę do kanału voice', time:'21:32' },
                  ].map((m,i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-full ${m.c} flex items-center justify-center text-xs font-bold text-white shrink-0`}>{m.u[0]}</div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-white">{m.u}</span>
                          <span className="text-[9px] text-zinc-600">{m.time}</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{m.msg}</p>
                      </div>
                    </div>
                  ))}
                  {/* Input mock */}
                  <div className="mt-auto flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.06]">
                    <span className="text-xs text-zinc-600 flex-1">Napisz wiadomość...</span>
                    <span className="text-zinc-600">😊</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow under mockup */}
            <div className="absolute -inset-4 bg-indigo-500/5 blur-3xl rounded-full -z-10"/>
          </motion.div>
        </section>

        {/* ── Features Section ── */}
        <section id="funkcje" className="py-24 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5 }}
              className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 mb-4">
                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Funkcje</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">
                Wszystko, czego potrzebujesz
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Jeden zestaw narzędzi do komunikacji, zarządzania społecznością i rozrywki.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {LANDING_FEATURES.map((f, i) => (
                <motion.div key={f.title}
                  initial={{ opacity:0, y:30 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
                  transition={{ duration:.4, delay: i * .07 }}
                  whileHover={{ y:-4, scale:1.01 }}
                  className={`relative flex flex-col gap-4 p-6 rounded-3xl border ${f.border} ${f.bg} hover:bg-white/[0.04] shadow-xl ${f.glow} hover:shadow-lg transition-all duration-200 cursor-default overflow-hidden`}>
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${f.grad} bg-opacity-10 w-fit`}
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <span className={`bg-gradient-to-r ${f.grad} bg-clip-text`} style={{ color:'transparent', display:'grid', placeItems:'center' }}>
                      {f.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className={`text-base font-bold mb-1.5 bg-gradient-to-r ${f.grad} bg-clip-text text-transparent`}>{f.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Integrations Section ── */}
        <section id="integracje" className="py-24 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:.5 }}
              className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Integracje</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">
                Połącz swoje platformy
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Cordyn integruje się z Twoimi ulubionymi serwisami, żebyś wszystko miał w jednym miejscu.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {INTEGRATIONS.map((intg, i) => (
                <motion.div key={intg.name}
                  initial={{ opacity:0, y:30 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
                  transition={{ duration:.4, delay: i * .1 }}
                  whileHover={{ y:-4 }}
                  className={`flex flex-col gap-5 p-7 rounded-3xl border ${intg.border} bg-gradient-to-br ${intg.color} transition-all duration-200`}>
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                    {intg.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2">{intg.name}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{intg.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security Section ── */}
        <section id="bezpieczeństwo" className="py-24 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left text */}
              <motion.div initial={{ opacity:0, x:-30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:.5 }}>
                <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-6">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Bezpieczeństwo</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black mb-5">
                  Twoje dane są bezpieczne
                </h2>
                <p className="text-zinc-400 leading-relaxed mb-8">
                  Cordyn kładzie bezpieczeństwo na pierwszym miejscu. Hasła szyfrowane przez bcrypt,
                  tokeny JWT z odświeżaniem, weryfikacja e-mail i dwuetapowe logowanie chronią Twoje konto.
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { icon:'🔐', text:'Dwuetapowe logowanie (TOTP + kody zapasowe)' },
                    { icon:'🔒', text:'Hasła szyfrowane bcrypt (12 rund)' },
                    { icon:'✉️', text:'Weryfikacja adresu e-mail przy rejestracji' },
                    { icon:'🛡️', text:'JWT access + refresh tokens z blacklistą' },
                    { icon:'⚡', text:'Rate limiting i ochrona przed spamem' },
                  ].map(item => (
                    <div key={item.text} className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{item.icon}</span>
                      <span className="text-sm text-zinc-400">{item.text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Right: authenticator apps card */}
              <motion.div initial={{ opacity:0, x:30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:.5, delay:.1 }}
                className="relative">
                <div className="absolute inset-0 bg-amber-500/5 blur-3xl rounded-full pointer-events-none"/>
                <div className="relative rounded-3xl border border-amber-500/20 bg-amber-500/5 p-7">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">🔐</div>
                    <div>
                      <p className="font-bold text-white">Weryfikacja dwuetapowa</p>
                      <p className="text-xs text-zinc-500">Obsługiwane aplikacje authenticator</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name:'Google Authenticator', color:'bg-blue-500/15 border-blue-500/25', icon:'🔵' },
                      { name:'Authy', color:'bg-red-500/15 border-red-500/25', icon:'🔴' },
                      { name:'Microsoft Authenticator', color:'bg-cyan-500/15 border-cyan-500/25', icon:'🔷' },
                      { name:'1Password', color:'bg-indigo-500/15 border-indigo-500/25', icon:'🔑' },
                    ].map(app => (
                      <div key={app.name} className={`flex items-center gap-2.5 p-3 rounded-2xl border ${app.color}`}>
                        <span className="text-lg">{app.icon}</span>
                        <span className="text-xs font-medium text-zinc-300 leading-tight">{app.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 mt-4 text-center">
                    Kompatybilny z każdą aplikacją TOTP (RFC 6238)
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Final CTA Section ── */}
        <section className="py-24 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity:0, scale:.95 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ duration:.5 }}>
              <div className="relative inline-block">
                <motion.div
                  animate={{ scale:[1,1.05,1], opacity:[.3,.6,.3] }}
                  transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }}
                  className="absolute inset-0 bg-indigo-500/30 blur-3xl rounded-full"/>
                <div className="relative rounded-3xl border border-indigo-500/25 bg-indigo-500/8 p-10 sm:p-14">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6 overflow-hidden">
                    <img src="/cordyn_logo.png" alt="Cordyn" className="w-12 h-12 object-contain"/>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black mb-4">
                    Gotowy na start?
                  </h2>
                  <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                    Dołącz do Cordyn — bezpłatnie, bez reklam, bez limitów wiadomości.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button onClick={() => openModal('register')}
                      className="px-8 py-4 rounded-2xl text-base font-bold bg-indigo-500 hover:bg-indigo-400 text-white transition-all shadow-xl shadow-indigo-500/30 hover:-translate-y-0.5">
                      Zarejestruj się za darmo
                    </button>
                    <button onClick={() => openModal('login')}
                      className="px-8 py-4 rounded-2xl text-base font-semibold text-zinc-300 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] transition-all hover:-translate-y-0.5">
                      Mam już konto
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="py-8 px-4 sm:px-6 border-t border-white/[0.05]">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg overflow-hidden">
                <img src="/cordyn_logo.png" alt="Cordyn" className="w-full h-full object-contain"/>
              </div>
              <span className="text-sm font-bold text-zinc-400">Cordyn</span>
            </div>
            <p className="text-xs text-zinc-700">© 2025 Cordyn. Wszelkie prawa zastrzeżone.</p>
            <div className="flex items-center gap-5 text-xs text-zinc-600">
              {['Funkcje','Integracje','Bezpieczeństwo'].map(l => (
                <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-zinc-400 transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {/* ─── AUTH MODAL ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>

            <motion.div initial={{ opacity:0, y:24, scale:.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:16, scale:.97 }}
              transition={{ duration:.3, ease:[.16,1,.3,1] }}
              className={`relative w-full max-w-sm ${gm} p-8 shadow-2xl shadow-black/60`}>

              {/* Close button */}
              <button onClick={closeModal}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.07] transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>

              {/* Mobile logo */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-7 h-7 rounded-lg overflow-hidden">
                  <img src="/cordyn_logo.png" alt="Cordyn" className="w-full h-full object-contain"/>
                </div>
                <span className="text-base font-bold text-white">Cordyn</span>
              </div>

              {/* Invite banner */}
              {inviteInfo && (
                <div className="mb-6 flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl px-4 py-3">
                  {inviteInfo.icon_url
                    ? <img src={inviteInfo.icon_url} className="w-10 h-10 rounded-xl object-cover shrink-0" alt=""/>
                    : <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-lg font-bold text-white shrink-0">{inviteInfo.server_name[0]}</div>
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">Zaproszenie na serwer</p>
                    <p className="text-xs text-indigo-300 font-semibold truncate">{inviteInfo.server_name}</p>
                    <p className="text-xs text-zinc-500 truncate">od <span className="text-zinc-400">{inviteInfo.creator_username}</span></p>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="mb-7">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {modalTab === 'login' ? 'Witaj z powrotem!' : 'Dołącz do Cordyn'}
                </h2>
                <p className="text-sm text-zinc-500">
                  {modalTab === 'login'
                    ? inviteInfo ? 'Zaloguj się, aby dołączyć do serwera' : 'Zaloguj się na swoje konto'
                    : inviteInfo ? 'Utwórz konto, aby dołączyć do serwera' : 'Utwórz konto i zacznij budować społeczność'}
                </p>
              </div>

              {/* Tab switch */}
              <div className="flex bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1 mb-6">
                {(['login','register'] as const).map(t => (
                  <button key={t} onClick={() => switchTab(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      modalTab===t ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-400 hover:text-white'}`}>
                    {t === 'login' ? 'Logowanie' : 'Rejestracja'}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* ── 2FA STEP ── */}
                {twoFaSession && (
                  <motion.form key="2fa-form" onSubmit={handleVerify2fa}
                    initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-12 }}
                    transition={{ duration:.2 }} className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-3 p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl mb-1">
                      <Shield size={18} className="text-indigo-400 shrink-0"/>
                      <div>
                        <p className="text-sm font-semibold text-white">Weryfikacja dwuetapowa</p>
                        <p className="text-xs text-zinc-400">
                          {twoFaType === 'totp' ? 'Podaj 6-cyfrowy kod z aplikacji authenticator' : 'Podaj kod zapasowy (XXXXX-XXXXX)'}
                        </p>
                      </div>
                    </div>
                    <input autoFocus value={twoFaCode} onChange={e => setTwoFaCode(e.target.value)}
                      placeholder={twoFaType === 'totp' ? '000000' : 'XXXXX-XXXXX'}
                      maxLength={twoFaType === 'totp' ? 6 : 11}
                      inputMode={twoFaType === 'totp' ? 'numeric' : 'text'}
                      className={`${gi} rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest w-full`}/>
                    <AnimatePresence>
                      {error && (
                        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                          className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 overflow-hidden">
                          <AlertCircle size={15} className="shrink-0"/><span>{error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button type="submit" disabled={loading || !twoFaCode.trim()}
                      className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                      {loading ? <><Loader2 size={17} className="animate-spin"/> Weryfikacja...</> : <><Shield size={15}/>Zatwierdź</>}
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setTwoFaSession(null); setError(''); }}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold text-zinc-400 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] transition-all">← Wróć</button>
                      <button type="button" onClick={() => { setTwoFaType(t => t === 'totp' ? 'backup' : 'totp'); setTwoFaCode(''); setError(''); }}
                        className="flex-1 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] transition-all">
                        {twoFaType === 'totp' ? 'Użyj kodu zapasowego' : 'Użyj aplikacji authenticator'}
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* ── LOGIN FORM ── */}
                {!twoFaSession && modalTab === 'login' && (
                  <motion.form key="login-form" onSubmit={handleLogin}
                    initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:12 }}
                    transition={{ duration:.2 }} className="flex flex-col gap-3.5">
                    <div className="relative">
                      <MessageSquare size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                      <input required value={form.login} onChange={set('login')} placeholder="Login lub email"
                        className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`}/>
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                      <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                        placeholder="Hasło" minLength={6}
                        className={`${gi} rounded-xl pl-10 pr-10 py-3 text-sm w-full`}/>
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                        {showPass ? <Eye size={15}/> : <EyeOff size={15}/>}
                      </button>
                    </div>
                    <AnimatePresence>
                      {error && (
                        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
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

                {/* ── REGISTER STEP 1 ── */}
                {!twoFaSession && modalTab === 'register' && regStep === 'form' && (
                  <motion.form key="reg-form" onSubmit={handleSendCode}
                    initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-12 }}
                    transition={{ duration:.2 }} className="flex flex-col gap-3.5">
                    <div className="relative">
                      <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                      <input required value={form.username} onChange={set('username')} placeholder="Nazwa użytkownika"
                        pattern="[a-zA-Z0-9_]+" minLength={2} maxLength={32}
                        className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`}/>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">@</span>
                      <input required type="email" value={form.email} onChange={set('email')} placeholder="Adres email"
                        className={`${gi} rounded-xl pl-9 pr-4 py-3 text-sm w-full`}/>
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                      <input required type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                        placeholder="Hasło" minLength={6}
                        className={`${gi} rounded-xl pl-10 pr-10 py-3 text-sm w-full`}/>
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                        {showPass ? <Eye size={15}/> : <EyeOff size={15}/>}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                      <input required type={showPass ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')}
                        placeholder="Potwierdź hasło" minLength={6}
                        className={`${gi} rounded-xl pl-10 pr-4 py-3 text-sm w-full`}/>
                    </div>
                    <AnimatePresence>
                      {error && (
                        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                          className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 overflow-hidden">
                          <AlertCircle size={15} className="shrink-0"/><span>{error}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button type="submit" disabled={loading}
                      className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 mt-1">
                      {loading ? <><Loader2 size={17} className="animate-spin"/> Wysyłanie kodu...</> : 'Wyślij kod weryfikacyjny →'}
                    </button>
                  </motion.form>
                )}

                {/* ── REGISTER STEP 2 ── */}
                {!twoFaSession && modalTab === 'register' && regStep === 'verify' && (
                  <motion.form key="verify-form" onSubmit={handleRegister}
                    initial={{ opacity:0, x:12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-12 }}
                    transition={{ duration:.2 }} className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0"><span className="text-base">✉️</span></div>
                      <div className="min-w-0">
                        <p className="text-xs text-indigo-300 font-medium">Kod wysłany na:</p>
                        <p className="text-sm text-white font-semibold truncate">{form.email}</p>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none text-sm font-mono">#</div>
                      <input required value={verifyCode} onChange={handleCodeInput} placeholder="xx-xxx-xxx" maxLength={10}
                        className={`${gi} rounded-xl pl-9 pr-4 py-3 text-sm w-full font-mono tracking-widest text-center`}/>
                    </div>
                    <p className="text-xs text-zinc-600 text-center -mt-1">Sprawdź skrzynkę mailową · Ważny przez 15 minut</p>
                    <AnimatePresence>
                      {(error || info) && (
                        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                          className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2.5 overflow-hidden border ${error ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                          <AlertCircle size={15} className="shrink-0"/><span>{error || info}</span>
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
                {modalTab === 'login' ? 'Nie masz konta? ' : 'Masz już konto? '}
                <button onClick={() => switchTab(modalTab === 'login' ? 'register' : 'login')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                  {modalTab === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
        className="relative w-full max-w-lg glass-modal rounded-3xl shadow-2xl shadow-indigo-900/30">

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
          w-16 h-16 rounded-2xl bg-white/[0.06] border-4 border-[#16161e]
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

// ─── Link Preview ─────────────────────────────────────────────────────────────
const YT_RE = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?(?:[^&]+&)*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const URL_RE = /https?:\/\/[^\s"<>()[\]{}]+/g;

interface OgData { title: string; description: string; image: string; site_name: string; }
function LinkPreview({ url, show }: { url: string; show: boolean }) {
  const [data, setData] = React.useState<OgData | null>(null);
  const [done, setDone] = React.useState(false);
  const ytId = url.match(YT_RE)?.[1];
  React.useEffect(() => {
    if (!show || done) return;
    setDone(true);
    // YouTube: show preview immediately using thumbnail API — no OG fetch needed
    if (ytId) {
      setData({ title: 'YouTube', description: '', image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, site_name: 'YouTube' });
      return;
    }
    const token = getToken();
    fetch(`/api/og?url=${encodeURIComponent(url)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then((d: OgData) => { if (d.title) setData(d); })
      .catch(() => {});
  }, [url, show, done, ytId]);
  if (!show || !data) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="link-prev">
      {ytId ? (
        <div className="link-prev-yt">
          <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover"/>
          <div className="link-prev-yt-play">▶</div>
        </div>
      ) : data.image ? (
        <img src={data.image} alt="" className="link-prev-img"/>
      ) : null}
      <div className="link-prev-body">
        {data.site_name && <p className="link-prev-site">{data.site_name}</p>}
        <p className="link-prev-title">{data.title}</p>
        {data.description && <p className="link-prev-desc">{data.description}</p>}
      </div>
    </a>
  );
}

// ─── Status badge SVG component ───────────────────────────────────────────────
const STATUS_COL: Record<string, string> = {
  online: '#3ba55d',
  idle:   '#faa81a',
  dnd:    '#ed4245',
};
function StatusBadge({ status, size = 14, className = '' }: { status: string; size?: number; className?: string }) {
  const r = size / 2;
  const col = STATUS_COL[status] ?? '#747f8d';
  if (status === 'idle') {
    const maskId = `sc-moon-${size}`;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
        <defs>
          <mask id={maskId}>
            <rect width={size} height={size} fill="white"/>
            {/* Offset circle cuts the crescent shape */}
            <circle cx={r * 0.52} cy={r * 0.52} r={r * 0.78} fill="black"/>
          </mask>
        </defs>
        <circle cx={r} cy={r} r={r} fill={col} mask={`url(#${maskId})`}/>
      </svg>
    );
  }
  if (status === 'dnd') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
        <circle cx={r} cy={r} r={r} fill={col}/>
        <rect x={size*0.2} y={r - size*0.115} width={size*0.6} height={size*0.23} rx={size*0.115} fill="white"/>
      </svg>
    );
  }
  // online / offline — solid circle
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle cx={r} cy={r} r={r} fill={col}/>
    </svg>
  );
}

// ─── Badge icon map ────────────────────────────────────────────────────────────
const BADGE_ICON_MAP: Record<string, LucideIcon> = {
  developer: Code2,
  qa: FlaskConical,
  admin: ShieldCheck,
  moderator: Hammer,
};
const getBadgeIcon = (name: string): LucideIcon => BADGE_ICON_MAP[name] ?? Award;

// ─── Server Settings Page ─────────────────────────────────────────────────────
// ─── Emoji Tab (osobny komponent — hooks muszą być w komponentach, nie w IIFE) ──
function EmojiTab({ serverId, initialEmojis, canManage, gi }: {
  serverId: string;
  initialEmojis: ServerEmoji[];
  canManage: boolean;
  gi: string;
}) {
  const [localEmojis, setLocalEmojis] = React.useState<ServerEmoji[]>(initialEmojis);
  const [emojiUploading, setEmojiUploading] = React.useState(false);

  React.useEffect(() => { setLocalEmojis(initialEmojis); }, [initialEmojis]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Niestandardowe Emoji ({localEmojis.length}/50)</h2>
          <p className="text-xs text-zinc-600 mt-0.5">Własne emoji dostępne dla wszystkich na serwerze w pickerze</p>
        </div>
      </div>
      {localEmojis.length === 0 && !emojiUploading && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Smile size={28} className="text-zinc-700"/>
          <p className="text-sm text-zinc-500">Brak emoji — dodaj własne obrazki</p>
          <p className="text-xs text-zinc-700">PNG, GIF lub WebP, maks. 256KB</p>
        </div>
      )}
      {localEmojis.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
          {localEmojis.map(e => (
            <div key={e.id} className="flex flex-col items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded-xl p-2 group relative hover:border-white/[0.1] transition-colors">
              <img src={e.image_url} alt={e.name} className="w-10 h-10 object-contain rounded-lg"/>
              <span className="text-[10px] text-zinc-400 truncate w-full text-center">:{e.name}:</span>
              {canManage && (
                <button
                  onClick={async () => {
                    try {
                      await emojisApi.delete(serverId, e.id);
                      setLocalEmojis(p => p.filter(x => x.id !== e.id));
                    } catch {}
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-400">
                  <X size={9}/>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && localEmojis.length < 50 && (
        <label className={`cursor-pointer flex items-center gap-2 text-sm font-semibold border px-4 py-3 rounded-xl transition-all ${
          emojiUploading
            ? 'bg-zinc-800/50 border-white/[0.05] text-zinc-600 cursor-not-allowed'
            : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 text-indigo-400'}`}>
          {emojiUploading
            ? <><Loader2 size={14} className="animate-spin"/> Wgrywanie...</>
            : <><Upload size={14}/> Dodaj emoji (PNG/GIF/WebP, maks. 256KB)</>}
          <input type="file" accept="image/png,image/gif,image/webp" disabled={emojiUploading} className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 256 * 1024) { alert('Plik za duży — maks. 256KB'); e.target.value = ''; return; }
              setEmojiUploading(true);
              try {
                const rawName = f.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 32) || 'emoji';
                const imageUrl = await uploadFile(f, 'emojis');
                const created = await emojisApi.create(serverId, rawName, imageUrl);
                setLocalEmojis(p => [...p, created]);
              } catch (err: any) {
                alert('Błąd wgrywania: ' + (err?.message || 'nieznany'));
              }
              setEmojiUploading(false);
              e.target.value = '';
            }}/>
        </label>
      )}
    </div>
  );
}

// ─── Automations Tab (osobny komponent — hooks mogą być używane tylko w komponentach) ──
function AutomationsTab({ serverId, gi }: { serverId: string; gi: string }) {
  const [automations, setAutomations] = React.useState<import('./api').ServerAutomation[]>([]);
  const [autoLoading, setAutoLoading] = React.useState(true);
  const [editAuto, setEditAuto] = React.useState<Partial<import('./api').ServerAutomation> | null>(null);
  const [autoSaving, setAutoSaving] = React.useState(false);

  React.useEffect(() => {
    automationsApi.list(serverId).then(list => { setAutomations(list); setAutoLoading(false); }).catch(() => setAutoLoading(false));
  }, [serverId]);

  const saveAuto = async () => {
    if (!editAuto) return;
    setAutoSaving(true);
    try {
      if (editAuto.id) {
        const updated = await automationsApi.update(serverId, editAuto.id, {
          name: editAuto.name || 'Reguła',
          enabled: editAuto.enabled ?? true,
          trigger_type: (editAuto.trigger_type || 'member_join') as import('./api').AutomationTrigger,
          trigger_config: editAuto.trigger_config || {},
          actions: editAuto.actions || [],
        });
        setAutomations(p => p.map(a => a.id === updated.id ? updated : a));
      } else {
        const created = await automationsApi.create(serverId, {
          name: editAuto.name || 'Nowa reguła',
          enabled: true,
          trigger_type: (editAuto.trigger_type || 'member_join') as import('./api').AutomationTrigger,
          trigger_config: editAuto.trigger_config || {},
          actions: editAuto.actions || [],
        });
        setAutomations(p => [...p, created]);
      }
      setEditAuto(null);
    } catch {}
    setAutoSaving(false);
  };

  const deleteAuto = async (id: string) => {
    await automationsApi.delete(serverId, id).catch(() => {});
    setAutomations(p => p.filter(a => a.id !== id));
  };

  const toggleAuto = async (id: string, enabled: boolean) => {
    await automationsApi.toggle(serverId, id, enabled).catch(() => {});
    setAutomations(p => p.map(a => a.id === id ? { ...a, enabled } : a));
  };

  const TRIGGER_LABELS: Record<string, string> = {
    member_join: 'Nowy member dołącza',
    member_leave: 'Member opuszcza serwer',
    role_assigned: 'Rola przypisana',
    message_contains: 'Wiadomość zawiera słowo',
  };
  const ACTION_LABELS: Record<string, string> = {
    assign_role: 'Przypisz rolę',
    remove_role: 'Usuń rolę',
    send_channel_message: 'Wyślij wiadomość na kanał',
    send_dm: 'Wyślij DM do usera',
    delete_message: 'Usuń wiadomość',
    kick_member: 'Kicknij usera',
  };

  if (editAuto !== null) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditAuto(null)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.07] transition-all"><ArrowLeft size={16}/></button>
          <h2 className="text-base font-bold text-white">{editAuto.id ? 'Edytuj regułę' : 'Nowa reguła'}</h2>
        </div>

        <div>
          <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Nazwa reguły</label>
          <input value={editAuto.name || ''} onChange={e => setEditAuto(p => ({...p!, name: e.target.value}))}
            placeholder="Np. Powitanie nowego użytkownika" className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/>
        </div>

        <div>
          <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Wyzwalacz</label>
          <select value={editAuto.trigger_type || 'member_join'}
            onChange={e => setEditAuto(p => ({...p!, trigger_type: e.target.value as any, trigger_config: {}}))}
            className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}>
            {Object.entries(TRIGGER_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {editAuto.trigger_type === 'role_assigned' && (
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">ID Roli wyzwalającej</label>
            <input value={(editAuto.trigger_config as any)?.role_id || ''}
              onChange={e => setEditAuto(p => ({...p!, trigger_config: {...(p?.trigger_config||{}), role_id: e.target.value}}))}
              placeholder="UUID roli" className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/>
            <p className="text-xs text-zinc-600 mt-1">Akcja uruchamia się gdy ta rola zostanie przypisana</p>
          </div>
        )}
        {editAuto.trigger_type === 'message_contains' && (
          <div>
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Słowo kluczowe</label>
            <input value={(editAuto.trigger_config as any)?.keyword || ''}
              onChange={e => setEditAuto(p => ({...p!, trigger_config: {...(p?.trigger_config||{}), keyword: e.target.value}}))}
              placeholder="Np. spam, discord.gg, itp." className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-zinc-600 uppercase tracking-widest block">Akcje ({(editAuto.actions||[]).length})</label>
            <button onClick={() => setEditAuto(p => ({...p!, actions: [...(p?.actions||[]), {type:'send_dm', config:{}} as any]}))}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              <Plus size={11}/> Dodaj akcję
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {(editAuto.actions || []).map((action, idx) => (
              <div key={idx} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <select value={action.type} onChange={e => setEditAuto(p => {
                    const acts = [...(p?.actions||[])];
                    acts[idx] = {...acts[idx], type: e.target.value as any, config: {}};
                    return {...p!, actions: acts};
                  })} className={`flex-1 ${gi} rounded-xl px-3 py-2 text-xs`}>
                    {Object.entries(ACTION_LABELS).map(([k,v]) => {
                      if (editAuto.trigger_type !== 'message_contains' && (k === 'delete_message' || k === 'kick_member')) return null;
                      return <option key={k} value={k}>{v}</option>;
                    })}
                  </select>
                  <button onClick={() => setEditAuto(p => ({...p!, actions: (p?.actions||[]).filter((_,i)=>i!==idx)}))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-zinc-600 hover:text-rose-400 transition-colors shrink-0">
                    <Trash2 size={11}/>
                  </button>
                </div>
                {(action.type === 'assign_role' || action.type === 'remove_role') && (
                  <input value={(action.config as any)?.role_id || ''} onChange={e => setEditAuto(p => {
                    const acts = [...(p?.actions||[])]; acts[idx] = {...acts[idx], config: {...(acts[idx].config||{}), role_id: e.target.value}}; return {...p!, actions: acts};
                  })} placeholder="UUID roli" className={`${gi} rounded-xl px-3 py-2 text-xs`}/>
                )}
                {action.type === 'send_channel_message' && (
                  <div className="flex flex-col gap-1.5">
                    <input value={(action.config as any)?.channel_id || ''} onChange={e => setEditAuto(p => {
                      const acts = [...(p?.actions||[])]; acts[idx] = {...acts[idx], config: {...(acts[idx].config||{}), channel_id: e.target.value}}; return {...p!, actions: acts};
                    })} placeholder="UUID kanału" className={`${gi} rounded-xl px-3 py-2 text-xs`}/>
                    <textarea value={(action.config as any)?.message || ''} onChange={e => setEditAuto(p => {
                      const acts = [...(p?.actions||[])]; acts[idx] = {...acts[idx], config: {...(acts[idx].config||{}), message: e.target.value}}; return {...p!, actions: acts};
                    })} placeholder="Treść wiadomości. Użyj {username} i {server}" rows={2} className={`${gi} rounded-xl px-3 py-2 text-xs resize-none`}/>
                  </div>
                )}
                {action.type === 'send_dm' && (
                  <textarea value={(action.config as any)?.message || ''} onChange={e => setEditAuto(p => {
                    const acts = [...(p?.actions||[])]; acts[idx] = {...acts[idx], config: {...(acts[idx].config||{}), message: e.target.value}}; return {...p!, actions: acts};
                  })} placeholder="Treść DM. Użyj {username} i {server}" rows={2} className={`${gi} rounded-xl px-3 py-2 text-xs resize-none`}/>
                )}
              </div>
            ))}
            {(editAuto.actions||[]).length === 0 && (
              <p className="text-xs text-zinc-700 py-3 text-center">Brak akcji — dodaj przynajmniej jedną</p>
            )}
          </div>
        </div>

        <button onClick={saveAuto} disabled={autoSaving || !editAuto.name?.trim() || !(editAuto.actions||[]).length}
          className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
          {autoSaving ? <Loader2 size={15} className="animate-spin"/> : <Check size={15}/>}
          {editAuto.id ? 'Zapisz zmiany' : 'Utwórz regułę'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Automatyzacje ({automations.length})</h2>
          <p className="text-xs text-zinc-600 mt-0.5">Automatycznie wykonuj akcje na podstawie zdarzeń serwera</p>
        </div>
        <button onClick={() => setEditAuto({name:'', trigger_type:'member_join', trigger_config:{}, actions:[], enabled:true})}
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5">
          <Plus size={14}/> Nowa reguła
        </button>
      </div>

      {autoLoading && <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-zinc-600"/></div>}

      {!autoLoading && automations.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Zap size={22} className="text-indigo-400"/>
          </div>
          <p className="text-sm font-semibold text-zinc-300">Brak reguł automatyzacji</p>
          <p className="text-xs text-zinc-600 leading-relaxed max-w-xs">Stwórz reguły które automatycznie przypisują role, wysyłają wiadomości powitalne lub moderują serwer</p>
          <button onClick={() => setEditAuto({name:'', trigger_type:'member_join', trigger_config:{}, actions:[], enabled:true})}
            className="mt-1 text-sm font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 px-4 py-2 rounded-xl transition-all flex items-center gap-2">
            <Plus size={14}/> Utwórz pierwszą regułę
          </button>
        </div>
      )}

      {automations.map(auto => (
        <div key={auto.id} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 flex items-start gap-3 group hover:border-white/[0.1] transition-colors">
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${auto.enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}/>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{auto.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Wyzwalacz: <span className="text-zinc-400">{TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}</span>
              {' · '}{auto.actions.length} {auto.actions.length === 1 ? 'akcja' : 'akcje'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => toggleAuto(auto.id, !auto.enabled)} title={auto.enabled ? 'Wyłącz' : 'Włącz'}
              className={`w-8 h-5 rounded-full transition-all relative ${auto.enabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all"
                style={{left: auto.enabled ? 'calc(100% - 1.125rem)' : '0.125rem'}}/>
            </button>
            <button onClick={() => setEditAuto(auto)}
              className="w-7 h-7 bg-white/[0.05] hover:bg-white/[0.09] text-zinc-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"><Edit3 size={12}/></button>
            <button onClick={() => deleteAuto(auto.id)}
              className="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center transition-colors"><Trash2 size={12}/></button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ServerSettingsPageProps {
  serverFull: ServerFull;
  tab: 'overview'|'roles'|'members'|'bans'|'invites'|'emoji'|'automations';
  setTab: (t: 'overview'|'roles'|'members'|'bans'|'invites'|'emoji'|'automations') => void;
  roles: ServerRole[];
  members: ServerMember[];
  banList: ServerBan[]; setBanList: (v: ServerBan[]) => void;
  srvForm: { name: string; description: string; icon_url: string; banner_url: string };
  setSrvForm: (v: any) => void;
  srvBannerFile: File|null; setSrvBannerFile: (f: File|null) => void;
  srvIconFile: File|null; setSrvIconFile: (f: File|null) => void;
  handleSaveSrv: () => void;
  inviteDur: string; setInviteDur: (v: string) => void;
  inviteCode: string|null; handleInvite: () => void;
  canManageServer: boolean; canManageRoles: boolean;
  canKickMembers: boolean; canBanMembers: boolean; canCreateInvites: boolean;
  handleSetMemberRole: (userId: string, roleName: string) => void;
  handleKick: (userId: string) => void;
  handleBan: (userId: string, username: string) => void;
  handleUnban: (userId: string) => void;
  openNewRole: () => void;
  openEditRole: (r: ServerRole) => void;
  handleDeleteRole: (id: string) => void;
  currentUser: UserProfile|null;
  onClose: () => void;
  streamerMode?: boolean;
  serverEmojis?: ServerEmoji[];
  activeServer?: string;
}
function ServerSettingsPage({
  serverFull, tab, setTab, roles, members, banList, setBanList,
  srvForm, setSrvForm, srvBannerFile, setSrvBannerFile, srvIconFile, setSrvIconFile,
  handleSaveSrv, inviteDur, setInviteDur, inviteCode, handleInvite,
  canManageServer, canManageRoles, canKickMembers, canBanMembers, canCreateInvites,
  handleSetMemberRole, handleKick, handleBan, handleUnban,
  openNewRole, openEditRole, handleDeleteRole, currentUser, onClose,
  streamerMode, serverEmojis, activeServer,
}: ServerSettingsPageProps) {
  const [memberQ, setMemberQ] = React.useState('');
  const filteredMembers = memberQ.trim()
    ? members.filter(m => m.username.toLowerCase().includes(memberQ.toLowerCase()))
    : members;
  const STABS = [
    canManageServer && { id: 'overview' as const, label: 'Ogólne',      icon: <Settings size={14}/> },
    canManageRoles  && { id: 'roles'    as const, label: 'Role',         icon: <Shield   size={14}/> },
    (canManageRoles||canKickMembers) && { id: 'members' as const, label: 'Członkowie', icon: <Users size={14}/> },
    canBanMembers   && { id: 'bans'     as const, label: 'Bany',         icon: <ShieldCheck size={14}/> },
    canCreateInvites && { id: 'invites' as const, label: 'Zaproszenia',  icon: <UserPlus size={14}/> },
    canManageServer && { id: 'emoji' as const, label: 'Emoji',           icon: <Smile size={14}/> },
    canManageServer && { id: 'automations' as const, label: 'Automatyzacje', icon: <Zap size={14}/> },
  ].filter(Boolean) as { id: typeof tab; label: string; icon: React.ReactNode }[];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d18]">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.06] flex items-center px-5 gap-4 shrink-0 glass-dark z-10">
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.07] transition-all">
          <ArrowLeft size={16}/>
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {serverFull.icon_url
            ? <img src={serverFull.icon_url} className="w-6 h-6 rounded-lg object-cover shrink-0" alt=""/>
            : <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{serverFull.name[0]}</div>
          }
          <span className="text-sm font-bold text-white truncate">{serverFull.name}</span>
          <span className="text-zinc-600 text-sm shrink-0">— Ustawienia</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-44 shrink-0 border-r border-white/[0.05] flex flex-col gap-0.5 p-2 overflow-y-auto">
          {STABS.map(t => (
            <button key={t.id} onClick={() => {
              setTab(t.id);
              if (t.id === 'bans') serversApi.bans.list(serverFull.id).then(setBanList).catch(console.error);
            }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left
                ${tab === t.id ? 'bg-indigo-500/15 text-indigo-300' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

          {/* ── Ogólne ── */}
          {tab === 'overview' && (
            <div className="max-w-2xl mx-auto flex flex-col gap-5">
              <h2 className="text-base font-bold text-white">Ogólne</h2>
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Banner</label>
                <div className="relative h-32 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06]">
                  {(srvBannerFile ? URL.createObjectURL(srvBannerFile) : srvForm.banner_url) ? (
                    <img src={srvBannerFile ? URL.createObjectURL(srvBannerFile) : srvForm.banner_url} className="w-full h-full object-cover" alt=""/>
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
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.06]">
                    {(srvIconFile ? URL.createObjectURL(srvIconFile) : srvForm.icon_url) ? (
                      <img src={srvIconFile ? URL.createObjectURL(srvIconFile) : srvForm.icon_url} className="w-full h-full object-cover" alt=""/>
                    ) : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-zinc-600">{serverFull.name.charAt(0)}</div>}
                  </div>
                  <label className="cursor-pointer text-sm font-semibold bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 hover:text-white px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all">
                    <Upload size={13}/> Zmień ikonę
                    <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setSrvIconFile(f);e.target.value='';}} className="hidden"/>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Nazwa</label>
                <input value={srvForm.name} onChange={e=>setSrvForm((p:any)=>({...p,name:e.target.value}))} className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/>
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Opis</label>
                <textarea value={srvForm.description} onChange={e=>setSrvForm((p:any)=>({...p,description:e.target.value}))} rows={4} placeholder="Opis serwera..." className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm resize-none`}/>
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Kolor akcentu serwera</label>
                <div className="grid grid-cols-5 gap-2">
                  {([
                    {key:'indigo', cls:'bg-indigo-500'},
                    {key:'violet', cls:'bg-violet-500'},
                    {key:'pink',   cls:'bg-pink-500'},
                    {key:'blue',   cls:'bg-blue-500'},
                    {key:'emerald',cls:'bg-emerald-500'},
                    {key:'teal',   cls:'bg-teal-500'},
                    {key:'cyan',   cls:'bg-cyan-500'},
                    {key:'amber',  cls:'bg-amber-500'},
                    {key:'orange', cls:'bg-orange-500'},
                    {key:'rose',   cls:'bg-rose-500'},
                  ] as const).map(c => (
                    <button key={c.key} onClick={() => setSrvForm((p: any) => ({...p, accent_color: c.key}))}
                      className={`h-10 rounded-xl ${c.cls} border-2 transition-all hover:scale-105 flex items-center justify-center ${(srvForm as any).accent_color === c.key ? 'border-white scale-105' : 'border-transparent'}`}>
                      {(srvForm as any).accent_color === c.key && <Check size={14} className="text-white"/>}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveSrv} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Zapisz zmiany</button>
            </div>
          )}

          {/* ── Role ── */}
          {tab === 'roles' && (
            <div className="max-w-2xl mx-auto flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Role ({roles.length})</h2>
                <button onClick={openNewRole} className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5"><Plus size={14}/> Nowa rola</button>
              </div>
              {roles.length === 0 && <p className="text-sm text-zinc-700">Brak ról</p>}
              {roles.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] px-4 py-3 rounded-xl group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{background: r.color}}/>
                    <span className="text-sm font-semibold text-white truncate">{r.name}</span>
                    {r.is_default && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 text-amber-400 bg-amber-500/10 border border-amber-500/20">Domyślny</span>}
                    <span className="text-xs text-zinc-600 shrink-0">{(r.permissions||[]).length} uprawnień</span>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEditRole(r)} className="w-7 h-7 bg-white/[0.05] hover:bg-white/[0.09] text-zinc-400 hover:text-white rounded-lg flex items-center justify-center"><Edit3 size={12}/></button>
                    {!r.is_default && <button onClick={() => handleDeleteRole(r.id)} className="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center"><Trash2 size={12}/></button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Członkowie ── */}
          {tab === 'members' && (
            <div className="max-w-4xl mx-auto flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Członkowie ({members.length})</h2>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"/>
                  <input value={memberQ} onChange={e=>setMemberQ(e.target.value)} placeholder="Szukaj członka..." className={`${gi} text-sm pl-8 pr-4 py-2 rounded-xl w-52`}/>
                </div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_150px_120px_80px] gap-3 px-4 py-2.5 border-b border-white/[0.05]">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Użytkownik</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Rola</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Dołączył</span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Akcje</span>
                </div>
                {filteredMembers.length === 0 && <div className="px-4 py-8 text-sm text-zinc-700 text-center">Brak wyników</div>}
                {filteredMembers.map((m, i) => (
                  <div key={m.id} className={`grid grid-cols-[1fr_150px_120px_80px] gap-3 items-center px-4 py-3 ${i > 0 ? 'border-t border-white/[0.03]' : ''} hover:bg-white/[0.02] transition-colors`}>
                    {/* Użytkownik */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img src={m.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.username)}&size=36`}
                          className="w-9 h-9 rounded-full object-cover" alt=""/>
                        <StatusBadge status={m.status} size={10} className="absolute -bottom-0.5 -right-0.5"/>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{m.username}</p>
                        {m.badges && m.badges.length > 0 && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {m.badges.slice(0, 3).map(b => {
                              const BIcon = getBadgeIcon(b.name);
                              return (
                                <span key={b.id} title={b.label}
                                  className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                                  style={{color: b.color, borderColor: b.color+'40', background: b.color+'18'}}>
                                  <BIcon size={8}/>{b.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Rola */}
                    <div>
                      {m.id !== currentUser?.id && canManageRoles ? (
                        <select value={m.role_name} onChange={e => handleSetMemberRole(m.id, e.target.value)}
                          className="text-xs bg-white/[0.06] border border-white/[0.08] text-zinc-300 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500/50 w-full"
                          style={{backgroundColor:'#18181b',color:'#d4d4d8'}}>
                          {roles.map(r => <option key={r.id} value={r.name} style={{background:'#18181b',color:'#d4d4d8'}}>{r.name}{r.is_default?' ★':''}</option>)}
                          {!roles.some(r=>r.name==='Member') && <option value="Member" style={{background:'#18181b',color:'#d4d4d8'}}>Member</option>}
                          {!roles.some(r=>r.name==='Admin')  && <option value="Admin"  style={{background:'#18181b',color:'#d4d4d8'}}>Admin</option>}
                        </select>
                      ) : (
                        <span className="text-xs text-zinc-500">{m.role_name}{m.id === currentUser?.id ? ' (ty)' : ''}</span>
                      )}
                    </div>
                    {/* Dołączył */}
                    <div>
                      <span className="text-xs text-zinc-600">
                        {new Date(m.joined_at).toLocaleDateString('pl-PL', {day:'2-digit', month:'short', year:'numeric'})}
                      </span>
                    </div>
                    {/* Akcje */}
                    <div className="flex items-center gap-1">
                      {m.id !== currentUser?.id && serverFull.owner_id !== m.id && (<>
                        {canKickMembers && <button onClick={() => handleKick(m.id)} title="Wyrzuć z serwera" className="w-7 h-7 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center transition-colors"><X size={12}/></button>}
                        {canBanMembers  && <button onClick={() => handleBan(m.id, m.username)} title="Zbanuj" className="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center transition-colors"><Shield size={12}/></button>}
                      </>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Bany ── */}
          {tab === 'bans' && (
            <div className="max-w-2xl mx-auto flex flex-col gap-4">
              <h2 className="text-base font-bold text-white">Zbanowani ({banList.length})</h2>
              {banList.length === 0 && <p className="text-sm text-zinc-600">Brak zbanowanych użytkowników.</p>}
              {banList.map(b => (
                <div key={b.user_id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] px-4 py-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <img src={b.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(b.username)}&size=36`}
                      className="w-9 h-9 rounded-full object-cover" alt=""/>
                    <div>
                      <p className="text-sm font-semibold text-white">{b.username}</p>
                      {b.reason && <p className="text-xs text-zinc-600">Powód: {b.reason}</p>}
                      {b.banned_by_username && <p className="text-xs text-zinc-700">przez {b.banned_by_username}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleUnban(b.user_id)} className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors">Odbanuj</button>
                </div>
              ))}
            </div>
          )}

          {/* ── Zaproszenia ── */}
          {tab === 'invites' && (
            <div className="max-w-xl mx-auto flex flex-col gap-5">
              <h2 className="text-base font-bold text-white">Zaproszenia</h2>
              <div>
                <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Ważność zaproszenia</label>
                <select value={inviteDur} onChange={e => setInviteDur(e.target.value)} className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}>
                  <option value="1800">30 minut</option>
                  <option value="3600">1 godzina</option>
                  <option value="86400">1 dzień</option>
                  <option value="never">Nigdy</option>
                </select>
              </div>
              <button onClick={handleInvite} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Generuj zaproszenie</button>
              {inviteCode && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-4">
                  <p className="text-[10px] text-zinc-600 mb-2">LINK DO ZAPROSZENIA</p>
                  <div className="flex items-center gap-2">
                    <code className="text-white font-mono text-sm flex-1 bg-black/30 px-3 py-2 rounded-lg">{streamerMode ? '••••••••••' : inviteCode}</code>
                    <button onClick={() => navigator.clipboard.writeText(inviteCode)} className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 rounded-lg transition-colors shrink-0">Kopiuj</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Emoji ── */}
          {tab === 'emoji' && activeServer && (
            <EmojiTab
              serverId={activeServer}
              initialEmojis={serverEmojis || []}
              canManage={canManageServer}
              gi={gi}
            />
          )}

          {/* ── Automatyzacje ── */}
          {tab === 'automations' && activeServer && (
            <AutomationsTab serverId={activeServer} gi={gi}/>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel component ────────────────────────────────────────────────────
interface AdminPanelProps {
  currentUser: import('./api').UserProfile | null;
  overview: import('./api').AdminOverview | null;
  setOverview: (v: import('./api').AdminOverview | null) => void;
  tab: 'dashboard'|'users'|'servers'|'badges'|'system';
  setTab: (t: 'dashboard'|'users'|'servers'|'badges'|'system') => void;
  badges: Badge[]; setBadges: (v: Badge[]) => void;
  users: AdminUser[]; setUsers: (v: AdminUser[]) => void;
  usersTotal: number; setUsersTotal: (v: number) => void;
  usersPage: number; setUsersPage: (v: number) => void;
  serversList: import('./api').AdminServer[]; setServersList: (v: import('./api').AdminServer[]) => void;
  userQ: string; setUserQ: (v: string) => void;
  badgeForm: { name:string; label:string; color:string; icon:string };
  setBadgeForm: (v: any) => void;
  badgeSaving: boolean; setBadgeSaving: (v: boolean) => void;
  assignUser: AdminUser|null; setAssignUser: (v: AdminUser|null) => void;
  assignBadgeId: string; setAssignBadgeId: (v: string) => void;
  onBack: () => void;
  addToast: (t: any) => void;
}
function AdminPanel({ currentUser, overview, setOverview, tab, setTab, badges, setBadges, users, setUsers,
  usersTotal, setUsersTotal, usersPage, setUsersPage, serversList, setServersList,
  userQ, setUserQ, badgeForm, setBadgeForm, badgeSaving, setBadgeSaving,
  assignUser, setAssignUser, assignBadgeId, setAssignBadgeId, onBack, addToast }: AdminPanelProps) {

  const gi2 = 'bg-white/[0.06] border border-white/[0.08] text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 transition-all rounded-xl';

  React.useEffect(() => {
    // Load all data when admin panel opens
    adminApi.overview().then(d => setOverview(d)).catch(()=>{});
    adminApi.badges.list().then(d => setBadges(d)).catch(()=>{});
    adminApi.users.list(1, 50).then(d => { setUsers(d.users); setUsersTotal(d.total); }).catch(()=>{});
    adminApi.servers().then(d => setServersList(d)).catch(()=>{});
  }, []);

  // Load more users on page change
  React.useEffect(() => {
    if (usersPage === 1) return;
    adminApi.users.list(usersPage, 50).then(d => { setUsers(d.users); setUsersTotal(d.total); }).catch(()=>{});
  }, [usersPage]);

  const searchUsers = React.useCallback(async (q: string) => {
    if (!q.trim()) {
      adminApi.users.list(1, 50).then(d => { setUsers(d.users); setUsersTotal(d.total); setUsersPage(1); }).catch(()=>{});
      return;
    }
    const res = await adminApi.users.search(q).catch(()=>[]);
    setUsers(res); setUsersTotal(res.length);
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => searchUsers(userQ), 300);
    return () => clearTimeout(t);
  }, [userQ]);

  const handleCreateBadge = async () => {
    if (!badgeForm.name || !badgeForm.label) return;
    setBadgeSaving(true);
    try {
      const badge = await adminApi.badges.create(badgeForm);
      setBadges([...badges, badge]);
      setBadgeForm({ name:'', label:'', color:'#6366f1', icon:'⚙️' });
      addToast({ type:'success', message:'Odznaka utworzona' });
    } catch { addToast({ type:'error', message:'Błąd tworzenia odznaki' }); }
    finally { setBadgeSaving(false); }
  };

  const handleDeleteBadge = async (id: string) => {
    try {
      await adminApi.badges.delete(id);
      setBadges(badges.filter(b => b.id !== id));
      addToast({ type:'success', message:'Odznaka usunięta' });
    } catch { addToast({ type:'error', message:'Błąd usuwania odznaki' }); }
  };

  const handleAssignBadge = async () => {
    if (!assignUser || !assignBadgeId) return;
    try {
      await adminApi.badges.assign(assignUser.id, assignBadgeId);
      setAssignUser(null); setAssignBadgeId('');
      adminApi.users.list(usersPage, 50).then(d => { setUsers(d.users); setUsersTotal(d.total); }).catch(()=>{});
      addToast({ type:'success', message:'Odznaka przypisana' });
    } catch { addToast({ type:'error', message:'Błąd przypisywania odznaki' }); }
  };

  const handleRemoveBadge = async (userId: string, badgeId: string) => {
    try {
      await adminApi.badges.remove(userId, badgeId);
      setUsers(users.map(u => u.id===userId ? { ...u, badges: u.badges.filter(b=>b.id!==badgeId) } : u));
      addToast({ type:'success', message:'Odznaka usunięta' });
    } catch { addToast({ type:'error', message:'Błąd usuwania odznaki' }); }
  };

  const handleToggleAdmin = async (u: AdminUser) => {
    const newState = !u.is_admin;
    try {
      await adminApi.users.setAdmin(u.id, newState);
      setUsers(users.map(x => x.id===u.id ? { ...x, is_admin: newState } : x));
    } catch { addToast({ type:'error', message:'Błąd zmiany uprawnień' }); }
  };

  // Ban state (local to AdminPanel)
  const [banTarget, setBanTarget] = React.useState<AdminUser|null>(null);
  const [banForm, setBanForm] = React.useState({ type:'permanent' as 'permanent'|'temporary'|'ip', reason:'', hours:'24', ip:'' });
  const [banLoading, setBanLoading] = React.useState(false);

  const handleBanUser = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    try {
      const payload: any = { ban_type: banForm.type, reason: banForm.reason||null };
      if (banForm.type==='temporary') payload.duration_hours = parseInt(banForm.hours)||24;
      if (banForm.type==='ip') payload.ip_address = banForm.ip;
      await adminApi.users.ban(banTarget.id, payload);
      setBanTarget(null);
      setBanForm({ type:'permanent', reason:'', hours:'24', ip:'' });
      addToast({ type:'success', message:`Zbanowano ${banTarget.username}` });
    } catch (e: any) { addToast({ type:'error', message: e?.message || 'Błąd banowania' }); }
    finally { setBanLoading(false); }
  };

  const handleUnbanUser = async (u: AdminUser) => {
    try {
      await adminApi.users.unban(u.id);
      addToast({ type:'success', message:`Odbanowano ${u.username}` });
    } catch (e: any) { addToast({ type:'error', message: e?.message || 'Błąd odbanowania' }); }
  };

  const TABS: { id: 'dashboard'|'users'|'servers'|'badges'|'system'; label: string; icon: React.ReactNode }[] = [
    { id:'dashboard', label:'Dashboard', icon: <LayoutDashboard size={14}/> },
    { id:'users',     label:'Użytkownicy', icon: <Users size={14}/> },
    { id:'servers',   label:'Serwery', icon: <Server size={14}/> },
    { id:'badges',    label:'Odznaki', icon: <Award size={14}/> },
    { id:'system',    label:'System', icon: <Database size={14}/> },
  ];

  const fmtUptime = (s: number) => {
    const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
    return [d&&`${d}d`, h&&`${h}h`, `${m}m`].filter(Boolean).join(' ');
  };

  const reg7 = overview?.registrations_7d ?? [];
  const maxReg = Math.max(1, ...reg7.map(r=>r.count));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d18]">
      {/* Header */}
      <div className="h-14 border-b border-white/[0.06] flex items-center px-5 gap-4 shrink-0 glass-dark z-10">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.07] transition-all">
          <ArrowLeft size={16}/>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Shield size={16} className="text-violet-400 shrink-0"/>
          <span className="text-sm font-bold text-white">Cordyn Admin Panel</span>
          {currentUser?.badges?.find(b=>b.name==='developer')&&(
            <span className="text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5 ml-1">developer</span>
          )}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <div className="w-44 shrink-0 border-r border-white/[0.05] flex flex-col gap-0.5 p-2 overflow-y-auto">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${tab===t.id?'bg-violet-500/15 text-violet-300':'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

          {/* ── Dashboard ── */}
          {tab==='dashboard'&&(
            <div className="max-w-4xl mx-auto space-y-6">
              <h2 className="text-base font-bold text-white">Dashboard</h2>
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label:'Użytkownicy', val: overview?.total_users, icon:<Users size={16} className="text-indigo-400"/>, color:'indigo' },
                  { label:'Online teraz', val: overview?.online_users, icon:<Activity size={16} className="text-emerald-400"/>, color:'emerald' },
                  { label:'Serwery', val: overview?.total_servers, icon:<Server size={16} className="text-violet-400"/>, color:'violet' },
                  { label:'Wiadomości', val: overview?.total_messages, icon:<MessageCircle size={16} className="text-blue-400"/>, color:'blue' },
                  { label:'DM', val: overview?.total_dms, icon:<MessageSquare size={16} className="text-pink-400"/>, color:'pink' },
                  { label:'Kanały', val: overview?.total_channels, icon:<Hash size={16} className="text-amber-400"/>, color:'amber' },
                ].map(c=>(
                  <div key={c.label} className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.06]">{c.icon}</div>
                    <div>
                      <div className="text-xl font-bold text-white">{c.val ?? <Loader2 size={14} className="animate-spin text-zinc-600"/>}</div>
                      <div className="text-xs text-zinc-500">{c.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* 7-day registration chart */}
              {reg7.length>0&&(
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Rejestracje — ostatnie 7 dni</h3>
                  <div className="flex items-end gap-2 h-24">
                    {reg7.map(r=>(
                      <div key={r.date} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-[10px] text-zinc-500">{r.count}</span>
                        <div className="w-full rounded-t-lg bg-indigo-500/70 transition-all" style={{height:`${Math.max(4,(r.count/maxReg)*80)}px`}}/>
                        <span className="text-[9px] text-zinc-600">{new Date(r.date).toLocaleDateString('pl',{weekday:'short'})}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Users ── */}
          {tab==='users'&&(
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Użytkownicy <span className="text-zinc-500 font-normal text-sm">({usersTotal})</span></h2>
                <input value={userQ} onChange={e=>setUserQ(e.target.value)} placeholder="Szukaj użytkownika..." className={`${gi2} px-3 py-1.5 text-sm w-52`}/>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2 border-b border-white/[0.06] text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                  <span>Użytkownik</span><span>Status</span><span>Serwery</span><span>Wiad.</span><span>Dołączył</span><span>Akcje</span>
                </div>
                {users.map(u=>(
                  <div key={u.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">{u.username[0].toUpperCase()}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-white truncate">{u.username}</span>
                          {u.is_admin&&<span className="text-[9px] font-bold bg-violet-500/15 text-violet-400 border border-violet-500/25 rounded-full px-1.5 py-0.5 leading-none">Admin</span>}
                          {u.badges?.map(b=>(
                            <span key={b.id} style={{color:b.color,borderColor:`${b.color}40`,background:`${b.color}15`}}
                              className="text-[9px] font-bold border rounded-full px-1.5 py-0.5 leading-none flex items-center gap-0.5">
                              {b.icon} {b.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${u.status==='online'?'text-emerald-400':u.status==='idle'?'text-amber-400':u.status==='dnd'?'text-rose-400':'text-zinc-500'}`}>{u.status}</span>
                    <span className="text-xs text-zinc-400">{u.server_count ?? '-'}</span>
                    <span className="text-xs text-zinc-400">{u.message_count ?? '-'}</span>
                    <span className="text-xs text-zinc-500">{new Date(u.created_at).toLocaleDateString('pl')}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={()=>{ setAssignUser(u); setAssignBadgeId(badges[0]?.id??''); }}
                        title="Odznaki"
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-indigo-500/20 hover:text-indigo-400 text-zinc-500 transition-colors">
                        <Award size={11}/>
                      </button>
                      <button onClick={()=>handleToggleAdmin(u)} title={u.is_admin?'Odbierz admina':'Nadaj admina'}
                        className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${u.is_admin?'bg-violet-500/15 text-violet-400 hover:bg-rose-500/20 hover:text-rose-400':'bg-white/[0.04] text-zinc-500 hover:bg-violet-500/15 hover:text-violet-400'}`}>
                        <ShieldCheck size={11}/>
                      </button>
                      <button onClick={()=>{ setBanTarget(u); setBanForm({ type:'permanent', reason:'', hours:'24', ip:'' }); }}
                        title="Zbanuj / zarządzaj banem"
                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-rose-500/20 hover:text-rose-400 text-zinc-500 transition-colors">
                        <Hammer size={11}/>
                      </button>
                    </div>
                  </div>
                ))}
                {users.length===0&&<p className="text-xs text-zinc-600 text-center py-8">Brak wyników</p>}
              </div>
              {/* Pagination */}
              {usersTotal>50&&!userQ&&(
                <div className="flex justify-center gap-2">
                  <button disabled={usersPage===1} onClick={()=>setUsersPage(usersPage-1)} className="px-3 py-1.5 text-xs rounded-lg bg-white/[0.05] text-zinc-400 hover:text-white disabled:opacity-30 transition-all"><ChevronLeft size={12}/></button>
                  <span className="px-3 py-1.5 text-xs text-zinc-400">str. {usersPage} / {Math.ceil(usersTotal/50)}</span>
                  <button disabled={usersPage>=Math.ceil(usersTotal/50)} onClick={()=>setUsersPage(usersPage+1)} className="px-3 py-1.5 text-xs rounded-lg bg-white/[0.05] text-zinc-400 hover:text-white disabled:opacity-30 transition-all"><ChevronRight size={12}/></button>
                </div>
              )}
              {/* Ban dialog */}
              {banTarget&&(
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={()=>setBanTarget(null)}>
                  <div className="bg-[#16162a] border border-white/[0.09] rounded-2xl p-5 w-80 space-y-4" onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Hammer size={14} className="text-rose-400"/>
                      <h3 className="text-sm font-bold text-white">Zbanuj — {banTarget.username}</h3>
                    </div>
                    {/* Type */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-500">Typ bana</label>
                      <div className="flex gap-2">
                        {(['permanent','temporary','ip'] as const).map(t=>(
                          <button key={t} onClick={()=>setBanForm(f=>({...f,type:t}))}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${banForm.type===t?'bg-rose-500/20 text-rose-300 border-rose-500/40':'bg-white/[0.04] text-zinc-500 border-transparent hover:text-zinc-300'}`}>
                            {t==='permanent'?'Stały':t==='temporary'?'Czasowy':'IP'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Reason */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-500">Powód (opcjonalnie)</label>
                      <input value={banForm.reason} onChange={e=>setBanForm(f=>({...f,reason:e.target.value}))}
                        placeholder="np. spam, nieodpowiednie zachowanie..."
                        className="w-full bg-white/[0.06] border border-white/[0.08] text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 rounded-xl px-3 py-2 text-sm"/>
                    </div>
                    {/* Duration — only for temporary */}
                    {banForm.type==='temporary'&&(
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-500">Czas zawieszenia (godziny)</label>
                        <input value={banForm.hours} onChange={e=>setBanForm(f=>({...f,hours:e.target.value}))}
                          type="number" min="1" max="8760" placeholder="24"
                          className="w-full bg-white/[0.06] border border-white/[0.08] text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 rounded-xl px-3 py-2 text-sm"/>
                      </div>
                    )}
                    {/* IP — only for ip ban */}
                    {banForm.type==='ip'&&(
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-500">Adres IP</label>
                        <input value={banForm.ip} onChange={e=>setBanForm(f=>({...f,ip:e.target.value}))}
                          placeholder="np. 1.2.3.4"
                          className="w-full bg-white/[0.06] border border-white/[0.08] text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 rounded-xl px-3 py-2 text-sm font-mono"/>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleBanUser} disabled={banLoading||(banForm.type==='ip'&&!banForm.ip.trim())}
                        className="flex-1 bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                        {banLoading&&<Loader2 size={12} className="animate-spin"/>} Zbanuj
                      </button>
                      <button onClick={()=>handleUnbanUser(banTarget)}
                        className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 py-2 rounded-xl text-sm font-semibold transition-colors">
                        Odbanuj
                      </button>
                      <button onClick={()=>setBanTarget(null)}
                        className="px-3 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-400 rounded-xl text-sm transition-colors">
                        <X size={13}/>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Assign badge dialog */}
              {assignUser&&(
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={()=>setAssignUser(null)}>
                  <div className="bg-[#16162a] border border-white/[0.09] rounded-2xl p-5 w-72 space-y-4" onClick={e=>e.stopPropagation()}>
                    <h3 className="text-sm font-bold text-white">Przypisz odznakę — {assignUser.username}</h3>
                    <select value={assignBadgeId} onChange={e=>setAssignBadgeId(e.target.value)} className={`${gi2} w-full px-3 py-2 text-sm`}>
                      {badges.map(b=><option key={b.id} value={b.id}>{b.icon} {b.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={handleAssignBadge} className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white py-2 rounded-xl text-sm font-semibold transition-colors">Przypisz</button>
                      <button onClick={()=>setAssignUser(null)} className="flex-1 bg-white/[0.05] hover:bg-white/[0.08] text-zinc-400 py-2 rounded-xl text-sm transition-colors">Anuluj</button>
                    </div>
                    {/* Remove badge section */}
                    {assignUser.badges?.length>0&&(
                      <div>
                        <p className="text-xs text-zinc-500 mb-2">Aktualne odznaki:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {assignUser.badges.map(b=>(
                            <button key={b.id} onClick={()=>handleRemoveBadge(assignUser.id, b.id)}
                              style={{color:b.color,borderColor:`${b.color}40`,background:`${b.color}15`}}
                              className="text-[10px] font-bold border rounded-full px-2 py-0.5 flex items-center gap-1 hover:opacity-70 transition-opacity">
                              {b.icon} {b.label} <X size={9}/>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Servers ── */}
          {tab==='servers'&&(
            <div className="max-w-4xl mx-auto space-y-4">
              <h2 className="text-base font-bold text-white">Serwery <span className="text-zinc-500 font-normal text-sm">({serversList.length})</span></h2>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-2 px-4 py-2 border-b border-white/[0.06] text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                  <span>Serwer</span><span>Właściciel</span><span>Członkowie</span><span>Kanały</span><span>Utworzony</span>
                </div>
                {serversList.map(s=>(
                  <div key={s.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-2 px-4 py-3 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                        {s.icon_url ? <img src={s.icon_url} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">{s.name[0]}</div>}
                      </div>
                      <span className="text-sm font-semibold text-white truncate">{s.name}</span>
                    </div>
                    <span className="text-xs text-zinc-400 truncate">{s.owner_name}</span>
                    <span className="text-xs text-zinc-400">{s.member_count}</span>
                    <span className="text-xs text-zinc-400">{s.channel_count}</span>
                    <span className="text-xs text-zinc-500">{new Date(s.created_at).toLocaleDateString('pl')}</span>
                  </div>
                ))}
                {serversList.length===0&&<p className="text-xs text-zinc-600 text-center py-8"><Loader2 size={14} className="animate-spin inline"/></p>}
              </div>
            </div>
          )}

          {/* ── Badges ── */}
          {tab==='badges'&&(
            <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-base font-bold text-white">Odznaki</h2>
              {/* Create form */}
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nowa odznaka</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input value={badgeForm.name} onChange={e=>setBadgeForm({...badgeForm,name:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')})} placeholder="Nazwa (np. vip)" className={`${gi2} px-3 py-2 text-sm`}/>
                  <input value={badgeForm.label} onChange={e=>setBadgeForm({...badgeForm,label:e.target.value})} placeholder="Etykieta (np. VIP)" className={`${gi2} px-3 py-2 text-sm`}/>
                  <input value={badgeForm.icon} onChange={e=>setBadgeForm({...badgeForm,icon:e.target.value})} placeholder="Emoji" className={`${gi2} px-3 py-2 text-sm`}/>
                  <input value={badgeForm.color} onChange={e=>setBadgeForm({...badgeForm,color:e.target.value})} type="color" className="h-9 w-full rounded-xl border border-white/[0.08] bg-transparent cursor-pointer"/>
                </div>
                <button onClick={handleCreateBadge} disabled={badgeSaving||!badgeForm.name||!badgeForm.label}
                  className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                  {badgeSaving&&<Loader2 size={13} className="animate-spin"/>} Utwórz
                </button>
              </div>
              {/* Badge list */}
              <div className="flex flex-col gap-2">
                {badges.map(b=>(
                  <div key={b.id} className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                    <span className="text-lg">{b.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{color:b.color}} className="text-sm font-bold">{b.label}</span>
                        <span className="text-xs text-zinc-600">#{b.name}</span>
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full shrink-0" style={{background:b.color}}/>
                    <button onClick={()=>handleDeleteBadge(b.id)} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-rose-500/20 hover:text-rose-400 text-zinc-600 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
                {badges.length===0&&<p className="text-xs text-zinc-600 text-center py-4">Brak odznak</p>}
              </div>
            </div>
          )}

          {/* ── System ── */}
          {tab==='system'&&(
            <div className="max-w-xl mx-auto space-y-4">
              <h2 className="text-base font-bold text-white">System</h2>
              {overview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
                      <div className="text-xs text-zinc-500 mb-1">Node.js</div>
                      <div className="text-sm font-bold text-emerald-400">{overview.node_version}</div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4">
                      <div className="text-xs text-zinc-500 mb-1">Uptime</div>
                      <div className="text-sm font-bold text-indigo-400">{fmtUptime(overview.uptime_seconds)}</div>
                    </div>
                  </div>
                  {/* Memory bars */}
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Pamięć</h3>
                    {([
                      { label:'RSS', val: overview.memory.rss, total: overview.memory.rss, color:'bg-violet-500' },
                      { label:'Heap Used', val: overview.memory.heapUsed, total: overview.memory.heapTotal, color:'bg-indigo-500' },
                      { label:'Heap Total', val: overview.memory.heapTotal, total: overview.memory.rss, color:'bg-blue-500/60' },
                    ] as const).map(m=>(
                      <div key={m.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-400">{m.label}</span>
                          <span className="text-zinc-300 font-semibold">{m.val} MB</span>
                        </div>
                        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className={`h-full ${m.color} rounded-full transition-all`} style={{width:`${Math.min(100,(m.val/Math.max(1,m.total))*100)}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-zinc-600"/></div>}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── DnD Sortable helpers ─────────────────────────────────────────────────────
function SortableCategoryItem({ id, children, canManage }: { id: string; children: React.ReactNode; canManage: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'category' } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      {canManage && (
        <span {...attributes} {...listeners}
          className="hidden group-hover/cat:flex cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors absolute left-0 top-0 items-center h-full pl-1 z-10"
          style={{ pointerEvents: 'auto' }}>
          <GripVertical size={11}/>
        </span>
      )}
      {children}
    </div>
  );
}

function SortableChannelItem({ id, catId, children, canManage }: { id: string; catId: string; children: React.ReactNode; canManage: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: 'channel', categoryId: catId } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center group/drag">
      {canManage && (
        <span {...attributes} {...listeners}
          className="ml-0.5 cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 opacity-0 group-hover/drag:opacity-100 transition-opacity shrink-0">
          <GripVertical size={11}/>
        </span>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────
function ProfilePage({
  viewUserId, profileData, games, spotify, ownSpotify, twitch, ownTwitch, steam, ownSteam, loading,
  currentUser, editProf, setEditProf, profBannerFile, profBannerPrev,
  onBack, onOpenDm, onCall,
  handleAvatarUpload, handleBannerSelect, handleSaveProfile,
  onGameAdded, onGameRemoved,
  showGameModal, setShowGameModal, gameSearch, setGameSearch,
  gameResults, setGameResults, gameSearching, setGameSearching, gameSearchRef,
  onSpotifyConnect, onSpotifyDisconnect, onSpotifyToggle,
  onTwitchConnect, onTwitchDisconnect, onTwitchToggle,
  onSteamConnect, onSteamDisconnect, onSteamToggle,
  friends, blockedUsers, addToast,
  myJam, jamLoading, onJamStart, onJamStop, onJamJoin, onJamLeave, viewedUserJam,
  steamGameStartedAt,
}: {
  viewUserId: string; profileData: UserProfile|null; games: FavoriteGame[];
  spotify: SpotifyData|null; ownSpotify: SpotifyData|null;
  twitch: TwitchData|null; ownTwitch: TwitchData|null;
  steam: SteamData|null; ownSteam: SteamData|null;
  steamGameStartedAt?: number | null;
  loading: boolean;
  currentUser: UserProfile|null; editProf: any; setEditProf: (fn:any)=>void;
  profBannerFile: File|null; profBannerPrev: string|null;
  onBack: ()=>void; onOpenDm: (id:string)=>void;
  onCall: (id:string,un:string,av:string|null,t:'voice'|'video')=>void;
  handleAvatarUpload: (e:React.ChangeEvent<HTMLInputElement>)=>void;
  handleBannerSelect: (e:React.ChangeEvent<HTMLInputElement>)=>void;
  handleSaveProfile: ()=>void;
  onGameAdded: (g:FavoriteGame)=>void; onGameRemoved: (id:string)=>void;
  showGameModal: boolean; setShowGameModal: (v:boolean)=>void;
  gameSearch: string; setGameSearch: (v:string)=>void;
  gameResults: {rawg_id:number;name:string;cover_url:string|null;genre:string|null}[];
  setGameResults: (r:any[])=>void;
  gameSearching: boolean; setGameSearching: (v:boolean)=>void;
  gameSearchRef: React.MutableRefObject<ReturnType<typeof setTimeout>|null>;
  onSpotifyConnect: ()=>void; onSpotifyDisconnect: ()=>void; onSpotifyToggle: (v:boolean)=>void;
  onTwitchConnect: ()=>void; onTwitchDisconnect: ()=>void; onTwitchToggle: (v:boolean)=>void;
  onSteamConnect: ()=>void; onSteamDisconnect: ()=>void; onSteamToggle: (v:boolean)=>void;
  friends: {id:string}[]; blockedUsers: Set<string>;
  addToast: (m:string,t?:any)=>void;
  myJam: SpotifyJamSession; jamLoading: boolean;
  onJamStart: ()=>void; onJamStop: ()=>void;
  onJamJoin: (hostId:string)=>void; onJamLeave: ()=>void;
  viewedUserJam?: { jam_id: string; host: any; members: any[] } | null;
}) {
  const isOwn   = currentUser?.id === viewUserId;
  const user    = profileData || (isOwn ? currentUser : null);
  const disp    = isOwn ? editProf : user;
  const gi      = 'bg-white/[0.06] border border-white/[0.08] text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] transition-all rounded-xl';
  const gm      = 'glass-modal rounded-3xl';
  const isFriend = friends.some((f:any) => f.id === viewUserId);
  const isBlocked = blockedUsers.has(viewUserId);

  // Game search handler
  const handleGameSearchChange = (val: string) => {
    setGameSearch(val);
    if (gameSearchRef.current) clearTimeout(gameSearchRef.current);
    if (!val.trim()) { setGameResults([]); return; }
    setGameSearching(true);
    gameSearchRef.current = setTimeout(async () => {
      try {
        const r = await gamesApi.search(val);
        setGameResults(r);
      } catch {}
      setGameSearching(false);
    }, 400);
  };

  const handleAddGame = async (g: {rawg_id:number;name:string;cover_url:string|null;genre:string|null}) => {
    try {
      const added = await gamesApi.add({ game_name: g.name, game_cover_url: g.cover_url, game_genre: g.genre, rawg_id: g.rawg_id });
      onGameAdded(added);
      setShowGameModal(false); setGameSearch(''); setGameResults([]);
      addToast(`Dodano ${g.name}`, 'success');
    } catch (e:any) { addToast(e.message || 'Błąd dodawania gry', 'error'); }
  };

  const handleRemoveGame = async (id: string, name: string) => {
    try {
      await gamesApi.remove(id);
      onGameRemoved(id);
      addToast(`Usunięto ${name}`, 'info');
    } catch { addToast('Błąd usuwania gry', 'error'); }
  };

  // For own profile: prefer full spotify data (with tracks) from userPublic, fall back to status-only
  const spotifyToShow = isOwn ? (spotify || ownSpotify) : spotify;
  const twitchToShow  = isOwn ? (twitch || ownTwitch)   : twitch;
  const steamToShow   = isOwn ? (steam  || ownSteam)    : steam;

  const bannerSrc = isOwn
    ? (profBannerPrev || editProf?.banner_url || null)
    : (user?.banner_url || null);
  const bannerGrad = isOwn
    ? (editProf?.banner_color || getBannerGradient(viewUserId))
    : (user?.banner_color || getBannerGradient(viewUserId));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0e0e1c]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] shrink-0">
        <button onClick={onBack}
          className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white transition-all">
          <ArrowLeft size={15}/>
        </button>
        <span className="text-sm font-semibold text-zinc-300">
          {loading ? 'Ładowanie...' : user ? `@${user.username}` : 'Profil użytkownika'}
        </span>
      </div>

      {loading && !user ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="text-indigo-400 animate-spin"/>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Banner — replaced by Twitch iframe when live */}
          <div className="relative h-44 shrink-0 overflow-hidden">
            {twitchToShow?.is_live && twitchToShow.stream && twitchToShow.login ? (
              <>
                <iframe
                  src={`https://player.twitch.tv/?channel=${twitchToShow.login}&parent=${window.location.hostname}&muted=true&autoplay=true`}
                  width="100%" height="100%"
                  allowFullScreen
                  title="Twitch Stream"
                  className="block w-full h-full border-0"
                />
                {/* Live overlay badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                  <span className="text-[11px] font-bold text-white">NA ŻYWO</span>
                  <span className="text-[11px] text-zinc-300">·</span>
                  <span className="text-[11px] text-zinc-300 truncate max-w-[120px]">{twitchToShow.stream.game_name}</span>
                  <span className="text-[11px] text-zinc-400">· {twitchToShow.stream.viewer_count.toLocaleString()} widzów</span>
                </div>
              </>
            ) : bannerSrc ? (
              <img src={bannerSrc} className="w-full h-full object-cover" alt=""/>
            ) : (
              <div className={`w-full h-full bg-gradient-to-r ${bannerGrad}`}/>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0e0e1c]/80 pointer-events-none"/>
            {isOwn && !(twitchToShow?.is_live) && (
              <label className="absolute top-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/75 rounded-xl flex items-center justify-center cursor-pointer transition-all border border-white/10">
                <Upload size={14} className="text-white"/>
                <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden"/>
              </label>
            )}
          </div>

          {/* Avatar row */}
          <div className="relative px-6 -mt-14 flex items-end justify-between mb-5">
            <div className="relative z-10">
              <div className="rounded-2xl p-1 bg-[#0e0e1c]">
                <div className="relative">
                  <img src={ava(user || { username: '?' })} className="w-24 h-24 rounded-2xl object-cover" alt=""/>
                  <StatusBadge status={(user?.status)||'offline'} size={16} className="absolute -bottom-1 -right-1"/>
                </div>
              </div>
              {isOwn && (
                <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center cursor-pointer z-10 shadow-lg border border-[#0e0e1c] transition-all">
                  <Upload size={11} className="text-white"/>
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
                </label>
              )}
            </div>
            {/* Action buttons for other users */}
            {!isOwn && user && (
              <div className="flex gap-2 pb-1">
                {!isBlocked && (
                  <button onClick={()=>onOpenDm(viewUserId)}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-lg shadow-indigo-500/20 transition-all">
                    <MessageSquare size={14}/> Wiadomość
                  </button>
                )}
                <button onClick={()=>onCall(viewUserId, user.username, user.avatar_url||null, 'voice')}
                  className="w-9 h-9 bg-white/[0.04] border border-white/[0.06] rounded-xl flex items-center justify-center text-zinc-400 hover:text-emerald-400 transition-all">
                  <Phone size={16}/>
                </button>
                <button onClick={()=>onCall(viewUserId, user.username, user.avatar_url||null, 'video')}
                  className="w-9 h-9 bg-white/[0.04] border border-white/[0.06] rounded-xl flex items-center justify-center text-zinc-400 hover:text-sky-400 transition-all">
                  <Video size={16}/>
                </button>
              </div>
            )}
          </div>

          {/* Content grid */}
          <div className="px-6 pb-8 flex gap-6 flex-col lg:flex-row">

            {/* ── Left sidebar ── */}
            <div className="lg:w-64 shrink-0 flex flex-col gap-4">
              {/* Name & tag */}
              <div>
                {isOwn ? (
                  <div className="flex flex-col gap-2">
                    <input value={editProf?.username||''} onChange={e=>setEditProf((p:any)=>({...p,username:e.target.value}))}
                      className={`text-xl font-black bg-transparent border-b border-white/10 focus:border-indigo-500/50 outline-none text-white w-full pb-0.5 transition-all`}/>
                    <p className="text-xs text-zinc-500 font-mono">#{(viewUserId||'0000').slice(-4).toUpperCase()}</p>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-black text-white leading-tight">{user?.username}</h2>
                    <p className="text-xs text-zinc-500 font-mono">#{(viewUserId||'0000').slice(-4).toUpperCase()}</p>
                  </>
                )}
              </div>

              {/* Custom status */}
              {isOwn ? (
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 block">Status</label>
                  <input value={editProf?.custom_status||''} onChange={e=>setEditProf((p:any)=>({...p,custom_status:e.target.value}))}
                    placeholder="Np. 🎮 Gram w gry..." className={`w-full ${gi} px-3 py-2 text-sm`}/>
                </div>
              ) : user?.custom_status ? (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                    <Quote size={9} className="text-zinc-400"/>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-tl-sm px-3 py-2 max-w-full">
                    <p className="text-xs text-zinc-300 leading-relaxed break-words">{user.custom_status}</p>
                  </div>
                </div>
              ) : null}

              {/* Badges */}
              {Array.isArray(disp?.badges) && disp.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {disp.badges.map((b:Badge)=>{
                    const BIcon = getBadgeIcon(b.name);
                    return (
                      <div key={b.id} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                        style={{background:b.color+'18',border:'1px solid '+b.color+'45'}}>
                        <BIcon size={11} style={{color:b.color}} className="shrink-0"/>
                        <span className="text-[11px] font-semibold" style={{color:b.color}}>{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bio */}
              <div>
                <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 block">O mnie</label>
                {isOwn ? (
                  <textarea value={editProf?.bio||''} onChange={e=>setEditProf((p:any)=>({...p,bio:e.target.value}))}
                    rows={4} placeholder="Napisz coś o sobie..."
                    className={`w-full ${gi} px-3 py-2.5 text-sm resize-none`}/>
                ) : user?.bio ? (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3">
                    <p className="text-xs text-zinc-300 leading-relaxed">{user.bio}</p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-700 italic">Brak opisu</p>
                )}
              </div>

              {/* Meta info */}
              <div className="flex flex-col gap-2">
                {user?.created_at && (
                  <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
                    <CalendarDays size={13} className="text-indigo-400 shrink-0"/>
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold leading-none mb-0.5">Dołączył/a</p>
                      <p className="text-xs text-zinc-300 font-medium">{new Date(user.created_at).toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric'})}</p>
                    </div>
                  </div>
                )}
                {typeof user?.mutual_friends_count==='number' && user.mutual_friends_count > 0 && (
                  <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
                    <Users size={13} className="text-indigo-400 shrink-0"/>
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold leading-none mb-0.5">Wspólni znajomi</p>
                      <p className="text-xs text-zinc-300 font-medium">{user.mutual_friends_count}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Banner color picker (own) */}
              {isOwn && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 block">Kolor bannera</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {GRADIENTS.map(g=>(
                      <button key={g} onClick={()=>setEditProf((p:any)=>({...p,banner_color:g}))}
                        className={`h-7 rounded-lg bg-gradient-to-r ${g} border-2 transition-all ${editProf?.banner_color===g?'border-white scale-105':'border-transparent'}`}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Save button (own) */}
              {isOwn && (
                <button onClick={handleSaveProfile}
                  className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all text-sm">
                  Zapisz zmiany
                </button>
              )}
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 flex flex-col gap-6 min-w-0">

              {/* Games section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Gamepad2 size={13} className="text-zinc-600"/>{isOwn?'Moje ulubione gry':'Ulubione gry'}
                  </h3>
                  {isOwn && games.length < 6 && (
                    <button onClick={()=>setShowGameModal(true)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg transition-all">
                      <Plus size={12}/> Dodaj grę
                    </button>
                  )}
                </div>
                {games.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-6 text-center">
                    <Gamepad2 size={28} className="text-zinc-800 mx-auto mb-2"/>
                    <p className="text-xs text-zinc-700">{isOwn ? 'Dodaj swoje ulubione gry' : 'Brak ulubionych gier'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {games.map(g => (
                      <div key={g.id} className="group relative bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.12] transition-all">
                        {g.game_cover_url ? (
                          <img src={g.game_cover_url} alt={g.game_name} className="w-full h-28 object-cover"/>
                        ) : (
                          <div className="w-full h-28 bg-white/[0.04] flex items-center justify-center">
                            <Gamepad2 size={32} className="text-zinc-700"/>
                          </div>
                        )}
                        <div className="px-3 py-2.5">
                          <p className="text-sm font-semibold text-white truncate">{g.game_name}</p>
                          {g.game_genre && <p className="text-xs text-zinc-600">{g.game_genre}</p>}
                        </div>
                        {isOwn && (
                          <button onClick={()=>handleRemoveGame(g.id, g.game_name)}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-rose-500/80 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                            <X size={12} className="text-white"/>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Spotify section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <SpotifyIcon size={13} className="text-[#1DB954]"/>Muzyka Spotify
                  </h3>
                  {isOwn && ownSpotify?.connected && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600">Pokaż na profilu</span>
                      <button onClick={()=>onSpotifyToggle(!ownSpotify.show_on_profile)}
                        className={`relative w-10 h-5 rounded-full transition-all ${ownSpotify.show_on_profile?'bg-emerald-500':'bg-white/[0.08]'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${ownSpotify.show_on_profile?'left-[22px]':'left-0.5'}`}/>
                      </button>
                    </div>
                  )}
                </div>

                {isOwn && !ownSpotify?.connected ? (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-5 py-6 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-[#1DB954]/10 border border-[#1DB954]/25 rounded-2xl flex items-center justify-center">
                      <Music size={22} className="text-[#1DB954]"/>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white mb-1">Połącz Spotify</p>
                      <p className="text-xs text-zinc-600">Pokaż co teraz słuchasz i swoje ulubione utwory</p>
                    </div>
                    <button onClick={onSpotifyConnect}
                      className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-[#1DB954]/20">
                      <Link2 size={14}/> Połącz Spotify
                    </button>
                  </div>
                ) : isOwn && ownSpotify?.connected ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-[#1DB954]/8 border border-[#1DB954]/20 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#1DB954]/15 rounded-lg flex items-center justify-center">
                          <Music size={13} className="text-[#1DB954]"/>
                        </div>
                        <span className="text-sm text-[#1DB954] font-medium">Połączono jako {ownSpotify.display_name || 'Spotify'}</span>
                      </div>
                      <button onClick={onSpotifyDisconnect}
                        className="text-xs text-zinc-600 hover:text-rose-400 flex items-center gap-1 transition-all">
                        <Link2Off size={12}/> Odłącz
                      </button>
                    </div>
                    <SpotifyDisplay spotify={spotifyToShow || ownSpotify}/>
                    {/* JAM controls for own profile */}
                    <div className="mt-3">
                      {myJam.role === 'host' ? (
                        <div className="bg-[#1DB954]/8 border border-[#1DB954]/20 rounded-2xl px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse"/>
                              <span className="text-xs font-bold text-[#1DB954]">JAM aktywny</span>
                              <span className="text-xs text-zinc-500">{myJam.members.length} słuchaczy</span>
                            </div>
                            <button onClick={onJamStop} disabled={jamLoading}
                              className="text-xs text-zinc-600 hover:text-rose-400 transition-all">
                              Zakończ JAM
                            </button>
                          </div>
                        </div>
                      ) : myJam.role === 'listener' ? (
                        <div className="bg-[#1DB954]/8 border border-[#1DB954]/20 rounded-2xl px-4 py-3 flex items-center justify-between">
                          <span className="text-xs text-[#1DB954]">Słuchasz razem z {myJam.host?.username}</span>
                          <button onClick={onJamLeave} disabled={jamLoading}
                            className="text-xs text-zinc-600 hover:text-rose-400 transition-all">
                            Opuść JAM
                          </button>
                        </div>
                      ) : ownSpotify?.connected ? (
                        <button onClick={onJamStart} disabled={jamLoading}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/20 text-[#1DB954] text-xs font-semibold transition-all active:scale-95">
                          <SpotifyIcon size={13}/> {jamLoading ? 'Ładowanie...' : 'Rozpocznij JAM'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : spotifyToShow?.connected && spotifyToShow?.show_on_profile ? (
                  <>
                    <SpotifyDisplay spotify={spotifyToShow}/>
                    {/* JAM join button for friend's profile */}
                    {viewedUserJam && (
                      <div className="mt-3 bg-[#1DB954]/8 border border-[#1DB954]/20 rounded-2xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse"/>
                          <span className="text-xs text-[#1DB954] font-semibold">JAM w toku</span>
                          <span className="text-xs text-zinc-500">{viewedUserJam.members.length} słuchaczy</span>
                        </div>
                        {myJam.role === 'listener' && myJam.jam_id === viewedUserJam.jam_id ? (
                          <button onClick={onJamLeave} disabled={jamLoading}
                            className="text-xs bg-[#1DB954]/20 text-[#1DB954] hover:bg-[#1DB954]/30 px-3 py-1.5 rounded-lg transition-all">
                            Opuszczasz ✓
                          </button>
                        ) : (
                          <button onClick={()=>onJamJoin(viewedUserJam.jam_id)} disabled={jamLoading}
                            className="text-xs bg-[#1DB954]/20 text-[#1DB954] hover:bg-[#1DB954]/30 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                            <SpotifyIcon size={11}/> Dołącz do JAM
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-6 text-center">
                    <Music size={28} className="text-zinc-800 mx-auto mb-2"/>
                    <p className="text-xs text-zinc-700">Brak połączenia Spotify</p>
                  </div>
                )}
              </div>

              {/* Twitch section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <TwitchIcon size={13} className="text-purple-400"/> Twitch
                  </h3>
                  {isOwn && ownTwitch?.connected && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600">Pokaż na profilu</span>
                      <button onClick={()=>onTwitchToggle(!ownTwitch.show_on_profile)}
                        className={`relative w-10 h-5 rounded-full transition-all ${ownTwitch.show_on_profile?'bg-purple-500':'bg-white/[0.08]'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${ownTwitch.show_on_profile?'left-[22px]':'left-0.5'}`}/>
                      </button>
                    </div>
                  )}
                </div>

                {isOwn && !ownTwitch?.connected ? (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-5 py-6 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/25 rounded-2xl flex items-center justify-center">
                      <span className="text-xl">📺</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white mb-1">Połącz Twitch</p>
                      <p className="text-xs text-zinc-600">Pokaż swój stream na żywo na profilu</p>
                    </div>
                    <button onClick={onTwitchConnect}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-purple-500/20">
                      <Link2 size={14}/> Połącz Twitch
                    </button>
                  </div>
                ) : isOwn && ownTwitch?.connected ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-purple-500/8 border border-purple-500/20 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-purple-500/15 rounded-lg flex items-center justify-center">
                          <span className="text-sm">📺</span>
                        </div>
                        <div>
                          <span className="text-sm text-purple-400 font-medium">Połączono jako {ownTwitch.display_name || ownTwitch.login || 'Twitch'}</span>
                          {ownTwitch.is_live && <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">NA ŻYWO</span>}
                        </div>
                      </div>
                      <button onClick={onTwitchDisconnect}
                        className="text-xs text-zinc-600 hover:text-rose-400 flex items-center gap-1 transition-all">
                        <Link2Off size={12}/> Odłącz
                      </button>
                    </div>
                    {twitchToShow?.is_live && twitchToShow.stream && (
                      <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                        <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">🔴 NA ŻYWO</span>
                        <span className="text-xs text-white truncate">{twitchToShow.stream.game_name}</span>
                        <span className="text-xs text-zinc-500 ml-auto shrink-0">{twitchToShow.stream.viewer_count.toLocaleString()} widzów</span>
                      </div>
                    )}
                  </div>
                ) : twitchToShow?.connected && twitchToShow?.show_on_profile ? (
                  twitchToShow.is_live && twitchToShow.stream ? (
                    <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">🔴 NA ŻYWO</span>
                      <span className="text-xs text-white truncate">{twitchToShow.stream.game_name}</span>
                      <span className="text-xs text-zinc-500 ml-auto shrink-0">{twitchToShow.stream.viewer_count.toLocaleString()} widzów</span>
                    </div>
                  ) : (
                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <span className="text-sm">📺</span>
                      <span className="text-sm text-purple-300">{twitchToShow.display_name || twitchToShow.login}</span>
                      <span className="text-xs text-zinc-600 ml-auto">Offline</span>
                    </div>
                  )
                ) : (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-6 text-center">
                    <span className="text-2xl block mb-2">📺</span>
                    <p className="text-xs text-zinc-700">Brak połączenia Twitch</p>
                  </div>
                )}
              </div>

              {/* Steam section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <SteamIcon size={13} className="text-zinc-400"/> Steam
                  </h3>
                  {isOwn && ownSteam?.connected && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-600">Pokaż na profilu</span>
                      <button onClick={()=>onSteamToggle(!ownSteam.show_on_profile)}
                        className={`relative w-10 h-5 rounded-full transition-all ${ownSteam.show_on_profile?'bg-blue-500':'bg-white/[0.08]'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${ownSteam.show_on_profile?'left-[22px]':'left-0.5'}`}/>
                      </button>
                    </div>
                  )}
                </div>

                {isOwn && !ownSteam?.connected ? (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-5 py-6 flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex items-center justify-center">
                      <Gamepad2 size={20} className="text-blue-400"/>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white mb-1">Połącz Steam</p>
                      <p className="text-xs text-zinc-600">Pokaż w co aktualnie grasz</p>
                    </div>
                    <button onClick={onSteamConnect}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20">
                      <Link2 size={14}/> Połącz Steam
                    </button>
                  </div>
                ) : isOwn && ownSteam?.connected ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-blue-500/8 border border-blue-500/20 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        {ownSteam.avatar_url && <img src={ownSteam.avatar_url} className="w-7 h-7 rounded-lg object-cover" alt=""/>}
                        <span className="text-sm text-blue-400 font-medium">{ownSteam.display_name || 'Steam'}</span>
                      </div>
                      <button onClick={onSteamDisconnect}
                        className="text-xs text-zinc-600 hover:text-rose-400 flex items-center gap-1 transition-all">
                        <Link2Off size={12}/> Odłącz
                      </button>
                    </div>
                    {steamToShow?.current_game && (
                      <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                        <img src={steamToShow.current_game.header_image} alt={steamToShow.current_game.name} className="w-16 h-9 rounded-lg object-cover shrink-0"/>
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
                            Gra teraz
                          </p>
                          <p className="text-sm text-white font-medium truncate">{steamToShow.current_game.name}</p>
                          {steamGameStartedAt && (
                            <p className="text-[11px] text-zinc-600 mt-0.5 flex items-center gap-1">
                              <Clock size={10}/> Grasz od {fmtGameDur(steamGameStartedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : steamToShow?.connected && steamToShow?.show_on_profile ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 rounded-xl px-3.5 py-2.5">
                      {steamToShow.avatar_url && <img src={steamToShow.avatar_url} className="w-7 h-7 rounded-lg object-cover" alt=""/>}
                      <span className="text-sm text-blue-300">{steamToShow.display_name}</span>
                    </div>
                    {steamToShow.current_game && (
                      <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5">
                        <img src={steamToShow.current_game.header_image} alt={steamToShow.current_game.name} className="w-16 h-9 rounded-lg object-cover shrink-0"/>
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
                            Gra teraz
                          </p>
                          <p className="text-sm text-white font-medium truncate">{steamToShow.current_game.name}</p>
                          {steamGameStartedAt && (
                            <p className="text-[11px] text-zinc-600 mt-0.5 flex items-center gap-1">
                              <Clock size={10}/> Grasz od {fmtGameDur(steamGameStartedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-6 text-center">
                    <Gamepad2 size={28} className="text-zinc-800 mx-auto mb-2"/>
                    <p className="text-xs text-zinc-700">Brak połączenia Steam</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Game search modal */}
      <AnimatePresence>
        {showGameModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
            onClick={()=>{setShowGameModal(false);setGameSearch('');setGameResults([]);}}>
            <motion.div initial={{scale:0.93,y:16,opacity:0}} animate={{scale:1,y:0,opacity:1}} exit={{scale:0.93,y:16,opacity:0}}
              transition={{type:'spring',stiffness:380,damping:32}}
              onClick={e=>e.stopPropagation()}
              className={`${gm} w-full max-w-sm overflow-hidden`}>
              <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <h3 className="font-bold text-white flex items-center gap-2"><Gamepad2 size={15} className="text-indigo-400"/> Dodaj ulubioną grę</h3>
                <button onClick={()=>{setShowGameModal(false);setGameSearch('');setGameResults([]);}} className="text-zinc-600 hover:text-white transition-all"><X size={16}/></button>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"/>
                  <input
                    autoFocus
                    value={gameSearch}
                    onChange={e=>handleGameSearchChange(e.target.value)}
                    placeholder="Szukaj gry (np. Minecraft)..."
                    className="w-full bg-white/[0.06] border border-white/[0.08] text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 transition-all rounded-xl pl-9 pr-3 py-2.5 text-sm"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                  {gameSearching && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={20} className="text-indigo-400 animate-spin"/>
                    </div>
                  )}
                  {!gameSearching && gameSearch && gameResults.length === 0 && (
                    <p className="text-xs text-zinc-600 text-center py-4">Nie znaleziono gier</p>
                  )}
                  {gameResults.map(g => (
                    <button key={g.rawg_id} onClick={()=>handleAddGame(g)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-all text-left w-full">
                      {g.cover_url ? (
                        <img src={g.cover_url} alt={g.name} className="w-10 h-10 rounded-lg object-cover shrink-0"/>
                      ) : (
                        <div className="w-10 h-10 bg-white/[0.04] rounded-lg flex items-center justify-center shrink-0">
                          <Gamepad2 size={18} className="text-zinc-600"/>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                        {g.genre && <p className="text-xs text-zinc-600">{g.genre}</p>}
                      </div>
                      <Plus size={14} className="text-indigo-400 shrink-0"/>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SpotifyDisplay ────────────────────────────────────────────────────────────
function SpotifyDisplay({ spotify }: { spotify: SpotifyData }) {
  const { current_playing: cp, top_tracks: tt } = spotify;

  const [elapsed, setElapsed] = useState(cp?.progress_ms ?? 0);
  const elapsedRef = useRef(elapsed);
  useEffect(() => {
    elapsedRef.current = cp?.progress_ms ?? 0;
    setElapsed(cp?.progress_ms ?? 0);
    if (!cp?.is_playing || !cp.duration_ms) return;
    const t = setInterval(() => {
      elapsedRef.current = Math.min(elapsedRef.current + 1000, cp.duration_ms!);
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp?.name, cp?.artists, cp?.is_playing]);

  const fmtMs = (ms: number) => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

  return (
    <div className="flex flex-col gap-3">
      {/* Currently playing */}
      {cp ? (
        <div className="bg-[#1DB954]/8 border border-[#1DB954]/20 rounded-2xl p-3.5">
          <div className="flex items-center gap-3 mb-2.5">
            {cp.album_cover && (
              <img src={cp.album_cover} alt={cp.name} className="w-12 h-12 rounded-xl object-cover shrink-0"/>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {cp.is_playing && (
                  <div className="flex items-end gap-[2px] h-3">
                    {[1,2,3].map(i=>(
                      <span key={i} className="w-[3px] bg-[#1DB954] rounded-sm animate-bounce"
                        style={{height:'100%',animationDelay:`${i*80}ms`,animationDuration:'0.6s'}}/>
                    ))}
                  </div>
                )}
                <span className="text-[10px] text-[#1DB954] font-bold uppercase tracking-wider">
                  {cp.is_playing ? 'Teraz gra' : 'Ostatnio grał'}
                </span>
              </div>
              <p className="text-sm font-semibold text-white truncate">{cp.name}</p>
              <p className="text-xs text-zinc-500 truncate">{cp.artists}</p>
            </div>
            {cp.external_url && (
              <a href={cp.external_url} target="_blank" rel="noopener noreferrer"
                className="w-7 h-7 bg-[#1DB954]/15 hover:bg-[#1DB954]/30 rounded-lg flex items-center justify-center text-[#1DB954] transition-all shrink-0">
                <ExternalLink size={12}/>
              </a>
            )}
          </div>
          {cp.is_playing && cp.duration_ms && cp.duration_ms > 0 && (
            <div>
              <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-[#1DB954] rounded-full"
                  style={{ width: `${Math.min((elapsed/cp.duration_ms)*100,100)}%`, transition:'width 1s linear' }}/>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600">
                <span>{fmtMs(elapsed)}</span>
                <span>{fmtMs(cp.duration_ms)}</span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Top tracks */}
      {tt && tt.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Ulubione utwory</p>
          <div className="flex flex-col gap-1">
            {tt.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-all group">
                <span className="text-xs text-zinc-700 w-4 shrink-0">{i+1}</span>
                {t.album_cover ? (
                  <img src={t.album_cover} alt={t.name} className="w-8 h-8 rounded-lg object-cover shrink-0"/>
                ) : (
                  <div className="w-8 h-8 bg-white/[0.04] rounded-lg flex items-center justify-center shrink-0">
                    <Music size={14} className="text-zinc-600"/>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{t.name}</p>
                  <p className="text-xs text-zinc-600 truncate">{t.artists}</p>
                </div>
                {t.external_url && (
                  <a href={t.external_url} target="_blank" rel="noopener noreferrer"
                    className="w-6 h-6 bg-transparent hover:bg-[#1DB954]/15 rounded-lg flex items-center justify-center text-zinc-700 hover:text-[#1DB954] transition-all opacity-0 group-hover:opacity-100">
                    <ExternalLink size={11}/>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HoverCard ────────────────────────────────────────────────────────────────
function HoverCard({ userId, x, y, currentUserId, onOpenDm, onCall, onOpenProfile, cache, activity, twitchActivity, steamActivity, steamGameStartedAt, onMouseEnter, onMouseLeave }: {
  userId: string; x: number; y: number;
  currentUserId: string | undefined;
  onOpenDm: (id: string) => void;
  onCall: (id: string, un: string, av: string|null, t: 'voice'|'video') => void;
  onOpenProfile: (id: string) => void;
  cache: React.MutableRefObject<Map<string, {profile:UserProfile|null;games:FavoriteGame[];spotify:SpotifyData|null;loadedAt:number}>>;
  activity: {name:string;artists:string;album_cover:string|null;external_url:string|null}|null|undefined;
  twitchActivity: TwitchStream | null | undefined;
  steamActivity: SteamGame | null | undefined;
  steamGameStartedAt: number | null | undefined;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [data, setData] = React.useState<{profile:UserProfile|null;games:FavoriteGame[];spotify:SpotifyData|null}|null>(null);
  const isSelf = userId === currentUserId;
  React.useEffect(() => {
    const cached = cache.current.get(userId);
    const CACHE_TTL = 60_000;
    if (cached && Date.now() - cached.loadedAt < CACHE_TTL) { setData(cached); return; }
    const tk = localStorage.getItem('cordyn_token') || '';
    Promise.allSettled([
      fetch(`/api/users/${userId}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r=>r.json()),
      fetch(`/api/games/user/${userId}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r=>r.json()),
      fetch(`/api/spotify/user/${userId}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r=>r.json()),
    ]).then(([p,g,s]) => {
      const entry = {
        profile: p.status==='fulfilled' ? p.value : null,
        games: g.status==='fulfilled' && Array.isArray(g.value) ? g.value : [],
        spotify: s.status==='fulfilled' ? s.value : null,
        loadedAt: Date.now(),
      };
      cache.current.set(userId, entry);
      setData(entry);
    });
  }, [userId]);

  const sc = (st: string) => st==='online'?'bg-emerald-400':st==='idle'?'bg-amber-400':st==='dnd'?'bg-rose-500':'bg-zinc-600';
  const scText = (st: string) => st==='online'?'Dostępny':st==='idle'?'Zaraz wracam':st==='dnd'?'Nie przeszkadzać':'Offline';
  const u = data?.profile;
  // Respect show_on_profile from fetched data; activity from socket is only shown if show_on_profile is true
  const showSpotify = data?.spotify?.show_on_profile !== false;
  const nowPlaying: (SpotifyTrack & {is_playing?:boolean}) | null | undefined =
    showSpotify
      ? (activity !== undefined
          ? (activity ? { name: activity.name, artists: activity.artists, album_cover: activity.album_cover, external_url: activity.external_url, is_playing: true } : null)
          : data?.spotify?.current_playing)
      : null;

  // Real-time progress
  const [elapsed, setElapsed] = React.useState(nowPlaying?.progress_ms ?? 0);
  const elapsedRef = React.useRef(elapsed);
  React.useEffect(() => {
    if (!nowPlaying?.is_playing || !nowPlaying.progress_ms) { setElapsed(nowPlaying?.progress_ms ?? 0); return; }
    elapsedRef.current = nowPlaying.progress_ms;
    setElapsed(nowPlaying.progress_ms);
    const t = setInterval(() => {
      elapsedRef.current += 1000;
      setElapsed(Math.min(elapsedRef.current, nowPlaying.duration_ms ?? elapsedRef.current));
    }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.name, nowPlaying?.artists]);

  const fmtMs = (ms: number) => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

  // Position card: prefer right side, flip to left if near right edge
  const cardW = 280;
  const left = x + 16 + cardW > window.innerWidth ? x - cardW - 8 : x + 16;
  const top = Math.min(y - 8, window.innerHeight - 420);

  return (
    <div className="fixed z-[9999]"
      style={{ left, top, width: cardW }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}>
      <div className="bg-[#18182a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Banner */}
        <div className="h-16 relative" style={u?.banner_url
          ? { backgroundImage: `url(${u.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(135deg, #2e2e48 0%, #1a1a2e 100%)' }}>
          {/* Avatar */}
          <div className="absolute -bottom-6 left-4">
            <div className="relative av-frozen av-active" style={{'--av-url':`url("${u?.avatar_url||`https://api.dicebear.com/9.x/identicon/svg?seed=${u?.username||userId}`}")`} as React.CSSProperties}>
              <img src={u?.avatar_url||`https://api.dicebear.com/9.x/identicon/svg?seed=${u?.username||userId}`}
                className={`w-14 h-14 rounded-2xl object-cover border-4 border-[#18182a] av-eff-${u?.avatar_effect||'none'} av-sc`} alt=""/>
              <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#18182a] ${sc(u?.status||'offline')}`}/>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-8 px-4 pb-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-base font-bold text-white leading-tight">{u?.username||'...'}</p>
              <p className={`text-[11px] mt-0.5 ${sc(u?.status||'offline').replace('bg-','text-')}`}>{scText(u?.status||'offline')}</p>
            </div>
            {!isSelf && u && (
              <div className="flex gap-1.5">
                <button onClick={()=>onOpenDm(userId)}
                  className="w-7 h-7 bg-white/[0.06] hover:bg-indigo-500/20 border border-white/[0.08] rounded-lg flex items-center justify-center text-zinc-400 hover:text-indigo-400 transition-all" title="Wiadomość">
                  <MessageCircle size={13}/>
                </button>
                <button onClick={()=>onCall(userId, u.username, u.avatar_url||null, 'voice')}
                  className="w-7 h-7 bg-white/[0.06] hover:bg-emerald-500/20 border border-white/[0.08] rounded-lg flex items-center justify-center text-zinc-400 hover:text-emerald-400 transition-all" title="Połączenie głosowe">
                  <Phone size={13}/>
                </button>
              </div>
            )}
          </div>

          {/* Custom status */}
          {u?.custom_status && <p className="text-xs text-zinc-500 mb-2 truncate max-w-[200px]">{u.custom_status}</p>}

          {/* Bio */}
          {u?.bio && <p className="text-xs text-zinc-500 mb-3 leading-relaxed line-clamp-2 border-t border-white/[0.05] pt-2 mt-2">{u.bio}</p>}

          {/* Now playing */}
          {nowPlaying && (
            <div className="bg-[#1DB954]/8 border border-[#1DB954]/20 rounded-xl px-3 py-2.5 mb-3">
              <div className="flex items-center gap-2.5 mb-2">
                {nowPlaying.album_cover
                  ? <img src={nowPlaying.album_cover} className="w-9 h-9 rounded-lg object-cover shrink-0" alt=""/>
                  : <div className="w-9 h-9 bg-[#1DB954]/15 rounded-lg flex items-center justify-center shrink-0"><Music size={14} className="text-[#1DB954]"/></div>}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-[#1DB954] font-semibold uppercase tracking-widest mb-0.5">Słucha Spotify</p>
                  <p className="text-xs text-white font-medium truncate">{nowPlaying.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{nowPlaying.artists}</p>
                </div>
              </div>
              {/* Progress bar */}
              {nowPlaying.duration_ms && nowPlaying.duration_ms > 0 && (
                <div>
                  <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-[#1DB954] rounded-full"
                      style={{ width: `${Math.min((elapsed / nowPlaying.duration_ms) * 100, 100)}%`, transition: 'width 1s linear' }}/>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>{fmtMs(elapsed)}</span>
                    <span>{fmtMs(nowPlaying.duration_ms)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Twitch live */}
          {twitchActivity && (
            <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl px-3 py-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">🔴 NA ŻYWO</span>
                <span className="text-xs text-white truncate flex-1">{twitchActivity.game_name}</span>
                <span className="text-[10px] text-zinc-500 shrink-0">{twitchActivity.viewer_count.toLocaleString()} widzów</span>
              </div>
            </div>
          )}

          {/* Steam game */}
          {!twitchActivity && steamActivity && (
            <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl px-2.5 py-2 mb-3">
              <img src={steamActivity.header_image} alt={steamActivity.name} className="w-12 h-7 rounded object-cover shrink-0"/>
              <div className="min-w-0">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
                  Gra teraz
                </p>
                <p className="text-xs text-white truncate">{steamActivity.name}</p>
                {steamGameStartedAt && (
                  <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1">
                    <Clock size={9}/> Grasz od {fmtGameDur(steamGameStartedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Favorite games */}
          {(data?.games?.length ?? 0) > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest mb-2">Ulubione gry</p>
              <div className="flex gap-1.5 flex-wrap">
                {data!.games.slice(0, 4).map(g => (
                  <div key={g.id} title={g.game_name}
                    className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06]">
                    {g.game_cover_url
                      ? <img src={g.game_cover_url} alt={g.game_name} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center"><Gamepad2 size={14} className="text-zinc-600"/></div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View profile link */}
          <button onClick={()=>onOpenProfile(userId)}
            className="w-full text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors text-center border-t border-white/[0.05] pt-2.5">
            Zobacz pełny profil →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
// Detect /join/:code in URL (evaluated once on module load)
const _inviteCodeFromUrl = (() => { const m = window.location.pathname.match(/^\/join\/([a-f0-9]+)$/i); return m ? m[1] : null; })();

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading]         = useState(true);
  const [pendingInvite, setPendingInvite]     = useState<InviteInfo | null>(null);
  const [inviteDialog, setInviteDialog]       = useState(false);
  const [inviteJoining, setInviteJoining]     = useState(false);
  const [currentUser, setCurrentUser]         = useState<UserProfile | null>(null);
  const [activeServer, setActiveServer]       = useState('');
  const [activeChannel, setActiveChannel]     = useState('');
  const [activeDmUserId, setActiveDmUserId]   = useState('');
  const [isMobileOpen, setIsMobileOpen]       = useState(false);
  const [activeView, setActiveView]           = useState<'servers'|'dms'|'friends'|'admin'>('dms');
  const [activeCall, setActiveCall]           = useState<CallState|null>(null);
  const [showCallPanel, setShowCallPanel]     = useState(false);
  const [voiceUsers, setVoiceUsers]           = useState<Record<string, VoiceUser[]>>({});
  const [incomingCall, setIncomingCall]       = useState<{from:{id:string,username:string,avatar_url:string|null},type:'voice'|'video',conversation_id:string}|null>(null);
  const [callDuration, setCallDuration]       = useState(0);
  const [toasts, setToasts]                   = useState<Toast[]>([]);
  const [isConnected, setIsConnected]         = useState(true);

  const [serverList, setServerList]           = useState<ServerData[]>([]);
  const [serverFull, setServerFull]           = useState<ServerFull | null>(null);
  const [serverEmojis, setServerEmojis]        = useState<Map<string, ServerEmoji[]>>(new Map());
  const [serverAccentColor, setServerAccentColor] = useState<string>('indigo');
  const [pollModal, setPollModal]              = useState<{open: boolean}>({open: false});
  const [pollQuestion, setPollQuestion]        = useState('');
  const [pollOptions, setPollOptions]          = useState(['', '']);
  const [pollMulti, setPollMulti]              = useState(false);
  const [polls, setPolls]                      = useState<Map<string, PollData>>(new Map());
  const [channelMsgs, setChannelMsgs]         = useState<MessageFull[]>([]);
  const [dmConvs, setDmConvs]                 = useState<DmConversation[]>([]);
  const [dmMsgs, setDmMsgs]                   = useState<DmMessageFull[]>([]);
  const [dmPinnedMsgs, setDmPinnedMsgs]         = useState<DmMessageFull[]>([]);
  // dm_read events: maps other_user_id → read_at timestamp (when THEY read our messages)
  const [dmReadStates, setDmReadStates]       = useState<Record<string, string>>({});
  const [friends, setFriends]                 = useState<FriendEntry[]>([]);
  const [blockedUsers, setBlockedUsers]       = useState<Set<string>>(new Set());
  const [showDmMenu, setShowDmMenu]           = useState(false);
  const [friendReqs, setFriendReqs]           = useState<FriendRequest[]>([]);
  const [members, setMembers]                 = useState<ServerMember[]>([]);
  const [roles, setRoles]                     = useState<ServerRole[]>([]);
  const [collapsedVcats, setCollapsedVcats]   = useState<Set<string>>(new Set());

  const [msgInput, setMsgInput]               = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [addFriendVal, setAddFriendVal]       = useState('');
  const [friendSearchResult, setFriendSearchResult] = useState<UserProfile | null>(null);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [sending, setSending]                 = useState(false);
  const [sendError, setSendError]             = useState('');
  const [replyTo, setReplyTo]                 = useState<MessageFull|DmMessageFull|null>(null);
  const [editingMsgId, setEditingMsgId]       = useState<string|null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState('');
  const [attachFile, setAttachFile]           = useState<File|null>(null);
  const [attachPreview, setAttachPreview]     = useState<string|null>(null);
  const [isDraggingOver, setIsDraggingOver]   = useState(false);

  // Lightbox for image previews
  const [lightboxSrc, setLightboxSrc]         = useState<string|null>(null);
  // DM media gallery (fullscreen slideshow)
  type GalleryItem = { url: string; isVideo: boolean; date: string; sender: string };
  const [dmGallery, setDmGallery] = useState<{ items: GalleryItem[]; index: number } | null>(null);

  // Voice channel text chat
  const [voiceChatOpen, setVoiceChatOpen]     = useState(false);
  const [voiceChatMsgs, setVoiceChatMsgs]     = useState<MessageFull[]>([]);
  const [voiceChatInput, setVoiceChatInput]   = useState('');
  const voiceChatEndRef                        = useRef<HTMLDivElement>(null);

  const [profileOpen, setProfileOpen]         = useState(false);
  const [selUser, setSelUser]                 = useState<any>(null);
  const [editProf, setEditProf]               = useState<any>(null);
  const [profBannerFile, setProfBannerFile]   = useState<File|null>(null);
  const [profBannerPrev, setProfBannerPrev]   = useState<string|null>(null);

  // ── Full profile page state ──────────────────────────────────────────
  const [profileViewId, setProfileViewId]     = useState<string|null>(null);
  const [profilePageData, setProfilePageData] = useState<UserProfile|null>(null);
  const [profileGames, setProfileGames]       = useState<FavoriteGame[]>([]);
  const [profileSpotify, setProfileSpotify]   = useState<SpotifyData|null>(null);
  const [profileViewedJam, setProfileViewedJam] = useState<{ jam_id: string; host: any; members: any[] } | null>(null);
  const [profileTwitch, setProfileTwitch]     = useState<TwitchData|null>(null);
  const [profileSteam, setProfileSteam]       = useState<SteamData|null>(null);
  const [profileLoading, setProfileLoading]   = useState(false);
  // Own connection statuses (loaded when viewing own profile)
  const [ownSpotify, setOwnSpotify]           = useState<SpotifyData|null>(null);
  const [ownTwitch, setOwnTwitch]             = useState<TwitchData|null>(null);
  const [ownSteam, setOwnSteam]               = useState<SteamData|null>(null);
  // Real-time activities: userId → data (null = not active)
  const [userActivities, setUserActivities]   = useState<Map<string, {name:string;artists:string;album_cover:string|null;external_url:string|null}|null>>(new Map());
  const [userTwitchActivities, setUserTwitchActivities] = useState<Map<string, TwitchStream|null>>(new Map());
  const [userSteamActivities, setUserSteamActivities]   = useState<Map<string, SteamGame|null>>(new Map());
  // Hover card
  const [hoverCard, setHoverCard]             = useState<{userId:string;x:number;y:number}|null>(null);
  const hoverCardTimer                        = useRef<ReturnType<typeof setTimeout>|null>(null);
  const hoverCardHideTimer                    = useRef<ReturnType<typeof setTimeout>|null>(null);
  const hoverCardCache                        = useRef<Map<string,{profile:UserProfile|null;games:FavoriteGame[];spotify:SpotifyData|null;loadedAt:number}>>(new Map());
  // Game search modal
  const [showGameModal, setShowGameModal]     = useState(false);
  const [gameSearch, setGameSearch]           = useState('');
  const [gameResults, setGameResults]         = useState<{rawg_id:number;name:string;cover_url:string|null;genre:string|null}[]>([]);
  const [gameSearching, setGameSearching]     = useState(false);
  const gameSearchRef                         = useRef<ReturnType<typeof setTimeout>|null>(null);

  const [createSrvOpen, setCreateSrvOpen]     = useState(false);
  const [createSrvMode, setCreateSrvMode]     = useState<'create'|'join'>('create');
  const [createSrvName, setCreateSrvName]     = useState('');
  const [joinCode, setJoinCode]               = useState('');
  const [createSrvIconFile, setCreateSrvIconFile]     = useState<File|null>(null);
  const [createSrvIconPreview, setCreateSrvIconPreview] = useState<string|null>(null);
  const createSrvIconRef = useRef<HTMLInputElement>(null);
  const msgInputRef      = useRef<HTMLTextAreaElement>(null);
  const msgDraftsRef     = useRef<Record<string, string>>({});
  const prevConvKeyRef   = useRef('');
  const [srvContextMenu, setSrvContextMenu]   = useState<{ x: number; y: number; srv: ServerData } | null>(null);
  const [deleteSrvConfirm, setDeleteSrvConfirm] = useState<{ id: string; name: string } | null>(null);

  const [srvSettOpen, setSrvSettOpen]         = useState(false);
  const [srvSettTab, setSrvSettTab]           = useState<'overview'|'roles'|'members'|'bans'|'invites'|'emoji'|'automations'>('overview');
  const [banList, setBanList]                 = useState<import('./api').ServerBan[]>([]);
  const [slowmodeLeft, setSlowmodeLeft]       = useState(0); // seconds remaining
  const [pinnedMsgs, setPinnedMsgs]           = useState<import('./api').MessageFull[]>([]);
  const [showPinned, setShowPinned]           = useState(false);
  const [inviteDur, setInviteDur]             = useState('86400');
  const [inviteCode, setInviteCode]           = useState<string|null>(null);
  const [srvForm, setSrvForm]                 = useState({ name:'', description:'', icon_url:'', banner_url:'', accent_color:'indigo' });
  const [srvIconFile, setSrvIconFile]         = useState<File|null>(null);
  const [srvBannerFile, setSrvBannerFile]     = useState<File|null>(null);

  const [chCreateOpen, setChCreateOpen]       = useState(false);
  const [chCreateCatId, setChCreateCatId]     = useState('');
  const [newChName, setNewChName]             = useState('');
  const [newChType, setNewChType]             = useState<'text'|'voice'|'forum'|'announcement'>('text');
  const [newChPrivate, setNewChPrivate]       = useState(false);
  const [newChRoles, setNewChRoles]           = useState<string[]>([]);

  // ── Forum state ──────────────────────────────────────────────────
  const [forumPosts, setForumPosts]           = useState<ForumPost[]>([]);
  const [forumPost, setForumPost]             = useState<ForumPost|null>(null); // open thread
  const [forumLoading, setForumLoading]       = useState(false);
  const [newPostTitle, setNewPostTitle]       = useState('');
  const [newPostContent, setNewPostContent]   = useState('');
  const [newPostImage, setNewPostImage]       = useState('');
  const [showNewPost, setShowNewPost]         = useState(false);
  const [replyContent, setReplyContent]       = useState('');
  const [replySending, setReplySending]       = useState(false);

  // ── Admin panel ──────────────────────────────────────────────────
  const [prevView, setPrevView]               = useState<'servers'|'dms'|'friends'>('dms');
  const [adminTab, setAdminTab]               = useState<'dashboard'|'users'|'servers'|'badges'|'system'>('dashboard');
  const [adminOverview, setAdminOverview]     = useState<AdminOverview|null>(null);
  const [adminStats, setAdminStats]           = useState<AdminStats|null>(null);
  const [adminBadges, setAdminBadges]         = useState<Badge[]>([]);
  const [adminUserQ, setAdminUserQ]           = useState('');
  const [adminUsers, setAdminUsers]           = useState<AdminUser[]>([]);
  const [adminUsersTotal, setAdminUsersTotal] = useState(0);
  const [adminUsersPage, setAdminUsersPage]   = useState(1);
  const [adminServersList, setAdminServersList] = useState<AdminServer[]>([]);
  const [adminBadgeForm, setAdminBadgeForm]   = useState({ name:'', label:'', color:'#6366f1', icon:'⚙️' });
  const [adminBadgeSaving, setAdminBadgeSaving] = useState(false);
  const [adminAssignUser, setAdminAssignUser] = useState<AdminUser|null>(null);
  const [adminAssignBadgeId, setAdminAssignBadgeId] = useState('');
  // ── DnD ──────────────────────────────────────────────────────────
  const [activeDragId,   setActiveDragId]     = useState<string|null>(null);
  const [activeDragType, setActiveDragType]   = useState<'category'|'channel'|null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [chEditOpen, setChEditOpen]           = useState(false);
  const [editingCh, setEditingCh]             = useState<ChannelData|null>(null);
  const [chForm, setChForm]                   = useState({ name:'', description:'', is_private:false, role_ids:[] as string[], slowmode_seconds:0 });

  // ── Server header dropdown ───────────────────────────────────────
  const [srvDropOpen, setSrvDropOpen]         = useState(false);
  const [bannerHovered, setBannerHovered]     = useState(false);

  // ── Create Category ──────────────────────────────────────────────
  const [catCreateOpen, setCatCreateOpen]     = useState(false);
  const [newCatName, setNewCatName]           = useState('');
  const [newCatPrivate, setNewCatPrivate]     = useState(false);
  const [newCatRoles, setNewCatRoles]         = useState<string[]>([]);

  // ── Category inline edit ─────────────────────────────────────────
  const [editingCatId, setEditingCatId]       = useState<string|null>(null);
  const [editingCatName, setEditingCatName]   = useState('');

  // ── Invite Friends popup ─────────────────────────────────────────
  const [inviteFriendsOpen, setInviteFriendsOpen] = useState(false);
  const [inviteFriendsCode, setInviteFriendsCode] = useState<string|null>(null);
  const [inviteSending, setInviteSending]     = useState<string|null>(null); // friend id being invited

  const [roleModalOpen, setRoleModalOpen]     = useState(false);
  const [editingRole, setEditingRole]         = useState<ServerRole|null>(null);
  const [roleForm, setRoleForm]               = useState({ name:'', color:'#5865f2', permissions:[] as string[] });

  const bottomRef        = useRef<HTMLDivElement>(null);
  const msgScrollRef     = useRef<HTMLDivElement>(null); // ref to the scrollable message container
  const srvTabsRef       = useRef<HTMLDivElement>(null); // ref to the scrollable server tabs
  const scrollToBottomOnLoadRef = useRef(false); // flag: scroll to bottom when messages finish loading
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
  const voiceBcRef          = useRef<BroadcastChannel|null>(null); // shared BroadcastChannel for multi-tab voice
  // DM unread counts (keyed by other_user_id)
  const [unreadDms, setUnreadDms]             = useState<Record<string, number>>({});
  // Channel unread counts (keyed by channel_id)
  const [unreadChs, setUnreadChs]             = useState<Record<string, number>>({});
  // DM partner full profile (for BIO panel)
  const [dmPartnerProfile, setDmPartnerProfile] = useState<UserProfile | null>(null);
  const [dmRightTab, setDmRightTab]             = useState<'profile'|'media'|'links'|'calls'|'pinned'>('profile');
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
  const [selMic, setSelMic]                   = useState(() => localStorage.getItem('cordyn_mic') || '');
  const [selSpeaker, setSelSpeaker]           = useState(() => localStorage.getItem('cordyn_speaker') || '');
  const [selCamera, setSelCamera]             = useState(() => localStorage.getItem('cordyn_camera') || '');
  const [devicesOpen, setDevicesOpen]         = useState(false);

  // App preferences — initialized from currentUser (DB), updated via users.updateMe()
  const [accentColor, setAccentColor]           = useState<string>('indigo');
  const [avatarEffect, setAvatarEffect]         = useState<string>('none');
  const [compactMessages, setCompactMessages]   = useState<boolean>(false);
  const [fontSize, setFontSize]                 = useState<'small'|'normal'|'large'>('normal');
  const [alwaysShowTimestamps, setAlwaysShowTimestamps] = useState<boolean>(false);
  const [showChatAvatars, setShowChatAvatars]   = useState<boolean>(true);
  const [messageAnimations, setMessageAnimations] = useState<boolean>(true);
  const [showLinkPreviews, setShowLinkPreviews] = useState<boolean>(true);
  const [streamerMode, setStreamerMode]           = useState<boolean>(() => localStorage.getItem('cordyn_streamer') === '1');

  // Formatting toolbar visibility
  const [showFmtBar, setShowFmtBar] = useState<boolean>(false);

  // Status system
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [isMicMuted, setIsMicMuted]           = useState(false);
  const myStatusRef                            = useRef<string>('online');
  const autoIdledRef                           = useRef(false); // true if idle was set automatically
  const idleTimerRef                           = useRef<ReturnType<typeof setTimeout>|null>(null);
  // Steam game session start timestamps (userId → Date.now() when game started)
  const steamGameStartRef                      = useRef<Map<string, number>>(new Map());
  const [gameTick, setGameTick]                = useState(0); // ticks every 60s to refresh elapsed time
  const [userNotes, setUserNotes]               = useState<Map<string, string>>(new Map());
  const userNoteDebounceRef                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusPickerRef                        = useRef<HTMLDivElement>(null);
  const notifBellRef                           = useRef<HTMLDivElement>(null);

  // App Settings
  const [appSettOpen, setAppSettOpen]         = useState(false);
  const [appSettTab, setAppSettTab]           = useState<'account'|'appearance'|'devices'|'privacy'>('account');
  // ── 2FA settings state ──
  const [twoFaStatus, setTwoFaStatus]         = useState<TwoFactorStatus | null>(null);
  const [twoFaModal, setTwoFaModal]           = useState<'setup'|'backup_codes'|'disable'|'regen'|null>(null);
  const [twoFaSetupData, setTwoFaSetupData]   = useState<{secret:string;qr_code:string;manual_key:string}|null>(null);
  const [twoFaInputCode, setTwoFaInputCode]   = useState('');
  const [twoFaPassword, setTwoFaPassword]     = useState('');
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState<string[]>([]);
  const [twoFaLoading, setTwoFaLoading]       = useState(false);
  const [twoFaError, setTwoFaError]           = useState('');

  // Spotify JAM session
  const [myJam, setMyJam]                     = useState<SpotifyJamSession>({ role: null, members: [] });
  const [jamLoading, setJamLoading]           = useState(false);

  // Voice Channel DJ
  const [voiceDj, setVoiceDj]                = useState<Record<string, SpotifyVoiceDj['dj']>>({});
  const [voiceDjListening, setVoiceDjListening] = useState<Set<string>>(new Set());
  const [voiceDjVolume, setVoiceDjVolume]     = useState(50);

  // Account deletion flow
  const [deleteStep, setDeleteStep]           = useState<'confirm'|'code'|null>(null);
  const [deleteCode, setDeleteCode]           = useState('');
  const [deleteLoading, setDeleteLoading]     = useState(false);

  // Load 2FA status when privacy tab opens
  useEffect(() => {
    if (appSettTab === 'privacy' && isAuthenticated) {
      twoFactorApi.status().then(setTwoFaStatus).catch(() => {});
    }
  }, [appSettTab, isAuthenticated]);

  // Activity modal
  const [showActivityModal, setShowActivityModal] = useState(false);

  // Per-user volume control during calls
  const [userVols, setUserVols]           = useState<Record<string, number>>({});  // 0–200, default 100
  const [streamVols, setStreamVols]       = useState<Record<string, number>>({});  // stream audio volume 0–100, default 100
  const [mutedByMe, setMutedByMe]         = useState<Record<string, boolean>>({});
  const [streamMutedByMe, setStreamMutedByMe] = useState<Record<string, boolean>>({});
  const [volMenu, setVolMenu]             = useState<{id:string, username:string, x:number, y:number}|null>(null);

  // Noise cancellation setting (loaded from DB, toggled in devices panel)
  const [noiseCancel, setNoiseCancel] = useState<boolean>(true);
  // Active noise gate pipeline (AudioWorklet + AudioContext); cleanup on re-acquire or leave
  const noisePipelineRef = useRef<NoisePipeline | null>(null);

  // Ref for auto-minimize: becomes true 600ms after call panel opens
  const callSettledRef = useRef(false);

  // Mention / ping system
  const [pingChs, setPingChs]                 = useState<Record<string, number>>({});
  const [notifications, setNotifications]     = useState<NotificationEntry[]>([]);
  const [notifOpen, setNotifOpen]             = useState(false);
  const [mentionQuery, setMentionQuery]       = useState<string | null>(null);
  const [mentionSel, setMentionSel]           = useState<number>(0);

  // Typing indicator
  const [typingUsers, setTypingUsers]         = useState<Record<string,string>>({});
  const typingTimersRef                        = useRef<Record<string,ReturnType<typeof setTimeout>>>({});
  const typingEmitTimerRef                     = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Server activity log
  const [serverActivity, setServerActivity]   = useState<{id:string;type:string;icon:string;text:string;time:string}[]>([]);

  // ── Multi-tab voice prevention (BroadcastChannel) ───────────────
  // IMPORTANT: we store a single instance in voiceBcRef and send FROM THE SAME INSTANCE.
  // BroadcastChannel does NOT deliver a message back to the same instance that sent it,
  // so there's no self-cancellation. Creating a new instance to send would cause
  // the listener on this page to receive and immediately destroy its own voice session.
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('cordyn_voice');
    voiceBcRef.current = bc;
    bc.onmessage = (e) => {
      // Another tab joined voice — silently leave this tab's voice session
      if (e.data?.type === 'voice_joined') {
        setActiveCall(cur => {
          if (cur?.channelId) {
            try { getSocket().emit('voice_leave', cur.channelId); } catch {}
          }
          return null;
        });
        setShowCallPanel(false);
      }
    };
    return () => { bc.close(); voiceBcRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-minimize call panel when navigating away ────────────────
  // Mark panel as "settled" 600ms after it opens to prevent false triggers during init
  useEffect(() => {
    if (showCallPanel) {
      callSettledRef.current = false;
      const t = setTimeout(() => { callSettledRef.current = true; }, 600);
      return () => clearTimeout(t);
    } else {
      callSettledRef.current = false;
    }
  }, [showCallPanel]);

  // When text channel or DM conversation changes while call is open → minimize
  useEffect(() => {
    if (callSettledRef.current && activeCall) setShowCallPanel(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel, activeDmUserId]);

  // Load voice channel messages when chat panel opens + subscribe to socket room
  useEffect(() => {
    if (voiceChatOpen && activeCall?.channelId) {
      joinChannel(activeCall.channelId);
      messagesApi.list(activeCall.channelId).then(setVoiceChatMsgs).catch(console.error);
      return () => { leaveChannel(activeCall.channelId!); };
    } else if (!voiceChatOpen) {
      setVoiceChatMsgs([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceChatOpen, activeCall?.channelId]);

  // Scroll voice chat to bottom on new messages
  useEffect(() => {
    voiceChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [voiceChatMsgs]);

  // Reset voice chat when call ends
  useEffect(() => {
    if (!activeCall) { setVoiceChatOpen(false); setVoiceChatMsgs([]); }
  }, [activeCall]);

  // Handle OAuth callback redirects (?spotify|twitch|steam=connected|error)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('spotify');
    if (s === 'connected') {
      addToast('Spotify połączono pomyślnie!', 'success');
      window.history.replaceState({}, '', window.location.pathname);
      spotifyApi.status().then(setOwnSpotify).catch(()=>{});
    } else if (s === 'error') {
      addToast('Błąd połączenia Spotify', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
    const tw = p.get('twitch');
    if (tw === 'connected') {
      addToast('Twitch połączono pomyślnie!', 'success');
      window.history.replaceState({}, '', window.location.pathname);
      twitchApi.status().then(setOwnTwitch).catch(()=>{});
    } else if (tw === 'error') {
      addToast('Błąd połączenia Twitch', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
    const st = p.get('steam');
    if (st === 'connected') {
      addToast('Steam połączono pomyślnie!', 'success');
      window.history.replaceState({}, '', window.location.pathname);
      steamApi.status().then(setOwnSteam).catch(()=>{});
    } else if (st === 'error') {
      addToast('Błąd połączenia Steam', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Invite link: fetch info on load, show dialog after auth ─────
  useEffect(() => {
    if (!_inviteCodeFromUrl) return;
    serversApi.inviteInfo(_inviteCodeFromUrl).then(info => {
      setPendingInvite(info);
      if (isAuthenticated) setInviteDialog(true);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Poll own Spotify every 30s → broadcast track to socket ──────
  const lastEmittedTrack = useRef<string|null|undefined>(undefined);
  useEffect(() => {
    if (!currentUser?.id) return;
    const poll = async () => {
      try {
        const r = await spotifyApi.nowPlaying();
        // Respect show_on_profile — emit null if disabled
        const showOnProfile = ownSpotify?.show_on_profile !== false;
        const effectiveTrack = (r.track && showOnProfile) ? r.track : null;
        const trackKey = effectiveTrack ? `${effectiveTrack.name}|${effectiveTrack.artists}` : null;
        if (trackKey === lastEmittedTrack.current) return;
        lastEmittedTrack.current = trackKey;
        const sock = getSocket();
        if (sock) (sock as any).emit('spotify_update', { track: effectiveTrack ? {
          name: effectiveTrack.name, artists: effectiveTrack.artists,
          album_cover: effectiveTrack.album_cover, external_url: effectiveTrack.external_url,
          uri: effectiveTrack.uri, progress_ms: effectiveTrack.progress_ms, duration_ms: effectiveTrack.duration_ms,
        } : null });
        setUserActivities(p => { const n = new Map(p); n.set(currentUser.id, effectiveTrack ? {
          name: effectiveTrack.name, artists: effectiveTrack.artists,
          album_cover: effectiveTrack.album_cover ?? null, external_url: effectiveTrack.external_url ?? null,
          uri: effectiveTrack.uri ?? null, progress_ms: effectiveTrack.progress_ms ?? null, duration_ms: effectiveTrack.duration_ms ?? null,
        } : null); return n; });
      } catch {}
    };
    poll();
    const t = setInterval(poll, 10_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, ownSpotify?.show_on_profile]);

  // ── Poll own Twitch every 30s → broadcast to socket ─────────────
  const lastEmittedStream = useRef<string|null|undefined>(undefined);
  useEffect(() => {
    if (!currentUser?.id || !ownTwitch?.connected) return;
    const poll = async () => {
      try {
        const r = await twitchApi.stream();
        const showOnProfile = ownTwitch?.show_on_profile !== false;
        const effectiveStream = (r.stream && showOnProfile) ? r.stream : null;
        const streamKey = effectiveStream ? `${effectiveStream.title}|${effectiveStream.viewer_count}` : null;
        if (streamKey === lastEmittedStream.current) return;
        lastEmittedStream.current = streamKey;
        const sock = getSocket();
        if (sock) (sock as any).emit('twitch_update', { stream: effectiveStream ? {
          title: effectiveStream.title, game_name: effectiveStream.game_name,
          viewer_count: effectiveStream.viewer_count, login: effectiveStream.login,
        } : null });
        setUserTwitchActivities(p => { const n = new Map(p); n.set(currentUser.id, effectiveStream); return n; });
      } catch {}
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, ownTwitch?.connected, ownTwitch?.show_on_profile]);

  // ── Poll own Steam game every 30s → broadcast to socket ──────────
  const lastEmittedGame = useRef<string|null|undefined>(undefined);
  useEffect(() => {
    if (!currentUser?.id || !ownSteam?.connected) return;
    const poll = async () => {
      try {
        const r = await steamApi.nowPlaying();
        const showOnProfile = ownSteam?.show_on_profile !== false;
        const effectiveGame = (r.game && showOnProfile) ? r.game : null;
        const gameKey = effectiveGame ? effectiveGame.gameid : null;
        if (gameKey === lastEmittedGame.current) return;
        lastEmittedGame.current = gameKey;
        // Track session start time
        if (effectiveGame) {
          steamGameStartRef.current.set(currentUser.id, Date.now());
        } else {
          steamGameStartRef.current.delete(currentUser.id);
        }
        const sock = getSocket();
        const startedAt = effectiveGame ? steamGameStartRef.current.get(currentUser.id) : undefined;
        if (sock) (sock as any).emit('steam_update', { game: effectiveGame ? {
          name: effectiveGame.name, gameid: effectiveGame.gameid, header_image: effectiveGame.header_image,
          started_at: startedAt,
        } : null });
        setUserSteamActivities(p => { const n = new Map(p); n.set(currentUser.id, effectiveGame); return n; });
        setGameTick(n => n + 1); // force re-render
      } catch {}
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, ownSteam?.connected, ownSteam?.show_on_profile]);

  // ── Profile page: real-time refresh every 30s ────────────────────
  useEffect(() => {
    if (!profileViewId) return;
    const t = setInterval(async () => {
      try {
        const s = await spotifyApi.userPublic(profileViewId);
        setProfileSpotify(s);
      } catch {}
    }, 30_000);
    return () => clearInterval(t);
  }, [profileViewId]);

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
      // Also route to voice chat messages if the call is on this channel
      if (chId && activeCallRef.current?.channelId === chId) {
        setVoiceChatMsgs(p => p.some(m => m.id === msg.id) ? p : [...p, msg as MessageFull]);
      }
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
        const preview = msg.content
          ? (msg.content.length > 55 ? msg.content.slice(0, 55) + '…' : msg.content)
          : msg.attachment_url ? '📎 Załącznik' : '';
        autoToast(
          preview,
          'info',
          () => { setActiveDmUserId(msg.sender_id); setActiveView('dms'); },
          msg.sender_avatar,
          msg.sender_username
        );
        setUnreadDms(p => ({ ...p, [msg.sender_id]: (p[msg.sender_id] || 0) + 1 }));
        playDmNotification();
      }
    });
    sock.on('message_deleted', ({ id }: any) =>
      setChannelMsgs(p => p.map(m => m.id === id ? { ...m, content: '__deleted__', deleted: true } : m)));
    sock.on('message_updated', ({ id, content, edited }: any) =>
      setChannelMsgs(p => p.map(m => m.id === id ? { ...m, content, edited } : m)));
    sock.on('dm_message_updated', ({ id, content, edited }: any) =>
      setDmMsgs(p => p.map(m => m.id === id ? { ...m, content, edited } : m)));
    sock.on('dm_message_deleted', ({ id }: any) =>
      setDmMsgs(p => p.map(m => m.id === id ? { ...m, content: '__deleted__', deleted: true } : m)));
    sock.on('dm_message_pinned', ({ id, pinned }: any) => {
      setDmMsgs(p => p.map(m => m.id === id ? { ...m, pinned } : m));
    });
    sock.on('poll_updated', (pollData: any) => {
      setPolls(p => new Map(p).set(pollData.id, pollData));
    });
    // dm_read: the other user has read our messages in this conversation
    sock.on('dm_read', ({ reader_id, read_at }: any) => {
      setDmReadStates(p => ({ ...p, [reader_id]: read_at }));
      // Also refresh conversation list to update other_last_read_at
      dmsApi.conversations().then(setDmConvs).catch(() => {});
    });
    sock.on('user_status', ({ user_id, status }) => {
      setFriends(p => p.map(f => f.id === user_id ? { ...f, status } : f));
      setDmConvs(p => p.map(d => d.other_user_id === user_id ? { ...d, other_status: status } : d));
      setMembers(p => p.map(m => m.id === user_id ? { ...m, status } : m));
    });
    sock.on('friend_spotify_update', ({ user_id, track }) => {
      setUserActivities(p => { const n = new Map(p); n.set(user_id, track); return n; });
    });
    // JAM sync: when host updates their track, auto-sync this user's Spotify
    (sock as any).on('spotify_jam_sync', async ({ host_id, track }: { host_id: string; track: SpotifyTrack | null }) => {
      setUserActivities(p => { const n = new Map(p); n.set(host_id, track); return n; });
      if (track?.uri) {
        try { await spotifyApi.play(track.uri, track.progress_ms ?? 0); } catch {}
      }
    });
    (sock as any).on('spotify_jam_ended', (_: any) => {
      setMyJam({ role: null, members: [] });
      addToast('JAM zakończony przez hosta', 'info');
    });
    (sock as any).on('spotify_jam_member_left', ({ user_id }: { user_id: string }) => {
      setMyJam(j => ({ ...j, members: j.members.filter((m: string) => m !== user_id) }));
    });
    // Voice DJ
    (sock as any).on('voice_dj_started', ({ dj_id, channel_id }: { dj_id: string; channel_id: string }) => {
      users.get(dj_id).then((u: any) => {
        setVoiceDj(p => ({ ...p, [channel_id]: { id: u.id, username: u.username, avatar_url: u.avatar_url ?? null } }));
      }).catch(() => {});
    });
    (sock as any).on('voice_dj_stopped', ({ channel_id }: { dj_id: string; channel_id: string }) => {
      setVoiceDj(p => { const n = { ...p }; delete n[channel_id]; return n; });
      setVoiceDjListening(s => { const n = new Set(s); n.delete(channel_id); return n; });
    });
    (sock as any).on('voice_dj_sync', async ({ channel_id, track }: { dj_id: string; channel_id: string; track: SpotifyTrack | null }) => {
      if (!voiceDjListening.has(channel_id)) return;
      if (track?.uri) {
        try { await spotifyApi.play(track.uri, track.progress_ms ?? 0); } catch {}
      }
    });
    (sock as any).on('friend_twitch_update', ({ user_id, stream }: { user_id: string; stream: TwitchStream | null }) => {
      setUserTwitchActivities(p => { const n = new Map(p); n.set(user_id, stream); return n; });
    });
    (sock as any).on('friend_steam_update', ({ user_id, game }: { user_id: string; game: (SteamGame & { started_at?: number }) | null }) => {
      if (game) {
        // Use server-sent started_at if present, otherwise record now as new session start
        const prev = steamGameStartRef.current.get(user_id);
        if (!prev || (game as any).started_at) {
          steamGameStartRef.current.set(user_id, (game as any).started_at ?? Date.now());
        }
      } else {
        steamGameStartRef.current.delete(user_id);
      }
      setUserSteamActivities(p => { const n = new Map(p); n.set(user_id, game); return n; });
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
    const autoToast = (msg: string, type: Toast['type'], onClick?: ()=>void, avatar?: string|null, senderName?: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts(p => [...p, { id, msg, type, onClick, avatar, senderName }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
    };
    sock.on('call_accepted', ({ from_user_id }: any) => {
      stopRing();
      playCallAccepted();
      autoToast('Połączenie zaakceptowane', 'success');
      // Caller initiates WebRTC after recipient accepts — pass remoteUserId directly
      // to avoid race condition where activeCallRef is not yet synced via useEffect
      voiceHandlerRef.current.onCallAccepted?.(from_user_id);
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
    // ── Force logout (ban) ──────────────────────────────────────────
    sock.on('force_logout' as any, ({ reason }: { reason?: string }) => {
      const msg = reason || 'Twoje konto zostało zbanowane';
      autoToast(msg, 'error');
      setTimeout(() => {
        clearToken();
        disconnectSocket();
        setIsAuthenticated(false);
        setCurrentUser(null);
      }, 2500);
    });
    // ── Real-time server/channel/member/user events ─────────────────
    sock.on('channel_created' as any, (ch: any) => {
      if (ch.server_id !== activeServerRef.current) return;
      setServerFull(p => {
        if (!p) return p;
        const targetCatId = ch.category_id || '__uncat__';
        const newCh = { ...ch, allowed_roles: ch.allowed_roles || [] };
        // If target category exists, add channel there
        const hasCat = p.categories.some((cat: any) => cat.id === targetCatId);
        if (hasCat) {
          return {
            ...p,
            categories: p.categories.map((cat: any) =>
              cat.id === targetCatId
                ? { ...cat, channels: [...cat.channels.filter((c: any) => c.id !== ch.id), newCh] }
                : cat
            ),
          };
        }
        // No matching category (uncategorized slot doesn't exist yet) — create it
        if (!ch.category_id) {
          return {
            ...p,
            categories: [{ id: '__uncat__', name: '', position: -1, channels: [newCh] } as any, ...p.categories],
          };
        }
        return p;
      });
    });
    sock.on('channel_updated' as any, (ch: any) => {
      if (ch.server_id !== activeServerRef.current) return;
      // If channel has privacy settings: refetch server data for accurate access control
      // This ensures non-admins see/hide the channel correctly without needing a page refresh
      if (ch.is_private) {
        serversApi.get(ch.server_id).then(setServerFull).catch(console.error);
        return;
      }
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
    sock.on('category_updated' as any, ({ id, name, server_id }: any) => {
      if (server_id !== activeServerRef.current) return;
      setServerFull(p => p ? { ...p, categories: p.categories.map(c => c.id === id ? { ...c, name } : c) } : p);
    });
    sock.on('category_deleted' as any, ({ id, server_id }: any) => {
      if (server_id !== activeServerRef.current) return;
      setServerFull(p => {
        if (!p) return p;
        // Channels from deleted category become uncategorized (category_id=null)
        const deletedCat = p.categories.find(c => c.id === id);
        const orphanChannels = deletedCat?.channels || [];
        const remaining = p.categories.filter(c => c.id !== id);
        // Find or create the __uncategorized__ slot
        const uncat = remaining.find(c => c.id === '__uncat__');
        if (orphanChannels.length === 0) return { ...p, categories: remaining };
        if (uncat) {
          return { ...p, categories: remaining.map(c => c.id === '__uncat__' ? { ...c, channels: [...c.channels, ...orphanChannels] } : c) };
        }
        return { ...p, categories: [{ id: '__uncat__', name: '', position: -1, channels: orphanChannels } as any, ...remaining] };
      });
    });
    sock.on('server_updated' as any, (srv: any) => {
      setServerFull(p => p && p.id === srv.id ? { ...p, ...srv } : p);
      setServerList(p => p.map(s => s.id === srv.id ? { ...s, name: srv.name, icon_url: srv.icon_url } : s));
    });
    sock.on('roles_updated' as any, ({ server_id, roles: updatedRoles }: any) => {
      if (server_id !== activeServerRef.current) return;
      setRoles(updatedRoles);
      setMembers(prev => prev.map(m => ({
        ...m,
        roles: (m.roles || []).map((r: any) => {
          const upd = updatedRoles.find((ur: any) => ur.id === r.id);
          return upd ? { ...r, name: upd.name, color: upd.color } : r;
        }),
      })));
      // Role permissions may have changed — refetch server to update my_permissions
      serversApi.get(server_id).then(setServerFull).catch(console.error);
    });
    sock.on('permissions_updated' as any, ({ server_id }: any) => {
      if (server_id !== activeServerRef.current) return;
      // My roles changed — refetch server to get updated my_permissions
      serversApi.get(server_id).then(setServerFull).catch(console.error);
    });
    sock.on('banned_from_server' as any, ({ server_id }: any) => {
      // Remove server from list and navigate away
      setServerList(p => p.filter(s => s.id !== server_id));
      if (activeServerRef.current === server_id) {
        setActiveServer(null); setServerFull(null); setActiveView('dms');
      }
    });
    sock.on('message_pinned' as any, ({ channel_id, message_id, pinned }: any) => {
      setChannelMsgs(p => p.map(m => m.id === message_id ? { ...m, pinned } : m));
      setPinnedMsgs(p => pinned
        ? p // full list refetched when panel opened
        : p.filter(m => m.id !== message_id)
      );
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
      // Update own profile if it's the current user
      setCurrentUser(p => p && p.id === u.id ? { ...p, ...u } : p);
      // Update open profile popup
      setSelUser((p: any) => p && p.id === u.id ? { ...p, ...u } : p);
      // Update DM partner profile if visible
      setDmPartnerProfile(p => p && p.id === u.id ? { ...p, ...u } : p);
    });

    // ── Badges updated (admin assigns/removes) ───────────────────────
    sock.on('badges_updated' as any, ({ badges }: { badges: Badge[] }) => {
      setCurrentUser(p => p ? { ...p, badges } : p);
    });

    // ── Channel/Category reorder ──────────────────────────────────
    sock.on('categories_reordered' as any, ({ server_id, categories }: any) => {
      setServerFull(p => {
        if (!p || p.id !== server_id) return p;
        const sorted = [...p.categories].map(c => {
          const u = categories.find((x: any) => x.id === c.id);
          return u ? { ...c, position: u.position } : c;
        }).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        return { ...p, categories: sorted };
      });
    });
    sock.on('channels_reordered' as any, ({ server_id, channels }: any) => {
      setServerFull(p => {
        if (!p || p.id !== server_id) return p;
        return {
          ...p,
          categories: p.categories.map(cat => {
            const catChannels = channels.filter((c: any) => c.category_id === cat.id);
            if (!catChannels.length) return cat;
            return {
              ...cat,
              channels: cat.channels
                .map(ch => {
                  const u = catChannels.find((c: any) => c.id === ch.id);
                  return u ? { ...ch, position: u.position, category_id: u.category_id } : ch;
                })
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
            };
          }),
        };
      });
    });

    // ── Forum real-time events ───────────────────────────────────────
    sock.on('forum_post_created' as any, ({ channel_id, post }: any) => {
      if (channel_id !== prevChRef.current) return;
      setForumPosts(p => p.some(x => x.id === post.id) ? p : [post, ...p]);
    });
    sock.on('forum_reply_created' as any, ({ channel_id, post_id, reply }: any) => {
      if (channel_id !== prevChRef.current) return;
      setForumPost(p => {
        if (!p || p.id !== post_id) return p;
        const alreadyHas = (p.replies || []).some((r: any) => r.id === reply.id);
        return alreadyHas ? p : { ...p, replies: [...(p.replies || []), reply], reply_count: p.reply_count + 1 };
      });
      setForumPosts(prev => prev.map(x => x.id === post_id ? { ...x, reply_count: x.reply_count + 1 } : x));
    });
    sock.on('forum_post_deleted' as any, ({ channel_id, post_id }: any) => {
      if (channel_id !== prevChRef.current) return;
      setForumPosts(p => p.filter(x => x.id !== post_id));
      setForumPost(p => p?.id === post_id ? null : p);
    });

    // ── Ping / mention received ──────────────────────────────────────
    sock.on('ping_received' as any, (data: any) => {
      const { channel_id, channel_name, server_id, server_name, from_username, content, type } = data;
      if (channel_id !== prevChRef.current) {
        setPingChs(p => ({ ...p, [channel_id]: (p[channel_id] || 0) + 1 }));
      }
      // Store notification entry
      const entry: NotificationEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        from_username: from_username ?? '?',
        server_id: server_id ?? '',
        server_name: server_name ?? 'Serwer',
        channel_id: channel_id ?? '',
        channel_name: channel_name ? `#${channel_name}` : '#kanał',
        content: (content ?? '').slice(0, 120),
        type: type === 'everyone' ? 'everyone' : 'mention',
        created_at: new Date().toISOString(),
        read: false,
      };
      setNotifications(prev => [entry, ...prev].slice(0, 50));
      // Browser push notification (if granted)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const n = new Notification(
          type === 'everyone' ? `@everyone na ${server_name ?? 'serwerze'}` : `${from_username} wspomniał(-a) o Tobie`,
          { body: content?.slice(0, 80) ?? '', icon: '/favicon.ico', tag: channel_id }
        );
        n.onclick = () => { window.focus(); };
      }
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
      setSrvForm({ name: s.name, description: s.description||'', icon_url: s.icon_url||'', banner_url: s.banner_url||'', accent_color: (s as any).accent_color||'indigo' });
      setServerAccentColor((s as any).accent_color||'indigo');
      // Load server emojis
      emojisApi.list(activeServer).then(emojis => {
        setServerEmojis(p => new Map(p).set(activeServer, emojis));
      }).catch(() => {});
      // Always auto-select first non-voice channel when switching servers
      const first = s.categories.flatMap(c => c.channels).find(ch => ch.type !== 'voice');
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

  // ── Load polls referenced in messages ──────────────────────────
  useEffect(() => {
    const allMsgs = [...channelMsgs, ...dmMsgs];
    allMsgs.forEach(m => {
      const match = m.content?.match(/^\[POLL:([^\]]+)\]/);
      if (match && !polls.has(match[1])) {
        pollsApi.get(match[1]).then(p => setPolls(prev => new Map(prev).set(p.id, p))).catch(() => {});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelMsgs.length, dmMsgs.length]);

  // ── Channel change ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeChannel || activeView !== 'servers') return;
    if (prevChRef.current) leaveChannel(prevChRef.current);
    prevChRef.current = activeChannel;
    joinChannel(activeChannel);
    setTypingUsers({});
    setUnreadChs(p => { const n = {...p}; delete n[activeChannel]; return n; });
    setPingChs(p => { const n = {...p}; delete n[activeChannel]; return n; });
    setForumPost(null); setShowNewPost(false); setReplyContent('');
    // Load content based on channel type
    const ch = serverFull?.categories.flatMap(c=>c.channels).find(c=>c.id===activeChannel);
    if (ch?.type === 'forum') {
      setForumPosts([]); setForumLoading(true);
      forumApi.listPosts(activeChannel).then(setForumPosts).catch(console.error).finally(()=>setForumLoading(false));
    } else {
      setChannelMsgs([]); setMsgsLoading(true); setSearchQuery('');
      messagesApi.list(activeChannel).then(setChannelMsgs).catch(console.error).finally(()=>setMsgsLoading(false));
    }
    setReplyTo(null);
  }, [activeChannel, activeView]);

  // ── DM change ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDmUserId) return;
    setDmMsgs([]); setMsgsLoading(true); setSearchQuery('');
    dmsApi.messages(activeDmUserId).then(setDmMsgs).catch(console.error).finally(()=>setMsgsLoading(false));
    users.get(activeDmUserId).then(setDmPartnerProfile).catch(console.error);
    setReplyTo(null);
    setDmRightTab('profile');
    // Mark conversation as read when opening
    dmsApi.markRead(activeDmUserId).catch(() => {});
    // Load pinned DM messages
    dmPinApi.pinned(activeDmUserId).then(setDmPinnedMsgs).catch(() => {});
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

  // Scroll smoothly on new incoming messages/typing indicator
  // Scroll helper
  const scrollToBottom = (smooth = false) => {
    const el = msgScrollRef.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  };
  // Set flag on channel/DM/view switch
  useEffect(() => { scrollToBottomOnLoadRef.current = true; }, [activeChannel, activeDmUserId, activeView]);
  // PRIMARY: useLayoutEffect on msgsLoading — fires after React commits DOM synchronously.
  // In React 18 setChannelMsgs + setMsgsLoading(false) are batched into ONE render, so
  // when msgsLoading→false the messages are already in the DOM and scrollHeight is correct.
  // AnimatePresence is now mode="sync" so new content is in DOM immediately too.
  useLayoutEffect(() => {
    if (!msgsLoading && scrollToBottomOnLoadRef.current) {
      scrollToBottomOnLoadRef.current = false;
      scrollToBottom(false);
    }
  }, [msgsLoading, activeView, activeDmUserId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Smart-scroll on new incoming messages (only near bottom, not during initial load)
  useEffect(() => {
    if (scrollToBottomOnLoadRef.current) return;
    const el = msgScrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 180) scrollToBottom(true);
  }, [channelMsgs, dmMsgs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync refs ───────────────────────────────────────────────────
  useEffect(() => { currentUserRef.current    = currentUser;    }, [currentUser]);
  useEffect(() => { activeCallRef.current     = activeCall;     }, [activeCall]);
  useEffect(() => { activeDmUserIdRef.current = activeDmUserId; }, [activeDmUserId]);
  useEffect(() => { activeViewRef.current     = activeView;     }, [activeView]);
  useEffect(() => { activeServerRef.current   = activeServer;   }, [activeServer]);
  useEffect(() => { callDurationRef.current   = callDuration;   }, [callDuration]);
  // Sync myStatusRef when currentUser.status changes (e.g. on login)
  useEffect(() => { if (currentUser?.status) myStatusRef.current = currentUser.status; }, [currentUser?.status]);

  // ── Per-conversation message drafts ─────────────────────────────
  // Save current input draft when switching DM/channel, restore for new conversation
  useLayoutEffect(() => {
    const key = activeDmUserId ? `dm:${activeDmUserId}` : activeChannel ? `ch:${activeChannel}` : '';
    const prev = prevConvKeyRef.current;
    if (key === prev) return;
    // Save draft for previous conversation (read from DOM to get latest value)
    if (prev) msgDraftsRef.current[prev] = msgInputRef.current?.value ?? '';
    // Restore draft for new conversation
    setMsgInput(msgDraftsRef.current[key] ?? '');
    prevConvKeyRef.current = key;
  }, [activeDmUserId, activeChannel]);

  // Apply accent color — override Tailwind v4 color CSS variables so every bg-indigo-*, text-indigo-* etc. uses the chosen color
  useEffect(() => {
    const palettes: Record<string, Record<string,string>> = {
      indigo:  { '300':'#a5b4fc','400':'#818cf8','500':'#6366f1','600':'#4f46e5','700':'#4338ca' },
      violet:  { '300':'#c4b5fd','400':'#a78bfa','500':'#8b5cf6','600':'#7c3aed','700':'#6d28d9' },
      pink:    { '300':'#f9a8d4','400':'#f472b6','500':'#ec4899','600':'#db2777','700':'#be185d' },
      blue:    { '300':'#93c5fd','400':'#60a5fa','500':'#3b82f6','600':'#2563eb','700':'#1d4ed8' },
      emerald: { '300':'#6ee7b7','400':'#34d399','500':'#10b981','600':'#059669','700':'#047857' },
      amber:   { '300':'#fcd34d','400':'#fbbf24','500':'#f59e0b','600':'#d97706','700':'#b45309' },
      orange:  { '300':'#fdba74','400':'#fb923c','500':'#f97316','600':'#ea580c','700':'#c2410c' },
      rose:    { '300':'#fda4af','400':'#fb7185','500':'#f43f5e','600':'#e11d48','700':'#be123c' },
      teal:    { '300':'#5eead4','400':'#2dd4bf','500':'#14b8a6','600':'#0d9488','700':'#0f766e' },
      cyan:    { '300':'#67e8f9','400':'#22d3ee','500':'#06b6d4','600':'#0891b2','700':'#0e7490' },
    };
    const p = palettes[accentColor] || palettes.indigo;
    const r = document.documentElement;
    ['300','400','500','600','700'].forEach(shade => r.style.setProperty(`--color-indigo-${shade}`, p[shade]));
    // Fallback: legacy CSS variable used by some inline styles
    const [r2,g2,b2] = p['500'].match(/[\da-f]{2}/gi)!.map(h=>parseInt(h,16));
    r.style.setProperty('--accent-rgb', `${r2} ${g2} ${b2}`);
  }, [accentColor]);

  // ── Game session timer tick (refresh elapsed time display every minute) ──
  useEffect(() => {
    const t = setInterval(() => setGameTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

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
        // Don't go idle while actively playing a game
        if (currentUser?.id && steamGameStartRef.current.has(currentUser.id)) return;
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

  // ── Close notification panel on outside click ────────────────────
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifBellRef.current && !notifBellRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // ── Enumerate devices ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    getMediaDevices().then(setDevices).catch(() => {});
    navigator.mediaDevices?.addEventListener('devicechange', () =>
      getMediaDevices().then(setDevices).catch(() => {}));
  }, [isAuthenticated]);

  // ── Persist selected devices across sessions ─────────────────────
  useEffect(() => { if (selMic)     localStorage.setItem('cordyn_mic',     selMic);     }, [selMic]);
  useEffect(() => { if (selSpeaker) localStorage.setItem('cordyn_speaker', selSpeaker); }, [selSpeaker]);
  useEffect(() => { if (selCamera)  localStorage.setItem('cordyn_camera',  selCamera);  }, [selCamera]);
  useEffect(() => { localStorage.setItem('cordyn_streamer', streamerMode ? '1' : '0'); }, [streamerMode]);

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
          // Remote video track (camera or screen share)
          remoteScreenStreamsRef.current.set(remoteUserId, stream);
          setScreenShareTick(t => t + 1);
          // Clear frozen frame when remote turns off camera/share
          e.track.onended = () => {
            if (remoteScreenStreamsRef.current.get(remoteUserId) === stream) {
              remoteScreenStreamsRef.current.delete(remoteUserId);
              setScreenShareTick(t => t + 1);
            }
          };
          e.track.onmute = () => {
            if (remoteScreenStreamsRef.current.get(remoteUserId) === stream) {
              remoteScreenStreamsRef.current.delete(remoteUserId);
              setScreenShareTick(t => t + 1);
            }
          };
          // Attach screen-share audio element (audio separate from video so volume is controllable)
          if (stream.getAudioTracks().length > 0) {
            attachRemoteScreenAudio(remoteUserId, stream);
            // Restore saved stream volume preference
            try {
              const saved = localStorage.getItem(`cordyn_streamvol_${remoteUserId}`);
              if (saved !== null) {
                const vol = parseInt(saved, 10);
                if (!isNaN(vol)) { setStreamVols(p => ({ ...p, [remoteUserId]: vol })); setRemoteScreenVolume(remoteUserId, vol); }
              }
            } catch {}
          }
        } else {
          // Audio track — only attach as mic audio if stream has NO video (not a screen-share stream)
          if (stream.getVideoTracks().length === 0) {
            attachRemoteAudio(remoteUserId, stream);
            // Restore saved volume preference for this user
            try {
              const saved = localStorage.getItem(`cordyn_vol_${remoteUserId}`);
              if (saved !== null) {
                const vol = parseInt(saved, 10);
                if (!isNaN(vol)) {
                  setUserVols(p => ({ ...p, [remoteUserId]: vol }));
                  setRemoteVolume(remoteUserId, vol);
                }
              }
            } catch {}
            const stop = watchSpeaking(stream, (s) =>
              setSpeakingUsers(p => { const n = new Set(p); s ? n.add(remoteUserId) : n.delete(remoteUserId); return n; }));
            const old = speakStopRef.current.get(remoteUserId); if (old) old();
            speakStopRef.current.set(remoteUserId, stop);
          }
          // Audio track on a stream that also has video = screen-share audio arriving separately
          // (race: audio track fires before/after video track; attachRemoteScreenAudio is idempotent)
          else {
            attachRemoteScreenAudio(remoteUserId, stream);
            try {
              const saved = localStorage.getItem(`cordyn_streamvol_${remoteUserId}`);
              if (saved !== null) {
                const vol = parseInt(saved, 10);
                if (!isNaN(vol)) { setStreamVols(p => ({ ...p, [remoteUserId]: vol })); setRemoteScreenVolume(remoteUserId, vol); }
              }
            } catch {}
          }
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
          playVoiceJoin();   // someone else joined my channel
          await openPeer(user.id, true);
        }
      },
      onUserLeft: ({ channel_id, user_id }: any) => {
        setVoiceUsers(p => ({ ...p, [channel_id]: (p[channel_id]||[]).filter((u:VoiceUser)=>u.id!==user_id) }));
        const me = currentUserRef.current; const call = activeCallRef.current;
        if (me && user_id !== me.id && call?.channelId === channel_id) {
          playVoiceLeave();  // someone else left my channel
        }
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
      // remoteUserId is passed directly from the socket event to avoid stale ref race condition
      onCallAccepted: async (remoteUserId: string) => {
        const userId = remoteUserId || activeCallRef.current?.userId;
        if (!userId) return;
        await openPeer(userId, true);
      },
    };
  }); // runs every render to keep closures fresh

  // ── Loaders ─────────────────────────────────────────────────────
  const loadServers = () => serversApi.list().then(list => {
    setServerList(list);
    // Do NOT auto-select first server — default view is DMs (set by useState initial value)
  }).catch(console.error);
  const loadFriends = () => {
    friendsApi.list().then(setFriends).catch(console.error);
    friendsApi.requests().then(setFriendReqs).catch(console.error);
    friendsApi.blocked().then(bl => setBlockedUsers(new Set(bl.map(b => b.id)))).catch(console.error);
  };
  const loadDms    = () => dmsApi.conversations().then(setDmConvs).catch(console.error);

  const handleBlockUser = async (userId: string, username: string) => {
    await friendsApi.block(userId);
    setBlockedUsers(prev => new Set([...prev, userId]));
    addToast(`Zablokowano ${username}`, 'success');
    setShowDmMenu(false);
  };

  const handleUnblockUser = async (userId: string, username: string) => {
    await friendsApi.unblock(userId);
    setBlockedUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
    addToast(`Odblokowano ${username}`, 'success');
    setShowDmMenu(false);
  };

  const handleRemoveFriend = async (friendshipId: string, username: string) => {
    await friendsApi.remove(friendshipId);
    setFriends(prev => prev.filter(f => (f.friendship_id ?? f.id) !== friendshipId));
    addToast(`Usunięto ${username} ze znajomych`, 'success');
    setShowDmMenu(false);
  };

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
  type PrivacyKey = 'privacy_status_visible'|'privacy_typing_visible'|'privacy_read_receipts'|'privacy_friend_requests'|'privacy_dm_from_strangers';
  const getPrivacy = (k: PrivacyKey) =>
    currentUser?.[k] ?? (k === 'privacy_read_receipts' ? false : true);
  const togglePrivacy = async (k: PrivacyKey) => {
    const next = !getPrivacy(k);
    const upd = await users.updateMe({ [k]: next } as any).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); addToast('Ustawienia prywatności zapisane', 'success'); }
    else addToast('Błąd zapisu ustawień', 'error');
  };

  // Derived appearance values
  const msgFontCls = fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm';

  // Mention autocomplete
  const mentionSuggestions = mentionQuery !== null
    ? members.filter(m => m.username.toLowerCase().startsWith(mentionQuery.toLowerCase()) && m.id !== currentUser?.id).slice(0, 6)
    : [];
  const insertMention = (username: string) => {
    const el = msgInputRef.current;
    if (!el) return;
    const caretPos = el.selectionStart ?? msgInput.length;
    const before = msgInput.slice(0, caretPos).replace(/!([a-zA-Z0-9_]*)$/, `!${username} `);
    const after  = msgInput.slice(caretPos);
    const newVal = before + after;
    setMsgInput(newVal);
    setMentionQuery(null);
    setMentionSel(0);
    setTimeout(() => { el.focus(); el.setSelectionRange(before.length, before.length); }, 0);
  };

  // ── Appearance helpers (save to DB) ──────────────────────────────
  const saveAccentColor = async (color: string) => {
    const upd = await users.updateMe({ accent_color: color }).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); setAccentColor(color); addToast('Kolor akcentu zmieniony', 'success'); }
    else addToast('Błąd zapisu', 'error');
  };
  const saveAvatarEffect = async (effect: string) => {
    const upd = await users.updateMe({ avatar_effect: effect } as any).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); setAvatarEffect(effect); addToast('Efekt avatara zmieniony', 'success'); }
    else addToast('Błąd zapisu', 'error');
  };
  const saveCompactMessages = async (compact: boolean) => {
    const upd = await users.updateMe({ compact_messages: compact }).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); setCompactMessages(compact); addToast('Układ wiadomości zmieniony', 'success'); }
    else addToast('Błąd zapisu', 'error');
  };
  const saveFontSize = async (size: 'small'|'normal'|'large') => {
    setFontSize(size); // apply immediately for live preview
    const upd = await users.updateMe({ font_size: size }).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); }
  };
  const saveTogglePref = async (
    key: 'show_timestamps'|'show_chat_avatars'|'message_animations'|'show_link_previews'|'privacy_dm_from_strangers',
    value: boolean
  ) => {
    const setter: Record<string, (v: boolean) => void> = {
      show_timestamps:   setAlwaysShowTimestamps,
      show_chat_avatars: setShowChatAvatars,
      message_animations: setMessageAnimations,
      show_link_previews: setShowLinkPreviews,
    };
    setter[key]?.(value); // apply immediately
    const upd = await users.updateMe({ [key]: value } as any).catch(() => null);
    if (upd) { setCurrentUser(upd); setEditProf({...upd}); }
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
    setAvatarEffect(u.avatar_effect || 'none');
    setCompactMessages(u.compact_messages ?? false);
    setNoiseCancel(u.voice_noise_cancel !== false); // default true
    setFontSize((u.font_size as 'small'|'normal'|'large') || 'normal');
    setAlwaysShowTimestamps(u.show_timestamps ?? false);
    setShowChatAvatars(u.show_chat_avatars !== false); // default true
    setMessageAnimations(u.message_animations !== false); // default true
    setShowLinkPreviews(u.show_link_previews !== false); // default true
  };
  const [showWelcome, setShowWelcome] = useState(false);
  const handleAuth = (u: UserProfile, _t: string, isNew = false) => {
    setCurrentUser(u); setEditProf({...u}); setIsAuthenticated(true); applyUserPrefs(u);
    if (pendingInvite) { setInviteDialog(true); }
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

  // ── Slowmode countdown ──────────────────────────────────────────
  useEffect(() => {
    if (slowmodeLeft <= 0) return;
    const t = setInterval(() => setSlowmodeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [slowmodeLeft]);

  // Reset slowmode and pinned panel when switching channels
  useEffect(() => { setSlowmodeLeft(0); setShowPinned(false); setPinnedMsgs([]); }, [activeChannel]);

  // Auto-resize message textarea
  useEffect(() => {
    const el = msgInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [msgInput]);

  // ── Send message ────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = msgInput.trim();
    // /poll command — open poll modal
    if (content.startsWith('/poll')) {
      setMsgInput('');
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMulti(false);
      setPollModal({ open: true });
      return;
    }
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
    } catch (err: any) {
      // 429 = slowmode – extract remaining seconds from error
      if ((err as any)?.status === 429) {
        const match = (err?.message || '').match(/(\d+)s/);
        setSlowmodeLeft(match ? parseInt(match[1]) : 5);
      }
      setSendError(err?.message || 'Nie udało się wysłać');
      setMsgInput(finalContent);
    }
    finally { setSending(false); }
  };

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setAttachFile(f);
    if (f.type.startsWith('image/')) setAttachPreview(URL.createObjectURL(f));
    else setAttachPreview(null);
    e.target.value = '';
  };

  // ── Formatting toolbar — wrap selected text in markdown syntax ───────────
  const wrapSelection = (prefix: string, suffix: string = prefix) => {
    const el = msgInputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end   = el.selectionEnd   ?? 0;
    const selected = msgInput.slice(start, end) || 'tekst';
    const newVal = msgInput.slice(0, start) + prefix + selected + suffix + msgInput.slice(end);
    setMsgInput(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // ── Voice channel chat send ──────────────────────────────────────
  const handleVoiceChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = voiceChatInput.trim();
    if (!content || !activeCall?.channelId) return;
    setVoiceChatInput('');
    try { await messagesApi.send(activeCall.channelId, content); }
    catch { setVoiceChatInput(content); }
  };

  // ── Edit message ─────────────────────────────────────────────────
  const startEditMsg = (msg: MessageFull | DmMessageFull) => {
    setEditingMsgId(msg.id);
    setEditingMsgContent(msg.content);
  };
  const cancelEditMsg = () => { setEditingMsgId(null); setEditingMsgContent(''); };
  const submitEditMsg = async (msg: MessageFull | DmMessageFull) => {
    const newContent = editingMsgContent.trim();
    if (!newContent || newContent === msg.content) { cancelEditMsg(); return; }
    cancelEditMsg(); // optimistic: close edit UI immediately
    try {
      if (activeView === 'dms') {
        // Optimistic update — show immediately, socket will confirm
        setDmMsgs(p => p.map(m => m.id === msg.id ? { ...m, content: newContent, edited: true } : m));
        await dmsApi.editMessage(msg.id, newContent);
      } else {
        // Optimistic update
        setChannelMsgs(p => p.map(m => m.id === msg.id ? { ...m, content: newContent, edited: true } : m));
        await messagesApi.edit(msg.id, newContent);
      }
    } catch (err: any) {
      addToast(err?.message || 'Nie udało się edytować wiadomości', 'error');
      // Revert on error
      if (activeView === 'dms') setDmMsgs(p => p.map(m => m.id === msg.id ? { ...m, content: msg.content, edited: (msg as any).edited } : m));
      else setChannelMsgs(p => p.map(m => m.id === msg.id ? { ...m, content: msg.content, edited: (msg as any).edited } : m));
    }
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
      const upd = await serversApi.update(activeServer, { name: srvForm.name, description: srvForm.description, icon_url: icon, banner_url: banner, accent_color: (srvForm as any).accent_color } as any);
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
    const icon = newChType==='voice'?'🎙️':newChType==='forum'?'🗨️':newChType==='announcement'?'📣':'#️⃣';
    try {
      await channelsApi.create({ server_id: activeServer, name: newChName.trim(), type: newChType, category_id: chCreateCatId || undefined, is_private: newChPrivate, role_ids: newChPrivate ? newChRoles : undefined });
      addServerActivity({ icon, text: `Kanał #${newChName.trim()} został utworzony` });
      setChCreateOpen(false); setNewChName(''); setNewChPrivate(false); setNewChRoles([]);
      // NOTE: Do NOT refetch serverFull here — the socket 'channel_created' event handles state update.
      // Re-fetching would overwrite the __uncat__ pseudo-category that the socket handler adds for uncategorized channels.
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || 'Nie udało się utworzyć kanału', 'error');
    }
  };

  // ── Create Category ──────────────────────────────────────────────
  const handleCreateCat = async () => {
    if (!newCatName.trim() || !activeServer) return;
    try {
      await channelsApi.createCategory(activeServer, newCatName.trim(), newCatPrivate, newCatPrivate ? newCatRoles : undefined);
      setCatCreateOpen(false); setNewCatName(''); setNewCatPrivate(false); setNewCatRoles([]);
      addToast(`Kategoria „${newCatName.trim()}" utworzona`, 'success');
      const s = await serversApi.get(activeServer); setServerFull(s);
    } catch (err: any) {
      addToast(err?.message || 'Nie udało się utworzyć kategorii', 'error');
    }
  };

  // ── Category rename / delete ─────────────────────────────────────
  const startEditCat = (cat: { id: string; name: string }) => {
    setEditingCatId(cat.id); setEditingCatName(cat.name);
  };
  const cancelEditCat = () => { setEditingCatId(null); setEditingCatName(''); };
  const submitEditCat = async (catId: string) => {
    const name = editingCatName.trim();
    if (!name) { cancelEditCat(); return; }
    cancelEditCat();
    try { await channelsApi.updateCategory(catId, name); }
    catch (err: any) { addToast(err?.message || 'Nie udało się zmienić nazwy', 'error'); }
  };
  const handleDeleteCat = (cat: { id: string; name: string }) => {
    confirmAction(`Usunąć kategorię „${cat.name}"? Kanały staną się niekategoryzowane.`, async () => {
      try { await channelsApi.deleteCategory(cat.id); }
      catch (err: any) { addToast(err?.message || 'Nie udało się usunąć kategorii', 'error'); }
    });
  };

  // ── Invite Friends ───────────────────────────────────────────────
  const openInviteFriends = async () => {
    setSrvDropOpen(false); setInviteFriendsOpen(true);
    if (!inviteFriendsCode) {
      try { const r = await serversApi.createInvite(activeServer, '604800'); setInviteFriendsCode(r.code); }
      catch (err) { console.error(err); }
    }
  };
  const handleInviteFriend = async (friendId: string, friendUsername: string) => {
    if (!inviteFriendsCode || !serverFull) return;
    setInviteSending(friendId);
    const srvName  = serverFull.name;
    const iconUrl  = serverFull.icon_url  || '';
    const bannerUrl = serverFull.banner_url || '';
    // Special invite message format — pipe-separated, safe printable chars
    // Format: CINV|serverId|code|serverName|iconUrl|bannerUrl
    const srvNameSafe  = srvName.replace(/\|/g, ' ');
    const iconSafe     = iconUrl.replace(/\|/g, '');
    const bannerSafe   = bannerUrl.replace(/\|/g, '');
    const inviteMsg    = `CINV|${activeServer}|${inviteFriendsCode}|${srvNameSafe}|${iconSafe}|${bannerSafe}`;
    try {
      await dmsApi.send(friendId, inviteMsg);
      addToast(`Zaproszenie wysłane do ${friendUsername}!`, 'success');
    } catch (err: any) {
      addToast(err?.message || 'Nie udało się wysłać zaproszenia', 'error');
    } finally { setInviteSending(null); }
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
    setChForm({ name: ch.name, description: ch.description||'', is_private: ch.is_private||false, role_ids: ch.allowed_roles?.map(r => r.role_id)||[], slowmode_seconds: ch.slowmode_seconds||0 });
    setChEditOpen(true);
  };
  const handleSaveCh = async () => {
    if (!editingCh) return;
    try {
      await channelsApi.update(editingCh.id, { name: chForm.name, description: chForm.description, is_private: chForm.is_private, role_ids: chForm.is_private ? chForm.role_ids : [], slowmode_seconds: chForm.slowmode_seconds } as any);
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
      catch (err: any) { alert(err?.message || 'Błąd'); }
    });
  };
  const handleBan = (userId: string, username: string) => {
    if (!activeServer) return;
    confirmAction(`Zbanować ${username}?`, async () => {
      try {
        await serversApi.bans.ban(activeServer, userId);
        setMembers(p => p.filter(m => m.id !== userId));
      } catch (err: any) { alert(err?.message || 'Błąd'); }
    });
  };
  const handleUnban = (userId: string) => {
    if (!activeServer) return;
    confirmAction('Odbanować użytkownika?', async () => {
      try {
        await serversApi.bans.unban(activeServer, userId);
        setBanList(p => p.filter(b => b.user_id !== userId));
      } catch (err: any) { alert(err?.message || 'Błąd'); }
    });
  };
  const handlePinMessage = async (msgId: string, pinned: boolean) => {
    // Optimistic update
    setChannelMsgs(p => p.map(m => m.id === msgId ? { ...m, pinned } : m));
    try {
      await messagesApi.pin(msgId, pinned);
      // Refresh pinned panel if open
      if (showPinned && activeChannel) {
        messagesApi.listPinned(activeChannel).then(setPinnedMsgs).catch(() => {});
      }
    } catch (err: any) {
      // Revert on error
      setChannelMsgs(p => p.map(m => m.id === msgId ? { ...m, pinned: !pinned } : m));
      alert(err?.message || 'Błąd');
    }
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
  const openProfilePage = async (userId: string) => {
    setProfileViewId(userId);
    setProfilePageData(null); setProfileGames([]); setProfileSpotify(null); setProfileTwitch(null); setProfileSteam(null); setProfileViewedJam(null);
    setProfileLoading(true);
    const [prof, games, spotify, twitch, steam] = await Promise.allSettled([
      users.get(userId),
      gamesApi.getUser(userId),
      spotifyApi.userPublic(userId),
      twitchApi.userPublic(userId),
      steamApi.userPublic(userId),
    ]);
    if (prof.status === 'fulfilled')    setProfilePageData(prof.value);
    if (games.status === 'fulfilled')   setProfileGames(games.value);
    if (spotify.status === 'fulfilled') setProfileSpotify(spotify.value);
    if (twitch.status === 'fulfilled')  setProfileTwitch(twitch.value);
    if (steam.status === 'fulfilled')   setProfileSteam(steam.value);
    setProfileLoading(false);
    // Load friend's JAM status if not own profile
    if (userId !== currentUser?.id) {
      spotifyApi.jamInfo(userId).then(j => setProfileViewedJam(j)).catch(() => {});
    }
    // If own profile — also load connection statuses
    if (userId === currentUser?.id) {
      spotifyApi.status().then(setOwnSpotify).catch(()=>{});
      twitchApi.status().then(setOwnTwitch).catch(()=>{});
      steamApi.status().then(setOwnSteam).catch(()=>{});
      spotifyApi.jamActive().then(setMyJam).catch(()=>{});
    }
    // Load user note for other users
    if (userId !== currentUser?.id && !userNotes.has(userId)) {
      notesApi.get(userId).then(r => {
        setUserNotes(p => new Map(p).set(userId, r.content || ''));
      }).catch(() => {});
    }
  };
  const closeProfilePage = () => { setProfileViewId(null); setProfilePageData(null); };
  const openProfile = (u: any) => { if (u?.id) openProfilePage(u.id); };
  const openOwnProfile = () => { if (currentUser?.id) openProfilePage(currentUser.id); };

  const saveUserNote = (userId: string, content: string) => {
    setUserNotes(p => new Map(p).set(userId, content));
    if (userNoteDebounceRef.current) clearTimeout(userNoteDebounceRef.current);
    userNoteDebounceRef.current = setTimeout(async () => {
      try { await notesApi.save(userId, content); } catch {}
    }, 1000);
  };

  // ── Hover card ────────────────────────────────────────────────────
  const showHoverCard = (userId: string, e: React.MouseEvent) => {
    if (hoverCardTimer.current) clearTimeout(hoverCardTimer.current);
    if (hoverCardHideTimer.current) clearTimeout(hoverCardHideTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverCardTimer.current = setTimeout(() => {
      setHoverCard({ userId, x: rect.right, y: rect.top });
    }, 450);
  };
  const hideHoverCard = () => {
    if (hoverCardTimer.current) clearTimeout(hoverCardTimer.current);
    hoverCardHideTimer.current = setTimeout(() => setHoverCard(null), 180);
  };
  const cancelHideHoverCard = () => {
    if (hoverCardHideTimer.current) clearTimeout(hoverCardHideTimer.current);
  };
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
      setProfilePageData(upd);
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
    // Stop noise pipeline (closes AudioContext + raw mic)
    if (noisePipelineRef.current) { noisePipelineRef.current.cleanup(); noisePipelineRef.current = null; }
    else { localStreamRef.current?.getTracks().forEach(t => t.stop()); }
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop()); screenStreamRef.current = null;
    // Stop speaking detection
    speakStopRef.current.forEach(fn => fn()); speakStopRef.current.clear();
    setSpeakingUsers(new Set());
  };

  const acquireMic = async (deviceId?: string, noiseCancelOverride?: boolean): Promise<MediaStream|null> => {
    const useNoise = noiseCancelOverride !== undefined ? noiseCancelOverride : noiseCancel;
    try {
      // Stop previous speaking detection
      const old = speakStopRef.current.get('self'); if (old) { old(); speakStopRef.current.delete('self'); }
      // Clean up previous noise pipeline (this also stops the old raw mic stream)
      if (noisePipelineRef.current) {
        noisePipelineRef.current.cleanup();
        noisePipelineRef.current = null;
      } else {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
      }
      localStreamRef.current = null;

      // Acquire raw mic — echoCancellation/autoGain always on; noiseSuppression off
      // because our AudioWorklet handles noise (they'd conflict if both active).
      const audioConstraints: MediaTrackConstraints = {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: true,   // hardware echo cancel — always useful
        autoGainControl:  true,   // normalize mic level
        noiseSuppression: !useNoise, // browser's basic filter only when our gate is off
      };
      const rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

      // Speaking detection on the raw stream (pre-gate) so indicator stays accurate
      if (currentUserRef.current?.id) {
        const uid = currentUserRef.current.id;
        const stop = watchSpeaking(rawStream, s =>
          setSpeakingUsers(p => { const n = new Set(p); s ? n.add(uid) : n.delete(uid); return n; }));
        speakStopRef.current.set('self', stop);
      }

      // Apply noise gate AudioWorklet if enabled
      let sendStream = rawStream;
      if (useNoise) {
        const pipeline = await applyNoiseGate(rawStream);
        if (pipeline) {
          noisePipelineRef.current = pipeline;
          sendStream = pipeline.processedStream;
        }
        // If applyNoiseGate returns null (unsupported), sendStream stays rawStream
      }

      localStreamRef.current = sendStream;
      // Pipe processed (or raw) stream to peer connections
      peerConnsRef.current.forEach(pc =>
        sendStream.getTracks().forEach(newTrack => {
          const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
          if (sender) { sender.replaceTrack(newTrack).catch(console.error); }
          else { pc.addTrack(newTrack, sendStream); }
        }));
      // Re-enumerate after permission granted — now we get real device labels
      getMediaDevices().then(setDevices).catch(() => {});
      return sendStream;
    } catch (err: any) {
      const msg = err?.name === 'NotFoundError' ? 'Nie znaleziono mikrofonu'
        : err?.name === 'NotAllowedError' ? 'Brak uprawnień do mikrofonu — zezwól w przeglądarce'
        : 'Brak dostępu do mikrofonu';
      addToast(msg, 'error'); return null;
    }
  };

  const joinVoiceCh = async (ch: ChannelData) => {
    if (activeCall?.channelId === ch.id) return; // Already on this channel — don't rejoin (would break mic)
    // Close settings / admin panel so the call panel is visible
    setSrvSettOpen(false);
    if (activeViewRef.current === 'admin') setActiveView('servers');
    const curCall = activeCallRef.current;
    // End any active DM call first — only 1 call allowed at a time
    if (curCall?.userId) {
      endCall(curCall.userId);
      stopRing(); stopIncomingRing(); playCallEnded();
      dmsApi.sendSystem(curCall.userId, `📞 Rozmowa zakończona · ${fmtDur(callDurationRef.current)}`).catch(() => {});
      cleanupWebRTC();
      setActiveCall(null); setShowCallPanel(false); setCallDuration(0);
    }
    // Switch voice channel if needed
    if (curCall?.channelId && curCall.channelId !== ch.id) {
      leaveVoiceChannel(curCall.channelId);
      if (currentUser) setVoiceUsers(p => ({ ...p, [curCall.channelId!]: (p[curCall.channelId!]||[]).filter(u=>u.id!==currentUser.id) }));
      cleanupWebRTC();
    }
    await acquireMic(selMic || undefined);
    joinVoiceChannel(ch.id);
    playVoiceJoin();
    setActiveCall({ type: 'voice_channel', channelId: ch.id, channelName: ch.name, serverId: activeServer, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    // Load current voice DJ for this channel
    spotifyApi.voiceDjGet(ch.id).then(r => {
      if (r.dj) setVoiceDj(p=>({...p,[ch.id]:r.dj}));
    }).catch(()=>{});
    setShowCallPanel(true);
    // Notify other tabs to leave voice
    try { voiceBcRef.current?.postMessage({ type: 'voice_joined' }); } catch {}
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

  const startDmCall = async (userId: string, username: string, type: 'voice'|'video', avatarUrl?: string | null) => {
    const curCall = activeCallRef.current;
    // Leave any active voice channel first — only 1 call allowed at a time
    if (curCall?.channelId) {
      leaveVoiceChannel(curCall.channelId);
      playVoiceLeave();
      if (currentUser) setVoiceUsers(p => ({ ...p, [curCall.channelId!]: (p[curCall.channelId!]||[]).filter(u=>u.id!==currentUser.id) }));
      cleanupWebRTC();
      setActiveCall(null); setShowCallPanel(false);
    }
    await acquireMic(selMic || undefined);
    sendCallInvite(userId, type);
    startRing();
    setActiveCall({ type: type === 'voice' ? 'dm_voice' : 'dm_video', userId, username, avatarUrl: avatarUrl ?? null, isMuted: false, isDeafened: false, isCameraOn: false, isScreenSharing: false });
    setActiveDmUserId(userId); setActiveView('dms'); setShowCallPanel(true); setProfileOpen(false);
    // Notify other tabs to leave voice
    try { voiceBcRef.current?.postMessage({ type: 'voice_joined' }); } catch {}
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
      // Stop local video tracks
      localStreamRef.current?.getVideoTracks().forEach(t => { t.stop(); });
      // Remove video senders from all peer connections and renegotiate
      peerConnsRef.current.forEach(async (pc, peerId) => {
        const videoSenders = pc.getSenders().filter(s => s.track?.kind === 'video');
        videoSenders.forEach(s => { try { pc.removeTrack(s); } catch {} });
        if (pc.signalingState === 'stable') {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            getSocket().emit('webrtc_offer', { to: peerId, sdp: offer });
          } catch {}
        }
      });
      localStreamRef.current = localStreamRef.current ?
        new MediaStream(localStreamRef.current.getAudioTracks()) : null;
      setActiveCall(p => p ? {...p, isCameraOn: false} : p);
    } else {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: selCamera ? { deviceId: { exact: selCamera } } : true });
        vs.getVideoTracks().forEach(t => { localStreamRef.current?.addTrack(t); });
        // Add video track to each peer connection and renegotiate
        peerConnsRef.current.forEach(async (pc, peerId) => {
          vs.getVideoTracks().forEach(t => {
            const existing = pc.getSenders().find(s => s.track?.kind === 'video');
            if (existing) { existing.replaceTrack(t).catch(() => {}); }
            else { pc.addTrack(t, localStreamRef.current!); }
          });
          if (pc.signalingState === 'stable') {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              getSocket().emit('webrtc_offer', { to: peerId, sdp: offer });
            } catch {}
          }
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
  if (authLoading) return <div className="fixed inset-0 bg-black/20 flex items-center justify-center"><Loader2 size={32} className="text-indigo-400 animate-spin" /></div>;
  if (!isAuthenticated) return <AuthScreen onAuth={(u, t, isNew) => handleAuth(u, t, isNew)} inviteInfo={pendingInvite} />;

  const allChs   = serverFull?.categories.flatMap(c => c.channels) ?? [];
  const activeCh = allChs.find(c => c.id === activeChannel);
  const activeDm = dmConvs.find(d => d.other_user_id === activeDmUserId);
  const isAdmin  = !!(serverFull?.my_role && ['Owner','Admin'].includes(serverFull.my_role));
  const myPerms: string[]      = serverFull?.my_permissions ?? [];
  const hasAdminPerm           = isAdmin || myPerms.includes('administrator');
  const canManageChannels      = hasAdminPerm || myPerms.includes('manage_channels');
  const canManageRoles         = hasAdminPerm || myPerms.includes('manage_roles');
  const canKickMembers         = hasAdminPerm || myPerms.includes('kick_members');
  const canManageServer        = hasAdminPerm || myPerms.includes('manage_server');
  const canManageMessages      = hasAdminPerm || myPerms.includes('manage_messages');
  const canSendMessages        = hasAdminPerm || myPerms.length === 0 || myPerms.includes('send_messages');
  const canBanMembers          = hasAdminPerm || myPerms.includes('ban_members');
  const canCreateInvites       = hasAdminPerm || myPerms.length === 0 || myPerms.includes('create_invites');
  const canAttachFiles         = hasAdminPerm || myPerms.length === 0 || myPerms.includes('attach_files');
  const canMentionEveryone     = hasAdminPerm || myPerms.includes('mention_everyone');
  const canPinMessages         = hasAdminPerm || myPerms.includes('pin_messages');
  const incoming = friendReqs.filter(r => r.direction === 'incoming');
  const outgoing = friendReqs.filter(r => r.direction === 'outgoing');
  const allMessages = activeView === 'servers' ? channelMsgs : dmMsgs;
  const messages = searchQuery.trim()
    ? allMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : allMessages;

  // Highlight matching text in search results
  // Returns status label + color class for non-online statuses (idle, dnd)
  const statusLabel = (s: string | undefined) => {
    if (s === 'idle') return { text: 'Zaraz wracam', cls: 'text-amber-400' };
    if (s === 'dnd')  return { text: 'Nie przeszkadzać', cls: 'text-rose-400' };
    return null;
  };

  // Returns badge array for a message sender (looks up members/dmPartnerProfile)
  const getMsgSenderBadges = (senderId: string): import('./api').Badge[] => {
    if (senderId === currentUser?.id) return currentUser?.badges ?? [];
    if (activeView === 'servers') return members.find(m => m.id === senderId)?.badges ?? [];
    return dmPartnerProfile?.badges ?? [];
  };

  // Maps server_activity.type to a Lucide icon element (no emoji)
  const activityIcon = (type: string) => {
    const cls = 'w-7 h-7 rounded-xl flex items-center justify-center shrink-0';
    switch (type) {
      case 'voice_join':
        return <div className={`${cls} bg-emerald-500/15`}><Volume2 size={13} className="text-emerald-400"/></div>;
      case 'voice_leave':
        return <div className={`${cls} bg-zinc-800`}><VolumeX size={13} className="text-zinc-500"/></div>;
      case 'member_join':
        return <div className={`${cls} bg-emerald-500/15`}><UserPlus size={13} className="text-emerald-400"/></div>;
      case 'member_leave':
        return <div className={`${cls} bg-zinc-800`}><LogOut size={13} className="text-zinc-500"/></div>;
      default:
        return <div className={`${cls} bg-indigo-500/15`}><Activity size={13} className="text-indigo-400"/></div>;
    }
  };

  // ── Channel/Category DnD ─────────────────────────────────────────────────────
  function handleChannelDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null); setActiveDragType(null);
    if (!over || !serverFull) return;
    const type = active.data.current?.type;
    const snapshot = serverFull; // snapshot for rollback

    if (type === 'category') {
      const cats = serverFull.categories.filter(c => c.id !== '__uncat__');
      const oldIdx = cats.findIndex(c => c.id === active.id);
      const newIdx = cats.findIndex(c => c.id === over.id);
      if (oldIdx === newIdx || oldIdx === -1) return;
      const reordered = (arrayMove(cats, oldIdx, newIdx) as typeof cats).map((c, i) => ({ ...c, position: i }));
      setServerFull(p => p ? { ...p, categories: [...reordered, ...p.categories.filter(c => c.id === '__uncat__')] } : p);
      channelsApi.reorderCategories(serverFull.id, reordered.map(c => ({ id: c.id, position: c.position ?? 0 }))).catch(() => {
        setServerFull(snapshot);
        addToast('Nie udało się zapisać kolejności kategorii', 'error');
      });
      return;
    }

    if (type === 'channel') {
      const activeCatId = active.data.current?.categoryId as string;
      const overCatId   = (over.data.current?.categoryId ?? over.id) as string;
      const activeCat   = serverFull.categories.find(c => c.id === activeCatId);
      if (!activeCat) return;

      if (activeCatId === overCatId) {
        const oldIdx = activeCat.channels.findIndex(c => c.id === active.id);
        const newIdx = activeCat.channels.findIndex(c => c.id === over.id);
        if (oldIdx === newIdx || oldIdx === -1) return;
        const reordered = (arrayMove(activeCat.channels, oldIdx, newIdx) as typeof activeCat.channels).map((c, i) => ({ ...c, position: i }));
        setServerFull(p => p ? { ...p, categories: p.categories.map(cat => cat.id === activeCatId ? { ...cat, channels: reordered } : cat) } : p);
        channelsApi.reorderChannels(serverFull.id, reordered.map(c => ({ id: c.id, position: c.position ?? 0, category_id: activeCatId }))).catch(() => {
          setServerFull(snapshot);
          addToast('Nie udało się zapisać kolejności kanałów', 'error');
        });
      } else {
        const targetCat = serverFull.categories.find(c => c.id === overCatId);
        if (!targetCat) return;
        const movedCh = activeCat.channels.find(c => c.id === active.id);
        if (!movedCh) return;
        const overIdx = targetCat.channels.findIndex(c => c.id === over.id);
        const insertAt = overIdx === -1 ? targetCat.channels.length : overIdx;
        const newSrcChs = activeCat.channels.filter(c => c.id !== active.id).map((c, i) => ({ ...c, position: i }));
        const tgtArr = [...targetCat.channels];
        tgtArr.splice(insertAt, 0, { ...movedCh, category_id: overCatId });
        const newTgtChs = tgtArr.map((c, i) => ({ ...c, position: i }));
        setServerFull(p => p ? { ...p, categories: p.categories.map(cat =>
          cat.id === activeCatId ? { ...cat, channels: newSrcChs } :
          cat.id === overCatId   ? { ...cat, channels: newTgtChs } : cat
        )} : p);
        const allUpdated = [
          ...newSrcChs.map(c => ({ id: c.id, position: c.position ?? 0, category_id: activeCatId })),
          ...newTgtChs.map(c => ({ id: c.id, position: c.position ?? 0, category_id: overCatId })),
        ];
        channelsApi.reorderChannels(serverFull.id, allUpdated).catch(() => {
          setServerFull(snapshot);
          addToast('Nie udało się zapisać kolejności kanałów', 'error');
        });
      }
    }
  }

  // ── Markdown + Mention HTML renderer ───────────────────────────────────────
  const renderMsgHTML = (text: string): string => {
    if (!text) return '';

    // ── Step 0: extract fenced code blocks (``` ``` multi-line) ─────
    const codeBlocks: string[] = [];
    // Alternation: first try ```lang\ncode``` (with explicit lang+newline),
    // then fall back to ```anything``` (no newline required — preserves backwards compat)
    let processed = text.replace(/```([a-zA-Z0-9]+)\n([\s\S]*?)```|```([\s\S]*?)```/g, (_, lang, code1, code2) => {
      const code = code1 !== undefined ? code1 : (code2 ?? '');
      const idx = codeBlocks.length;
      const safeLang = (lang || '').toLowerCase().substring(0, 20);
      const escaped = code.trim()
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const dataCode = encodeURIComponent(code.trim());
      codeBlocks.push(
        `<div class="code-block">` +
        `<div class="code-block-hdr">` +
        `<span class="code-lang">${safeLang || 'tekst'}</span>` +
        `<button class="copy-code-btn" data-code="${dataCode}" type="button">⎘ Kopiuj</button>` +
        `</div>` +
        `<pre class="code-pre"><code>${escaped}</code></pre>` +
        `</div>`
      );
      return `\x00CB${idx}\x00`;
    });

    // ── Step 1: protect mentions ──────────────────────────────────────
    const mentionMap: string[] = [];
    processed = processed.replace(/(![a-zA-Z0-9_]+|@everyone|@here)/g, (match) => {
      const idx = mentionMap.length;
      mentionMap.push(match);
      return `\x00M${idx}\x00`;
    });
    // ── Step 2: protect search-query highlights ───────────────────────
    const q = searchQuery.trim();
    if (q) {
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      processed = processed.replace(new RegExp(`(${esc})`, 'gi'), '\x00Q$1\x00Q');
    }
    // ── Step 3: parse each line with marked inline parser ─────────────
    const lines = processed.split('\n');
    let html = lines.map(line => marked.parseInline(line) as string).join('<br>');
    // ── Step 4: restore search highlights ────────────────────────────
    html = html.replace(/\x00Q([\s\S]+?)\x00Q/g, (_, m) =>
      `<mark style="background:rgba(234,179,8,0.2);color:#fef08a;border-radius:3px;padding:0 2px">${m}</mark>`);
    // ── Step 5: restore mentions ──────────────────────────────────────
    html = html.replace(/\x00M(\d+)\x00/g, (_, i) => {
      const mention = mentionMap[parseInt(i, 10)];
      if (mention === '@everyone' || mention === '@here')
        return `<span style="background:rgba(239,68,68,0.2);color:#fca5a5;border-radius:4px;padding:0 4px;font-weight:700;cursor:default">${mention}</span>`;
      const uname = mention.slice(1);
      const isMe = currentUser?.username?.toLowerCase() === uname.toLowerCase();
      const bg = isMe ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)';
      const color = isMe ? '#fbbf24' : '#a5b4fc';
      return `<span style="background:${bg};color:${color};border-radius:4px;padding:0 4px;font-weight:700;cursor:default">@${uname}</span>`;
    });
    // ── Step 6: links open in new tab ────────────────────────────────
    html = html.replace(/<a href=/g, '<a target="_blank" rel="noopener noreferrer" href=');
    // ── Step 7: sanitize (code block placeholders survive as text) ────
    let safe = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['strong', 'em', 'code', 'del', 's', 'a', 'br', 'span', 'mark'],
      ALLOWED_ATTR: ['href', 'style', 'target', 'rel'],
    });
    // ── Step 8: restore code blocks (already HTML-safe, injected after sanitize) ──
    safe = safe.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i, 10)] || '');
    return safe;
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full text-zinc-300 font-sans overflow-hidden relative bg-transparent p-2 gap-2">

      {/* TOP NAV — 3-col grid: [left tabs] [Cordyn] [right actions]
           grid-cols: 1fr auto 1fr guarantees center is always truly centered.
           No items-center on nav so children use h-full correctly (stretch). */}
      <nav className="h-12 shrink-0 z-30 glass-panel rounded-2xl px-2 grid" style={{gridTemplateColumns:'1fr auto 1fr'}}>
        {/* Left col — flex, clips overflow so tabs can't bleed into center */}
        <div className="flex items-center h-full min-w-0 overflow-hidden">
          <button onClick={() => setIsMobileOpen(v => !v)} className="md:hidden w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-white ml-2 shrink-0">
            {isMobileOpen ? <X size={18}/> : <Menu size={18}/>}
          </button>
          {/* Friends / DM quick icons — always visible, shrink-0 */}
          <div className="hidden md:flex items-center h-full pl-2 gap-0.5 pr-2 border-r border-white/[0.06] shrink-0">
            {([{v:'friends' as const,i:<Users size={15}/>,label:'Znajomi'},{v:'dms' as const,i:<MessageCircle size={15}/>,label:'Wiadomości'}]).map(({v,i,label}) => {
              const totalUnreadDms: number = v==='dms' ? (Object.values(unreadDms) as number[]).reduce((a,b)=>a+b,0) : 0;
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
          {/* Server tabs slider with ◀ ▶ arrows */}
          <div className="hidden md:flex items-center h-full min-w-0 flex-1 relative">
            {/* ◀ scroll left */}
            <button onClick={() => srvTabsRef.current && (srvTabsRef.current.scrollLeft -= 160)}
              className="w-6 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-all shrink-0 border-r border-white/[0.05]">
              <ChevronLeft size={13}/>
            </button>
            {/* scrollable tab strip */}
            <div ref={srvTabsRef} className="flex items-center h-full overflow-x-auto scrollbar-hide min-w-0 flex-1">
              {serverList.map(srv => {
                const isActive = activeServer===srv.id&&activeView==='servers';
                return (
                  <button key={srv.id}
                    onClick={() => { if(activeServer===srv.id&&activeView==='servers') return; setActiveServer(srv.id); setActiveView('servers'); setActiveChannel(''); setServerFull(null); setProfileViewId(null); }}
                    onContextMenu={e => { e.preventDefault(); setSrvContextMenu({ x: e.clientX, y: e.clientY, srv }); }}
                    className={`flex items-center gap-2 h-full px-3 text-sm font-medium transition-all duration-200 border-r border-white/[0.05] whitespace-nowrap relative group shrink-0 ${isActive?'text-white bg-black/20':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'}`}>
                    {isActive&&<motion.span layoutId="nav-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"/>}
                    <span className={`relative w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden transition-all duration-200 ${isActive?'bg-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.3)]':'bg-zinc-800'} ${srv.is_official?'ring-2 ring-amber-400/80 ring-offset-[2px] ring-offset-transparent':''}`}>
                      {srv.icon_url ? <img src={srv.icon_url} className="w-full h-full object-cover" alt=""/> : srv.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[90px] truncate">{srv.name}</span>
                    {srv.is_official&&(
                      <BadgeCheck size={13} className="shrink-0 text-amber-400" title="Oficjalny serwer Cordyn"/>
                    )}
                  </button>
                );
              })}
            </div>
            {/* ▶ scroll right */}
            <button onClick={() => srvTabsRef.current && (srvTabsRef.current.scrollLeft += 160)}
              className="w-6 h-full flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-all shrink-0 border-r border-white/[0.05]">
              <ChevronRight size={13}/>
            </button>
          </div>
          {/* + button always visible */}
          <button onClick={() => setCreateSrvOpen(true)} title="Utwórz serwer"
            className="hidden md:flex items-center justify-center w-9 h-full text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 border-r border-white/[0.05] shrink-0">
            <Plus size={15}/>
          </button>
        </div>
        {/* Center col — Cordyn, always truly centered in the nav */}
        <div className="flex items-center justify-center pointer-events-none select-none px-4">
          <span className="text-white font-bold tracking-tight text-sm">Cordyn</span>
        </div>
        {/* Right col */}
        <div className="flex items-center justify-end gap-1.5 pr-1">
          <div className="relative group hidden sm:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-zinc-400 transition-colors"/>
            <input placeholder="Szukaj w wiadomościach..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.07] text-white placeholder-zinc-600 outline-none focus:border-indigo-500/40 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] rounded-xl pl-8 pr-10 py-1.5 text-xs w-44 focus:w-56 transition-all duration-300"/>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono hidden lg:flex items-center gap-0.5"><span className="border border-zinc-700 rounded px-1 py-0.5">⌘</span><span className="border border-zinc-700 rounded px-1 py-0.5">K</span></span>
          </div>
          {/* 🔔 Notification bell with dropdown panel */}
          <div className="relative" ref={notifBellRef}>
            <button onClick={() => {
              setNotifOpen(p => !p);
              if (!notifOpen) {
                // Request notification permission on first open
                if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                  Notification.requestPermission().catch(() => {});
                }
              }
            }} className="relative w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
              <Bell size={15}/>
              {(()=>{
                const unreadCount = notifications.filter(n=>!n.read).length;
                return unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none shadow-[0_0_6px_rgba(239,68,68,0.5)]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null;
              })()}
            </button>
            <AnimatePresence>
              {notifOpen&&(
                <motion.div initial={{opacity:0,y:-8,scale:0.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8,scale:0.96}}
                  transition={{duration:0.15,ease:'easeOut'}}
                  className="absolute right-0 top-full mt-2 w-96 max-h-[480px] flex flex-col z-50 rounded-2xl border border-white/[0.1] shadow-2xl shadow-black/60 overflow-hidden"
                  style={{background:'rgba(13,13,24,0.98)',backdropFilter:'blur(24px)'}}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] shrink-0">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-indigo-400"/>
                      <span className="text-sm font-semibold text-white">Powiadomienia</span>
                      {notifications.filter(n=>!n.read).length > 0&&(
                        <span className="text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full px-1.5 py-0.5 leading-none">
                          {notifications.filter(n=>!n.read).length} nowych
                        </span>
                      )}
                    </div>
                    <button onClick={() => setNotifications(p => p.map(n=>({...n,read:true})))}
                      className="text-[11px] text-zinc-500 hover:text-indigo-400 transition-colors">
                      Oznacz wszystkie
                    </button>
                  </div>
                  {/* Notifications list */}
                  <div className="overflow-y-auto flex-1" style={{scrollbarWidth:'thin',scrollbarColor:'#3f3f46 transparent'}}>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                          <Bell size={20} className="text-zinc-600"/>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-400">Brak powiadomień</p>
                          <p className="text-xs text-zinc-600 mt-0.5">Powiadomienia o wzmiankowaniach pojawią się tutaj</p>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/[0.04]">
                        {notifications.map(notif => (
                          <button key={notif.id} onClick={() => {
                            // Navigate to server+channel
                            if (notif.server_id) {
                              setActiveView('servers');
                              setActiveServer(notif.server_id);
                              setServerFull(null);
                              if (notif.channel_id) setActiveChannel(notif.channel_id);
                            }
                            // Mark as read
                            setNotifications(p => p.map(n => n.id===notif.id ? {...n,read:true} : n));
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors group ${!notif.read?'bg-indigo-500/[0.04]':''}`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${notif.type==='everyone'?'bg-amber-500/15':'bg-indigo-500/15'}`}>
                                {notif.type==='everyone'
                                  ? <Megaphone size={15} className="text-amber-400"/>
                                  : <AtSign size={15} className="text-indigo-400"/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-white">{notif.from_username}</span>
                                  <span className="text-xs text-zinc-500">
                                    {notif.type==='everyone' ? 'użył @everyone na' : 'wspomniał(-a) o Tobie na'}
                                  </span>
                                  <span className="text-xs font-medium text-indigo-400 truncate">{notif.server_name}</span>
                                </div>
                                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{notif.channel_name}</p>
                                {notif.content&&(
                                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2 break-words">{notif.content}</p>
                                )}
                                <p className="text-[10px] text-zinc-600 mt-1">{ft(notif.created_at)}</p>
                              </div>
                              {!notif.read&&<div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2"/>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {notifications.length > 0&&(
                    <div className="px-4 py-2 border-t border-white/[0.06] shrink-0">
                      <button onClick={() => setNotifications([])}
                        className="w-full text-center text-[11px] text-zinc-600 hover:text-rose-400 transition-colors py-1">
                        Wyczyść wszystkie
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {(currentUser?.badges?.some(b=>b.name==='developer')||currentUser?.is_admin)&&(
            <button onClick={()=>{setPrevView(activeView==='admin'?prevView:(activeView as 'servers'|'dms'|'friends'));setActiveView('admin');setAdminTab('dashboard');setShowCallPanel(false);setProfileViewId(null);}} title="Panel admina"
              className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all">
              <LayoutDashboard size={15}/>
            </button>
          )}
          <button onClick={() => { setAppSettTab('account'); setAppSettOpen(true); }} title="Ustawienia"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
            <Settings size={15}/>
          </button>
          <button onClick={openOwnProfile} className="w-7 h-7 rounded-full border-2 border-white/[0.08] overflow-hidden hover:border-indigo-500/50 transition-all shrink-0 shadow-sm">
            <img src={streamerMode ? 'https://api.dicebear.com/7.x/initials/svg?seed=S&backgroundColor=6366f1&fontColor=ffffff' : (currentUser ? ava(currentUser) : '')} alt="" className="w-full h-full object-cover"/>
          </button>
        </div>
      </nav>

      {isMobileOpen&&<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsMobileOpen(false)}/>}

      {/* WORKSPACE */}
      <main className="flex-1 flex gap-2 overflow-hidden relative min-h-0">

        {/* LEFT */}
        <aside className={`absolute md:relative z-30 md:z-0 w-60 shrink-0 flex flex-col glass-panel rounded-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] h-full overflow-hidden ${isMobileOpen?'translate-x-0':'-translate-x-[120%] md:translate-x-0'}`}>
          {/* mobile server row */}
          <div className="md:hidden p-2 border-b border-white/[0.05] flex gap-1.5 overflow-x-auto">
            {([{v:'friends' as const,i:<Users size={16}/>},{v:'dms' as const,i:<MessageCircle size={16}/>}]).map(({v,i}) => (
              <button key={v} onClick={() => { setActiveView(v); setIsMobileOpen(false); }}
                className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl ${activeView===v?'bg-indigo-500 text-white':`${gb}`}`}>{i}</button>
            ))}
            <div className="w-px h-7 bg-white/[0.07] self-center mx-0.5"/>
            {serverList.map(s => (
              <button key={s.id}
                onClick={() => { if(activeServer===s.id&&activeView==='servers') return; setActiveServer(s.id); setActiveView('servers'); setActiveChannel(''); setServerFull(null); setIsMobileOpen(false); setProfileViewId(null); }}
                onContextMenu={e=>{ e.preventDefault(); setSrvContextMenu({x:e.clientX,y:e.clientY,srv:s}); }}
                className={`w-10 h-10 shrink-0 rounded-xl overflow-hidden border ${activeServer===s.id&&activeView==='servers'?'border-indigo-500/40':'border-white/[0.05]'}`}>
                <span className="text-sm font-bold text-white flex w-full h-full items-center justify-center bg-zinc-800">{s.name.charAt(0)}</span>
              </button>
            ))}
            <button onClick={() => setCreateSrvOpen(true)} className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl ${gb}`}><Plus size={16}/></button>
          </div>

          {/* servers */}
          {activeView==='servers'&&<>
            {/* Server header with dropdown */}
            <div className="relative border-b border-white/[0.06]">
              <div className="px-4 py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors group"
                onClick={() => setSrvDropOpen(p => !p)}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white truncate">{serverFull?.name||serverList.find(s=>s.id===activeServer)?.name||'Serwer'}</h2>
                  <motion.div animate={{ rotate: srvDropOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-zinc-500 group-hover:text-indigo-400 transition-colors shrink-0">
                      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </motion.div>
                </div>
                {serverFull?.description&&<p className="text-xs text-zinc-500 mt-0.5 truncate">{serverFull.description}</p>}
              </div>
              <AnimatePresence>
              {srvDropOpen&&(
                <>
                  <div className="fixed inset-0 z-[39]" onClick={()=>setSrvDropOpen(false)}/>
                  <motion.div initial={{opacity:0,y:-6,scale:0.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6,scale:0.97}}
                    transition={{duration:0.15,ease:[0.16,1,0.3,1]}}
                    className="absolute left-3 right-3 top-full mt-1 z-40 bg-[#0e0e1c] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/80 py-1.5 overflow-hidden" style={{backdropFilter:'blur(24px)'}}>
                    {canManageChannels&&<>
                      <button onClick={()=>{setSrvDropOpen(false);setChCreateCatId('');setChCreateOpen(true);setNewChName('');setNewChType('text');setNewChPrivate(false);}}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-zinc-300 hover:bg-indigo-500/10 hover:text-white transition-colors text-left">
                        <Hash size={16} className="text-indigo-400 shrink-0"/>
                        Utwórz kanał
                      </button>
                      <button onClick={()=>{setSrvDropOpen(false);setNewCatName('');setNewCatPrivate(false);setCatCreateOpen(true);}}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-zinc-300 hover:bg-indigo-500/10 hover:text-white transition-colors text-left">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 shrink-0">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        Utwórz kategorię
                      </button>
                      <div className="mx-3 my-1 h-px bg-white/[0.06]"/>
                    </>}
                    {canCreateInvites&&<button onClick={openInviteFriends}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-zinc-300 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors text-left">
                      <UserPlus size={14} className="text-emerald-400 shrink-0"/>
                      Zaproś znajomych
                    </button>}
                    {(canManageServer||canManageRoles||canKickMembers)&&<>
                      <div className="mx-3 my-1 h-px bg-white/[0.06]"/>
                      <button onClick={()=>{setSrvDropOpen(false);setSrvSettTab(canManageServer?'overview':canManageRoles?'roles':'members');setSrvSettOpen(true);setShowCallPanel(false);}}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors text-left">
                        <Settings2 size={14} className="text-zinc-500 shrink-0"/>
                        Ustawienia serwera
                      </button>
                    </>}
                    {serverFull?.my_role!=='Owner'&&<>
                      <div className="mx-3 my-1 h-px bg-white/[0.06]"/>
                      <button onClick={()=>{setSrvDropOpen(false);handleLeaveServer(activeServer);}}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left">
                        <LogOut size={14} className="shrink-0"/>
                        Opuść serwer
                      </button>
                    </>}
                  </motion.div>
                </>
              )}
              </AnimatePresence>
            </div>
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
              <AnimatePresence mode="wait">
              {serverFull && <motion.div key={activeServer}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
              {/* Uncategorized channels (category_id = null) rendered first */}
              {(()=>{
                const allCatChannelIds = new Set(serverFull.categories.flatMap(c=>c.channels.map((ch:any)=>ch.id)));
                // The server GET response only includes channels attached to a category.
                // Channels with category_id=null are NOT in any category.channels array.
                // They are surfaced here via real-time socket updates (channel_created with null category_id).
                const uncatChannels = serverFull.categories
                  .filter(c=>c.id==='__uncat__')
                  .flatMap(c=>c.channels);
                if (uncatChannels.length===0) return null;
                return (
                  <div className="mb-1">
                    {uncatChannels.filter((c:any)=>c.type!=='voice').map((ch:any)=>{
                      const isAct = activeChannel===ch.id; const unread = unreadChs[ch.id]||0; const ping = pingChs[ch.id]||0;
                      const ChIcon = ch.type==='forum'?MessageSquare:ch.type==='announcement'?Megaphone:Hash;
                      return (
                        <div key={ch.id} className="px-2">
                          <button onClick={()=>{setActiveChannel(ch.id);setIsMobileOpen(false);setSrvSettOpen(false);setProfileViewId(null);if(activeViewRef.current==='admin')setActiveView('servers');}}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl mb-0.5 group/ch transition-all duration-150 ${isAct?'bg-indigo-500/15 text-white border border-indigo-500/25':ping>0?'text-white hover:bg-white/[0.06] border border-amber-500/20 bg-amber-500/5':unread>0?'text-white hover:bg-white/[0.06] border border-transparent':'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 border border-transparent'}`}>
                            <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                              <ChIcon size={16} className={`shrink-0 ${isAct?'text-indigo-400':ping>0?'text-amber-400':unread>0?'text-indigo-400/70':'text-zinc-600'}`}/>
                              <span className={`text-sm truncate ${(unread>0||ping>0)&&!isAct?'font-semibold':'font-medium'}`}>{ch.name}</span>
                            </div>
                            {ping>0&&!isAct&&<span className="min-w-[18px] h-[18px] bg-amber-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1 shadow-[0_0_8px_rgba(245,158,11,0.5)]">@{ping>9?'9+':ping}</span>}
                            {unread>0&&!isAct&&!ping&&<span className="min-w-[18px] h-[18px] bg-indigo-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">{unread>99?'99+':unread}</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <DndContext sensors={dndSensors} collisionDetection={closestCorners}
                onDragStart={e=>{ setActiveDragId(e.active.id as string); setActiveDragType(e.active.data.current?.type); }}
                onDragEnd={handleChannelDragEnd}>
              <SortableContext
                items={serverFull?.categories.filter(c=>c.id!=='__uncat__').map(c=>c.id)??[]}
                strategy={verticalListSortingStrategy}>
              {serverFull?.categories.filter(c=>c.id!=='__uncat__').map((cat, catIdx) => {
                const textChs  = cat.channels.filter(c=>c.type!=='voice');
                const voiceChs = cat.channels.filter(c=>c.type==='voice');
                const isEmpty  = textChs.length===0 && voiceChs.length===0;
                const openAddCh = () => { setChCreateCatId(cat.id); setChCreateOpen(true); setNewChName(''); setNewChType('text'); setNewChPrivate(false); };
                return (
                  <React.Fragment key={cat.id}>
                  <SortableCategoryItem id={cat.id} canManage={canManageChannels}>
                  <motion.div className="mb-1"
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ type:'spring', stiffness:320, damping:28, delay: catIdx * 0.04 }}>

                    {/* Category header — ALWAYS shown */}
                    {cat.id !== '__uncat__' && (
                    <div className="flex items-center justify-between px-3 pt-5 pb-1.5 group/cat">
                      {editingCatId === cat.id ? (
                        <input autoFocus value={editingCatName}
                          onChange={e=>setEditingCatName(e.target.value.toUpperCase())}
                          onKeyDown={e=>{if(e.key==='Enter')submitEditCat(cat.id);if(e.key==='Escape')cancelEditCat();}}
                          onBlur={()=>submitEditCat(cat.id)}
                          className="flex-1 bg-white/[0.07] border border-indigo-500/40 text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded-lg px-2 py-0.5 outline-none focus:border-indigo-500/70 transition-all mr-2"/>
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest cursor-default select-none flex-1">
                          {cat.name}
                        </span>
                      )}
                      {canManageChannels&&editingCatId!==cat.id&&(
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                          <button onClick={openAddCh} title="Dodaj kanał" className="w-4 h-4 flex items-center justify-center rounded hover:text-zinc-300 text-zinc-600 transition-colors"><Plus size={11}/></button>
                          <button onClick={()=>startEditCat(cat)} title="Zmień nazwę" className="w-4 h-4 flex items-center justify-center rounded hover:text-zinc-300 text-zinc-600 transition-colors"><Edit3 size={10}/></button>
                          <button onClick={()=>handleDeleteCat(cat)} title="Usuń kategorię" className="w-4 h-4 flex items-center justify-center rounded hover:text-rose-400 text-zinc-600 transition-colors"><Trash2 size={10}/></button>
                        </div>
                      )}
                    </div>
                    )}
                    {/* Empty category hint */}
                    {isEmpty&&canManageChannels&&(
                      <div className="px-3 pb-2">
                        <button onClick={openAddCh} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-zinc-700 hover:text-zinc-400 hover:bg-white/[0.03] transition-all text-xs border border-dashed border-white/[0.05] hover:border-white/[0.09]">
                          <Plus size={10}/> Dodaj kanał do kategorii
                        </button>
                      </div>
                    )}

                    {/* Text/forum/announcement channels */}
                    {textChs.length>0&&<>
                      <SortableContext items={textChs.map(c=>c.id)} strategy={verticalListSortingStrategy}>
                      {textChs.map(ch => {
                        const isAct = activeChannel===ch.id;
                        const unread = unreadChs[ch.id] || 0;
                        const ping = pingChs[ch.id] || 0;
                        const ChIcon = ch.type==='forum'?MessageSquare:ch.type==='announcement'?Megaphone:Hash;
                        return (
                          <React.Fragment key={ch.id}>
                          <SortableChannelItem id={ch.id} catId={cat.id} canManage={canManageChannels}>
                          <div className="px-2">
                            <button onClick={() => { setActiveChannel(ch.id); setIsMobileOpen(false); setSrvSettOpen(false); setProfileViewId(null); if(activeViewRef.current==='admin')setActiveView('servers'); }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl mb-0.5 group/ch transition-all duration-150 ${
                                isAct
                                  ? 'bg-indigo-500/15 text-white border border-indigo-500/25'
                                  : ping > 0
                                    ? 'text-white hover:bg-white/[0.06] border border-amber-500/20 bg-amber-500/5'
                                    : unread > 0
                                      ? 'text-white hover:bg-white/[0.06] border border-transparent'
                                      : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 border border-transparent'}`}>
                              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                                <ChIcon size={16} className={`shrink-0 transition-colors ${isAct?'text-indigo-400':ping>0?'text-amber-400':unread>0?'text-indigo-400/70':'text-zinc-600'}`}/>
                                <span className={`text-sm truncate transition-colors ${(unread>0||ping>0)&&!isAct?'font-semibold':'font-medium'}`}>{ch.name}</span>
                                {ch.is_private&&<Lock size={9} className="text-zinc-700 shrink-0"/>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {ping > 0 && !isAct && (
                                  <span className="min-w-[18px] h-[18px] bg-amber-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1 leading-none shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                    @{ping > 9 ? '9+' : ping}
                                  </span>
                                )}
                                {unread > 0 && !isAct && !ping && (
                                  <span className="min-w-[18px] h-[18px] bg-indigo-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1 leading-none shadow-[0_0_8px_rgba(99,102,241,0.5)]">
                                    {unread > 99 ? '99+' : unread}
                                  </span>
                                )}
                                {canManageChannels&&<div className="flex gap-0.5 opacity-0 group-hover/ch:opacity-100 transition-opacity">
                                  <button onClick={e=>{e.stopPropagation();openChEdit(ch);}} className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white/10 hover:text-zinc-200 transition-colors"><Settings2 size={10}/></button>
                                  <button onClick={e=>{e.stopPropagation();handleDeleteCh(ch.id);}} className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-colors"><Trash2 size={10}/></button>
                                </div>}
                              </div>
                            </button>
                          </div>
                          </SortableChannelItem>
                          </React.Fragment>
                        );
                      })}
                      </SortableContext>
                    </>}

                    {/* Voice channels — POKOJE GŁOSOWE */}
                    {voiceChs.length>0&&<>
                      <div className="flex items-center justify-between px-3 pt-4 pb-1.5 group/vcat cursor-pointer"
                        onClick={()=>setCollapsedVcats(p=>{const n=new Set(p);n.has(cat.id)?n.delete(cat.id):n.add(cat.id);return n;})}>
                        <div className="flex items-center gap-1">
                          <ChevronRight size={10} className={`text-zinc-600 transition-transform ${collapsedVcats.has(cat.id)?'':'rotate-90'}`}/>
                          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Pokoje głosowe</span>
                        </div>
                        {canManageChannels&&<Plus size={12} className="text-zinc-700 hover:text-zinc-300 cursor-pointer opacity-0 group-hover/vcat:opacity-100 transition-all"
                          onClick={e=>{ e.stopPropagation(); setChCreateCatId(cat.id); setChCreateOpen(true); setNewChName(''); setNewChType('voice'); }}/>}
                      </div>
                      {!collapsedVcats.has(cat.id)&&voiceChs.map(ch => {
                        const isActiveVoice = activeCall?.channelId===ch.id;
                        const chVoiceUsers  = voiceUsers[ch.id]||[];
                        const hasUsers = chVoiceUsers.length>0;
                        return (
                          <div key={ch.id} className="px-2">
                            <button onClick={() => joinVoiceCh(ch)}
                              className={`w-full px-3 py-2 rounded-2xl mb-0.5 group/ch transition-all duration-150 ${
                                isActiveVoice?'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_0_12px_rgba(52,211,153,0.08)]':'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 border border-transparent'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Volume2 size={13} className={`shrink-0 ${isActiveVoice?'text-emerald-400':hasUsers?'text-zinc-400':'text-zinc-600'}`}/>
                                  <span className="text-sm font-medium truncate">{ch.name}</span>
                                </div>
                                {/* Stacked avatars for voice users */}
                                {hasUsers&&(
                                  <div className="flex -space-x-1.5 shrink-0">
                                    {chVoiceUsers.slice(0,3).map(u=>(
                                      <img key={u.id} src={ava(u)} className={`w-4 h-4 rounded-full border ${isActiveVoice?'border-emerald-900':'border-[#1e1e30]'} object-cover`} alt="" title={u.username}/>
                                    ))}
                                    {chVoiceUsers.length>3&&<div className="w-4 h-4 rounded-full border border-[#1e1e30] bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-white">+{chVoiceUsers.length-3}</div>}
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
                                      <span className={`text-xs truncate ${isSpeaking&&!isMuted?'text-emerald-400':isMuted?'text-rose-400/70':'text-zinc-500'}`}>{u.username}</span>
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
                  </SortableCategoryItem>
                  </React.Fragment>
                );
              })}
              </SortableContext>
              </DndContext>
              {activeDragId&&activeDragType==='channel'&&<DragOverlay><div className="px-2 py-1.5 bg-indigo-500/20 border border-indigo-500/40 rounded-xl text-xs text-indigo-300 opacity-90">Przenoszenie kanału...</div></DragOverlay>}
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
                  <button key={dm.id} onClick={() => { setActiveDmUserId(dm.other_user_id); setIsMobileOpen(false); setUnreadDms(p => ({ ...p, [dm.other_user_id]: 0 })); setProfileViewId(null); }}
                    onMouseEnter={e=>showHoverCard(dm.other_user_id,e)}
                    onMouseLeave={hideHoverCard}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-2xl transition-all duration-150 ${isActive?'bg-indigo-500/15 text-white border border-indigo-500/25':'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200 border border-transparent'}`}>
                    <div className="relative shrink-0 av-frozen" style={{'--av-url':`url("${ava({avatar_url:dm.other_avatar,username:dm.other_username})}")`} as React.CSSProperties}>
                      <img src={ava({avatar_url:dm.other_avatar,username:dm.other_username})} className={`w-10 h-10 rounded-2xl object-cover av-eff-${(dm as any).other_avatar_effect||'none'}`} alt=""/>
                      <StatusBadge status={dm.other_status} size={10} className="absolute -bottom-0.5 -right-0.5"/>
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
          <div className="shrink-0 px-3 py-3 border-t border-white/[0.05] relative" ref={statusPickerRef}>

            {/* Status picker popup */}
            <AnimatePresence>
              {statusPickerOpen&&(
                <motion.div initial={{opacity:0,y:6,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:6,scale:0.95}}
                  transition={{duration:0.15,ease:[0.16,1,0.3,1]}}
                  className="absolute bottom-full left-3 right-3 mb-2 bg-[#0e0e1c] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-50 p-1" style={{backdropFilter:'blur(24px)'}}>

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
                <img src={streamerMode ? 'https://api.dicebear.com/7.x/initials/svg?seed=S&backgroundColor=6366f1&fontColor=ffffff' : (currentUser?ava(currentUser):'')} className={`w-8 h-8 rounded-full object-cover av-eff-${avatarEffect} av-sc-xs`} alt=""/>
                {/* Status dot — red phone when in call, else normal status */}
                {activeCall ? (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-[#181828] rounded-full flex items-center justify-center">
                    <Phone size={6} className="text-white"/>
                  </div>
                ) : (
                  <StatusBadge status={currentUser?.status??'offline'} size={10} className="absolute -bottom-0.5 -right-0.5"/>
                )}
              </div>

              {/* Name + status label */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={openOwnProfile}>
                <p className="text-sm font-semibold text-white leading-tight truncate hover:text-zinc-300 transition-colors">{streamerMode ? 'Streamer' : currentUser?.username}</p>
                <p className="text-xs truncate leading-tight mt-0.5">
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
                <button title={streamerMode ? 'Wyłącz tryb streamera (aktywny)' : 'Tryb streamera'}
                  onClick={() => setStreamerMode(p => !p)}
                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                    streamerMode ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07]'}`}>
                  {streamerMode ? <EyeOff size={13}/> : <Eye size={13}/>}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className="flex-1 flex flex-col glass-dark rounded-2xl overflow-hidden min-w-0 relative">
          {showCallPanel && activeCall ? (
            /* ── CALL PANEL ─────────────────────────────────────────── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Call header */}
              <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-5 glass-dark border-b border-white/[0.05] shrink-0">
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
                  {activeCall.type==='voice_channel' && (
                    <button onClick={()=>setVoiceChatOpen(v=>!v)} title="Czat kanału głosowego"
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${voiceChatOpen?'bg-indigo-500/30 text-indigo-300':gb}`}>
                      <MessageSquare size={13}/>
                    </button>
                  )}
                  {activeCall.type==='voice_channel' && ownSpotify?.connected && (
                    voiceDj[activeCall.channelId] ? (
                      voiceDj[activeCall.channelId]?.id === currentUser?.id ? (
                        // I am the DJ
                        <button onClick={async()=>{
                          try {
                            await spotifyApi.voiceDjStop();
                            getSocket()?.emit('voice_dj_stopped' as any, { channel_id: activeCall.channelId });
                            setVoiceDj(p=>{const n={...p};delete n[activeCall.channelId];return n;});
                            addToast('DJ zatrzymany','info');
                          } catch(e:any){ addToast(e.message||'Błąd','error'); }
                        }} title="Zatrzymaj Spotify DJ"
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#1DB954]/20 text-[#1DB954] hover:bg-rose-500/20 hover:text-rose-400 transition-all">
                          <SpotifyIcon size={13}/>
                        </button>
                      ) : (
                        // Someone else is DJ — listen/stop toggle
                        <button onClick={()=>{
                          const ch = activeCall.channelId;
                          if (voiceDjListening.has(ch)) {
                            getSocket()?.emit('voice_dj_unlisten' as any, { channel_id: ch });
                            setVoiceDjListening(s=>{const n=new Set(s);n.delete(ch);return n;});
                          } else {
                            getSocket()?.emit('voice_dj_listen' as any, { channel_id: ch });
                            setVoiceDjListening(s=>new Set(s).add(ch));
                          }
                        }} title={voiceDjListening.has(activeCall.channelId) ? 'Stop Spotify sync' : 'Słuchaj Spotify DJ'}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${voiceDjListening.has(activeCall.channelId)?'bg-[#1DB954]/20 text-[#1DB954]':gb}`}>
                          <SpotifyIcon size={13}/>
                        </button>
                      )
                    ) : (
                      // No DJ — I can become DJ
                      <button onClick={async()=>{
                        try {
                          await spotifyApi.voiceDjStart(activeCall.channelId);
                          getSocket()?.emit('voice_dj_started' as any, { channel_id: activeCall.channelId });
                          setVoiceDj(p=>({...p,[activeCall.channelId]:{id:currentUser!.id,username:currentUser!.username,avatar_url:currentUser!.avatar_url??null}}));
                          addToast('Jesteś teraz DJ-em! Wszyscy mogą słuchać Twojego Spotify.','success');
                        } catch(e:any){ addToast(e.message||'Błąd','error'); }
                      }} title="Uruchom Spotify DJ"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-[#1DB954] hover:bg-[#1DB954]/10 transition-all ${gb}`}>
                        <SpotifyIcon size={13}/>
                      </button>
                    )
                  )}
                  <button onClick={()=>setShowCallPanel(false)} title="Minimalizuj" className={`w-7 h-7 ${gb} rounded-lg flex items-center justify-center`}><Minimize2 size={13}/></button>
                </div>
              </header>
              {/* Spotify DJ info bar */}
              {activeCall?.type==='voice_channel' && voiceDj[activeCall.channelId] && (
                <div className="flex items-center justify-between px-4 py-2 bg-[#1DB954]/8 border-b border-[#1DB954]/20 shrink-0">
                  <div className="flex items-center gap-2">
                    <SpotifyIcon size={14} className="text-[#1DB954]"/>
                    <span className="text-xs text-[#1DB954] font-semibold">
                      {voiceDj[activeCall.channelId]?.id === currentUser?.id
                        ? 'Jesteś DJ-em'
                        : `${voiceDj[activeCall.channelId]?.username} jest DJ-em`}
                    </span>
                    {voiceDjListening.has(activeCall.channelId) && voiceDj[activeCall.channelId]?.id !== currentUser?.id && (
                      <span className="text-[11px] text-zinc-500">· syncing</span>
                    )}
                  </div>
                  {voiceDj[activeCall.channelId]?.id === currentUser?.id && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-500">Głośność:</span>
                      <input type="range" min={0} max={100} value={voiceDjVolume}
                        onChange={async e=>{
                          const v=+e.target.value; setVoiceDjVolume(v);
                          try { await spotifyApi.setVolume(v); } catch {}
                        }}
                        className="w-20 accent-[#1DB954] cursor-pointer"/>
                      <span className="text-[11px] text-zinc-400 w-7 text-right">{voiceDjVolume}%</span>
                    </div>
                  )}
                </div>
              )}
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
                  const uMutedByMe = mutedByMe[u.id] ?? false;
                  return (
                    <div key={u.id} className="flex flex-col items-center gap-2"
                      onContextMenu={e=>{e.preventDefault();setVolMenu({id:u.id,username:u.username,x:e.clientX,y:e.clientY});}}>
                      <div className={`relative p-1 rounded-2xl border-2 transition-all duration-150 ${isSpeaking&&!uMuted?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':uMuted?'border-rose-500/40':'border-white/10'}`}>
                        <img src={ava(u)} className={`${hasScreenShare?'w-14 h-14':'w-24 h-24'} rounded-xl object-cover`} alt=""/>
                        {uMutedByMe&&<div className="absolute inset-0 rounded-xl bg-zinc-900/60 flex items-center justify-center"><VolumeX size={20} className="text-rose-400"/></div>}
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
                  const pVol      = userVols[activeCall.userId!] ?? 100;
                  const pMutedByMe = mutedByMe[activeCall.userId!] ?? false;
                  return (
                    <div key="partner" className="flex flex-col items-center gap-2"
                      onContextMenu={e=>{e.preventDefault();setVolMenu({id:activeCall.userId!,username:activeCall.username!,x:e.clientX,y:e.clientY});}}>
                      <div className={`relative p-1 rounded-2xl border-2 transition-all duration-150 ${partnerSpeaking&&!pMuted?'border-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.45)]':pMuted?'border-rose-500/40':'border-white/10'}`}>
                        <img src={ava({avatar_url: activeCall.avatarUrl, username: activeCall.username})}
                          className={`${hasScreenShare?'w-14 h-14':'w-24 h-24'} rounded-xl object-cover`} alt=""/>
                        {pMutedByMe&&<div className="absolute inset-0 rounded-xl bg-zinc-900/60 flex items-center justify-center"><VolumeX size={20} className="text-rose-400"/></div>}
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
                            id="screen-share-video"
                            ref={el => { if (el && el.srcObject !== screenStream) { el.muted = true; el.srcObject = screenStream; el.play().catch(()=>{}); } }}
                            className="w-full h-full object-contain"
                            autoPlay playsInline muted /* always muted — audio plays via remoteScreenAudios element */
                          />
                        )}
                        {/* Label + stream mute button */}
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1">
                            <ScreenShare size={12} className="text-indigo-400"/>
                            <span className="text-xs text-white font-medium">{screenOwner} udostępnia ekran</span>
                          </div>
                          {/* Stream audio controls (only for remote streams) */}
                          {!activeCall.isScreenSharing && remoteScreenEntries[0]?.[0] && (()=>{
                            const sid = remoteScreenEntries[0][0];
                            const isMutedStream = streamMutedByMe[sid] ?? false;
                            const svol = streamVols[sid] ?? 100;
                            return (
                              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
                                <button onClick={()=>{
                                  const m = !isMutedStream;
                                  setStreamMutedByMe(p=>({...p,[sid]:m}));
                                  muteRemoteScreenStream(sid, m);
                                  if (!m) setRemoteScreenVolume(sid, svol);
                                }} title={isMutedStream ? 'Włącz dźwięk transmisji' : 'Wycisz transmisję'}
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isMutedStream?'text-rose-400':'text-zinc-300 hover:text-white'}`}>
                                  {isMutedStream ? <VolumeX size={13}/> : <Volume2 size={13}/>}
                                </button>
                                <input type="range" min={0} max={100} step={5} value={isMutedStream ? 0 : svol}
                                  onChange={e=>{
                                    const v=+e.target.value;
                                    setStreamVols(p=>({...p,[sid]:v}));
                                    setRemoteScreenVolume(sid, v);
                                    if (v > 0 && isMutedStream) { setStreamMutedByMe(p=>({...p,[sid]:false})); muteRemoteScreenStream(sid, false); }
                                    if (v === 0) { setStreamMutedByMe(p=>({...p,[sid]:true})); muteRemoteScreenStream(sid, true); }
                                    try { localStorage.setItem(`cordyn_streamvol_${sid}`, String(v)); } catch {}
                                  }}
                                  className="w-20 accent-indigo-400 cursor-pointer" style={{height:4}}/>
                                <span className="text-[10px] text-zinc-400 font-mono w-7 text-right">{isMutedStream ? 0 : svol}%</span>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Fullscreen button */}
                        <button
                          onClick={() => { const el = document.getElementById('screen-share-video') as HTMLVideoElement; el?.requestFullscreen?.(); }}
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
              <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.04]">
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
                        {/* Noise cancellation toggle */}
                        <div className="sm:col-span-3 flex items-center justify-between px-0.5 pt-1 border-t border-white/[0.05] mt-1">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-white">Redukcja szumów i echo</span>
                            <span className="text-[10px] text-zinc-500 mt-0.5">Wycisza hałas tła i echa mikrofonu w czasie rzeczywistym</span>
                          </div>
                          <button
                            onClick={async () => {
                              const next = !noiseCancel;
                              setNoiseCancel(next);
                              // Re-acquire mic with new constraints (real-time effect)
                              if (localStreamRef.current) await acquireMic(selMic || undefined, next);
                              // Save to DB
                              users.updateMe({ voice_noise_cancel: next }).catch(() => {});
                            }}
                            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${noiseCancel ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${noiseCancel ? 'translate-x-5' : 'translate-x-0'}`}/>
                          </button>
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
              {/* ── Voice channel text chat panel ────────────────────── */}
              {voiceChatOpen && activeCall.channelId && (
                <div className="h-64 shrink-0 flex flex-col border-t border-white/[0.06] bg-black/20">
                  <div className="flex-1 overflow-y-auto p-3 custom-scrollbar flex flex-col gap-1.5">
                    {voiceChatMsgs.length === 0 && (
                      <p className="text-xs text-zinc-600 text-center mt-4">Brak wiadomości — zacznij czat głosowy!</p>
                    )}
                    {voiceChatMsgs.map(msg => (
                      <div key={msg.id} className={`flex gap-2 ${msg.sender_id===currentUser?.id?'flex-row-reverse':''}`}>
                        <img src={ava({avatar_url:msg.sender_avatar,username:msg.sender_username})} className="w-6 h-6 rounded-lg object-cover shrink-0 self-start mt-0.5" alt=""/>
                        <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-xs msg-md ${msg.sender_id===currentUser?.id?'bg-indigo-600/80 text-white':'bg-white/[0.08] text-zinc-200'}`}
                          dangerouslySetInnerHTML={{__html:renderMsgHTML(msg.content)}}/>
                      </div>
                    ))}
                    <div ref={voiceChatEndRef}/>
                  </div>
                  <div className="p-2.5 border-t border-white/[0.06] shrink-0">
                    <form onSubmit={handleVoiceChatSend} className="flex gap-2">
                      <input value={voiceChatInput} onChange={e=>setVoiceChatInput(e.target.value)}
                        placeholder={`Wiadomość w #${activeCall.channelName||'kanał'}...`}
                        className="flex-1 bg-white/[0.07] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/40 transition-colors"/>
                      <button type="submit" disabled={!voiceChatInput.trim()}
                        className="w-7 h-7 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 flex items-center justify-center text-white transition-colors shrink-0 active:scale-90">
                        <Send size={12}/>
                      </button>
                    </form>
                  </div>
                </div>
              )}
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
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600/30 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center float-up mb-5 shadow-[0_0_40px_-8px_rgba(99,102,241,0.4)]">
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
                            <img src={ava(f)} className="w-9 h-9 rounded-xl object-cover av-sc-xs" alt=""/>
                            <StatusBadge status={f.status} size={10} className="absolute -bottom-0.5 -right-0.5"/>
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
          ) : profileViewId ? (
            <ProfilePage
              viewUserId={profileViewId}
              profileData={profilePageData}
              games={profileGames}
              spotify={profileSpotify}
              ownSpotify={ownSpotify}
              twitch={profileTwitch}
              ownTwitch={ownTwitch}
              steam={profileSteam}
              ownSteam={ownSteam}
              steamGameStartedAt={profileViewId ? (steamGameStartRef.current.get(profileViewId) ?? null) : null}
              loading={profileLoading}
              currentUser={currentUser}
              editProf={editProf}
              setEditProf={setEditProf}
              profBannerFile={profBannerFile}
              profBannerPrev={profBannerPrev}
              onBack={closeProfilePage}
              onOpenDm={(id)=>{ openDm(id); closeProfilePage(); }}
              onCall={(id,un,av,t)=>{ startDmCall(id,un,t,av); closeProfilePage(); }}
              handleAvatarUpload={handleAvatarUpload}
              handleBannerSelect={handleBannerSelect}
              handleSaveProfile={handleSaveProfile}
              onGameAdded={(g)=>setProfileGames(p=>[...p,g])}
              onGameRemoved={(id)=>setProfileGames(p=>p.filter(g=>g.id!==id))}
              showGameModal={showGameModal}
              setShowGameModal={setShowGameModal}
              gameSearch={gameSearch}
              setGameSearch={setGameSearch}
              gameResults={gameResults}
              setGameResults={setGameResults}
              gameSearching={gameSearching}
              setGameSearching={setGameSearching}
              gameSearchRef={gameSearchRef}
              onSpotifyConnect={async()=>{ try { const r = await spotifyApi.connect(); window.location.href = r.url; } catch(e:any){ addToast(e.message||'Błąd Spotify','error'); } }}
              onSpotifyDisconnect={async()=>{ await spotifyApi.disconnect(); setOwnSpotify(null); addToast('Spotify odłączono','info'); }}
              onSpotifyToggle={async(v)=>{ await spotifyApi.setSettings({show_on_profile:v}); setOwnSpotify(p=>p?{...p,show_on_profile:v}:p); lastEmittedTrack.current=undefined; if(!v&&currentUser?.id){const sock=getSocket();if(sock)(sock as any).emit('spotify_update',{track:null});setUserActivities(p=>{const n=new Map(p);n.set(currentUser.id,null);return n;});} }}
              onTwitchConnect={async()=>{ try { const r = await twitchApi.connect(); window.location.href = r.url; } catch(e:any){ addToast(e.message||'Błąd Twitch','error'); } }}
              onTwitchDisconnect={async()=>{ await twitchApi.disconnect(); setOwnTwitch(null); addToast('Twitch odłączono','info'); }}
              onTwitchToggle={async(v)=>{ await twitchApi.setSettings({show_on_profile:v}); setOwnTwitch(p=>p?{...p,show_on_profile:v}:p); lastEmittedStream.current=undefined; if(!v&&currentUser?.id){const sock=getSocket();if(sock)(sock as any).emit('twitch_update',{stream:null});setUserTwitchActivities(p=>{const n=new Map(p);n.set(currentUser.id,null);return n;});} }}
              onSteamConnect={async()=>{ try { const r = await steamApi.connect(); window.location.href = r.url; } catch(e:any){ addToast(e.message||'Błąd Steam','error'); } }}
              onSteamDisconnect={async()=>{ await steamApi.disconnect(); setOwnSteam(null); addToast('Steam odłączono','info'); }}
              onSteamToggle={async(v)=>{ await steamApi.setSettings({show_on_profile:v}); setOwnSteam(p=>p?{...p,show_on_profile:v}:p); lastEmittedGame.current=undefined; if(!v&&currentUser?.id){const sock=getSocket();if(sock)(sock as any).emit('steam_update',{game:null});setUserSteamActivities(p=>{const n=new Map(p);n.set(currentUser.id,null);return n;});} }}
              friends={friends}
              blockedUsers={blockedUsers}
              addToast={addToast}
              myJam={myJam}
              jamLoading={jamLoading}
              viewedUserJam={profileViewedJam}
              onJamStart={async()=>{
                setJamLoading(true);
                try {
                  await spotifyApi.jamStart();
                  const j = await spotifyApi.jamActive();
                  setMyJam(j);
                  addToast('JAM uruchomiony! Znajomi mogą dołączyć z Twojego profilu', 'success');
                } catch(e:any){ addToast(e.message||'Błąd JAM','error'); }
                finally { setJamLoading(false); }
              }}
              onJamStop={async()=>{
                setJamLoading(true);
                try {
                  await spotifyApi.jamLeave();
                  getSocket()?.emit('spotify_jam_ended' as any, { host_id: currentUser?.id });
                  setMyJam({ role: null, members: [] });
                  addToast('JAM zakończony','info');
                } catch(e:any){ addToast(e.message||'Błąd','error'); }
                finally { setJamLoading(false); }
              }}
              onJamJoin={async(hostId)=>{
                setJamLoading(true);
                try {
                  await spotifyApi.jamJoin(hostId);
                  getSocket()?.emit('spotify_jam_joined' as any, { host_id: hostId });
                  const j = await spotifyApi.jamActive();
                  setMyJam(j);
                  addToast('Dołączono do JAM! Synchronizacja Spotify...','success');
                } catch(e:any){ addToast(e.message||'Błąd','error'); }
                finally { setJamLoading(false); }
              }}
              onJamLeave={async()=>{
                setJamLoading(true);
                try {
                  const r = await spotifyApi.jamLeave();
                  if (!r.was_host) getSocket()?.emit('spotify_jam_left' as any, { host_id: r.host_id });
                  setMyJam({ role: null, members: [] });
                  addToast('Opuszczono JAM','info');
                } catch(e:any){ addToast(e.message||'Błąd','error'); }
                finally { setJamLoading(false); }
              }}
            />
          ) : activeView==='friends' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-14 border-b border-white/[0.06] flex items-center px-5 shrink-0 glass-dark border-b border-white/[0.05] z-10">
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
                          <img src={ava(friendSearchResult)} className="w-10 h-10 rounded-full object-cover av-sc-xs" alt=""/>
                          <StatusBadge status={friendSearchResult.status} size={10} className="absolute -bottom-0.5 -right-0.5"/>
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
                    {friends.map(f => {
                      const fActivity = userActivities.get(f.id);
                      const fTwitch = userTwitchActivities.get(f.id);
                      const fSteam = userSteamActivities.get(f.id);
                      return (
                      <div key={f.id}
                        className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.07] p-3.5 rounded-2xl transition-all duration-150 group"
                        onMouseEnter={e=>showHoverCard(f.id, e)}
                        onMouseLeave={hideHoverCard}>
                        <div className="flex items-center gap-3 cursor-pointer" onClick={()=>openProfile(f)}>
                          <div className="relative"><img src={ava(f)} className="w-10 h-10 rounded-2xl object-cover av-sc-xs" alt=""/><StatusBadge status={f.status} size={10} className="absolute -bottom-0.5 -right-0.5"/></div>
                          <div>
                            <p className="font-semibold text-white text-sm">{f.username}</p>
                            {fActivity ? (
                              <p className="text-xs text-[#1DB954] truncate max-w-[160px] flex items-center gap-1"><SpotifyIcon size={11} className="shrink-0"/> {fActivity.artists} — {fActivity.name}</p>
                            ) : fTwitch ? (
                              <p className="text-xs text-purple-400 truncate max-w-[160px] flex items-center gap-1"><TwitchIcon size={11} className="shrink-0"/> Streamuje: {fTwitch.game_name}</p>
                            ) : fSteam ? (
                              <p className="text-xs text-zinc-400 truncate max-w-[160px] flex items-center gap-1"><Gamepad2 size={11} className="shrink-0"/> {fSteam.name}</p>
                            ) : (
                              <p className="text-xs text-zinc-600">{f.custom_status||f.status}</p>
                            )}
                          </div>
                        </div>
                        <button onClick={()=>openDm(f.id)} title="Wyślij wiadomość" className={`w-8 h-8 rounded-xl ${gb} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-90`}><MessageCircle size={15}/></button>
                      </div>
                    )})}
                    </div>
                    {friends.length===0&&<p className="text-sm text-zinc-700 py-4">Brak znajomych. Dodaj kogoś powyżej!</p>}
                  </div>

                </div>
              </div>
            </div>
          ) : srvSettOpen && serverFull ? (
            <ServerSettingsPage
              serverFull={serverFull}
              tab={srvSettTab} setTab={setSrvSettTab}
              roles={roles} members={members}
              banList={banList} setBanList={setBanList}
              srvForm={srvForm} setSrvForm={setSrvForm}
              srvBannerFile={srvBannerFile} setSrvBannerFile={setSrvBannerFile}
              srvIconFile={srvIconFile} setSrvIconFile={setSrvIconFile}
              handleSaveSrv={handleSaveSrv}
              inviteDur={inviteDur} setInviteDur={setInviteDur}
              inviteCode={inviteCode} handleInvite={handleInvite}
              canManageServer={canManageServer} canManageRoles={canManageRoles}
              canKickMembers={canKickMembers} canBanMembers={canBanMembers}
              canCreateInvites={canCreateInvites}
              handleSetMemberRole={handleSetMemberRole}
              handleKick={handleKick} handleBan={handleBan} handleUnban={handleUnban}
              openNewRole={openNewRole} openEditRole={openEditRole} handleDeleteRole={handleDeleteRole}
              currentUser={currentUser}
              onClose={() => setSrvSettOpen(false)}
              streamerMode={streamerMode}
              serverEmojis={serverEmojis.get(activeServer)||[]}
              activeServer={activeServer}
            />
          ) : activeView==='admin' ? (
            <AdminPanel
              currentUser={currentUser}
              overview={adminOverview} setOverview={setAdminOverview}
              tab={adminTab} setTab={setAdminTab}
              badges={adminBadges} setBadges={setAdminBadges}
              users={adminUsers} setUsers={setAdminUsers}
              usersTotal={adminUsersTotal} setUsersTotal={setAdminUsersTotal}
              usersPage={adminUsersPage} setUsersPage={setAdminUsersPage}
              serversList={adminServersList} setServersList={setAdminServersList}
              userQ={adminUserQ} setUserQ={setAdminUserQ}
              badgeForm={adminBadgeForm} setBadgeForm={setAdminBadgeForm}
              badgeSaving={adminBadgeSaving} setBadgeSaving={setAdminBadgeSaving}
              assignUser={adminAssignUser} setAssignUser={setAdminAssignUser}
              assignBadgeId={adminAssignBadgeId} setAssignBadgeId={setAdminAssignBadgeId}
              onBack={()=>setActiveView(prevView)}
              addToast={(t:any)=>setToasts(p=>[...p,{id:Date.now().toString(),...t}])}
            />
          ) : (
            <>
              {/* Server banner — expands on hover to show server details */}
              {activeView==='servers' && serverFull?.banner_url && (
                <motion.div
                  className="shrink-0 relative overflow-hidden cursor-pointer"
                  initial={{ height: 80 }}
                  animate={{ height: bannerHovered ? 200 : 80 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => setBannerHovered(true)}
                  onMouseLeave={() => setBannerHovered(false)}
                >
                  <img src={serverFull.banner_url} className="w-full h-full object-cover" alt=""
                    style={{ transition: 'transform 0.35s ease', transform: bannerHovered ? 'scale(1.04)' : 'scale(1)' }}/>
                  {/* Gradient overlay — deeper on hover */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/70"
                    style={{ opacity: bannerHovered ? 1 : 0.85, transition: 'opacity 0.35s ease' }}/>
                  {/* Bottom info row — always visible */}
                  <div className="absolute bottom-0 left-0 right-0 px-5 pb-3 flex items-end gap-3">
                    <motion.div
                      initial={{ width: 28, height: 28 }}
                      animate={{ width: bannerHovered ? 52 : 28, height: bannerHovered ? 52 : 28 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="rounded-xl overflow-hidden border-2 border-white/25 shadow-lg shrink-0 flex items-center justify-center bg-indigo-600">
                      {serverFull.icon_url
                        ? <img src={serverFull.icon_url} className="w-full h-full object-cover" alt=""/>
                        : <span className="text-white font-bold" style={{ fontSize: bannerHovered ? 20 : 12 }}>{serverFull.name?.[0]?.toUpperCase()}</span>
                      }
                    </motion.div>
                    <div className="flex-1 min-w-0 pb-0.5">
                      <motion.p
                        initial={{ fontSize: 13 }}
                        animate={{ fontSize: bannerHovered ? 18 : 13 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="font-bold text-white drop-shadow truncate leading-tight">
                        {serverFull.name}
                      </motion.p>
                      <AnimatePresence>
                        {bannerHovered && (
                          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.2, delay: 0.1 }}
                            className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <Users size={11} className="text-zinc-300"/>
                              <span className="text-xs text-zinc-200">{serverFull.member_count ?? members.length} członków</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock size={11} className="text-zinc-300"/>
                              <span className="text-xs text-zinc-200">od {new Date(serverFull.created_at).toLocaleDateString('pl-PL', { year:'numeric', month:'long', day:'numeric' })}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
              {/* Chat header */}
              <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-5 glass-dark border-b border-white/[0.05] z-10 shrink-0 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {activeView==='dms' ? (activeDm ? (
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0 av-frozen" style={{'--av-url':`url("${ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})}")`} as React.CSSProperties}>
                        <img src={ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})} className={`w-8 h-8 rounded-2xl object-cover shadow-sm av-eff-${(activeDm as any).other_avatar_effect||'none'}`} alt=""/>
                        <StatusBadge status={activeDm.other_status} size={10} className="absolute -bottom-0.5 -right-0.5"/>
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm leading-tight">{activeDm.other_username}</h3>
                        <p className="text-xs text-zinc-500 leading-tight capitalize">{activeDm.other_status||'offline'}</p>
                      </div>
                    </div>
                  ) : <h3 className="font-bold text-white text-sm">Wiadomości</h3>) : (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                        {activeCh?.type==='forum' ? <MessageSquare size={16} className="text-indigo-400"/>
                         : activeCh?.type==='announcement' ? <Megaphone size={16} className="text-indigo-400"/>
                         : <Hash size={16} className="text-indigo-400"/>}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">{activeCh?.name||activeChannel}</h3>
                        {activeCh?.description&&<p className="text-xs text-zinc-500 truncate hidden lg:block">{activeCh.description}</p>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeView==='dms'&&activeDm&&<>
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'voice',activeDm.other_avatar)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-150 active:scale-95"><Phone size={15}/></button>
                    <button onClick={()=>startDmCall(activeDm.other_user_id,activeDm.other_username,'video',activeDm.other_avatar)} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all duration-150 active:scale-95"><Video size={15}/></button>
                    <div className="w-px h-4 bg-white/[0.06] mx-1"/>
                  </>}
                  {activeView==='servers'&&members.length>0&&(
                  <div className="hidden md:flex -space-x-2 mr-1">
                    {members.slice(0,4).map(m=>(
                      <img key={m.id} src={ava(m)} className="w-6 h-6 rounded-full border-2 border-[#181828] object-cover hover:scale-110 transition-transform cursor-pointer" alt="" title={m.username}/>
                    ))}
                    {members.length>4&&<div className="w-6 h-6 rounded-full border-2 border-[#181828] bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white">+{members.length-4}</div>}
                  </div>
                  )}
                  {activeView==='servers'&&activeCh?.type==='text'&&(
                    <>
                      {activeCh.slowmode_seconds!=null&&activeCh.slowmode_seconds>0&&(
                        <div title={`Tryb wolny: ${activeCh.slowmode_seconds<60?activeCh.slowmode_seconds+'s':activeCh.slowmode_seconds<3600?Math.floor(activeCh.slowmode_seconds/60)+'min':Math.floor(activeCh.slowmode_seconds/3600)+'h'}`}
                          className="flex items-center gap-1 text-amber-400/70 px-2 py-1 bg-amber-500/10 rounded-lg text-[11px] font-medium">
                          <Clock size={11}/>{activeCh.slowmode_seconds<60?activeCh.slowmode_seconds+'s':activeCh.slowmode_seconds<3600?Math.floor(activeCh.slowmode_seconds/60)+'min':Math.floor(activeCh.slowmode_seconds/3600)+'h'}
                        </div>
                      )}
                      <button onClick={async()=>{setShowPinned(v=>{const next=!v;if(next){messagesApi.listPinned(activeChannel!).then(setPinnedMsgs).catch(()=>{});}return next;})} }
                        title="Przypięte wiadomości"
                        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${showPinned?'text-amber-400 bg-amber-500/15':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07]'}`}>
                        <Pin size={14}/>
                      </button>
                    </>
                  )}
                  <div className="relative">
                    <button onClick={()=>setShowDmMenu(v=>!v)} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${showDmMenu?'text-white bg-white/[0.1]':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.07]'}`}>
                      <MoreHorizontal size={15}/>
                    </button>
                    <AnimatePresence>
                      {showDmMenu&&(
                        <>
                          <div className="fixed inset-0 z-40" onClick={()=>setShowDmMenu(false)}/>
                          <motion.div initial={{opacity:0,scale:0.92,y:-6}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:-6}}
                            transition={{duration:0.12}}
                            className="absolute right-0 top-10 z-50 bg-[#1a1a2e] border border-white/[0.08] rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden">
                            {activeView==='dms'&&activeDm&&(
                              <>
                                {blockedUsers.has(activeDm.other_user_id) ? (
                                  <button onClick={()=>handleUnblockUser(activeDm.other_user_id,activeDm.other_username)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-emerald-400 hover:bg-white/[0.05] transition-colors">
                                    <UserCheck size={14}/>Odblokuj użytkownika
                                  </button>
                                ) : (
                                  <button onClick={()=>handleBlockUser(activeDm.other_user_id,activeDm.other_username)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-white/[0.05] transition-colors">
                                    <UserX size={14}/>Zablokuj użytkownika
                                  </button>
                                )}
                                {friends.some(f=>f.id===activeDm.other_user_id)&&(
                                  <>
                                    <div className="h-px bg-white/[0.06] mx-2 my-1"/>
                                    <button onClick={()=>{
                                      const f=friends.find(fr=>fr.id===activeDm.other_user_id);
                                      if(f?.friendship_id) handleRemoveFriend(f.friendship_id,activeDm.other_username);
                                    }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-400 hover:text-rose-400 hover:bg-white/[0.05] transition-colors">
                                      <UserMinus size={14}/>Usuń ze znajomych
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </header>

              {/* ── Pinned Messages Panel ── */}
              <AnimatePresence>
                {showPinned&&activeView==='servers'&&activeCh?.type==='text'&&(
                  <motion.div initial={{opacity:0,x:320}} animate={{opacity:1,x:0}} exit={{opacity:0,x:320}}
                    transition={{type:'spring',stiffness:300,damping:30}}
                    className="absolute top-[57px] right-0 bottom-0 w-80 bg-[#141420] border-l border-white/[0.06] z-20 flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2 text-white font-semibold text-sm"><Pin size={13} className="text-amber-400"/>Przypięte</div>
                      <button onClick={()=>setShowPinned(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={15}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
                      {pinnedMsgs.length===0?(
                        <div className="text-center text-zinc-600 text-sm py-8">Brak przypiętych wiadomości</div>
                      ):pinnedMsgs.map(msg=>(
                        <div key={msg.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <img src={msg.sender_avatar||`https://api.dicebear.com/7.x/shapes/svg?seed=${msg.sender_id}`} className="w-5 h-5 rounded-full object-cover" alt=""/>
                            <span className="text-xs font-semibold text-white">{msg.sender_username}</span>
                            <span className="text-[10px] text-zinc-600 ml-auto">{new Date(msg.created_at).toLocaleDateString('pl-PL')}</span>
                          </div>
                          <p className="text-xs text-zinc-400 line-clamp-3 break-words">{msg.content}</p>
                          {canPinMessages&&(
                            <button onClick={()=>handlePinMessage(msg.id,false)}
                              className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-rose-400 transition-colors">
                              <PinOff size={10}/> Odepnij
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Forum View ── */}
              {activeView==='servers' && activeCh?.type==='forum' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {!forumPost ? (
                    /* Post list */
                    <div className="p-4 md:p-6 max-w-3xl mx-auto">
                      <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold text-white">Posty</h2>
                        <button onClick={()=>setShowNewPost(v=>!v)}
                          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20">
                          <Plus size={14}/> Utwórz post
                        </button>
                      </div>

                      {/* New post form */}
                      {showNewPost && (
                        <div className="mb-5 p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
                          <h3 className="text-sm font-semibold text-white mb-3">Nowy post</h3>
                          <input value={newPostTitle} onChange={e=>setNewPostTitle(e.target.value)}
                            placeholder="Tytuł posta..." maxLength={200}
                            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 transition-all mb-2"/>
                          <textarea value={newPostContent} onChange={e=>setNewPostContent(e.target.value)}
                            placeholder="Treść posta..." rows={4}
                            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 transition-all resize-none mb-2"/>
                          <input value={newPostImage} onChange={e=>setNewPostImage(e.target.value)}
                            placeholder="URL obrazka (opcjonalnie)..."
                            className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 transition-all mb-3"/>
                          <div className="flex gap-2 justify-end">
                            <button onClick={()=>{setShowNewPost(false);setNewPostTitle('');setNewPostContent('');setNewPostImage('');}}
                              className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors">
                              Anuluj
                            </button>
                            <button disabled={!newPostTitle.trim()||!newPostContent.trim()} onClick={async()=>{
                              try {
                                const p = await forumApi.createPost(activeChannel, { title: newPostTitle.trim(), content: newPostContent.trim(), image_url: newPostImage.trim()||undefined });
                                setForumPosts(prev=>[p,...prev]); setShowNewPost(false); setNewPostTitle(''); setNewPostContent(''); setNewPostImage('');
                              } catch {}
                            }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                              Opublikuj
                            </button>
                          </div>
                        </div>
                      )}

                      {forumLoading && <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-400"/></div>}
                      {!forumLoading && forumPosts.length===0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                            <MessageSquare size={26} className="text-zinc-600"/>
                          </div>
                          <h3 className="text-base font-bold text-white mb-1">Brak postów</h3>
                          <p className="text-sm text-zinc-500">Bądź pierwszy i utwórz nowy post!</p>
                        </div>
                      )}
                      <div className="flex flex-col gap-3">
                        {forumPosts.map(post=>(
                          <button key={post.id} onClick={async()=>{
                            try {
                              const full = await forumApi.getPost(activeChannel, post.id);
                              setForumPost(full);
                            } catch {}
                          }} className="text-left w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.07] hover:border-white/[0.12] rounded-2xl overflow-hidden transition-all duration-150 group">
                            {post.image_url && (
                              <div className="h-40 overflow-hidden">
                                <img src={post.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt=""/>
                              </div>
                            )}
                            <div className="p-4">
                              {post.pinned&&<span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1"><Sparkles size={9}/> Przypięty</span>}
                              <h3 className="font-bold text-white text-sm mb-2 group-hover:text-indigo-300 transition-colors">{post.title}</h3>
                              <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{post.content}</p>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <img src={post.author_avatar||`https://ui-avatars.com/api/?name=${post.author_username}&background=random`} className="w-5 h-5 rounded-full object-cover" alt=""/>
                                  <span className="text-xs text-zinc-500">{post.author_username}</span>
                                </div>
                                <span className="text-xs text-zinc-600">{new Date(post.created_at).toLocaleDateString('pl-PL')}</span>
                                <span className="ml-auto flex items-center gap-1 text-xs text-zinc-600">
                                  <Reply size={11}/> {post.reply_count}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Thread view */
                    <div className="p-4 md:p-6 max-w-3xl mx-auto">
                      <button onClick={()=>setForumPost(null)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-4">
                        <ArrowLeft size={14}/> Wróć do listy
                      </button>
                      {/* Post */}
                      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden mb-4">
                        {forumPost.image_url && <img src={forumPost.image_url} className="w-full max-h-80 object-cover" alt=""/>}
                        <div className="p-5">
                          <h2 className="text-xl font-bold text-white mb-2">{forumPost.title}</h2>
                          <div className="flex items-center gap-3 mb-4">
                            <img src={forumPost.author_avatar||`https://ui-avatars.com/api/?name=${forumPost.author_username}&background=random`} className="w-7 h-7 rounded-full object-cover" alt=""/>
                            <span className="text-sm font-semibold text-zinc-300">{forumPost.author_username}</span>
                            <span className="text-xs text-zinc-600">{new Date(forumPost.created_at).toLocaleString('pl-PL')}</span>
                            {(currentUser?.id===forumPost.author_id||canManageMessages)&&(
                              <button onClick={async()=>{
                                try { await forumApi.deletePost(activeChannel,forumPost.id); setForumPost(null); setForumPosts(p=>p.filter(x=>x.id!==forumPost.id)); } catch {}
                              }} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                                <Trash2 size={13}/>
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{forumPost.content}</p>
                        </div>
                      </div>
                      {/* Replies */}
                      <div className="flex flex-col gap-2 mb-4">
                        <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Odpowiedzi ({forumPost.replies?.length||0})</h3>
                        {forumPost.locked&&<div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400"><Lock size={11}/>Ten wątek jest zablokowany</div>}
                        {(forumPost.replies||[]).map(r=>(
                          <div key={r.id} className="flex gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                            <img src={r.author_avatar||`https://ui-avatars.com/api/?name=${r.author_username}&background=random`} className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" alt=""/>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-zinc-300">{r.author_username}</span>
                                <span className="text-[10px] text-zinc-600">{new Date(r.created_at).toLocaleString('pl-PL')}</span>
                              </div>
                              <p className="text-sm text-zinc-400 leading-relaxed">{r.content}</p>
                            </div>
                          </div>
                        ))}
                        {!forumPost.locked&&(
                          <div className="flex gap-3 mt-2">
                            <img src={currentUser?.avatar_url||`https://ui-avatars.com/api/?name=${currentUser?.username||'?'}&background=random`} className="w-7 h-7 rounded-full object-cover shrink-0 mt-2" alt=""/>
                            <div className="flex-1">
                              <textarea value={replyContent} onChange={e=>setReplyContent(e.target.value)}
                                placeholder="Napisz odpowiedź..." rows={2}
                                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500/50 transition-all resize-none mb-2"/>
                              <button disabled={!replyContent.trim()||replySending} onClick={async()=>{
                                setReplySending(true);
                                try {
                                  const r = await forumApi.createReply(activeChannel, forumPost.id, replyContent.trim());
                                  setForumPost(p=>p?{...p, replies:[...(p.replies||[]),r], reply_count:p.reply_count+1}:p);
                                  setForumPosts(prev=>prev.map(x=>x.id===forumPost.id?{...x,reply_count:x.reply_count+1}:x));
                                  setReplyContent('');
                                } catch {} finally { setReplySending(false); }
                              }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2">
                                {replySending&&<Loader2 size={13} className="animate-spin"/>} Odpowiedz
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Announcement / Text Messages / DMs ── */}
              {(activeView!=='servers' || activeCh?.type!=='forum') && <div
                className="flex-1 flex flex-col min-h-0 relative"
                onDragOver={e=>{e.preventDefault();setIsDraggingOver(true);}}
                onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setIsDraggingOver(false);}}
                onDrop={e=>{
                  e.preventDefault(); setIsDraggingOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) { setAttachFile(file); if(file.type.startsWith('image/'))setAttachPreview(URL.createObjectURL(file)); else setAttachPreview(null); }
                }}>
                {isDraggingOver&&(
                  <div className="absolute inset-0 z-50 bg-indigo-500/15 border-2 border-dashed border-indigo-400/70 rounded-2xl flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-3 text-indigo-300">
                      <Upload size={32}/>
                      <span className="text-sm font-semibold">Upuść plik tutaj</span>
                    </div>
                  </div>
                )}
              {/* Messages */}
              <div ref={msgScrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 custom-scrollbar flex flex-col"
                onClickCapture={e => {
                  const btn = (e.target as HTMLElement).closest<HTMLElement>('.copy-code-btn');
                  if (!btn) return;
                  const code = decodeURIComponent(btn.dataset.code || '');
                  navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = '✓ Skopiowano';
                    btn.classList.add('cb-copied');
                    setTimeout(() => { btn.textContent = '⎘ Kopiuj'; btn.classList.remove('cb-copied'); }, 2000);
                  }).catch(() => {});
                }}>
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
                {/* mode="sync" (default) so new content mounts immediately — mode="wait" kept
                    new DOM out until old exit animation finished, breaking scrollHeight */}
                <AnimatePresence initial={false}>
                <motion.div key={`${activeServer}-${activeChannel}-${activeDmUserId}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
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
                              <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest shrink-0">{sepLabel}</span>
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
                            <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest shrink-0">{sepLabel}</span>
                            <div className="flex-1 h-px bg-white/[0.07]"/>
                          </div>
                        )}
                        {/* ── BUBBLE MESSAGE ───────────────────────── */}
                        {(()=>{ const mentionsMe = !!currentUser?.username && new RegExp(`!${currentUser.username}(?:[^a-zA-Z0-9_]|$)`,'i').test(msg.content); return (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.01, 0.06), type: 'spring', stiffness: 340, damping: 28 }}
                          className={`flex ${showChatAvatars?'gap-2.5':'gap-0'} group ${compactMessages?'mb-0.5':'mb-1.5'} ${isOwn?'flex-row-reverse':'flex-row'} ${mentionsMe?'rounded-xl bg-amber-400/5 border-l-2 border-amber-400/60 pl-2 -ml-2':''}`}>

                          {/* Avatar */}
                          {showChatAvatars&&(
                          <div className="av-frozen shrink-0 self-end mb-0.5" style={{'--av-url':`url("${ava({avatar_url:msg.sender_avatar,username:msg.sender_username})}")`} as React.CSSProperties}>
                            <img src={ava({avatar_url:msg.sender_avatar,username:msg.sender_username})} alt=""
                              onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar,status:(msg as MessageFull).sender_status})}
                              className={`w-9 h-9 rounded-xl object-cover cursor-pointer hover:opacity-80 hover:scale-105 transition-all av-eff-${(msg as any).sender_avatar_effect||'none'}`}/>
                          </div>
                          )}

                          {/* Content column */}
                          <div className={`flex flex-col max-w-[72%] ${isOwn?'items-end':'items-start'} min-w-0`}>

                            {/* Meta (name + time) */}
                            <div className={`flex items-center gap-1.5 mb-1 px-1 ${isOwn?'flex-row-reverse':''}`}>
                              <span className="text-xs font-semibold cursor-pointer hover:underline transition-opacity hover:opacity-80"
                                style={{ color: (msg as MessageFull).sender_role_color || (isOwn ? '#818cf8' : '#a1a1aa') }}
                                onClick={()=>openProfile({id:msg.sender_id,username:msg.sender_username,avatar_url:msg.sender_avatar})}>
                                {msg.sender_username}
                              </span>
                              {getMsgSenderBadges(msg.sender_id).map(b=>{const BIcon=getBadgeIcon(b.name);return <BIcon key={b.id} size={10} style={{color:b.color}} title={b.label} className="shrink-0"/>;  })}
                              {(msg as MessageFull).sender_role&&(
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                  style={{
                                    color: (msg as MessageFull).sender_role_color || '#a1a1aa',
                                    background: `${(msg as MessageFull).sender_role_color || '#a1a1aa'}18`,
                                    border: `1px solid ${(msg as MessageFull).sender_role_color || '#a1a1aa'}30`,
                                  }}>
                                  {(msg as MessageFull).sender_role}
                                </span>
                              )}
                              <span className={`text-[10px] text-zinc-600 transition-opacity ${alwaysShowTimestamps?'':'opacity-0 group-hover:opacity-100'}`}>{ft(msg.created_at)}</span>
                              {(msg as MessageFull).edited&&<span className="text-[10px] text-zinc-700 italic">(ed.)</span>}
                            </div>

                            {/* Reply preview */}
                            {msg.reply_to_id&&msg.reply_content&&(
                              <div className={`flex items-center gap-1.5 mb-1 text-[11px] text-zinc-500 border-l-2 border-indigo-500/40 pl-2 py-0.5 ${isOwn?'self-end':''}`}>
                                <Reply size={9} className="shrink-0"/>
                                <span className="font-semibold">{msg.reply_username}</span>
                                <span className="truncate max-w-[160px] text-zinc-600">{msg.reply_content}</span>
                              </div>
                            )}

                            {/* Bubble or edit input */}
                            {editingMsgId === msg.id ? (
                              <div className="w-full flex flex-col gap-1.5">
                                <input autoFocus value={editingMsgContent}
                                  onChange={e => setEditingMsgContent(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEditMsg(msg); }
                                    if (e.key === 'Escape') cancelEditMsg();
                                  }}
                                  className="w-full bg-white/[0.08] border border-indigo-500/40 text-zinc-100 text-sm rounded-xl px-3 py-1.5 outline-none focus:border-indigo-500/70 transition-all"/>
                                <div className="flex items-center gap-2 text-[11px] text-zinc-500 px-1">
                                  <span>Esc — <button type="button" onClick={cancelEditMsg} className="text-zinc-400 hover:text-white">anuluj</button></span>
                                  <span>• Enter — <button type="button" onClick={() => submitEditMsg(msg)} className="text-indigo-400 hover:text-indigo-300">zapisz</button></span>
                                </div>
                              </div>
                            ) : msg.content.startsWith('CINV|') ? (() => {
                              const parts = msg.content.split('|');
                              const [,srvId,code,srvName,iconUrl,bannerUrl] = parts;
                              const alreadyMember = serverList.some(s=>s.id===srvId);
                              return (
                                <div className="max-w-xs glass-bubble rounded-2xl overflow-hidden shadow-xl">
                                  {/* Banner or gradient fallback */}
                                  <div className="h-16 relative overflow-hidden">
                                    {bannerUrl ? (
                                      <img src={bannerUrl} className="w-full h-full object-cover" alt=""/>
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"/>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                                  </div>
                                  <div className="px-4 pb-4 pt-2 flex items-end gap-3 -mt-6 relative">
                                    {iconUrl ? (
                                      <img src={iconUrl} className="w-12 h-12 rounded-2xl border-4 border-black/50 object-cover shadow-lg shrink-0" alt=""/>
                                    ) : (
                                      <div className="w-12 h-12 rounded-2xl border-4 border-black/50 bg-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0">
                                        {srvName?.[0]?.toUpperCase()||'S'}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0 pb-1">
                                      <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Zaproszenie na serwer</p>
                                      <p className="text-sm font-bold text-white truncate">{srvName}</p>
                                    </div>
                                  </div>
                                  <div className="px-4 pb-4">
                                    {alreadyMember ? (
                                      <div className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-center text-zinc-400 font-semibold">Jesteś już członkiem</div>
                                    ) : (
                                      <button onClick={async()=>{
                                        try {
                                          const s = await serversApi.join(code);
                                          setServerList(p=>[...p,s]); setActiveServer(s.id); setActiveView('servers');
                                          addToast(`Dołączono do serwera ${srvName}!`,'success');
                                        } catch(err:any){ addToast(err?.message||'Nie udało się dołączyć','error'); }
                                      }} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-500/25">
                                        Dołącz do serwera →
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })() : (msg as any).deleted || msg.content === '__deleted__' ? (
                              <div className="px-3.5 py-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] flex items-center gap-2">
                                <Trash2 size={12} className="text-zinc-600 shrink-0"/>
                                <p className="text-sm italic text-zinc-600">Wiadomość została usunięta</p>
                              </div>
                            ) : msg.content?.startsWith('[POLL:') ? (() => {
                              const pollIdMatch = msg.content.match(/^\[POLL:([^\]]+)\]/);
                              const pollId = pollIdMatch?.[1];
                              const poll = pollId ? polls.get(pollId) : null;
                              if (!poll) {
                                return (
                                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 max-w-xs">
                                    <div className="flex items-center gap-2 text-zinc-600 text-xs">
                                      <BarChart2 size={13}/>
                                      <span>Ładowanie ankiety...</span>
                                    </div>
                                  </div>
                                );
                              }
                              const totalVotes = poll.total_votes || 0;
                              return (
                                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 max-w-xs w-full">
                                  <div className="flex items-center gap-2 mb-3">
                                    <BarChart2 size={14} className="text-indigo-400 shrink-0"/>
                                    <p className="text-sm font-bold text-white">{poll.question}</p>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    {poll.options.map(opt => {
                                      const count = poll.votes[opt.id] || 0;
                                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                      const voted = poll.my_votes?.includes(opt.id);
                                      return (
                                        <button key={opt.id}
                                          onClick={async () => {
                                            try {
                                              const updated = voted
                                                ? await pollsApi.unvote(poll.id, opt.id)
                                                : await pollsApi.vote(poll.id, opt.id);
                                              setPolls(p => new Map(p).set(poll.id, updated));
                                            } catch {}
                                          }}
                                          className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border text-left overflow-hidden transition-all ${
                                            voted ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]'}`}>
                                          <div className="absolute inset-0 bg-indigo-500/10 origin-left transition-all duration-500"
                                            style={{transform:`scaleX(${pct/100})`}}/>
                                          <span className={`relative text-xs font-medium flex-1 ${voted ? 'text-indigo-300' : 'text-zinc-300'}`}>{opt.text}</span>
                                          <span className="relative text-[10px] text-zinc-600 shrink-0">{pct}%</span>
                                          {voted && <Check size={10} className="relative text-indigo-400 shrink-0"/>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <p className="text-[10px] text-zinc-600 mt-2">{totalVotes} głosów</p>
                                </div>
                              );
                            })() : (
                              <div className={`relative px-4 py-2.5 rounded-2xl max-w-full ${isOwn
                                ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/20 bubble-tail-right'
                                : 'glass-bubble text-zinc-100 bubble-tail-left'
                              }`}>
                                <p className={`${msgFontCls} leading-relaxed break-words msg-md`} dangerouslySetInnerHTML={{__html: renderMsgHTML(msg.content)}}/>
                              </div>
                            )}

                            {/* Link preview */}
                            {(()=>{
                              const urls = msg.content?.match(URL_RE);
                              const firstUrl = urls?.[0];
                              if (!firstUrl || !msg.content) return null;
                              // Don't show for invite links (already rendered as card)
                              if (msg.content.includes('/join/')) return null;
                              return <span key={firstUrl}><LinkPreview url={firstUrl} show={showLinkPreviews}/></span>;
                            })()}

                            {/* Attachment */}
                            {msg.attachment_url&&(
                              <div className="mt-1.5 max-w-sm">
                                {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.attachment_url) ? (
                                  <img src={msg.attachment_url} alt="attachment" className="rounded-2xl max-h-64 object-contain cursor-zoom-in hover:opacity-90 transition-opacity shadow-lg"
                                    onClick={()=>setLightboxSrc(msg.attachment_url!)}/>
                                ) : (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl glass-bubble text-xs text-zinc-400 hover:text-white transition-colors">
                                    <Paperclip size={12}/> {msg.attachment_url.split('/').pop()}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Hover actions */}
                          {editingMsgId !== msg.id && !((msg as any).deleted || msg.content === '__deleted__') && (
                          <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center`}>
                            <button onClick={()=>setReplyTo(msg)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/[0.1] text-zinc-600 hover:text-zinc-300 transition-colors" title="Odpowiedz"><Reply size={11}/></button>
                            {isOwn&&<button onClick={()=>startEditMsg(msg)} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/[0.1] text-zinc-600 hover:text-zinc-300 transition-colors" title="Edytuj"><Edit3 size={11}/></button>}
                            {activeView==='servers'&&canPinMessages&&activeCh?.type==='text'&&(
                              <button onClick={()=>{const pinned=!(msg as MessageFull).pinned;handlePinMessage(msg.id,pinned);}} title={(msg as MessageFull).pinned?'Odepnij':'Przypnij'}
                                className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${(msg as MessageFull).pinned?'text-amber-400 hover:bg-amber-500/10':'text-zinc-600 hover:bg-white/[0.1] hover:text-amber-400'}`}>
                                <Pin size={10}/>
                              </button>
                            )}
                            {activeView==='dms' && (
                              <button
                                onClick={async () => {
                                  const isPinned = !!(msg as any).pinned;
                                  try {
                                    await dmPinApi.pin(msg.id);
                                    const newPinned = !isPinned;
                                    setDmMsgs(p => p.map(m => m.id === msg.id ? {...m, pinned: newPinned} : m));
                                    if (newPinned) {
                                      setDmPinnedMsgs(p => [msg as DmMessageFull, ...p.filter(x => x.id !== msg.id)]);
                                    } else {
                                      setDmPinnedMsgs(p => p.filter(x => x.id !== msg.id));
                                    }
                                  } catch {}
                                }}
                                title={(msg as any).pinned ? 'Odepnij' : 'Przypnij'}
                                className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${(msg as any).pinned ? 'text-amber-400 hover:bg-amber-500/10' : 'text-zinc-600 hover:bg-white/[0.1] hover:text-amber-400'}`}>
                                <Pin size={10}/>
                              </button>
                            )}
                            {(isOwn||(activeView==='servers'&&canManageMessages))&&(
                              <button onClick={()=>confirmAction('Usunąć wiadomość?', () => { if(activeView==='servers') messagesApi.delete(msg.id).catch(console.error); else dmsApi.deleteMessage(msg.id).catch(console.error); })} title="Usuń" className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-zinc-600 hover:text-rose-400 transition-colors"><Trash2 size={11}/></button>
                            )}
                          </div>
                          )}
                        </motion.div>
                        );})()}
                      </React.Fragment>
                    );
                  })}
                  {/* DM read receipt — "Przeczytane" after last own message */}
                  {(()=>{
                    if (activeView !== 'dms' || !activeDm || !currentUser) return null;
                    // Hide if partner has disabled read receipts
                    if (dmPartnerProfile?.privacy_read_receipts === false) return null;
                    // Use socket-received read time or the other user's last_read_at from conversations list
                    const readAt = dmReadStates[activeDmUserId] || activeDm.other_last_read_at;
                    if (!readAt) return null;
                    // Find last message sent by current user
                    const msgs = messages as (MessageFull|DmMessageFull)[];
                    const lastOwn = [...msgs].reverse().find(m => m.sender_id === currentUser.id);
                    if (!lastOwn) return null;
                    const wasRead = new Date(readAt) >= new Date(lastOwn.created_at);
                    if (!wasRead) return null;
                    return (
                      <div className="flex justify-end items-center gap-1.5 pr-1 -mt-1 mb-0.5">
                        <span className="text-[10px] text-zinc-600">Przeczytane</span>
                        <img src={ava({avatar_url:activeDm.other_avatar,username:activeDm.other_username})}
                          className="w-5 h-5 rounded-full object-cover opacity-80" alt=""/>
                      </div>
                    );
                  })()}

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
              <div className="shrink-0 px-4 md:px-6 pb-5 pt-3 bg-black/20 border-t border-white/[0.05]">
                {/* Reply / attach previews */}
                <AnimatePresence>
                  {replyTo&&(
                    <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                      className="flex items-center justify-between bg-white/[0.06]/70 border border-white/[0.07] rounded-xl px-3 py-1.5 mb-2 text-xs overflow-hidden">
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
                  // Announcement channel — only those with manage_messages can write
                  if (activeCh?.type==='announcement' && !canManageMessages) return (
                    <div className="flex items-center justify-center gap-2.5 py-3 px-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
                      <Megaphone size={14} className="shrink-0"/>
                      <span>To jest kanał ogłoszeń. Tylko administratorzy mogą tutaj pisać.</span>
                    </div>
                  );
                  // send_messages permission check (server channels only)
                  if (!isDmView && activeView==='servers' && !canSendMessages) return (
                    <div className="flex items-center justify-center gap-2.5 py-3 px-4 bg-zinc-900/60 border border-white/[0.06] rounded-xl text-zinc-500 text-sm">
                      <Lock size={14} className="text-zinc-600 shrink-0"/>
                      <span>Nie masz uprawnień do wysyłania wiadomości na tym kanale.</span>
                    </div>
                  );
                  if (!isFriend) return (
                    <div className="flex items-center justify-center gap-2.5 py-3 px-4 bg-zinc-900/60 border border-white/[0.06] rounded-xl text-zinc-500 text-sm">
                      <Lock size={14} className="text-zinc-600 shrink-0"/>
                      <span>Możesz pisać tylko do znajomych — dodaj tę osobę do znajomych, aby wysłać wiadomość.</span>
                    </div>
                  );
                  return (
                    <form onSubmit={handleSend} className="relative">
                      {/* Mention autocomplete dropdown */}
                      {mentionQuery !== null && mentionSuggestions.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#141420] border border-white/[0.1] rounded-2xl overflow-hidden shadow-2xl z-50">
                          <div className="px-3 py-1.5 border-b border-white/[0.05]">
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Wspomnij użytkownika</span>
                          </div>
                          {mentionSuggestions.map((m, i) => (
                            <button key={m.id} type="button"
                              onMouseDown={e=>{e.preventDefault(); insertMention(m.username);}}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors ${i === mentionSel ? 'bg-indigo-500/15' : 'hover:bg-white/[0.04]'}`}>
                              <img src={ava(m)} alt="" className="w-7 h-7 rounded-xl object-cover shrink-0"/>
                              <span className="text-sm font-semibold text-white">{m.username}</span>
                              <span className={`w-2 h-2 rounded-full shrink-0 ml-auto ${m.status==='online'?'bg-emerald-400':m.status==='idle'?'bg-amber-400':m.status==='dnd'?'bg-rose-500':'bg-zinc-600'}`}/>
                            </button>
                          ))}
                        </div>
                      )}
                      {slowmodeLeft > 0 && activeView === 'servers' && (
                        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3.5 text-amber-400 text-sm select-none">
                          <Clock size={15} className="shrink-0"/>
                          <span className="flex-1">Tryb wolny — poczekaj <span className="font-bold tabular-nums">{slowmodeLeft}s</span> przed kolejną wiadomością</span>
                        </div>
                      )}
                      {/* Formatting toolbar — collapsible */}
                      <AnimatePresence>
                        {showFmtBar && (
                          <motion.div key="fmtbar"
                            initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                            transition={{duration:0.15}} className="overflow-hidden">
                            <div className="flex items-center gap-0.5 mb-1.5 pl-1 pb-1.5 border-b border-white/[0.05]">
                              {([
                                {title:'Pogrubienie (Ctrl+B)',md:'**',label:<strong className="text-xs">B</strong>},
                                {title:'Kursywa (Ctrl+I)',md:'*',label:<em className="text-xs">I</em>},
                                {title:'Przekreślenie',md:'~~',label:<span className="text-xs line-through">S</span>},
                                {title:'Kod inline',md:'`',label:<code className="text-xs font-mono">&lt;/&gt;</code>},
                                {title:'Blok kodu',md:'```\n',suffix:'\n```',label:<span className="text-xs font-mono opacity-60">&#123;&#125;</span>},
                              ] as {title:string;md:string;suffix?:string;label:React.ReactNode}[]).map(({title,md,suffix,label})=>(
                                <button key={md} type="button" title={title}
                                  onClick={()=>wrapSelection(md,suffix??md)}
                                  className="w-8 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.09] transition-all active:scale-90 select-none">
                                  {label}
                                </button>
                              ))}
                              <div className="ml-auto mr-1 flex items-center gap-0.5">
                                <span className="text-[10px] text-zinc-700">Markdown</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className={`flex items-center gap-3 bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-3.5 hover:border-white/[0.12] focus-within:border-indigo-500/40 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] transition-all duration-200 ${slowmodeLeft > 0 && activeView === 'servers' ? 'opacity-40 pointer-events-none' : ''}`}>
                        <input type="file" ref={attachRef} onChange={handleAttach} accept="image/*" className="hidden"/>
                        <button type="button" onClick={()=>canAttachFiles?attachRef.current?.click():setSendError('Nie masz uprawnień do wysyłania plików')}
                          title={canAttachFiles?'Wyślij plik':'Brak uprawnień do wysyłania plików'}
                          className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all shrink-0 active:scale-90 ${canAttachFiles?'text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10':'text-zinc-700 cursor-not-allowed'}`}>
                          <Plus size={16}/>
                        </button>
                        <button type="button" onClick={()=>setShowFmtBar(v=>!v)}
                          title="Formatowanie tekstu"
                          className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all shrink-0 active:scale-90 ${showFmtBar?'text-indigo-400 bg-indigo-500/10':'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.07]'}`}>
                          <Edit3 size={14}/>
                        </button>
                        <textarea ref={msgInputRef} value={msgInput} rows={1}
                          onPaste={e=>{
                            const items = Array.from(e.clipboardData?.items||[]);
                            const imgItem = items.find(it=>it.type.startsWith('image/'));
                            if(imgItem){
                              e.preventDefault();
                              const file = imgItem.getAsFile();
                              if(!file) return;
                              const ext = file.type.split('/')[1]||'png';
                              const named = new File([file], `paste-${Date.now()}.${ext}`, { type: file.type });
                              setAttachFile(named);
                              setAttachPreview(URL.createObjectURL(named));
                            }
                          }}
                          onChange={e=>{
                            const v=e.target.value; setMsgInput(v);
                            // Mention autocomplete trigger
                            const caretPos = e.target.selectionStart ?? v.length;
                            const textBefore = v.slice(0, caretPos);
                            const mentionMatch = textBefore.match(/!([a-zA-Z0-9_]*)$/);
                            if (mentionMatch && activeView==='servers') { setMentionQuery(mentionMatch[1]); setMentionSel(0); }
                            else setMentionQuery(null);
                            // Typing indicator
                            if(activeChannel&&activeView==='servers'&&currentUser?.privacy_typing_visible!==false){
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
                          onKeyDown={e=>{
                            if (mentionQuery !== null && mentionSuggestions.length > 0) {
                              if (e.key==='ArrowUp')   { e.preventDefault(); setMentionSel(s=>Math.max(0,s-1)); return; }
                              if (e.key==='ArrowDown') { e.preventDefault(); setMentionSel(s=>Math.min(mentionSuggestions.length-1,s+1)); return; }
                              if (e.key==='Enter'||e.key==='Tab') { e.preventDefault(); insertMention(mentionSuggestions[mentionSel]?.username||''); return; }
                              if (e.key==='Escape') { setMentionQuery(null); return; }
                            }
                            if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSend(e as any); }
                          }}
                          placeholder={activeView==='dms'&&activeDm?`Wiadomość do ${activeDm.other_username}...`:`Wiadomość w #${activeCh?.name||''}...`}
                          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none min-w-0 resize-none overflow-hidden leading-[1.4] self-center"/>
                        <div className="relative shrink-0">
                          <button type="button" onClick={() => setShowEmojiPicker(v => !v)}
                            className={`transition-all active:scale-90 ${showEmojiPicker ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                            <Smile size={17}/>
                          </button>
                          {showEmojiPicker && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmojiPicker(false)} serverEmojis={activeView==='servers'&&activeServer ? (serverEmojis.get(activeServer)||[]) : []}/>}
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
              </div>}
            </>
          )}
        </section>

        {/* RIGHT — Live voice + Activity */}
        <aside className="hidden xl:flex w-64 shrink-0 flex-col gap-0 glass-panel rounded-2xl overflow-y-auto custom-scrollbar">
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
                  {activeCall&&<span className="text-xs font-mono text-emerald-400 font-semibold">{fmtDur(callDuration)}</span>}
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
                  className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/[0.08] text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
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
                <>
                  <div className="flex flex-col gap-1.5">
                    {serverActivity.slice(0,4).map(a=>(
                      <div key={a.id} className="flex items-start gap-2.5 bg-white/[0.03] rounded-2xl px-3 py-2.5 border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-200">
                        {activityIcon(a.type)}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-zinc-300 leading-snug">{a.text}</p>
                          <p className="text-[10px] text-zinc-600 mt-0.5">{ft(a.time)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {serverActivity.length>4&&(
                    <button onClick={()=>setShowActivityModal(true)}
                      className="mt-2.5 w-full text-[11px] text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl py-2 transition-all font-medium">
                      Zobacz więcej ({serverActivity.length - 4})
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-700 italic">Brak aktywności na serwerze</p>
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
                    <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
                      Online — {online.length}
                    </h3>
                    <div className="flex flex-col gap-0.5">
                      {online.map(m=>{
                        const isNew = m.joined_at && (Date.now()-new Date(m.joined_at).getTime()<172800000);
                        const isOwner = m.id === serverFull?.owner_id;
                        const mActivity = userActivities.get(m.id);
                        const mTwitch = userTwitchActivities.get(m.id);
                        const mSteam = userSteamActivities.get(m.id);
                        return (
                        <div key={m.id} className="flex items-center gap-3 cursor-pointer group px-2 py-2 rounded-xl hover:bg-white/[0.06] hover:transition-all" onClick={()=>openProfile(m)}
                          onMouseEnter={e=>showHoverCard(m.id, e)}
                          onMouseLeave={hideHoverCard}>
                          <div className="relative shrink-0 av-frozen" style={{'--av-url':`url("${ava(m)}")`} as React.CSSProperties}>
                            {isNew&&<div className="absolute inset-0 rounded-xl ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-[#1e1e30] pointer-events-none animate-pulse z-10"/>}
                            <img src={ava(m)} className={`w-10 h-10 rounded-xl object-cover av-eff-${m.avatar_effect||'none'} av-sc`} alt=""/>
                            <StatusBadge status={m.status} size={10} className="absolute -bottom-0.5 -right-0.5"/>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="text-[13px] font-semibold truncate group-hover:opacity-90 transition-colors leading-tight"
                                style={{ color: m.roles?.[0]?.color || '#d4d4d8' }}>
                                {m.username}
                              </p>
                              {isOwner&&<Crown size={11} className="text-amber-400 shrink-0"/>}
                              {m.badges?.map(b=>{const BIcon=getBadgeIcon(b.name);return <BIcon key={b.id} size={11} style={{color:b.color}} title={b.label} className="shrink-0"/>;  })}
                            </div>
                            {mActivity ? (
                              <p className="text-[11px] text-[#1DB954] truncate leading-tight flex items-center gap-1"><SpotifyIcon size={10} className="shrink-0"/> {mActivity.artists}</p>
                            ) : mTwitch ? (
                              <p className="text-[11px] text-purple-400 truncate leading-tight flex items-center gap-1"><TwitchIcon size={10} className="shrink-0"/> Streamuje: {mTwitch.game_name}</p>
                            ) : mSteam ? (
                              <p className="text-[11px] text-zinc-400 truncate leading-tight flex items-center gap-1"><Gamepad2 size={10} className="shrink-0"/> {mSteam.name}</p>
                            ) : (()=>{const sl=statusLabel(m.status); return sl
                              ? <p className={`text-[11px] truncate leading-tight ${sl.cls}`}>{sl.text}</p>
                              : m.role_name ? <p className="text-[11px] text-zinc-600 truncate leading-tight">{m.role_name}</p> : null;
                            })()}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {offline.length>0&&(
                  <div>
                    <h3 className="text-[11px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-1">
                      Offline — {offline.length}
                    </h3>
                    <div className="flex flex-col gap-0.5">
                      {offline.map(m=>{
                        const isOwner = m.id === serverFull?.owner_id;
                        return (
                        <div key={m.id} className="flex items-center gap-3 cursor-pointer group px-2 py-2 rounded-xl hover:bg-white/[0.06] hover:transition-all" onClick={()=>openProfile(m)}
                          onMouseEnter={e=>showHoverCard(m.id,e)}
                          onMouseLeave={hideHoverCard}>
                          <div className="relative shrink-0 av-frozen" style={{'--av-url':`url("${ava(m)}")`} as React.CSSProperties}>
                            <img src={ava(m)} className={`w-10 h-10 rounded-xl object-cover opacity-35 av-eff-${m.avatar_effect||'none'} av-sc`} alt=""/>
                            <StatusBadge status="offline" size={10} className="absolute -bottom-0.5 -right-0.5 opacity-50"/>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="text-[13px] font-medium truncate group-hover:opacity-70 transition-colors leading-tight"
                                style={{ color: m.roles?.[0]?.color ? `${m.roles[0].color}80` : '#52525b' }}>
                                {m.username}
                              </p>
                              {isOwner&&<Crown size={11} className="text-amber-400/50 shrink-0"/>}
                              {m.badges?.map(b=>{const BIcon=getBadgeIcon(b.name);return <BIcon key={b.id} size={11} style={{color:b.color+'80'}} title={b.label} className="shrink-0 opacity-50"/>;  })}
                            </div>
                            {m.role_name&&<p className="text-[11px] text-zinc-700 truncate leading-tight">{m.role_name}</p>}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─ DM PARTNER BIO PANEL ─ */}
          {activeView==='dms'&&activeDm&&dmPartnerProfile&&(()=>{
            // ── helpers for tabs ─────────────────────────────────
            const IMG_EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?.*)?$/i;
            const VID_EXT = /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i;
            const URL_RE  = /https?:\/\/[^\s<>"']+/gi;
            const isImgUrl = (u: string) => IMG_EXT.test(u);
            const isVidUrl = (u: string) => VID_EXT.test(u);

            // Media: messages with image/video attachment OR content that is just an image URL
            const mediaItems = dmMsgs.filter(m => {
              if (m.attachment_url) return true;
              const urls = m.content.match(URL_RE) ?? [];
              return urls.some(u => isImgUrl(u) || isVidUrl(u));
            });

            // Links: messages containing URLs that are NOT pure-media messages
            const linkItems = dmMsgs.filter(m => {
              if (!m.content) return false;
              const urls = m.content.match(URL_RE) ?? [];
              if (urls.length === 0) return false;
              // Exclude if it's only image/video URLs with no other text
              const nonMedia = urls.filter(u => !isImgUrl(u) && !isVidUrl(u));
              return nonMedia.length > 0;
            });

            // Calls: system messages with 📞 or 📹
            const callItems = dmMsgs.filter(m =>
              m.content.includes('📞') || m.content.includes('📹')
            );

            const DM_TABS: { id: 'profile'|'media'|'links'|'calls'|'pinned'; label: string; icon: React.ReactNode; count?: number }[] = [
              { id: 'profile', label: 'Profil',     icon: <Users size={13}/> },
              { id: 'media',   label: 'Media',      icon: <Image size={13}/>,  count: mediaItems.length },
              { id: 'links',   label: 'Linki',      icon: <Link2 size={13}/>,  count: linkItems.length },
              { id: 'calls',   label: 'Połączenia', icon: <Phone size={13}/>,  count: callItems.length },
              { id: 'pinned',  label: 'Przypięte',  icon: <Pin size={13}/>,    count: dmPinnedMsgs.length },
            ];

            return (
              <div className="flex flex-col min-h-0">
                {/* Banner */}
                <div className="h-16 relative overflow-hidden shrink-0">
                  {dmPartnerProfile.banner_url
                    ? <img src={dmPartnerProfile.banner_url} className="w-full h-full object-cover" alt=""/>
                    : <div className={`w-full h-full bg-gradient-to-br ${dmPartnerProfile.banner_color||'from-indigo-600 via-purple-600 to-pink-600'}`}/>
                  }
                </div>

                {/* Avatar + name */}
                <div className="px-4 pb-3 border-b border-white/[0.07]">
                  <div className="relative inline-block -mt-7 mb-2 av-frozen" style={{'--av-url':`url("${ava(dmPartnerProfile)}")`} as React.CSSProperties}>
                    <img src={ava(dmPartnerProfile)} className={`w-14 h-14 rounded-2xl border-4 border-[#1e1e30] object-cover av-eff-${dmPartnerProfile.avatar_effect||'none'}`} alt=""/>
                    <StatusBadge status={activeDm.other_status} size={20} className="absolute -bottom-1 -right-1"/>
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight">{dmPartnerProfile.username}</h3>
                  {activeDm.other_custom_status&&(
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{activeDm.other_custom_status}</p>
                  )}
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-white/[0.07] shrink-0 px-1 pt-1">
                  {DM_TABS.map(t => (
                    <button key={t.id} onClick={() => setDmRightTab(t.id)}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] font-semibold rounded-t-xl transition-all relative
                        ${dmRightTab===t.id ? 'text-indigo-300' : 'text-zinc-600 hover:text-zinc-400'}`}>
                      {t.icon}
                      <span>{t.label}</span>
                      {typeof t.count === 'number' && t.count > 0 && (
                        <span className={`absolute top-1 right-1 text-[9px] font-bold rounded-full px-1 leading-none py-0.5
                          ${dmRightTab===t.id ? 'bg-indigo-500/30 text-indigo-300' : 'bg-white/[0.07] text-zinc-500'}`}>
                          {t.count}
                        </span>
                      )}
                      {dmRightTab===t.id && (
                        <motion.div layoutId="dm-tab-indicator"
                          className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-400 rounded-full"/>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <AnimatePresence mode="wait">
                    {/* ── PROFILE ── */}
                    {dmRightTab==='profile' && (
                      <motion.div key="profile" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        transition={{duration:0.15}} className="p-4 flex flex-col gap-3">
                        {dmPartnerProfile.bio&&(
                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">O mnie</h4>
                            <p className="text-[12px] text-zinc-400 leading-relaxed">{dmPartnerProfile.bio}</p>
                          </div>
                        )}
                        <div>
                          <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Dołączył/a</h4>
                          <p className="text-[12px] text-zinc-400">
                            {new Date(dmPartnerProfile.created_at).toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric'})}
                          </p>
                        </div>
                        {typeof dmPartnerProfile.mutual_friends_count==='number' && dmPartnerProfile.mutual_friends_count > 0 && (
                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Wspólni znajomi</h4>
                            <p className="text-[12px] text-zinc-400 flex items-center gap-1.5">
                              <Users size={11} className="text-indigo-400"/>
                              {dmPartnerProfile.mutual_friends_count} wspólnych znajomych
                            </p>
                          </div>
                        )}
                        {/* Private note */}
                        <div>
                          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5 block">Prywatna notatka</label>
                          <textarea
                            value={userNotes.get(dmPartnerProfile.id) || ''}
                            onChange={e => saveUserNote(dmPartnerProfile.id, e.target.value)}
                            placeholder="Dodaj notatkę o tej osobie..."
                            rows={3}
                            className="w-full text-xs bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 text-zinc-300 placeholder-zinc-600 resize-none outline-none focus:border-indigo-500/40 transition-all"
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* ── MEDIA ── */}
                    {dmRightTab==='media' && (
                      <motion.div key="media" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        transition={{duration:0.15}} className="p-3">
                        {mediaItems.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <Image size={28} className="text-zinc-700"/>
                            <p className="text-xs text-zinc-600">Brak zdjęć ani filmów</p>
                          </div>
                        ) : (() => {
                          // Build flat gallery items list (same order as grid)
                          const galleryItems: GalleryItem[] = [];
                          [...mediaItems].reverse().forEach(m => {
                            const attUrl = m.attachment_url;
                            const urlsInContent = (m.content.match(URL_RE) ?? []);
                            const mediaUrl = attUrl ?? urlsInContent.find(u => isImgUrl(u) || isVidUrl(u));
                            if (!mediaUrl) return;
                            galleryItems.push({
                              url: mediaUrl,
                              isVideo: isVidUrl(mediaUrl),
                              date: new Date(m.created_at).toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'}),
                              sender: m.sender_id === currentUser?.id ? 'Ty' : m.sender_username,
                            });
                          });
                          return (
                            <div className="grid grid-cols-2 gap-1.5">
                              {galleryItems.map((item, idx) => (
                                <button key={idx}
                                  onClick={() => setDmGallery({ items: galleryItems, index: idx })}
                                  className="relative aspect-square rounded-xl overflow-hidden group border border-white/[0.07] hover:border-indigo-500/40 transition-all">
                                  {item.isVideo ? (
                                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                      <video src={item.url} className="w-full h-full object-cover" muted/>
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
                                        <Film size={22} className="text-white/80"/>
                                      </div>
                                    </div>
                                  ) : (
                                    <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                                  )}
                                  <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-black/60 rounded-md px-1.5 py-0.5 text-[9px] text-white/70">{item.date}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}

                    {/* ── LINKS ── */}
                    {dmRightTab==='links' && (
                      <motion.div key="links" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        transition={{duration:0.15}} className="p-3 flex flex-col gap-2">
                        {linkItems.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <Link2 size={28} className="text-zinc-700"/>
                            <p className="text-xs text-zinc-600">Brak udostępnionych linków</p>
                          </div>
                        ) : (
                          [...linkItems].reverse().map(m => {
                            const urls = (m.content.match(URL_RE) ?? []).filter(u => !isImgUrl(u) && !isVidUrl(u));
                            if (!urls.length) return null;
                            let host = '';
                            try { host = new URL(urls[0]).hostname.replace(/^www\./, ''); } catch {}
                            const sentByMe = m.sender_id === currentUser?.id;
                            return (
                              <div key={m.id} className="flex flex-col gap-1">
                                {urls.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-start gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-indigo-500/30 rounded-xl p-2.5 group transition-all">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                      <Link2 size={12} className="text-indigo-400"/>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] text-indigo-300 group-hover:text-indigo-200 truncate font-medium leading-tight">{host || url}</p>
                                      <p className="text-[10px] text-zinc-600 truncate mt-0.5">{url.length > 50 ? url.slice(0, 50) + '…' : url}</p>
                                    </div>
                                    <ExternalLink size={11} className="text-zinc-700 group-hover:text-zinc-400 shrink-0 mt-1 transition-colors"/>
                                  </a>
                                ))}
                                <p className="text-[10px] text-zinc-700 px-1">
                                  {sentByMe ? 'Ty' : m.sender_username} · {new Date(m.created_at).toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'})}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </motion.div>
                    )}

                    {/* ── CALLS ── */}
                    {dmRightTab==='calls' && (
                      <motion.div key="calls" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        transition={{duration:0.15}} className="p-3 flex flex-col gap-1.5">
                        {callItems.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <Phone size={28} className="text-zinc-700"/>
                            <p className="text-xs text-zinc-600">Brak historii połączeń</p>
                          </div>
                        ) : (
                          [...callItems].reverse().map(m => {
                            const isVideo = m.content.includes('📹');
                            const sentByMe = m.sender_id === currentUser?.id;
                            // Extract duration if present e.g. "Rozmowa zakończona · 2m 15s"
                            const durMatch = m.content.match(/·\s*(.+)$/);
                            const dur = durMatch ? durMatch[1].trim() : null;
                            // Missed = very short or "Połączenie nieodebrane"
                            const missed = m.content.toLowerCase().includes('nieodebrane') || m.content.toLowerCase().includes('odrzucone');
                            return (
                              <div key={m.id}
                                className="flex items-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.05] rounded-xl px-3 py-2.5 transition-all">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                                  ${missed ? 'bg-rose-500/10' : sentByMe ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                                  {missed
                                    ? <PhoneMissed size={14} className="text-rose-400"/>
                                    : isVideo
                                      ? <Video size={14} className={sentByMe ? 'text-indigo-400' : 'text-emerald-400'}/>
                                      : sentByMe
                                        ? <PhoneIncoming size={14} className="text-indigo-400" style={{transform:'scaleX(-1)'}}/>
                                        : <PhoneIncoming size={14} className="text-emerald-400"/>
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[12px] font-semibold leading-tight ${missed ? 'text-rose-400' : 'text-zinc-300'}`}>
                                    {missed ? 'Nieodebrane' : isVideo ? 'Rozmowa wideo' : 'Rozmowa głosowa'}
                                  </p>
                                  <p className="text-[10px] text-zinc-600 mt-0.5">
                                    {new Date(m.created_at).toLocaleDateString('pl-PL',{day:'numeric',month:'short',year:'numeric'})}
                                    {' · '}
                                    {new Date(m.created_at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}
                                  </p>
                                </div>
                                {dur && !missed && (
                                  <span className="text-[10px] text-zinc-600 shrink-0">{dur}</span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </motion.div>
                    )}

                    {/* ── PINNED DM MESSAGES ── */}
                    {dmRightTab==='pinned' && (
                      <motion.div key="pinned" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        transition={{duration:0.15}} className="p-3 flex flex-col gap-2">
                        {dmPinnedMsgs.length === 0 ? (
                          <div className="text-center text-zinc-600 text-xs py-8">
                            <Pin size={28} className="mx-auto mb-2 text-zinc-700"/>
                            Brak przypiętych wiadomości
                          </div>
                        ) : dmPinnedMsgs.map(m => (
                          <div key={m.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <img src={m.sender_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.sender_username)}`}
                                className="w-5 h-5 rounded-full object-cover" alt=""/>
                              <span className="text-[11px] font-semibold text-zinc-300">{m.sender_username}</span>
                              <span className="text-[10px] text-zinc-600 ml-auto">{new Date(m.created_at).toLocaleDateString('pl-PL')}</span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{m.content}</p>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })()}
        </aside>
      </main>

      {/* ── MODALS ─────────────────────────────────────────────────────── */}

      {/* Server context menu */}
      {srvContextMenu&&(
        <>
          <div className="fixed inset-0 z-[90]" onClick={()=>setSrvContextMenu(null)}/>
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
            style={{position:'fixed',left:srvContextMenu.x,top:srvContextMenu.y,backdropFilter:'blur(24px)'}}
            className="z-[91] bg-[#0e0e1c] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 py-1.5 min-w-[180px] overflow-hidden">
            {(srvContextMenu.srv.owner_id===currentUser?.id ||
              (srvContextMenu.srv.id===activeServer && (canManageServer||canManageRoles||canKickMembers))) && (<>
              <button onClick={()=>{ setSrvContextMenu(null); setSrvSettTab(canManageServer?'overview':canManageRoles?'roles':'members'); setSrvSettOpen(true); setShowCallPanel(false); setActiveServer(srvContextMenu.srv.id); setActiveView('servers'); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors text-left">
                <Settings2 size={13} className="text-zinc-500 shrink-0"/>
                Ustawienia serwera
              </button>
              <div className="mx-3 my-1 h-px bg-white/[0.06]"/>
            </>)}
            {srvContextMenu.srv.owner_id===currentUser?.id ? (
              <button onClick={()=>{ setDeleteSrvConfirm({id:srvContextMenu.srv.id,name:srvContextMenu.srv.name}); setSrvContextMenu(null); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left">
                <Trash2 size={13} className="shrink-0"/>
                Usuń serwer
              </button>
            ) : (
              <button onClick={()=>handleLeaveServer(srvContextMenu.srv.id)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors text-left">
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
            className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={()=>setProfileOpen(false)}>
            <motion.div
              initial={{scale:0.93,opacity:0,y:20}}
              animate={{scale:1,opacity:1,y:0}}
              exit={{scale:0.93,opacity:0,y:16}}
              transition={{type:'spring',stiffness:340,damping:28}}
              onClick={e=>e.stopPropagation()}
              className="glass-modal rounded-3xl w-full max-w-sm flex flex-col max-h-[92vh] overflow-hidden">

              {/* ── BANNER ── */}
              <div className="relative shrink-0">
                <div className="h-28 relative overflow-hidden rounded-t-3xl">
                  {(currentUser?.id===selUser.id ? (profBannerPrev||currentUser?.banner_url) : selUser.banner_url) ? (
                    <img src={currentUser?.id===selUser.id?(profBannerPrev||currentUser?.banner_url!):selUser.banner_url} className="w-full h-full object-cover" alt=""/>
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-r ${(currentUser?.id===selUser.id ? editProf?.banner_color : selUser?.banner_color)||getBannerGradient(selUser.id||'')}`}/>
                  )}
                  {/* Subtle bottom fade */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#222238]/50 pointer-events-none"/>
                  {currentUser?.id===selUser.id&&(
                    <label className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/75 rounded-xl flex items-center justify-center cursor-pointer transition-all">
                      <Upload size={13} className="text-white"/>
                      <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden"/>
                    </label>
                  )}
                </div>
                {/* Close button */}
                <button onClick={()=>setProfileOpen(false)} className="absolute top-2 left-2 w-8 h-8 bg-black/50 hover:bg-black/75 rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-all">
                  <X size={15}/>
                </button>
                {/* Avatar — overlaps banner */}
                <div className="absolute bottom-0 left-5 translate-y-1/2 z-10">
                  <div className="relative rounded-2xl p-0.5 bg-white/[0.06]">
                    <img src={ava(selUser)} className="w-20 h-20 rounded-2xl object-cover av-sc-lg" alt=""/>
                    <StatusBadge status={selUser.status||'offline'} size={18} className="absolute -bottom-1.5 -right-1.5"/>
                  </div>
                </div>
              </div>

              {/* ── SCROLLABLE BODY ── */}
              <div className="overflow-y-auto custom-scrollbar flex-1">
                <div className="px-5 pb-6 pt-14">

                  {/* Name + tag */}
                  <div className="mb-2">
                    <h3 className="text-xl font-black text-white leading-tight tracking-tight truncate">{selUser.username}</h3>
                    <p className="text-xs text-zinc-500 font-mono">#{(selUser.id||'0000').slice(-4).toUpperCase()}</p>
                  </div>

                  {/* Custom status — thought bubble style */}
                  {selUser.custom_status&&(
                    <div className="flex items-start gap-2.5 mb-4">
                      <div className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                        <Quote size={10} className="text-zinc-400"/>
                      </div>
                      <div className="relative bg-white/[0.04] border border-white/[0.07] rounded-2xl rounded-tl-sm px-3 py-2 max-w-[220px]">
                        <p className="text-xs text-zinc-300 leading-relaxed break-words">{selUser.custom_status}</p>
                      </div>
                    </div>
                  )}

                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {/* Global badges — Lucide icons */}
                    {Array.isArray(selUser.badges)&&selUser.badges.map((b:Badge)=>{
                      const BIcon = getBadgeIcon(b.name);
                      return (
                        <div key={b.id} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                          style={{background:b.color+'18',border:'1px solid '+b.color+'45'}}>
                          <BIcon size={11} style={{color:b.color}} className="shrink-0"/>
                          <span className="text-[11px] font-semibold" style={{color:b.color}}>{b.label}</span>
                        </div>
                      );
                    })}
                    {/* Crown — server owner */}
                    {activeView==='servers'&&serverFull&&selUser.id===serverFull.owner_id&&(
                      <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1">
                        <Crown size={11} className="text-amber-400"/>
                        <span className="text-[11px] text-amber-400 font-semibold">Właściciel</span>
                      </div>
                    )}
                    {/* New member indicator (joined within 48h) */}
                    {activeView==='servers'&&selUser.joined_at&&(Date.now()-new Date(selUser.joined_at).getTime()<172800000)&&(
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1">
                        <Sparkles size={11} className="text-emerald-400"/>
                        <span className="text-[11px] text-emerald-400 font-semibold">Nowy</span>
                      </div>
                    )}
                    {/* NOTE: server roles and date intentionally removed here — shown in sections below */}
                  </div>

                  {/* Server roles section */}
                  {activeView==='servers'&&Array.isArray(selUser.roles)&&selUser.roles.length>0&&(
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Shield size={9} className="text-zinc-700"/>Role na serwerze
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selUser.roles.map((role:any)=>(
                          <div key={role.role_id} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                            style={{background:(role.color||'#5865f2')+'18',border:'1px solid '+(role.color||'#5865f2')+'35'}}>
                            <div className="w-2 h-2 rounded-full shrink-0" style={{background:role.color||'#5865f2'}}/>
                            <span className="text-xs font-semibold" style={{color:role.color||'#818cf8'}}>{role.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio block */}
                  {selUser.bio&&(
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <FileText size={9} className="text-zinc-700"/>O mnie
                      </p>
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-3">
                        <p className="text-xs text-zinc-300 leading-relaxed">{selUser.bio}</p>
                      </div>
                    </div>
                  )}

                  {/* Info rows — full-width cards */}
                  {(selUser.created_at||(typeof selUser.mutual_friends_count==='number'&&selUser.mutual_friends_count>0))&&(
                    <div className="border-t border-white/[0.05] pt-4 mb-4 flex flex-col gap-2">
                      {selUser.created_at&&(
                        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <CalendarDays size={13} className="text-indigo-400"/>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold leading-none mb-0.5">Dołączył/a do Cordyn</p>
                            <p className="text-xs text-zinc-300 font-medium">{new Date(selUser.created_at).toLocaleDateString('pl-PL',{day:'numeric',month:'long',year:'numeric'})}</p>
                          </div>
                        </div>
                      )}
                      {typeof selUser.mutual_friends_count==='number'&&selUser.mutual_friends_count>0&&(
                        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <Users size={13} className="text-indigo-400"/>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold leading-none mb-0.5">Wspólni znajomi</p>
                            <p className="text-xs text-zinc-300 font-medium">{selUser.mutual_friends_count} {selUser.mutual_friends_count===1?'znajomy':'znajomych'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons (other user) */}
                  {currentUser?.id!==selUser.id ? (
                    <div className="flex gap-2.5">
                      <button onClick={()=>openDm(selUser.id)}
                        className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 text-sm">
                        <MessageSquare size={15}/> Wyślij wiadomość
                      </button>
                      <button onClick={()=>startDmCall(selUser.id,selUser.username,'voice',selUser.avatar_url)}
                        className="w-11 h-11 bg-white/[0.04] border border-white/[0.06] rounded-xl flex items-center justify-center text-zinc-400 hover:text-emerald-400 transition-all">
                        <Phone size={16}/>
                      </button>
                      <button onClick={()=>startDmCall(selUser.id,selUser.username,'video',selUser.avatar_url)}
                        className="w-11 h-11 bg-white/[0.04] border border-white/[0.06] rounded-xl flex items-center justify-center text-zinc-400 hover:text-sky-400 transition-all">
                        <Video size={16}/>
                      </button>
                    </div>
                  ) : (
                    /* Own profile edit form */
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5 block font-bold">Avatar</label>
                          <label className={`flex items-center gap-2 cursor-pointer ${gi} px-3 py-2.5 hover:border-indigo-500/30 transition-all`}>
                            <Upload size={14} className="text-zinc-500 shrink-0"/>
                            <span className="text-zinc-500 truncate text-xs">Zmień avatar</span>
                            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden"/>
                          </label>
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5 block font-bold">Banner</label>
                          <label className={`flex items-center gap-2 cursor-pointer ${gi} px-3 py-2.5 hover:border-indigo-500/30 transition-all`}>
                            <Upload size={14} className="text-zinc-500 shrink-0"/>
                            <span className="text-zinc-500 truncate text-xs">Zmień banner</span>
                            <input type="file" accept="image/*" onChange={handleBannerSelect} className="hidden"/>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5 block font-bold">Nazwa użytkownika</label>
                        <input value={editProf?.username||''} onChange={e=>setEditProf((p:any)=>({...p,username:e.target.value}))} className={`w-full ${gi} px-3 py-2.5 text-sm`}/>
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5 block font-bold">Status niestandardowy</label>
                        <input value={editProf?.custom_status||''} onChange={e=>setEditProf((p:any)=>({...p,custom_status:e.target.value}))} placeholder="Np. 🎮 Gram w gry..." className={`w-full ${gi} px-3 py-2.5 text-sm`}/>
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-600 uppercase tracking-widest mb-1.5 block font-bold">Bio</label>
                        <textarea value={editProf?.bio||''} onChange={e=>setEditProf((p:any)=>({...p,bio:e.target.value}))} rows={3} placeholder="Napisz coś o sobie..." className={`w-full ${gi} px-3 py-2.5 text-sm resize-none`}/>
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-600 uppercase tracking-widest mb-2 block font-bold">Kolor bannera</label>
                        <div className="grid grid-cols-6 gap-2">
                          {GRADIENTS.map(g=>(
                            <button key={g} onClick={()=>setEditProf((p:any)=>({...p,banner_color:g}))}
                              className={`h-8 rounded-xl bg-gradient-to-r ${g} border-2 transition-all ${editProf?.banner_color===g?'border-white scale-105':'border-transparent'}`}/>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleSaveProfile}
                        className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/25 transition-all mt-1">
                        Zapisz zmiany
                      </button>
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
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nazwa serwera</label>
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
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Kod zaproszenia</label>
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

      {/* Server Settings — moved to full-page in main content area (ServerSettingsPage component) */}
      {false&&srvSettOpen&&serverFull&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setSrvSettOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col`}>
              <div className="flex items-center justify-between p-5 border-b border-white/[0.06] shrink-0">
                <h2 className="text-base font-bold text-white">Ustawienia serwera</h2>
                <button onClick={()=>setSrvSettOpen(false)} className="text-zinc-600 hover:text-white"><X size={17}/></button>
              </div>
              <div className="flex border-b border-white/[0.06] shrink-0 px-5 gap-0.5 overflow-x-auto scrollbar-hide">
                {([
                  canManageServer && 'overview',
                  canManageRoles && 'roles',
                  (canManageRoles||canKickMembers) && 'members',
                  canBanMembers && 'bans',
                  canCreateInvites && 'invites',
                ].filter(Boolean) as ('overview'|'roles'|'members'|'bans'|'invites')[]).map(t=>(
                  <button key={t} onClick={()=>{
                    setSrvSettTab(t);
                    if (t==='bans' && activeServer) serversApi.bans.list(activeServer).then(setBanList).catch(console.error);
                  }}
                    className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 -mb-px shrink-0 ${srvSettTab===t?'border-indigo-500 text-white':'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                    {t==='overview'?'Ogólne':t==='roles'?'Role':t==='members'?'Członkowie':t==='bans'?'Bany':'Zaproszenia'}
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
                          <div className="relative"><img src={ava(m)} className="w-9 h-9 rounded-full object-cover av-sc-xs" alt=""/><StatusBadge status={m.status} size={10} className="absolute -bottom-0.5 -right-0.5"/></div>
                          <div><p className="text-sm font-semibold text-white">{m.username}</p><p className="text-xs text-zinc-600">{m.role_name}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.id!==currentUser?.id ? (
                            <>
                              {canManageRoles&&<select value={m.role_name} onChange={e=>handleSetMemberRole(m.id,e.target.value)}
                                className={`text-xs ${gi} rounded-lg px-2 py-1.5`}
                                style={{backgroundColor:'#18181b',color:'#d4d4d8'}}>
                                {roles.map(r=><option key={r.id} value={r.name} style={{background:'#18181b',color:'#d4d4d8'}}>{r.name}{r.is_default?' ★':''}</option>)}
                                {!roles.some(r=>r.name==='Member')&&<option value="Member" style={{background:'#18181b',color:'#d4d4d8'}}>Member</option>}
                                {!roles.some(r=>r.name==='Admin')&&<option value="Admin" style={{background:'#18181b',color:'#d4d4d8'}}>Admin</option>}
                              </select>}
                              {canKickMembers&&m.id!==serverFull?.owner_id&&<button onClick={()=>handleKick(m.id)} title="Wyrzuć" className="w-7 h-7 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg flex items-center justify-center"><X size={12}/></button>}
                              {canBanMembers&&m.id!==serverFull?.owner_id&&<button onClick={()=>handleBan(m.id,m.username)} title="Zbanuj" className="w-7 h-7 bg-rose-900/20 hover:bg-rose-800/40 text-rose-500 rounded-lg flex items-center justify-center"><Shield size={12}/></button>}
                            </>
                          ) : <span className="text-xs text-zinc-700">(ty)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {srvSettTab==='bans'&&(
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-white">Zbanowani ({banList.length})</h3>
                    {banList.length===0&&<p className="text-sm text-zinc-600">Brak zbanowanych użytkowników.</p>}
                    {banList.map(b=>(
                      <div key={b.user_id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] px-4 py-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <img src={b.avatar_url||`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(b.username)}&size=36`} className="w-9 h-9 rounded-full object-cover" alt=""/>
                          <div>
                            <p className="text-sm font-semibold text-white">{b.username}</p>
                            {b.reason&&<p className="text-xs text-zinc-600">Powód: {b.reason}</p>}
                            {b.banned_by_username&&<p className="text-xs text-zinc-700">przez {b.banned_by_username}</p>}
                          </div>
                        </div>
                        <button onClick={()=>handleUnban(b.user_id)} className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors">Odbanuj</button>
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
                          <code className="text-white font-mono text-sm flex-1">{streamerMode ? '••••••••••' : inviteCode}</code>
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

      {/* Poll Creation Modal */}
      <AnimatePresence>
        {pollModal.open && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
            onClick={() => setPollModal({open:false})}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} p-7 w-full max-w-md`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><BarChart2 size={18} className="text-indigo-400"/> Utwórz ankietę</h2>
                <button onClick={()=>setPollModal({open:false})} className="text-zinc-600 hover:text-white"><X size={17}/></button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Pytanie</label>
                  <input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)}
                    placeholder="Wpisz pytanie ankiety..." className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}/>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Opcje ({pollOptions.length})</label>
                  <div className="flex flex-col gap-2">
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={opt} onChange={e=>{const n=[...pollOptions];n[i]=e.target.value;setPollOptions(n);}}
                          placeholder={`Opcja ${i+1}`} className={`flex-1 ${gi} rounded-xl px-4 py-2 text-sm`}/>
                        {pollOptions.length > 2 && (
                          <button onClick={()=>setPollOptions(p=>p.filter((_,j)=>j!==i))}
                            className="w-7 h-7 text-rose-400 hover:bg-rose-500/10 rounded-lg flex items-center justify-center transition-colors">
                            <X size={12}/>
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 10 && (
                      <button onClick={()=>setPollOptions(p=>[...p,''])}
                        className={`text-xs ${gb} px-3 py-2 rounded-xl flex items-center gap-1.5`}>
                        <Plus size={11}/> Dodaj opcję
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm text-white font-medium">Wielokrotny wybór</p>
                    <p className="text-xs text-zinc-600">Pozwól głosować na więcej niż jedną opcję</p>
                  </div>
                  <button onClick={()=>setPollMulti(p=>!p)}
                    className={`w-10 h-5 rounded-full transition-all shrink-0 relative ${pollMulti ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
                    <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200"
                      style={{left: pollMulti ? 'calc(100% - 1.125rem)' : '0.125rem'}}/>
                  </button>
                </div>
                <button
                  disabled={!pollQuestion.trim() || pollOptions.filter(o=>o.trim()).length < 2}
                  onClick={async () => {
                    const opts = pollOptions.filter(o=>o.trim()).map(text=>({id: Math.random().toString(36).slice(2), text}));
                    try {
                      const poll = await pollsApi.create({
                        question: pollQuestion.trim(),
                        options: opts,
                        multi_vote: pollMulti,
                      });
                      setPolls(p => new Map(p).set(poll.id, poll));
                      // Send a message with poll reference
                      const content = `[POLL:${poll.id}] ${pollQuestion.trim()}`;
                      if (activeView === 'dms' && activeDmUserId) await dmsApi.send(activeDmUserId, content, {});
                      else if (activeChannel) await messagesApi.send(activeChannel, content, {});
                      setPollModal({open:false});
                    } catch (err: any) { addToast(err?.message || 'Błąd tworzenia ankiety', 'error'); }
                  }}
                  className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                  Utwórz ankietę
                </button>
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
                {chForm.is_private&&(
                  <div><label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2 block">Dostęp dla ról</label>
                    {roles.length===0 ? (
                      <p className="text-xs text-zinc-600 italic">Brak ról — utwórz role w ustawieniach serwera.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {roles.map(r=>{
                          const sel=chForm.role_ids.includes(r.id);
                          return <button key={r.id} onClick={()=>setChForm(p=>({...p,role_ids:sel?p.role_ids.filter(id=>id!==r.id):[...p.role_ids,r.id]}))}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${sel?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:r.color}}/>{r.name}
                            {sel&&<Check size={13} className="ml-auto text-indigo-400"/>}
                          </button>;
                        })}
                      </div>
                    )}
                  </div>
                )}
                {editingCh.type==='text'&&(
                  <div>
                    <label className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 block">Tryb wolny</label>
                    <select value={chForm.slowmode_seconds} onChange={e=>setChForm(p=>({...p,slowmode_seconds:parseInt(e.target.value)||0}))}
                      className={`w-full ${gi} rounded-xl px-4 py-2.5 text-sm`}>
                      <option value="0">Wyłączony</option>
                      <option value="5">5 sekund</option>
                      <option value="10">10 sekund</option>
                      <option value="30">30 sekund</option>
                      <option value="60">1 minuta</option>
                      <option value="300">5 minut</option>
                      <option value="600">10 minut</option>
                      <option value="3600">1 godzina</option>
                      <option value="21600">6 godzin</option>
                    </select>
                    {chForm.slowmode_seconds>0&&<p className="text-[11px] text-zinc-600 mt-1">Użytkownicy mogą wysyłać wiadomość co {chForm.slowmode_seconds<60?`${chForm.slowmode_seconds}s`:chForm.slowmode_seconds<3600?`${chForm.slowmode_seconds/60} min`:`${chForm.slowmode_seconds/3600} godz`}</p>}
                  </div>
                )}
                <button onClick={handleSaveCh} className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl transition-colors">Zapisz</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Channel (Discord-style) ─────────────────────────── */}
      <AnimatePresence>
        {chCreateOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setChCreateOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} p-7 w-full max-w-md`}>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-white">Utwórz kanał</h2>
                <button onClick={()=>setChCreateOpen(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={17}/></button>
              </div>
              <p className="text-[12px] text-zinc-500 mb-5">
                {chCreateCatId ? `W kategorii: ${serverFull?.categories.find(c=>c.id===chCreateCatId)?.name||''}` : 'Bez kategorii'}
              </p>

              {/* Channel type list */}
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Rodzaj kanału</p>
              <div className="flex flex-col gap-1.5 mb-5">
                {([
                  { type:'text',         icon:<Hash size={18}/>,         label:'Tekstowy',    desc:'Przesyłaj wiadomości, obrazy i emoji' },
                  { type:'voice',        icon:<Volume2 size={18}/>,      label:'Głosowy',     desc:'Rozmawiaj na żywo głosem i wideo' },
                  { type:'forum',        icon:<MessageSquare size={18}/>,label:'Forum',       desc:'Wątki dyskusyjne i zorganizowane tematy' },
                  { type:'announcement', icon:<Bell size={18}/>,         label:'Ogłoszenia',  desc:'Ważne aktualizacje dla użytkowników' },
                ] as const).map(({ type, icon, label, desc }) => (
                  <button key={type} onClick={()=>setNewChType(type as any)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all text-left ${
                      newChType===type
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
                    }`}>
                    <span className={newChType===type?'text-indigo-400':'text-zinc-500'}>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <p className="text-xs text-zinc-500 leading-tight mt-0.5">{desc}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${newChType===type?'border-indigo-500 bg-indigo-500':'border-zinc-600'}`}>
                      {newChType===type&&<div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Name */}
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nazwa kanału</p>
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                  {newChType==='voice'?<Volume2 size={14}/>:newChType==='forum'?<MessageSquare size={14}/>:newChType==='announcement'?<Megaphone size={14}/>:<Hash size={16}/>}
                </span>
                <input autoFocus value={newChName}
                  onChange={e=>setNewChName(e.target.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,''))}
                  onKeyDown={e=>e.key==='Enter'&&handleCreateCh()}
                  placeholder={newChType==='voice'?'pokoj-glosowy':newChType==='forum'?'dyskusje':newChType==='announcement'?'ogloszenia':'ogolny'}
                  className={`w-full ${gi} pl-8 pr-4 py-2.5 text-sm`}/>
              </div>

              {/* Private toggle */}
              <button onClick={()=>{setNewChPrivate(p=>!p);setNewChRoles([]);}}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${newChPrivate?'bg-indigo-500/10 border-indigo-500/30':'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'} ${newChPrivate?'mb-3':'mb-5'}`}>
                <div className="flex items-center gap-3">
                  <Lock size={15} className={newChPrivate?'text-indigo-400':'text-zinc-500'}/>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">Kanał prywatny</p>
                    <p className="text-xs text-zinc-500">Tylko wybrani członkowie mogą go zobaczyć</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-all relative ${newChPrivate?'bg-indigo-500':'bg-zinc-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${newChPrivate?'left-5':'left-1'}`}/>
                </div>
              </button>
              {newChPrivate&&(
                <div className="mb-5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Dostęp dla ról</p>
                  {roles.length===0 ? (
                    <p className="text-xs text-zinc-600 italic px-1">Brak ról na serwerze. Utwórz role w ustawieniach serwera, aby przypisać dostęp.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {roles.map(r=>{
                        const sel=newChRoles.includes(r.id);
                        return <button key={r.id} onClick={()=>setNewChRoles(p=>sel?p.filter(id=>id!==r.id):[...p,r.id])}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${sel?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:r.color}}/>{r.name}
                          {sel&&<Check size={13} className="ml-auto text-indigo-400"/>}
                        </button>;
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={()=>setChCreateOpen(false)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${gb} transition-all`}>Anuluj</button>
                <button onClick={handleCreateCh} disabled={!newChName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all">
                  Utwórz kanał
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Category ──────────────────────────────────────────── */}
      <AnimatePresence>
        {catCreateOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setCatCreateOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} p-7 w-full max-w-sm`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Utwórz kategorię</h2>
                <button onClick={()=>setCatCreateOpen(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={17}/></button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nazwa kategorii</p>
                  <input autoFocus value={newCatName}
                    onChange={e=>setNewCatName(e.target.value.toUpperCase())}
                    onKeyDown={e=>e.key==='Enter'&&handleCreateCat()}
                    placeholder="NOWA KATEGORIA"
                    className={`w-full ${gi} px-4 py-2.5 text-sm tracking-wide`}/>
                </div>
                <button onClick={()=>{setNewCatPrivate(p=>!p);setNewCatRoles([]);}}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${newCatPrivate?'bg-indigo-500/10 border-indigo-500/30':'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}>
                  <div className="flex items-center gap-3">
                    <Lock size={15} className={newCatPrivate?'text-indigo-400':'text-zinc-500'}/>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">Kategoria prywatna</p>
                      <p className="text-xs text-zinc-500">Tylko wybrani mają dostęp</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-all relative ${newCatPrivate?'bg-indigo-500':'bg-zinc-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${newCatPrivate?'left-5':'left-1'}`}/>
                  </div>
                </button>
                {newCatPrivate&&(
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Dostęp dla ról</p>
                    {roles.length===0 ? (
                      <p className="text-xs text-zinc-600 italic px-1">Brak ról na serwerze. Utwórz role w ustawieniach serwera, aby przypisać dostęp.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {roles.map(r=>{
                          const sel=newCatRoles.includes(r.id);
                          return <button key={r.id} onClick={()=>setNewCatRoles(p=>sel?p.filter(id=>id!==r.id):[...p,r.id])}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${sel?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:r.color}}/>{r.name}
                            {sel&&<Check size={13} className="ml-auto text-indigo-400"/>}
                          </button>;
                        })}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={()=>setCatCreateOpen(false)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${gb} transition-all`}>Anuluj</button>
                  <button onClick={handleCreateCat} disabled={!newCatName.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all">
                    Utwórz kategorię
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Invite Friends ────────────────────────────────────────────── */}
      <AnimatePresence>
        {inviteFriendsOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={()=>setInviteFriendsOpen(false)}>
            <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
              onClick={e=>e.stopPropagation()} className={`${gm} p-7 w-full max-w-md`}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-lg font-bold text-white">Zaproś znajomych</h2>
                  <p className="text-[12px] text-zinc-500 mt-0.5">na serwer <span className="text-zinc-300 font-semibold">{serverFull?.name}</span></p>
                </div>
                <button onClick={()=>setInviteFriendsOpen(false)} className="text-zinc-600 hover:text-white transition-colors"><X size={17}/></button>
              </div>

              {/* Copy link */}
              {inviteFriendsCode&&(
                <div className="flex items-center gap-2 mt-4 mb-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3">
                  <Globe size={14} className="text-zinc-500 shrink-0"/>
                  <code className="flex-1 text-xs text-zinc-300 truncate font-mono">
                    {window.location.origin}/join/{inviteFriendsCode}
                  </code>
                  <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/join/${inviteFriendsCode}`);addToast('Link skopiowany!','success');}}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-indigo-500/10">
                    Kopiuj link
                  </button>
                </div>
              )}

              {/* Friends list */}
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Znajomi — {friends.filter(f=>f.status!=='offline').length} online</p>
              <div className="flex flex-col gap-1 max-h-72 overflow-y-auto custom-scrollbar">
                {friends.length === 0 && (
                  <p className="text-sm text-zinc-600 text-center py-6">Brak znajomych do zaproszenia</p>
                )}
                {/* Online first, then offline */}
                {[...friends].sort((a,b)=>{
                  const onlineA = a.status!=='offline'; const onlineB = b.status!=='offline';
                  return onlineA===onlineB ? 0 : onlineA ? -1 : 1;
                }).map(f=>(
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.04] transition-colors">
                    <div className="relative shrink-0">
                      <img src={ava(f)} className={`w-9 h-9 rounded-xl object-cover av-sc-xs ${f.status==='offline'?'opacity-40':''}`} alt=""/>
                      <StatusBadge status={f.status} size={10} className="absolute -bottom-0.5 -right-0.5"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${f.status==='offline'?'text-zinc-500':'text-white'}`}>{f.username}</p>
                      <p className="text-xs text-zinc-600 capitalize">{f.status==='online'?'Dostępny':f.status==='idle'?'Zaraz wracam':f.status==='dnd'?'Nie przeszkadzać':'Offline'}</p>
                    </div>
                    <button onClick={()=>handleInviteFriend(f.id, f.username)}
                      disabled={inviteSending===f.id}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/25 hover:text-indigo-200 disabled:opacity-50 transition-all flex items-center gap-1.5">
                      {inviteSending===f.id?<Loader2 size={11} className="animate-spin"/>:<UserPlus size={11}/>}
                      {inviteSending===f.id?'Wysyłam...':'Zaproś'}
                    </button>
                  </div>
                ))}
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
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${chk?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                        <div className="flex items-start gap-2 min-w-0">
                          <Shield size={13} className={`mt-0.5 shrink-0 ${chk?'text-indigo-400':'text-zinc-600'}`}/>
                          <div className="min-w-0">
                            <p className="font-medium leading-tight">{perm.label}</p>
                            {perm.desc&&<p className="text-[10px] text-zinc-600 leading-tight mt-0.5 truncate">{perm.desc}</p>}
                          </div>
                        </div>
                        {chk&&<Check size={13} className="text-indigo-400 shrink-0"/>}
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

              {/* Responsive: flex-col on mobile (tab bar on top), flex-row on sm+ (sidebar) */}
              <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
                {/* Sidebar / Tab bar */}
                <div className="sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r border-white/[0.06] p-2 sm:p-3 flex sm:flex-col flex-row gap-0.5 overflow-x-auto scrollbar-hide">
                  {([
                    {id:'account',label:'Konto',icon:<Users size={14}/>},
                    {id:'appearance',label:'Wygląd',icon:<Image size={14}/>},
                    {id:'devices',label:'Urządzenia',icon:<Mic size={14}/>},
                    {id:'privacy',label:'Prywatność',icon:<Shield size={14}/>},
                  ] as const).map(t=>(
                    <button key={t.id} onClick={()=>setAppSettTab(t.id)}
                      className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all text-left shrink-0 ${
                        appSettTab===t.id?'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20':'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'}`}>
                      <span className={appSettTab===t.id?'text-indigo-400':'text-zinc-600'}>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                  {/* Logout — at end of tab bar on mobile, bottom of sidebar on desktop */}
                  <div className="sm:mt-auto sm:pt-3 sm:border-t border-white/[0.06] ml-auto sm:ml-0 shrink-0">
                    <button onClick={()=>{setAppSettOpen(false);auth.logout().then(()=>{clearToken();setIsAuthenticated(false);setCurrentUser(null);}).catch(()=>{clearToken();setIsAuthenticated(false);setCurrentUser(null);});}}
                      className="flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all w-full shrink-0">
                      <LogOut size={14}/> <span className="sm:inline hidden">Wyloguj</span><span className="sm:hidden">Wyloguj</span>
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
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
                            {key:'indigo',  label:'Indigo',     cls:'bg-indigo-500'},
                            {key:'violet',  label:'Fioletowy',  cls:'bg-violet-500'},
                            {key:'pink',    label:'Różowy',     cls:'bg-pink-500'},
                            {key:'blue',    label:'Niebieski',  cls:'bg-blue-500'},
                            {key:'emerald', label:'Zielony',    cls:'bg-emerald-500'},
                            {key:'teal',    label:'Morski',     cls:'bg-teal-500'},
                            {key:'cyan',    label:'Cyjan',      cls:'bg-cyan-500'},
                            {key:'amber',   label:'Bursztynowy',cls:'bg-amber-500'},
                            {key:'orange',  label:'Pomarańcz', cls:'bg-orange-500'},
                            {key:'rose',    label:'Karmazyn',  cls:'bg-rose-500'},
                          ] as const).map(c=>(
                            <button key={c.key} onClick={()=>saveAccentColor(c.key)}
                              title={c.label}
                              className={`h-10 rounded-xl ${c.cls} border-2 transition-all hover:scale-105 flex items-center justify-center ${accentColor===c.key?'border-white scale-105':'border-transparent'}`}>
                              {accentColor===c.key&&<Check size={14} className="text-white"/>}
                            </button>
                          ))}
                        </div>
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
                                <p className="text-xs text-zinc-600 mt-0.5">{opt.desc}</p>
                              </div>
                              {compactMessages===opt.key&&<Check size={13} className="text-indigo-400 shrink-0"/>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Font size */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 block font-bold">Rozmiar czcionki</label>
                        <div className="flex gap-2">
                          {([
                            {key:'small',  label:'Mała',    sample:'Aa'},
                            {key:'normal', label:'Normalna', sample:'Aa'},
                            {key:'large',  label:'Duża',    sample:'Aa'},
                          ] as const).map(opt=>(
                            <button key={opt.key} onClick={()=>saveFontSize(opt.key)}
                              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm transition-all ${fontSize===opt.key?'bg-indigo-500/10 border-indigo-500/30 text-white':'bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:text-zinc-300'}`}>
                              <span className={`font-bold ${opt.key==='small'?'text-sm':opt.key==='large'?'text-xl':'text-base'}`}>{opt.sample}</span>
                              <span className="text-[10px]">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Toggle options */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 block font-bold">Opcje wyświetlania</label>
                        {([
                          {
                            key: 'show_timestamps' as const,
                            label: 'Zawsze pokazuj sygnatury czasowe',
                            desc: 'Godzina przy każdej wiadomości widoczna bez najechania',
                            value: alwaysShowTimestamps,
                          },
                          {
                            key: 'show_chat_avatars' as const,
                            label: 'Pokaż awatary w czacie',
                            desc: 'Zdjęcia profilowe obok wiadomości na kanałach',
                            value: showChatAvatars,
                          },
                          {
                            key: 'message_animations' as const,
                            label: 'Animacje wiadomości',
                            desc: 'Płynne pojawianie się nowych wiadomości',
                            value: messageAnimations,
                          },
                          {
                            key: 'show_link_previews' as const,
                            label: 'Podgląd linków',
                            desc: 'Pokazuj miniatury i opisy dla wklejonych adresów URL',
                            value: showLinkPreviews,
                          },
                        ]).map(opt=>(
                          <div key={opt.key} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-3 hover:border-white/[0.09] transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-sm font-medium text-white">{opt.label}</p>
                              <p className="text-xs text-zinc-600 mt-0.5">{opt.desc}</p>
                            </div>
                            <button onClick={()=>saveTogglePref(opt.key,!opt.value)}
                              className={`w-11 h-6 rounded-full transition-all shrink-0 relative ${opt.value?'bg-indigo-500':'bg-zinc-700'}`}>
                              <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"
                                style={{left: opt.value ? 'calc(100% - 1.375rem)' : '0.125rem'}}/>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Streamer mode */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 block font-bold">Tryb Streamera</label>
                        <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-2xl px-4 py-3 hover:border-white/[0.09] transition-colors">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-sm font-medium text-white">Tryb Streamera</p>
                            <p className="text-xs text-zinc-600 mt-0.5">Ukrywa Twoje dane — nickname, avatar i linki zaproszeń są maskowane podczas streamów</p>
                          </div>
                          <button onClick={() => setStreamerMode(p => !p)}
                            className={`w-11 h-6 rounded-full transition-all shrink-0 relative ${streamerMode ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
                            <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200"
                              style={{left: streamerMode ? 'calc(100% - 1.375rem)' : '0.125rem'}}/>
                          </button>
                        </div>
                      </div>

                      {/* Avatar effects */}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 block font-bold">Efekty avatara</label>
                        {/* Live preview */}
                        <div className="flex items-center gap-4 mb-4 p-3 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                          <div className="relative av-frozen shrink-0" style={{'--av-url':`url("${currentUser?ava(currentUser):''}")`} as React.CSSProperties}>
                            <img src={currentUser?ava(currentUser):''} className={`w-14 h-14 rounded-2xl object-cover av-eff-${avatarEffect}`} alt="podgląd"/>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{AVATAR_EFFECTS.find(e=>e.key===avatarEffect)?.label ?? 'Brak efektu'}</p>
                            <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{AVATAR_EFFECTS.find(e=>e.key===avatarEffect)?.desc}</p>
                          </div>
                        </div>
                        {/* Effect picker */}
                        <div className="grid grid-cols-5 gap-2">
                          {AVATAR_EFFECTS.map(ef=>(
                            <button key={ef.key} onClick={()=>saveAvatarEffect(ef.key)}
                              title={ef.label}
                              className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${avatarEffect===ef.key?'border-indigo-500/70 bg-indigo-500/10':'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                              <div className="relative av-frozen" style={{'--av-url':`url("${currentUser?ava(currentUser):''}")`} as React.CSSProperties}>
                                <img src={currentUser?ava(currentUser):''} className={`w-9 h-9 rounded-xl object-cover av-eff-${ef.key}`} alt=""/>
                              </div>
                              <span className="text-[9px] text-zinc-400 font-medium leading-tight text-center">{ef.label}</span>
                              {avatarEffect===ef.key&&<span className="absolute top-1 right-1 w-3 h-3 bg-indigo-500 rounded-full flex items-center justify-center"><Check size={7} className="text-white"/></span>}
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
                        {key:'privacy_status_visible',     label:'Status widoczny dla innych',       desc:'Inni widzą czy jesteś online/offline/zaraz wracam'},
                        {key:'privacy_typing_visible',     label:'Podgląd "pisze..."',                desc:'Inni widzą animację gdy piszesz wiadomość'},
                        {key:'privacy_read_receipts',      label:'Potwierdzenia odczytu',             desc:'Nadawca widzi że przeczytałeś wiadomość prywatną'},
                        {key:'privacy_friend_requests',    label:'Zaproszenia od nieznajomych',       desc:'Osoby spoza twoich serwerów mogą cię zaprosić'},
                        {key:'privacy_dm_from_strangers',  label:'Wiadomości prywatne od obcych',    desc:'Osoby niebędące Twoimi znajomymi mogą pisać do Ciebie w DM'},
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
                      {/* ── 2FA SECTION ── */}
                      <div className="mt-1 p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldCheck size={16} className="text-indigo-400"/>
                          <h4 className="text-sm font-bold text-white">Weryfikacja dwuetapowa (2FA)</h4>
                          {twoFaStatus?.totp_enabled && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">WŁĄCZONE</span>
                          )}
                        </div>
                        {twoFaStatus?.totp_enabled ? (
                          <div className="flex flex-col gap-2.5">
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              2FA jest aktywne. Przy logowaniu wymagany będzie kod z aplikacji authenticator (Google Authenticator, Authy).
                              Masz <span className="text-white font-semibold">{twoFaStatus.backup_codes_count}</span> kodów zapasowych.
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={async()=>{
                                  setTwoFaInputCode(''); setTwoFaPassword(''); setTwoFaError('');
                                  setTwoFaModal('regen');
                                }}
                                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-all">
                                Regeneruj kody zapasowe
                              </button>
                              <button
                                onClick={()=>{ setTwoFaInputCode(''); setTwoFaPassword(''); setTwoFaError(''); setTwoFaModal('disable'); }}
                                className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 px-3 py-1.5 rounded-lg transition-all">
                                Wyłącz 2FA
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2.5">
                            <p className="text-xs text-zinc-500 leading-relaxed">
                              Zabezpiecz konto drugim składnikiem uwierzytelniania. Po włączeniu, przy każdym logowaniu będziesz musieć podać kod z aplikacji authenticator.
                            </p>
                            <button
                              onClick={async()=>{
                                setTwoFaLoading(true); setTwoFaError('');
                                try {
                                  const data = await twoFactorApi.totpSetup();
                                  setTwoFaSetupData(data);
                                  setTwoFaInputCode('');
                                  setTwoFaModal('setup');
                                } catch(e:any) { setTwoFaError(e?.message || 'Błąd'); }
                                finally { setTwoFaLoading(false); }
                              }}
                              disabled={twoFaLoading}
                              className="self-start text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 border border-indigo-500/30 px-4 py-2 rounded-xl transition-all flex items-center gap-2">
                              {twoFaLoading ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>}
                              Włącz weryfikację dwuetapową
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── PUSH NOTIFICATIONS ── */}
                      <div className="p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Bell size={15} className="text-indigo-400"/>
                          <h4 className="text-sm font-bold text-white">Powiadomienia Push</h4>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                          Otrzymuj powiadomienia push o nowych wiadomościach nawet gdy aplikacja jest w tle lub zamknięta.
                        </p>
                        <button onClick={async () => {
                          if (!('Notification' in window) || !('serviceWorker' in navigator)) {
                            addToast('Twoja przeglądarka nie obsługuje powiadomień push', 'error');
                            return;
                          }
                          const perm = await Notification.requestPermission();
                          if (perm !== 'granted') {
                            addToast('Brak zgody na powiadomienia', 'error');
                            return;
                          }
                          try {
                            const reg = await navigator.serviceWorker.ready;
                            // Use public VAPID key (demo — replace with real key in production)
                            const sub = await reg.pushManager.subscribe({
                              userVisibleOnly: true,
                              applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZEkIbPV3Jo8VrHH16NInS95-qPs',
                            }).catch(() => null);
                            if (!sub) throw new Error('Subskrypcja nieudana');
                            await pushApi.subscribe(sub);
                            addToast('Powiadomienia push włączone!', 'success');
                          } catch (e: any) {
                            addToast(e?.message || 'Błąd aktywacji push', 'error');
                          }
                        }}
                          className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 px-4 py-2 rounded-xl transition-all flex items-center gap-2">
                          <Bell size={13}/> Włącz powiadomienia push
                        </button>
                      </div>

                      <div className="mt-2 p-4 bg-rose-500/5 border border-rose-500/15 rounded-2xl">
                        <h4 className="text-sm font-bold text-rose-400 mb-1">Strefa zagrożenia</h4>
                        <p className="text-xs text-zinc-500 mb-3">Trwałe akcje których nie można cofnąć</p>
                        <button onClick={()=>setDeleteStep('confirm')}
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

      {/* ── ACCOUNT DELETION MODALS ─────────────────────────────────────── */}
      <AnimatePresence>
        {deleteStep === 'confirm' && (
          <motion.div key="del-confirm-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={()=>setDeleteStep(null)}>
            <motion.div key="del-confirm-card" initial={{opacity:0,scale:0.92,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:8}} transition={{type:'spring',stiffness:380,damping:28}}
              className="bg-[#141420] border border-rose-500/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-rose-400"/>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Usuń konto</h3>
                  <p className="text-xs text-zinc-500">Ta akcja jest nieodwracalna</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                Na pewno chcesz <span className="text-rose-400 font-semibold">trwale usunąć</span> swoje konto? Wszystkie wiadomości, serwery i dane zostaną usunięte bezpowrotnie.
              </p>
              <div className="flex gap-3">
                <button onClick={()=>setDeleteStep(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] transition-all">
                  Anuluj
                </button>
                <button
                  disabled={deleteLoading}
                  onClick={async()=>{
                    setDeleteLoading(true);
                    try {
                      await users.requestDeletion();
                      setDeleteStep('code');
                      setDeleteCode('');
                    } catch(e:any) {
                      addToast(e?.message || 'Nie udało się wysłać kodu','error');
                      setDeleteStep(null);
                    } finally { setDeleteLoading(false); }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {deleteLoading ? <Loader2 size={15} className="animate-spin"/> : <Trash2 size={15}/>}
                  Tak, usuń
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {deleteStep === 'code' && (
          <motion.div key="del-code-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={()=>{setDeleteStep(null);setDeleteCode('');}}>
            <motion.div key="del-code-card" initial={{opacity:0,scale:0.92,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:8}} transition={{type:'spring',stiffness:380,damping:28}}
              className="bg-[#141420] border border-rose-500/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-rose-400"/>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Potwierdź kodem</h3>
                  <p className="text-xs text-zinc-500">Sprawdź swoją skrzynkę e-mail</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                Wysłaliśmy 7-znakowy kod potwierdzający na Twój adres e-mail. Wklej go poniżej, aby potwierdzić usunięcie konta.
              </p>
              <input
                autoFocus
                value={deleteCode}
                onChange={e=>setDeleteCode(e.target.value)}
                onKeyDown={async e=>{
                  if(e.key==='Enter' && deleteCode.trim()) {
                    e.preventDefault();
                    setDeleteLoading(true);
                    try {
                      await users.confirmDeletion(deleteCode.trim());
                      disconnectSocket();
                      clearToken();
                      setIsAuthenticated(false);
                      setCurrentUser(null);
                      setDeleteStep(null);
                      setDeleteCode('');
                      addToast('Konto zostało usunięte','success');
                    } catch(err:any) {
                      addToast(err?.message||'Nieprawidłowy kod','error');
                    } finally { setDeleteLoading(false); }
                  }
                }}
                placeholder="np. AB-CDE-FGH"
                className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-lg font-mono tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 mb-5 transition-colors"
              />
              <div className="flex gap-3">
                <button onClick={()=>{setDeleteStep(null);setDeleteCode('');}}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] transition-all">
                  Anuluj
                </button>
                <button
                  disabled={deleteLoading || !deleteCode.trim()}
                  onClick={async()=>{
                    setDeleteLoading(true);
                    try {
                      await users.confirmDeletion(deleteCode.trim());
                      disconnectSocket();
                      clearToken();
                      setIsAuthenticated(false);
                      setCurrentUser(null);
                      setDeleteStep(null);
                      setDeleteCode('');
                      addToast('Konto zostało usunięte','success');
                    } catch(err:any) {
                      addToast(err?.message||'Nieprawidłowy kod','error');
                    } finally { setDeleteLoading(false); }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {deleteLoading ? <Loader2 size={15} className="animate-spin"/> : <Trash2 size={15}/>}
                  Usuń konto
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2FA MODALS ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {/* Setup modal: show QR code + manual key, user enters code to confirm */}
        {twoFaModal === 'setup' && twoFaSetupData && (
          <motion.div key="2fa-setup-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={()=>setTwoFaModal(null)}>
            <motion.div key="2fa-setup-card" initial={{opacity:0,scale:0.92,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:8}}
              transition={{type:'spring',stiffness:380,damping:28}}
              className="bg-[#141420] border border-indigo-500/25 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-indigo-400"/>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Konfiguracja 2FA</h3>
                  <p className="text-xs text-zinc-500">Skanuj kod QR aplikacją authenticator</p>
                </div>
              </div>
              <div className="flex justify-center mb-4">
                <div className="bg-white rounded-xl p-3">
                  <img src={twoFaSetupData.qr_code} alt="QR code 2FA" className="w-44 h-44"/>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-1.5">Jeśli nie możesz zeskanować, wprowadź klucz ręcznie:</p>
                <div className="flex items-center gap-2 bg-black/30 border border-white/[0.07] rounded-xl px-3 py-2">
                  <code className="text-xs text-indigo-300 font-mono flex-1 break-all">{twoFaSetupData.manual_key}</code>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-3">Po skonfigurowaniu aplikacji, wpisz wygenerowany 6-cyfrowy kod:</p>
              <input
                autoFocus
                value={twoFaInputCode}
                onChange={e=>setTwoFaInputCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                className={`w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-[0.4em] placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 mb-1 transition-colors`}
              />
              {twoFaError && <p className="text-xs text-rose-400 mt-1.5 mb-2">{twoFaError}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={()=>{ setTwoFaModal(null); setTwoFaError(''); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] transition-all">
                  Anuluj
                </button>
                <button
                  disabled={twoFaLoading || twoFaInputCode.length < 6}
                  onClick={async()=>{
                    setTwoFaLoading(true); setTwoFaError('');
                    try {
                      const { backup_codes } = await twoFactorApi.totpEnable(twoFaInputCode);
                      setTwoFaBackupCodes(backup_codes);
                      setTwoFaStatus(s => s ? { ...s, totp_enabled: true, backup_codes_count: backup_codes.length } : null);
                      setTwoFaModal('backup_codes');
                    } catch(e:any) { setTwoFaError(e?.message || 'Nieprawidłowy kod'); }
                    finally { setTwoFaLoading(false); }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {twoFaLoading ? <Loader2 size={15} className="animate-spin"/> : <Check size={15}/>}
                  Aktywuj 2FA
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Backup codes modal */}
        {twoFaModal === 'backup_codes' && (
          <motion.div key="2fa-backup-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={()=>setTwoFaModal(null)}>
            <motion.div key="2fa-backup-card" initial={{opacity:0,scale:0.92,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:8}}
              transition={{type:'spring',stiffness:380,damping:28}}
              className="bg-[#141420] border border-emerald-500/25 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-emerald-400"/>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">2FA aktywowane!</h3>
                  <p className="text-xs text-zinc-500">Zapisz kody zapasowe w bezpiecznym miejscu</p>
                </div>
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4 mt-3">
                <p className="text-xs text-amber-400 font-semibold">⚠️ Każdy kod można użyć tylko raz. Przechowuj je poza aplikacją.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {twoFaBackupCodes.map((c,i)=>(
                  <code key={i} className="text-center font-mono text-sm text-white bg-black/30 border border-white/[0.07] rounded-lg px-3 py-2">{c}</code>
                ))}
              </div>
              <button
                onClick={()=>{
                  const text = twoFaBackupCodes.join('\n');
                  navigator.clipboard?.writeText(text).catch(()=>{});
                }}
                className="w-full py-2 mb-3 rounded-xl text-sm font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 transition-all">
                Kopiuj wszystkie kody
              </button>
              <button onClick={()=>setTwoFaModal(null)}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">
                Gotowe, zapisałem kody
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* Disable 2FA modal */}
        {twoFaModal === 'disable' && (
          <motion.div key="2fa-disable-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={()=>setTwoFaModal(null)}>
            <motion.div key="2fa-disable-card" initial={{opacity:0,scale:0.92,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:8}}
              transition={{type:'spring',stiffness:380,damping:28}}
              className="bg-[#141420] border border-rose-500/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
                  <Shield size={18} className="text-rose-400"/>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Wyłącz 2FA</h3>
                  <p className="text-xs text-zinc-500">Potwierdź hasłem i kodem authenticator</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  value={twoFaPassword}
                  onChange={e=>setTwoFaPassword(e.target.value)}
                  placeholder="Hasło do konta"
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 transition-colors"
                />
                <input
                  value={twoFaInputCode}
                  onChange={e=>setTwoFaInputCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-xl font-mono tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 transition-colors"
                />
                {twoFaError && <p className="text-xs text-rose-400">{twoFaError}</p>}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={()=>{setTwoFaModal(null);setTwoFaError('');}}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] transition-all">
                  Anuluj
                </button>
                <button
                  disabled={twoFaLoading || !twoFaPassword || twoFaInputCode.length < 6}
                  onClick={async()=>{
                    setTwoFaLoading(true); setTwoFaError('');
                    try {
                      await twoFactorApi.totpDisable(twoFaPassword, twoFaInputCode);
                      setTwoFaStatus(s => s ? { ...s, totp_enabled: false, backup_codes_count: 0 } : null);
                      setTwoFaModal(null);
                    } catch(e:any) { setTwoFaError(e?.message || 'Błąd weryfikacji'); }
                    finally { setTwoFaLoading(false); }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {twoFaLoading ? <Loader2 size={15} className="animate-spin"/> : <Shield size={15}/>}
                  Wyłącz 2FA
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Regenerate backup codes modal */}
        {twoFaModal === 'regen' && (
          <motion.div key="2fa-regen-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={()=>setTwoFaModal(null)}>
            <motion.div key="2fa-regen-card" initial={{opacity:0,scale:0.92,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92,y:8}}
              transition={{type:'spring',stiffness:380,damping:28}}
              className="bg-[#141420] border border-indigo-500/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} className="text-indigo-400"/>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Nowe kody zapasowe</h3>
                  <p className="text-xs text-zinc-500">Stare kody zostaną unieważnione</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  type="password"
                  value={twoFaPassword}
                  onChange={e=>setTwoFaPassword(e.target.value)}
                  placeholder="Hasło do konta"
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                <input
                  value={twoFaInputCode}
                  onChange={e=>setTwoFaInputCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="Kod z aplikacji (000000)"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 text-white text-center text-xl font-mono tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                {twoFaError && <p className="text-xs text-rose-400">{twoFaError}</p>}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={()=>{setTwoFaModal(null);setTwoFaError('');}}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] transition-all">
                  Anuluj
                </button>
                <button
                  disabled={twoFaLoading || !twoFaPassword || twoFaInputCode.length < 6}
                  onClick={async()=>{
                    setTwoFaLoading(true); setTwoFaError('');
                    try {
                      const { backup_codes } = await twoFactorApi.regenerateBackupCodes(twoFaPassword, twoFaInputCode);
                      setTwoFaBackupCodes(backup_codes);
                      setTwoFaStatus(s => s ? { ...s, backup_codes_count: backup_codes.length } : null);
                      setTwoFaModal('backup_codes');
                    } catch(e:any) { setTwoFaError(e?.message || 'Błąd weryfikacji'); }
                    finally { setTwoFaLoading(false); }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {twoFaLoading ? <Loader2 size={15} className="animate-spin"/> : <ShieldCheck size={15}/>}
                  Generuj nowe kody
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VOLUME CONTEXT MENU ──────────────────────────────────────────── */}
      {volMenu&&(
        <div className="fixed inset-0 z-[260]" onClick={()=>setVolMenu(null)}>
          <motion.div initial={{opacity:0,scale:0.92}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.92}}
            className="absolute bg-[#18181b] border border-white/[0.08] rounded-2xl shadow-2xl p-4 w-64"
            style={{left:Math.min(volMenu.x,window.innerWidth-270),top:Math.min(volMenu.y,window.innerHeight-220)}}
            onClick={e=>e.stopPropagation()}>
            <p className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-widest truncate">{volMenu.username}</p>
            {/* Mic volume slider */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-zinc-500">Głośność mikrofonu</span>
                <span className="text-xs font-bold text-white">{userVols[volMenu.id]??100}%</span>
              </div>
              <input type="range" min={0} max={200} step={5} value={userVols[volMenu.id]??100}
                onChange={e=>{
                  const v=+e.target.value;
                  setUserVols(p=>({...p,[volMenu.id]:v}));
                  setRemoteVolume(volMenu.id,v);
                  try { localStorage.setItem(`cordyn_vol_${volMenu.id}`, String(v)); } catch {}
                  if(mutedByMe[volMenu.id]&&v>0){setMutedByMe(p=>({...p,[volMenu.id]:false}));muteRemoteUser(volMenu.id,false);}
                }}
                className="w-full accent-indigo-500 cursor-pointer"/>
              <div className="flex justify-between text-[10px] text-zinc-700 mt-0.5"><span>0%</span><span>100%</span><span>200%</span></div>
            </div>
            {/* Stream volume — shown whenever user is (or was recently) streaming */}
            {(screenShareTick >= 0 && remoteScreenStreamsRef.current.has(volMenu.id)) && (
              <div className="mb-3 pt-3 border-t border-white/[0.05]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-500 flex items-center gap-1"><ScreenShare size={11}/> Transmisja</span>
                  <span className="text-xs font-bold text-white">{(streamMutedByMe[volMenu.id]??false) ? '🔇' : `${streamVols[volMenu.id]??100}%`}</span>
                </div>
                <input type="range" min={0} max={100} step={5}
                  value={(streamMutedByMe[volMenu.id]??false) ? 0 : (streamVols[volMenu.id]??100)}
                  onChange={e=>{
                    const v=+e.target.value;
                    setStreamVols(p=>({...p,[volMenu.id]:v}));
                    setRemoteScreenVolume(volMenu.id, v);
                    if (v > 0 && (streamMutedByMe[volMenu.id]??false)) { setStreamMutedByMe(p=>({...p,[volMenu.id]:false})); muteRemoteScreenStream(volMenu.id, false); }
                    if (v === 0) { setStreamMutedByMe(p=>({...p,[volMenu.id]:true})); muteRemoteScreenStream(volMenu.id, true); }
                    try { localStorage.setItem(`cordyn_streamvol_${volMenu.id}`, String(v)); } catch {}
                  }}
                  className="w-full accent-indigo-500 cursor-pointer"/>
                <div className="flex justify-between text-[10px] text-zinc-700 mt-0.5"><span>Cicho</span><span>100%</span></div>
                <button onClick={()=>{
                  const m = !(streamMutedByMe[volMenu.id]??false);
                  setStreamMutedByMe(p=>({...p,[volMenu.id]:m}));
                  muteRemoteScreenStream(volMenu.id, m);
                }} className={`w-full py-2 mt-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${(streamMutedByMe[volMenu.id]??false)?'bg-rose-500/20 text-rose-400 border border-rose-500/30':'bg-white/[0.05] text-zinc-400 hover:text-white border border-white/[0.06]'}`}>
                  <VolumeX size={12}/>{(streamMutedByMe[volMenu.id]??false)?'Włącz transmisję':'Wycisz transmisję'}
                </button>
              </div>
            )}
            {/* Mute toggle */}
            <button onClick={()=>{
              const muted=!(mutedByMe[volMenu.id]??false);
              setMutedByMe(p=>({...p,[volMenu.id]:muted}));
              muteRemoteUser(volMenu.id,muted);
            }} className={`w-full py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${(mutedByMe[volMenu.id]??false)?'bg-rose-500/20 text-rose-400 border border-rose-500/30':'bg-white/[0.05] text-zinc-400 hover:text-white border border-white/[0.06]'}`}>
              <VolumeX size={13}/>{(mutedByMe[volMenu.id]??false)?'Odcisz':'Wycisz dla mnie'}
            </button>
          </motion.div>
        </div>
      )}

      {/* ── ACTIVITY MODAL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showActivityModal&&(
          <motion.div key="act-modal-bg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={()=>setShowActivityModal(false)}>
            <motion.div key="act-modal" initial={{opacity:0,scale:0.93,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.93,y:16}}
              transition={{duration:0.22,ease:[0.16,1,0.3,1]}}
              className="bg-[#18181b] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e=>e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <Activity size={14} className="text-indigo-400"/>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Aktywność serwera</h3>
                    <p className="text-[10px] text-zinc-600">{serverActivity.length} zdarzeń</p>
                  </div>
                </div>
                <button onClick={()=>setShowActivityModal(false)}
                  className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all">
                  <X size={13}/>
                </button>
              </div>
              {/* List */}
              <div className="overflow-y-auto custom-scrollbar max-h-[60vh] p-4 flex flex-col gap-2">
                {serverActivity.map((a,i)=>(
                  <motion.div key={a.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.025}}
                    className="flex items-start gap-2.5 bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-150">
                    {activityIcon(a.type)}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300 leading-snug">{a.text}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{ft(a.time)}</p>
                    </div>
                  </motion.div>
                ))}
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
      <div className="fixed top-4 right-4 z-[200] flex flex-col items-end gap-2.5 pointer-events-none" style={{minWidth:'20rem',maxWidth:'26rem'}}>
        <AnimatePresence>
          {toasts.map(t => {
            const isDm = !!t.avatar || !!t.senderName;
            const toastIcon = t.type==='success'?<CheckCircle2 size={15}/>:t.type==='error'?<AlertCircle size={15}/>:t.type==='warn'?<AlertTriangle size={15}/>:<MessageCircle size={15}/>;
            const toastCls  = t.type==='success'?'bg-emerald-950/90 border-emerald-500/40 text-emerald-100':t.type==='error'?'bg-rose-950/90 border-rose-500/40 text-rose-100':t.type==='warn'?'bg-amber-950/90 border-amber-500/40 text-amber-100':'bg-[#0f0f1e]/95 border-indigo-500/35 text-white';
            const iconCls   = t.type==='success'?'bg-emerald-500/25 text-emerald-400':t.type==='error'?'bg-rose-500/25 text-rose-400':t.type==='warn'?'bg-amber-500/25 text-amber-400':'bg-indigo-500/25 text-indigo-400';
            const isClickable = !!t.onClick && !t.onConfirm;
            return (
              <motion.div key={t.id}
                initial={{opacity:0,x:40,scale:0.93}}
                animate={{opacity:1,x:0,scale:1}}
                exit={{opacity:0,x:32,scale:0.9}}
                transition={{type:'spring',stiffness:380,damping:28}}
                className={`pointer-events-auto w-full rounded-2xl border shadow-2xl shadow-black/60 overflow-hidden ${toastCls} ${isClickable?'cursor-pointer':''}`}
                onClick={isClickable ? ()=>{t.onClick!();rmToast(t.id);} : undefined}>
                {/* DM toast: full-width clickable layout */}
                {isDm ? (
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <div className="relative shrink-0">
                      <img src={t.avatar||`https://api.dicebear.com/7.x/shapes/svg?seed=${t.senderName}`}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/30" alt=""/>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                        <MessageCircle size={8} className="text-white"/>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-indigo-300 mb-0.5">{t.senderName}</p>
                      <p className="text-sm text-zinc-200 leading-snug line-clamp-2 break-words">{t.msg}</p>
                    </div>
                    <button onClick={e=>{e.stopPropagation();rmToast(t.id);}} className="shrink-0 text-zinc-600 hover:text-zinc-300 mt-0.5 transition-colors"><X size={13}/></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${iconCls}`}>{toastIcon}</span>
                    <span className="flex-1 text-sm font-medium leading-snug">{t.msg}</span>
                    {t.onConfirm && <>
                      <button onClick={()=>{t.onConfirm!();rmToast(t.id);}} className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors">Tak</button>
                      <button onClick={()=>rmToast(t.id)} className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 transition-colors">Nie</button>
                    </>}
                    {!t.onConfirm && <button onClick={()=>rmToast(t.id)} className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-opacity"><X size={14}/></button>}
                  </div>
                )}
                {/* Click hint for DM toasts */}
                {isDm && isClickable && (
                  <div className="px-4 pb-2.5 flex items-center gap-1 text-[10px] text-indigo-400/70">
                    <span>Kliknij aby otworzyć rozmowę</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── MINIMIZED CALL WIDGET ────────────────────────────────────────── */}
      <AnimatePresence>
        {activeCall && !showCallPanel && (()=>{
          const miniRemoteScreenEntries = [...remoteScreenStreamsRef.current.entries()];
          const miniScreenStream = activeCall.isScreenSharing && screenStreamRef.current
            ? screenStreamRef.current
            : miniRemoteScreenEntries[0]?.[1] ?? null;
          const hasStream = !!miniScreenStream;
          return (
            <motion.div initial={{opacity:0,scale:0.85,y:24}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.85,y:20}}
              transition={{duration:0.3,ease:[0.16,1,0.3,1]}}
              className={`fixed bottom-6 right-6 z-[150] ${gm} shadow-2xl border-indigo-500/10 overflow-hidden`}>
              {/* Stream preview (shown when someone is streaming) */}
              {hasStream && (
                <div className="relative bg-black cursor-pointer" style={{width:280,height:158}} onClick={()=>setShowCallPanel(true)}>
                  <video
                    ref={el=>{ if(el&&el.srcObject!==miniScreenStream){el.muted=true;el.srcObject=miniScreenStream;el.play().catch(()=>{}); }}}
                    className="w-full h-full object-contain" autoPlay playsInline muted/>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"/>
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                    <ScreenShare size={11} className="text-indigo-400"/>
                    <span className="text-[10px] text-white font-medium">
                      {activeCall.isScreenSharing ? 'Ty' : (miniRemoteScreenEntries[0] ? (activeCall.username || 'Rozmówca') : '')} udostępnia
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-lg flex items-center justify-center">
                    <Maximize2 size={11} className="text-white"/>
                  </div>
                </div>
              )}
              {/* Controls row */}
              <div className="p-3.5 flex items-center gap-3">
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
                    <Maximize2 size={13}/>
                  </button>
                  <button onClick={hangupCall} title="Rozłącz" className="w-8 h-8 rounded-xl bg-rose-500 hover:bg-rose-400 active:scale-90 flex items-center justify-center text-white transition-all shadow-lg shadow-rose-500/30">
                    <PhoneOff size={13}/>
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
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
                stopIncomingRing();
                playCallAccepted();
                // Leave any active voice channel first — only 1 call allowed at a time
                const curCall = activeCallRef.current;
                if (curCall?.channelId) {
                  leaveVoiceChannel(curCall.channelId);
                  playVoiceLeave();
                  if (currentUser) setVoiceUsers(p => ({ ...p, [curCall.channelId!]: (p[curCall.channelId!]||[]).filter(u=>u.id!==currentUser.id) }));
                  cleanupWebRTC();
                  setActiveCall(null); setShowCallPanel(false);
                }
                // Acquire mic before notifying caller — ensures localStreamRef is set when offer arrives
                await acquireMic(selMic || undefined);
                acceptCall(incomingCall.conversation_id, incomingCall.from.id);
                setActiveCall({type: incomingCall.type==='video'?'dm_video':'dm_voice', userId: incomingCall.from.id, username: incomingCall.from.username, avatarUrl: incomingCall.from.avatar_url, isMuted:false,isDeafened:false,isCameraOn:false,isScreenSharing:false});
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

        {/* ── Invite join dialog ───────────────────────────────────── */}
        {inviteDialog && pendingInvite && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[300] p-4">
            <motion.div initial={{scale:0.92,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.92,opacity:0}}
              className="bg-[#16161e] border border-white/[0.08] rounded-2xl p-7 w-full max-w-sm shadow-2xl flex flex-col gap-5">
              {/* Server info */}
              <div className="flex items-center gap-4">
                {pendingInvite.icon_url
                  ? <img src={pendingInvite.icon_url} className="w-14 h-14 rounded-2xl object-cover shrink-0" alt=""/>
                  : <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">{pendingInvite.server_name[0]}</div>
                }
                <div>
                  <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-0.5">Zaproszenie na serwer</p>
                  <p className="text-lg font-black text-white">{pendingInvite.server_name}</p>
                  <p className="text-xs text-zinc-400">od <span className="text-indigo-300 font-semibold">{pendingInvite.creator_username}</span></p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">Czy chcesz dołączyć do serwera <span className="text-white font-semibold">{pendingInvite.server_name}</span>?</p>
              <div className="flex gap-3">
                <button
                  disabled={inviteJoining}
                  onClick={async () => {
                    setInviteJoining(true);
                    try {
                      const s = await serversApi.join(pendingInvite.code);
                      setServerList(p => [...p, s]);
                      setActiveServer(s.id);
                      setActiveView('servers');
                      window.history.replaceState({}, '', '/');
                      addToast(`Dołączono do ${s.name}!`, 'success');
                    } catch (e: any) {
                      addToast(e.message || 'Błąd dołączania', 'error');
                    } finally {
                      setInviteJoining(false);
                      setInviteDialog(false);
                      setPendingInvite(null);
                    }
                  }}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {inviteJoining ? <Loader2 size={14} className="animate-spin"/> : <UserPlus size={14}/>}
                  Dołącz
                </button>
                <button
                  onClick={() => { setInviteDialog(false); setPendingInvite(null); window.history.replaceState({}, '', '/'); }}
                  className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-semibold py-2.5 rounded-xl transition-colors">
                  Nie
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Image Lightbox ──────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxSrc && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}
            className="lightbox-bg" onClick={()=>setLightboxSrc(null)}>
            <motion.img initial={{scale:0.88,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.88,opacity:0}} transition={{duration:0.2,ease:[0.16,1,0.3,1]}}
              src={lightboxSrc} alt="preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              onClick={e=>e.stopPropagation()}/>
            <button onClick={()=>setLightboxSrc(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center text-white transition-colors">
              <X size={18}/>
            </button>
            <a href={lightboxSrc} download target="_blank" rel="noopener noreferrer"
              className="absolute bottom-4 right-4 px-4 py-2 rounded-xl bg-black/50 hover:bg-black/80 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
              onClick={e=>e.stopPropagation()}>
              <Upload size={13}/> Pobierz
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DM Gallery Lightbox ─────────────────────────────────────── */}
      <AnimatePresence>
        {dmGallery && (() => {
          const { items, index } = dmGallery;
          const item = items[index];
          const prev = () => setDmGallery(g => g ? { ...g, index: (g.index - 1 + g.items.length) % g.items.length } : g);
          const next = () => setDmGallery(g => g ? { ...g, index: (g.index + 1) % g.items.length } : g);
          const close = () => setDmGallery(null);
          return (
            <motion.div key="dm-gallery"
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}
              className="fixed inset-0 z-[300] flex items-center justify-center"
              style={{background:'rgba(0,0,0,0.92)',backdropFilter:'blur(20px)'}}
              onClick={close}
              onKeyDown={e => { if(e.key==='Escape') close(); if(e.key==='ArrowLeft') prev(); if(e.key==='ArrowRight') next(); }}
              tabIndex={0}
              ref={(el) => el?.focus()}>

              {/* Media */}
              <AnimatePresence mode="wait">
                <motion.div key={index}
                  initial={{opacity:0, x: 40}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-40}}
                  transition={{duration:0.2, ease:[0.16,1,0.3,1]}}
                  className="flex items-center justify-center max-w-[85vw] max-h-[85vh]"
                  onClick={e=>e.stopPropagation()}>
                  {item.isVideo ? (
                    <video src={item.url} controls autoPlay
                      className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"/>
                  ) : (
                    <img src={item.url} alt=""
                      className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"/>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Close */}
              <button onClick={close}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
                <X size={20}/>
              </button>

              {/* Counter */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-semibold px-4 py-2 rounded-full">
                {index + 1} / {items.length}
              </div>

              {/* Sender + date */}
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 text-white text-xs px-4 py-2 rounded-full"
                onClick={e=>e.stopPropagation()}>
                <span className="text-zinc-400">{item.sender}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">{item.date}</span>
              </div>

              {/* Download */}
              <a href={item.url} download target="_blank" rel="noopener noreferrer"
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors z-10"
                onClick={e=>e.stopPropagation()}>
                <Upload size={13}/> Pobierz
              </a>

              {/* Prev / Next arrows */}
              {items.length > 1 && (<>
                <button onClick={e=>{ e.stopPropagation(); prev(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95">
                  <ChevronLeft size={24}/>
                </button>
                <button onClick={e=>{ e.stopPropagation(); next(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95">
                  <ChevronRight size={24}/>
                </button>
              </>)}

              {/* Thumbnail strip */}
              {items.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-2 bg-black/40 rounded-2xl max-w-[80vw] overflow-x-auto"
                  style={{scrollbarWidth:'none'}} onClick={e=>e.stopPropagation()}>
                  {items.map((it, i) => (
                    <button key={i} onClick={() => setDmGallery(g => g ? {...g, index: i} : g)}
                      className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 transition-all
                        ${i===index ? 'ring-2 ring-indigo-400 scale-110' : 'opacity-50 hover:opacity-80'}`}>
                      {it.isVideo
                        ? <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Film size={14} className="text-white/60"/></div>
                        : <img src={it.url} alt="" className="w-full h-full object-cover"/>
                      }
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Hover card ── */}
      {hoverCard && (
        <HoverCard
          userId={hoverCard.userId}
          x={hoverCard.x}
          y={hoverCard.y}
          currentUserId={currentUser?.id}
          onOpenDm={openDm}
          onCall={(id,un,av,t)=>{ startDmCall(id,un,t,av); hideHoverCard(); }}
          onOpenProfile={(id)=>{ openProfilePage(id); setHoverCard(null); }}
          cache={hoverCardCache}
          activity={userActivities.has(hoverCard.userId) ? userActivities.get(hoverCard.userId)??null : undefined}
          twitchActivity={userTwitchActivities.has(hoverCard.userId) ? userTwitchActivities.get(hoverCard.userId)??null : undefined}
          steamActivity={userSteamActivities.has(hoverCard.userId) ? userSteamActivities.get(hoverCard.userId)??null : undefined}
          steamGameStartedAt={steamGameStartRef.current.get(hoverCard.userId) ?? null}
          onMouseEnter={cancelHideHoverCard}
          onMouseLeave={hideHoverCard}
        />
      )}

    </div>
  );
}
