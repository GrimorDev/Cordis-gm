// ── Linux native RTCPeerConnection polyfill ───────────────────────────────────
//
// On Linux Tauri when WebKitGTK does not expose RTCPeerConnection, this module
// injects window.RTCPeerConnection backed by webrtc-rs via Tauri IPC.
//
// The existing VoiceEngine (engine.ts) works UNCHANGED — it calls
// `new RTCPeerConnection(config)` and gets this class instead.
//
// Usage: call injectNativeRtcPolyfill() once in main.tsx before React mounts
// when running on Linux Tauri with RTCPeerConnection missing.

import { invoke, Channel } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── Internal helpers ─────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// Tauri event payloads emitted by rtc_linux.rs
interface IceCandidatePayload {
  pc_id:             string;
  candidate:         string;
  sdp_mid?:          string;
  sdp_m_line_index?: number;
}
interface StatePayload  { pc_id: string; state: string; }
interface TrackPayload  { pc_id: string; kind: string; }

// ── Polyfill class ────────────────────────────────────────────────────────────

class NativeRTCPeerConnection implements Partial<RTCPeerConnection> {
  // Internal ID shared with Rust
  private readonly _id: string;

  // RTCPeerConnection public callbacks
  onicecandidate:            ((e: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack:                   ((e: RTCTrackEvent) => void) | null = null;
  onnegotiationneeded:       (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange:   (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;

  // State strings mirroring browser RTCPeerConnection
  iceConnectionState:  RTCIceConnectionState   = 'new';
  iceGatheringState:   RTCIceGatheringState     = 'new';
  connectionState:     RTCPeerConnectionState   = 'new';
  signalingState:      RTCSignalingState        = 'stable';
  localDescription:    RTCSessionDescription | null = null;
  remoteDescription:   RTCSessionDescription | null = null;

  private _unlisteners: UnlistenFn[] = [];
  private _closed = false;

  constructor(config?: RTCConfiguration) {
    this._id = genId();

    const iceServers = (config?.iceServers ?? []).map((s: RTCIceServer) => ({
      urls:       Array.isArray(s.urls) ? s.urls : [s.urls as string],
      username:   (s as any).username   ?? null,
      credential: (s as any).credential ?? null,
    }));

    // Create Rust-side peer connection
    invoke('rtc_create_pc', { id: this._id, iceServers }).catch((e) =>
      console.error('[NativeRTC] rtc_create_pc failed:', e)
    );

    // Wire Tauri events → JS callbacks
    this._wire();
  }

  private async _wire() {
    const id = this._id;

    const u1 = await listen<IceCandidatePayload>('rtc_ice_candidate', (e) => {
      if (e.payload.pc_id !== id) return;
      const candidate = new RTCIceCandidate({
        candidate:       e.payload.candidate,
        sdpMid:          e.payload.sdp_mid ?? null,
        sdpMLineIndex:   e.payload.sdp_m_line_index ?? null,
      } as any);
      this.onicecandidate?.({ candidate } as RTCPeerConnectionIceEvent);
    });

    const u2 = await listen<StatePayload>('rtc_connection_state', (e) => {
      if (e.payload.pc_id !== id) return;
      this.connectionState = e.payload.state as RTCPeerConnectionState;
      this.onconnectionstatechange?.();
      // Map connection state to ICE connection state (approximate)
      const iceMap: Record<string, RTCIceConnectionState> = {
        new: 'new', connecting: 'checking', connected: 'connected',
        disconnected: 'disconnected', failed: 'failed', closed: 'closed',
      };
      const ice = iceMap[e.payload.state] ?? 'new';
      if (ice !== this.iceConnectionState) {
        this.iceConnectionState = ice as RTCIceConnectionState;
        this.oniceconnectionstatechange?.();
      }
    });

    const u3 = await listen<StatePayload>('rtc_negotiation_needed', (e) => {
      if (e.payload.pc_id !== id) return;
      this.onnegotiationneeded?.();
    });

    const u4 = await listen<TrackPayload>('rtc_track_added', (e) => {
      if (e.payload.pc_id !== id) return;
      // Create a synthetic MediaStream so engine.ts onRemoteTrack fires.
      // Audio is played natively via cpal — mark it so App.tsx skips browser attachment.
      const stream = Object.assign(new MediaStream(), { __nativeRtc: true, __pcId: id });
      const track  = Object.assign(new MediaStreamTrack(), { kind: e.payload.kind });
      this.ontrack?.({ track, streams: [stream] } as unknown as RTCTrackEvent);
    });

    this._unlisteners.push(u1, u2, u3, u4);
  }

  // ── RTCPeerConnection API ─────────────────────────────────────────────────

  async createOffer(_options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    const sdp = await invoke<string>('rtc_create_offer', { id: this._id });
    return { type: 'offer', sdp };
  }

  async createAnswer(_options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    // In our flow, createAnswer is implicit in rtc_set_remote_description when type=offer.
    // Return a placeholder; the real answer SDP was already sent in setRemoteDescription.
    return { type: 'answer', sdp: this.localDescription?.sdp ?? '' };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc as RTCSessionDescription;
    this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
    await invoke('rtc_set_local_description', {
      id:   this._id,
      type: desc.type,
      sdp:  desc.sdp ?? '',
    });
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = desc as RTCSessionDescription;
    // For offers: Rust creates the answer internally and sets it as local description.
    const answerSdp = await invoke<string>('rtc_set_remote_description', {
      id:   this._id,
      type: desc.type,
      sdp:  desc.sdp ?? '',
    });
    if (desc.type === 'offer' && answerSdp) {
      this.localDescription = { type: 'answer', sdp: answerSdp } as RTCSessionDescription;
      this.signalingState = 'stable';
    } else {
      this.signalingState = 'stable';
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit | null): Promise<void> {
    if (!candidate?.candidate) return;
    await invoke('rtc_add_ice_candidate', {
      id:              this._id,
      candidate:       candidate.candidate,
      sdpMid:          candidate.sdpMid ?? null,
      sdpMLineIndex:   candidate.sdpMLineIndex ?? null,
    });
  }

  addTrack(_track: MediaStreamTrack, ..._streams: MediaStream[]): RTCRtpSender {
    // Mic capture is started by rtc_create_pc in Rust — no extra action needed.
    // Return a minimal sender so engine.ts getSenders() works.
    return {
      track:         _track,
      transport:     null,
      dtmf:          null,
      getParameters: () => ({ encodings: [{}], codecs: [], headerExtensions: [], rtcp: {}, transactionId: '' }),
      setParameters: async () => {},
      getStats:      async () => new Map(),
      replaceTrack:  async () => {},
    } as unknown as RTCRtpSender;
  }

  getSenders(): RTCRtpSender[] {
    // Return empty — bitrate tuning via setParameters is a no-op for native
    return [];
  }

  getReceivers(): RTCRtpReceiver[] { return []; }

  getTransceivers(): RTCRtpTransceiver[] { return []; }

  restartIce(): void {
    // Close and signal re-connect (engine.ts will re-negotiate)
    invoke('rtc_close_pc', { id: this._id }).catch(() => {});
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    this._unlisteners.forEach((u) => u());
    this._unlisteners = [];
    await invoke('rtc_close_pc', { id: this._id }).catch(() => {});
    this.connectionState = 'closed';
    this.onconnectionstatechange?.();
  }

  // Properties required by some code paths
  get sctp(): RTCSctpTransport | null { return null; }
  get canTrickleIceCandidates(): boolean | null { return true; }
  get pendingLocalDescription(): RTCSessionDescription | null { return null; }
  get pendingRemoteDescription(): RTCSessionDescription | null { return null; }

  // Stubs for unused APIs
  async getStats(): Promise<RTCStatsReport> { return new Map() as any; }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  createDataChannel(): RTCDataChannel { throw new Error('Not supported in native mode'); }
}

// ── Injection ─────────────────────────────────────────────────────────────────

/**
 * Call once in main.tsx on Linux Tauri when RTCPeerConnection is missing.
 * Injects NativeRTCPeerConnection as window.RTCPeerConnection so the entire
 * existing engine.ts works without any changes.
 */
export function injectNativeRtcPolyfill(): void {
  if (typeof RTCPeerConnection === 'function') return; // already available
  console.info('[Cordyn] Injecting native RTCPeerConnection polyfill (webrtc-rs + cpal)');
  (window as any).RTCPeerConnection = NativeRTCPeerConnection;
}
