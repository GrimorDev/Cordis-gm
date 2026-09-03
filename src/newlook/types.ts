// Fresh, minimal prop surface for the opt-in "Nowy wygląd" shell — deliberately
// NOT a parallel simplified schema (that's what src/cordyn-ui/ did and it left
// gaps like missing reply_to fields). Components here consume the real API
// types from src/api.ts directly and receive already-computed state/handlers
// from App.tsx as props, the same data the classic layout already renders.
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
  onSelectChannel: (id: string) => void;

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

  inCall: boolean;
  callSummary: CallSummary | null;
  onOpenClassicForCall: () => void;

  onOpenSettings: () => void;
}

export type { MsgReaction };
