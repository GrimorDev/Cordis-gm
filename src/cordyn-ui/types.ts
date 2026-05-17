// Cordyn UI — shared types
// All components are presentational; wire your real data shape to these.

export type Status = "online" | "idle" | "dnd" | "offline";

export interface ServerSummary {
  id: string;
  name: string;
  short?: string;     // 1-2 chars for the rail icon
  color?: string;     // av-1 … av-8 (avatar palette class)
  unread?: boolean;
  badge?: number | string | null;
  sub?: string;       // shown in the "Moje serwery" popup
  verified?: boolean;
  bannerUrl?: string;
  iconUrl?: string;   // URL to server icon image
}

export interface VoiceParticipant {
  name: string;
  color?: string;
  speaking?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  type: "text" | "voice" | "announcement" | "forum";
  unread?: boolean;
  locked?: boolean;
  badge?: string | number;
  participants?: VoiceParticipant[];
  topic?: string;
}

export interface Category {
  id: string;
  name: string;
  channels: Channel[];
}

export interface Member {
  name: string;
  avatar?: string;    // av-1 … av-8
  status: Status;
  substatus?: string;
  role?: string;
}

export interface MembersByRole {
  tester?: Member[];
  online?: Member[];
  idle?: Member[];
  dnd?: Member[];
  offline?: Member[];
  boty?: Member[];
}

export interface RoleTag {
  kind: "dev" | "tester" | "cvel" | "bot";
  label: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  mine?: boolean;
}

export type MessageItem =
  | { kind: "date"; id?: string; label: string }
  | ChatMessage;

export interface ChatMessage {
  kind?: "message";
  id: string;
  author: string;
  avatar?: string;
  role?: RoleTag | null;
  time: string;
  content?: string;
  continuation?: boolean;
  reactions?: Reaction[];
  embed?: { src: string; title: string; desc: string };
  image?: string;
  system?: { text: string; channel: string; more?: string };
}

export interface DM {
  id: string;
  name: string;
  avatar?: string;
  status: Status;
  preview: string;
  unread?: number;
  joined?: string;
  mutualServers?: number;
  mutualFriends?: number;
  role?: string;
  bannerUrl?: string;  // URL to DM profile banner image
}

export interface CmdkItem {
  kind: "channel" | "dm" | "server" | "action";
  icon: string;        // lucide icon name (kebab-case)
  label: string;
  sub?: string;
}

export interface CurrentUser {
  name: string;
  avatar?: string;
  status: string;
}

export type Layout = "classic" | "unified" | "floating";
export type Atmosphere = "aurora" | "graphite" | "sunset";
export type Density = "compact" | "comfortable" | "spacious";
export type Theme = "dark" | "light";
