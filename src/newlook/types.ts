// Fresh, minimal prop surface for the opt-in "Nowy wygląd" shell — deliberately
// NOT a parallel simplified schema (that's what src/cordyn-ui/ did and it left
// gaps like missing reply_to fields). Components here consume the real API
// types from src/api.ts directly and receive already-computed state/handlers
// from App.tsx as props, the same data the classic layout already renders.
import type { RefObject } from 'react';
import type {
  UserProfile, ServerData, ServerFull, ChannelData, ServerMember,
  MessageFull, DmMessageFull, DmConversation, MsgReaction,
} from '../api';

export type ActiveView = 'servers' | 'dms' | 'friends' | 'admin' | 'home';

/** Minimal shape of App.tsx's local `CallState` — that type isn't exported,
 *  and v1 only needs enough to show a compact "in call" indicator (see
 *  ChatColumn's CallBanner) rather than the full call UI. */
export interface CallSummary {
  channelName?: string;
  username?: string;
}

/** Mirrors App.tsx's local `CallState` type (not exported) — used by CallView. */
export interface CallStateLike {
  type: 'voice_channel' | 'dm_voice' | 'dm_video';
  channelId?: string; channelName?: string; serverId?: string;
  userId?: string; username?: string; avatarUrl?: string | null;
  isMuted: boolean; isDeafened: boolean; isCameraOn: boolean; isScreenSharing: boolean;
}

/** Mirrors App.tsx's local `VoiceUser` type (not exported). */
export interface VoiceUserLike {
  id: string; username: string; avatar_url: string | null; status: string;
}

export interface CallViewProps {
  activeCall: CallStateLike;
  currentUser: UserProfile;
  staticUrl: (url: string | null | undefined) => string | null;
  voiceUsers: VoiceUserLike[];
  voiceUserStates: Record<string, { muted: boolean; deafened: boolean }>;
  cameraOnUserIds: Set<string>;
  sharingUserIds: Set<string>;
  cameraStreamRef: RefObject<MediaStream | null>;
  screenStreamRef: RefObject<MediaStream | null>;
  remoteCameraStreamsRef: RefObject<Map<string, MediaStream>>;
  remoteScreenStreamsRef: RefObject<Map<string, MediaStream>>;
  screenShareTick: number;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onHangup: () => void;
  onMinimize: () => void;
}

export interface NewLookShellProps {
  currentUser: UserProfile;
  staticUrl: (url: string | null | undefined) => string;
  renderMsgHTML: (text: string) => string;

  serverList: ServerData[];
  activeServer: string;
  serverFull: ServerFull | null;
  onSelectServer: (id: string) => void;

  activeView: ActiveView;
  onShowDms: () => void;

  allChs: ChannelData[];
  activeChannel: string;
  activeCh: ChannelData | undefined;
  /** Text/announcement/forum channels just switch the active channel; voice
   *  channels actually join the call (mirrors classic's joinVoiceCh) — the
   *  full ChannelData is needed to tell them apart and to read user_limit
   *  etc., not just the id. */
  onSelectChannel: (ch: ChannelData) => void;

  dmConvs: DmConversation[];
  activeDmUserId: string;
  unreadDms: Record<string, number>;
  onSelectDm: (userId: string) => void;

  channelMsgs: MessageFull[];
  dmMsgs: DmMessageFull[];

  members: ServerMember[];

  msgInput: string;
  setMsgInput: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  sending: boolean;

  onToggleReaction: (msgId: string, emoji: string, evt?: React.MouseEvent) => void;
  onDeleteMessage: (msg: MessageFull | DmMessageFull) => void;
  onEditMessage: (msg: MessageFull | DmMessageFull, content: string) => void;
  onPinMessage: (msgId: string, pinned: boolean) => void;
  replyTo: MessageFull | DmMessageFull | null;
  setReplyTo: (msg: MessageFull | DmMessageFull | null) => void;

  inCall: boolean;
  callSummary: CallSummary | null;
  /** Opens the native new-look call view (sets showCallPanel true) — replaces
   *  the earlier "bail out to classic" escape hatch now that calls have a
   *  real visual of their own. */
  onOpenCallView: () => void;
  /** Starts a DM voice/video call (mirrors App.tsx's startDmCall) — the
   *  chat header's phone/video buttons had nothing wired to actually place
   *  a call, only to reopen an already-active one. */
  onStartCall: (userId: string, username: string, avatarUrl: string | null, type: 'voice' | 'video') => void;
  /** Present whenever inCall is true — full data/handlers for the native
   *  new-look call view (see CallView.tsx). */
  callView: CallViewProps | null;

  onOpenSettings: () => void;
  /** Opens the real full profile (ProfilePage) as a full-screen overlay —
   *  same component/tabs (Profil/Media/Linki/Połączenia/Przypięte) the
   *  classic view uses, rendered by App.tsx outside this shell. */
  onOpenProfile: (userId: string) => void;
  /** Joins a server via invite code — used by the CINV|... server-invite
   *  card rendered in place of that raw pipe-delimited payload. */
  onJoinServer: (code: string) => void;
}

export type { MsgReaction };
