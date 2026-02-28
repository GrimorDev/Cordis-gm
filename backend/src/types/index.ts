import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  banner_color: string;
  bio: string | null;
  custom_status: string | null;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  created_at: Date;
  updated_at: Date;
}

export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  created_at: Date;
}

export interface Channel {
  id: string;
  server_id: string;
  category_id: string | null;
  name: string;
  type: 'text' | 'voice';
  description: string | null;
  position: number;
  created_at: Date;
}

export interface ChannelCategory {
  id: string;
  server_id: string;
  name: string;
  position: number;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  edited: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DmConversation {
  id: string;
  created_at: Date;
  participants: User[];
}

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  edited: boolean;
  created_at: Date;
}

export interface Friend {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: Date;
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  role_name: string;
  joined_at: Date;
}

export interface JwtPayload {
  id: string;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Socket.IO event types
export interface ServerToClientEvents {
  new_message: (msg: MessageWithSender) => void;
  message_updated: (msg: { id: string; content: string; edited: boolean }) => void;
  message_deleted: (data: { id: string; channel_id: string }) => void;
  new_dm: (msg: DmMessageWithSender) => void;
  user_typing: (data: { channel_id: string; user_id: string; username: string }) => void;
  user_stop_typing: (data: { channel_id: string; user_id: string }) => void;
  user_status: (data: { user_id: string; status: string }) => void;
  voice_user_joined: (data: { channel_id: string; user: UserPublic }) => void;
  voice_user_left: (data: { channel_id: string; user_id: string }) => void;
  call_invite: (data: { from: UserPublic; type: 'voice' | 'video'; conversation_id: string }) => void;
  call_accepted: (data: { from_user_id: string; conversation_id: string }) => void;
  call_rejected: (data: { from_user_id: string }) => void;
  call_ended: (data: { by_user_id: string }) => void;
  webrtc_offer: (data: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  webrtc_answer: (data: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  webrtc_ice: (data: { from: string; candidate: RTCIceCandidateInit }) => void;
  friend_request: (data: { from: UserPublic }) => void;
  friend_accepted: (data: { user: UserPublic }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  authenticate: (token: string) => void;
  join_channel: (channel_id: string) => void;
  leave_channel: (channel_id: string) => void;
  typing_start: (channel_id: string) => void;
  typing_stop: (channel_id: string) => void;
  voice_join: (channel_id: string) => void;
  voice_leave: (channel_id: string) => void;
  call_invite: (data: { to_user_id: string; type: 'voice' | 'video' }) => void;
  call_accept: (data: { conversation_id: string; to_user_id: string }) => void;
  call_reject: (data: { to_user_id: string }) => void;
  call_end: (data: { to_user_id: string }) => void;
  webrtc_offer: (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  webrtc_answer: (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  webrtc_ice: (data: { to: string; candidate: RTCIceCandidateInit }) => void;
}

export interface MessageWithSender extends Message {
  sender: UserPublic;
}

export interface DmMessageWithSender extends DmMessage {
  sender: UserPublic;
}

export interface UserPublic {
  id: string;
  username: string;
  avatar_url: string | null;
  status: string;
  custom_status: string | null;
  role?: string;
}

// RTCSessionDescriptionInit and RTCIceCandidateInit (browser types not available in Node)
interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}
