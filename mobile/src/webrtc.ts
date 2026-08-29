// ─── Voice-channel WebRTC mesh (mirrors src/webrtc.ts on desktop) ───────────
//
// Signaling contract (backend/src/socket/index.ts) — identical to desktop:
//   voice_join {channelId}          → C→S
//   voice_existing_users {channel_id, user_ids}  → S→C (who to call)
//   voice_leave {channelId}         → C→S
//   webrtc_offer/answer  {to, sdp}  → relayed as {from, sdp}
//   webrtc_ice           {to, candidate} → relayed as {from, candidate}
//
// react-native-webrtc auto-routes a received remote audio track to the
// device speaker/earpiece once it's attached to the peer connection — unlike
// web, no <audio> element or RTCView is needed for audio-only calls.

import { mediaDevices, RTCPeerConnection, RTCIceCandidate, MediaStream } from 'react-native-webrtc';
import { getSocket } from './socket';

// Desktop (src/rtc/engine.ts) sends pc.localDescription.toJSON() — a plain
// {type, sdp} object — over the wire. Build that explicitly here rather than
// relying on react-native-webrtc's RTCSessionDescription serializing the
// same way through Socket.IO's JSON encoder.
function descToPlain(desc: any): { type: string; sdp: string } {
  return { type: desc.type, sdp: desc.sdp };
}

function buildIceServers(): any[] {
  const servers: any[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];
  const turnUrl  = process.env.EXPO_PUBLIC_TURN_URL || '';
  const turnUser = process.env.EXPO_PUBLIC_TURN_USERNAME || '';
  const turnCred = process.env.EXPO_PUBLIC_TURN_CREDENTIAL || '';
  if (turnUrl) {
    servers.push({
      urls: [
        turnUrl.replace(/^turns?:/, 'turn:'),
        turnUrl.replace(/^turns?:/, 'turns:'),
      ],
      username: turnUser,
      credential: turnCred,
    });
  }
  return servers;
}

const ICE_SERVERS = buildIceServers();

type VoiceMeshEvents = {
  onLocalStreamReady?: (stream: MediaStream) => void;
  onError?: (message: string) => void;
};

class VoiceMeshManager {
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private channelId: string | null = null;
  // 'channel' = voice-channel mesh (join/leave, N peers). 'direct' = 1:1 DM
  // call (call_invite/accept, exactly one peer). Both speak the same
  // underlying webrtc_offer/answer/ice wire format, so they share this class.
  private mode: 'channel' | 'direct' | null = null;
  private muted = false;
  private events: VoiceMeshEvents = {};
  private attached = false;

  configure(events: VoiceMeshEvents) {
    this.events = events;
  }

  /** True while ANY session (voice-channel or direct call) is active. */
  get active(): boolean {
    return this.mode !== null;
  }

  private attachSocketListeners() {
    if (this.attached) return;
    const sock = getSocket();
    if (!sock) return;
    sock.on('voice_existing_users', this.onExistingUsers);
    sock.on('webrtc_offer', this.onOffer);
    sock.on('webrtc_answer', this.onAnswer);
    sock.on('webrtc_ice', this.onIce);
    this.attached = true;
  }

  private detachSocketListeners() {
    const sock = getSocket();
    sock?.off('voice_existing_users', this.onExistingUsers);
    sock?.off('webrtc_offer', this.onOffer);
    sock?.off('webrtc_answer', this.onAnswer);
    sock?.off('webrtc_ice', this.onIce);
    this.attached = false;
  }

  /** Call right after emitting `voice_join` on the socket. */
  async join(channelId: string): Promise<void> {
    if (this.mode) await this.leave();
    this.mode = 'channel';
    this.channelId = channelId;
    this.attachSocketListeners();
    try {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false }) as unknown as MediaStream;
      this.events.onLocalStreamReady?.(this.localStream);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Nie udało się uzyskać dostępu do mikrofonu');
      this.mode = null;
      this.channelId = null;
      this.detachSocketListeners();
      throw e;
    }
  }

  /**
   * Caller side of a 1:1 DM call — call after the callee has accepted
   * (`call_accepted`), so the offer isn't racing their mic setup.
   */
  async startDirectCall(peerId: string): Promise<void> {
    if (this.mode) await this.leave();
    this.mode = 'direct';
    this.attachSocketListeners();
    try {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false }) as unknown as MediaStream;
      this.events.onLocalStreamReady?.(this.localStream);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Nie udało się uzyskać dostępu do mikrofonu');
      this.mode = null;
      this.detachSocketListeners();
      throw e;
    }
    const pc = this.makePeerConnection(peerId);
    try {
      const offer = await pc.createOffer({} as any);
      await pc.setLocalDescription(offer);
      getSocket()?.emit('webrtc_offer', { to: peerId, sdp: descToPlain(pc.localDescription) });
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Błąd nawiązywania połączenia');
      throw e;
    }
  }

  /**
   * Callee side of a 1:1 DM call — call after accepting (`call_accept`
   * emitted), before the caller's offer necessarily arrives. Just gets the
   * mic ready; the incoming offer is handled by the normal onOffer listener.
   */
  async acceptDirectCall(): Promise<void> {
    if (this.mode) await this.leave();
    this.mode = 'direct';
    this.attachSocketListeners();
    try {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false }) as unknown as MediaStream;
      this.events.onLocalStreamReady?.(this.localStream);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Nie udało się uzyskać dostępu do mikrofonu');
      this.mode = null;
      this.detachSocketListeners();
      throw e;
    }
  }

  /** Call right before/after emitting `voice_leave`/`call_end` on the socket. */
  async leave(): Promise<void> {
    this.mode = null;
    this.channelId = null;
    this.detachSocketListeners();
    for (const pc of this.peers.values()) {
      try { pc.close(); } catch {}
    }
    this.peers.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.muted = false;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  isMuted(): boolean {
    return this.muted;
  }

  private makePeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10,
    } as any);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream as MediaStream);
      });
    }

    (pc as any).onicecandidate = (e: any) => {
      if (e.candidate) {
        getSocket()?.emit('webrtc_ice', { to: peerId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private onExistingUsers = async ({ channel_id, user_ids }: { channel_id: string; user_ids: string[] }) => {
    if (this.mode !== 'channel' || channel_id !== this.channelId) return;
    for (const peerId of user_ids) {
      if (this.peers.has(peerId)) continue;
      const pc = this.makePeerConnection(peerId);
      try {
        const offer = await pc.createOffer({} as any);
        await pc.setLocalDescription(offer);
        getSocket()?.emit('webrtc_offer', { to: peerId, sdp: descToPlain(pc.localDescription) });
      } catch (e: any) {
        this.events.onError?.(e?.message ?? `Błąd połączenia z uczestnikiem`);
      }
    }
  };

  private onOffer = async ({ from, sdp }: { from: string; sdp: any }) => {
    if (!this.mode) return; // no active channel-mesh or direct-call session
    let pc = this.peers.get(from);
    if (!pc) pc = this.makePeerConnection(from);
    try {
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit('webrtc_answer', { to: from, sdp: descToPlain(pc.localDescription) });
    } catch (e: any) {
      this.events.onError?.(e?.message ?? `Błąd odpowiedzi na połączenie`);
    }
  };

  private onAnswer = async ({ from, sdp }: { from: string; sdp: any }) => {
    const pc = this.peers.get(from);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(sdp);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? `Błąd negocjacji połączenia`);
    }
  };

  private onIce = async ({ from, candidate }: { from: string; candidate: any }) => {
    const pc = this.peers.get(from);
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Benign — candidates can arrive before the remote description is set on flaky connections.
    }
  };
}

/** Single shared instance — only one active voice-channel session at a time. */
export const voiceMesh = new VoiceMeshManager();
