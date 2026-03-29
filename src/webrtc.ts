// ─── WebRTC Utilities for Cordis ─────────────────────────────────────────────

// ─── TURN server support ──────────────────────────────────────────────────────
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];
  const turnUrl  = (import.meta.env.VITE_TURN_URL  as string | undefined) || '';
  const turnUser = (import.meta.env.VITE_TURN_USERNAME   as string | undefined) || '';
  const turnCred = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || '';
  if (turnUrl) {
    servers.push({
      urls: [
        turnUrl.replace(/^turns?:/, 'turn:'),
        turnUrl.replace(/^turns?:/, 'turns:'),
      ],
      username:   turnUser,
      credential: turnCred,
    });
  }
  return servers;
}

export const ICE_SERVERS = buildIceServers();

// ─── DeepFilter status observable ────────────────────────────────────────────
export type DeepFilterStatus = 'idle' | 'loading' | 'active' | 'failed';
let _deepFilterStatus: DeepFilterStatus = 'idle';
const _dfListeners = new Set<(s: DeepFilterStatus) => void>();
function setDFStatus(s: DeepFilterStatus) {
  _deepFilterStatus = s;
  _dfListeners.forEach(fn => fn(s));
}
export function getDeepFilterStatus(): DeepFilterStatus { return _deepFilterStatus; }
/** Subscribe to DeepFilter status changes. Returns an unsubscribe function. */
export function onDeepFilterStatus(fn: (s: DeepFilterStatus) => void): () => void {
  _dfListeners.add(fn);
  return () => _dfListeners.delete(fn);
}

// ─── Peer Connection ─────────────────────────────────────────────────────────
export function makePeerConnection(
  onIce: (c: RTCIceCandidateInit) => void,
  onTrack: (e: RTCTrackEvent) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = e => { if (e.candidate) onIce(e.candidate.toJSON()); };
  pc.ontrack = onTrack;
  return pc;
}

// ─── Remote Audio Elements ───────────────────────────────────────────────────
const remoteAudios = new Map<string, HTMLAudioElement>();       // microphone audio
const remoteScreenAudios = new Map<string, HTMLAudioElement>(); // screen-share audio (separate element)

function makeAudioEl(): HTMLAudioElement {
  const el = document.createElement('audio');
  el.autoplay = true;
  el.style.display = 'none';
  document.body.appendChild(el);
  return el;
}

export function attachRemoteAudio(userId: string, stream: MediaStream) {
  // Close stale AudioContext from previous connection so we don't leak or double-play
  const stale = gainNodes.get(userId);
  if (stale) { stale.ctx.close().catch(() => {}); gainNodes.delete(userId); }

  let el = remoteAudios.get(userId);
  if (!el) { el = makeAudioEl(); remoteAudios.set(userId, el); }

  // Route: rawStream → GainNode → processedStream → <audio> element
  // Using createMediaStreamSource (not createMediaElementSource) avoids the
  // "already connected" InvalidStateError and works regardless of autoplay policy.
  // ── Step 1: immediate playback via direct srcObject ───────────────────────
  // Set raw stream FIRST so audio plays right away — no AudioContext dependency.
  // Without this, dest.stream is silent while AudioContext is suspended and the
  // user hears nothing until ctx.resume() resolves (which may require a gesture).
  el.srcObject = stream;
  el.play().catch(() => {});

  // ── Step 2: async — set up GainNode chain for volume > 100% support ────────
  // Only switch el.srcObject to dest.stream AFTER AudioContext is confirmed running.
  try {
    const ctx      = new AudioContext();           // system default sample rate
    const src      = ctx.createMediaStreamSource(stream);
    const gainNode = ctx.createGain();
    const dest     = ctx.createMediaStreamDestination();
    gainNode.gain.value = 1.0;
    src.connect(gainNode);
    gainNode.connect(dest);
    gainNodes.set(userId, { ctx, gain: gainNode });
    ctx.resume().then(() => {
      // Switch to processed stream only once AudioContext is running
      const liveEl = remoteAudios.get(userId);
      if (liveEl && liveEl.srcObject === stream) {
        liveEl.srcObject = dest.stream;
        liveEl.play().catch(() => {});
      }
    }).catch(() => {
      // ctx.resume() failed — keep playing direct stream; clean up unused GainNode
      gainNodes.delete(userId);
      ctx.close().catch(() => {});
    });
    el.addEventListener('play', () => ctx.resume().catch(() => {}), { once: true });
  } catch {
    // AudioContext not available — volume capped at 100% via el.volume fallback
  }
}

/** Separate element for screen-share audio so it doesn't overwrite mic audio. */
export function attachRemoteScreenAudio(userId: string, stream: MediaStream) {
  let el = remoteScreenAudios.get(userId);
  if (!el) { el = makeAudioEl(); remoteScreenAudios.set(userId, el); }
  el.srcObject = stream;
  el.play().catch(() => {});
}

export function detachRemoteAudio(userId: string) {
  const el = remoteAudios.get(userId);
  if (el) { el.srcObject = null; el.remove(); remoteAudios.delete(userId); }
  const sel = remoteScreenAudios.get(userId);
  if (sel) { sel.srcObject = null; sel.remove(); remoteScreenAudios.delete(userId); }
  // Clean up GainNode to prevent memory leaks and stale AudioContext connections
  const gn = gainNodes.get(userId);
  if (gn) { gn.ctx.close().catch(() => {}); gainNodes.delete(userId); }
}

// GainNode map for per-user volume boost above 100%
const gainNodes = new Map<string, { ctx: AudioContext; gain: GainNode }>();

export function setRemoteVolume(userId: string, volumePct: number) {
  // volumePct: 0–200 (100 = normal, 200 = double gain przez GainNode)
  const gain = Math.max(0, volumePct / 100);
  const el = remoteAudios.get(userId);
  if (!el) return;

  const gn = gainNodes.get(userId);
  if (gn) {
    // GainNode obsługuje cały zakres 0.0–2.0 (el.volume zostaje na 1.0)
    gn.gain.gain.value = gain;
    gn.ctx.resume().catch(() => {}); // upewnij się że context nie jest suspended
  } else {
    // Fallback (np. przeglądarka bez WebAudio) — natywne el.volume, max 100%
    el.volume = Math.min(1, gain);
  }
}

/** Set volume for a user's screen-share audio (0–100%). */
export function setRemoteScreenVolume(userId: string, volumePct: number) {
  const el = remoteScreenAudios.get(userId);
  if (!el) return;
  el.volume = Math.max(0, Math.min(1, volumePct / 100));
  if (volumePct > 0) el.muted = false; // un-mute if raising volume
}

/** Mute/unmute only the screen-share audio for a remote user. */
export function muteRemoteScreenStream(userId: string, muted: boolean) {
  const el = remoteScreenAudios.get(userId);
  if (el) el.muted = muted;
}

export function muteRemoteUser(userId: string, muted: boolean) {
  const el = remoteAudios.get(userId);
  if (el) el.muted = muted;
  const sel = remoteScreenAudios.get(userId);
  if (sel) sel.muted = muted;
}

export function muteAllRemote(muted: boolean) {
  remoteAudios.forEach(el => { el.muted = muted; });
  remoteScreenAudios.forEach(el => { el.muted = muted; });
}

export async function setOutputDevice(deviceId: string) {
  for (const el of [...remoteAudios.values(), ...remoteScreenAudios.values()]) {
    if ('setSinkId' in el) {
      try { await (el as any).setSinkId(deviceId); } catch {}
    }
  }
}

// ─── Voice Activity Detection (VAD) ──────────────────────────────────────────
/**
 * Proper VAD with:
 *  - RMS (root-mean-square) energy on time-domain data — far more accurate than
 *    frequency-bin averaging; immune to tonal artifacts from noise gate worklets.
 *  - Hysteresis: START_THRESHOLD > STOP_THRESHOLD to avoid flicker at the edge.
 *  - HOLD time: "speaking" stays true for HOLD_MS after energy drops below
 *    stop-threshold — eliminates indicator flutter between words.
 *  - requestAnimationFrame loop (~60 fps) so detection is instant, not laggy.
 *  - Focused on voice band (80–4000 Hz bins, ~fftSize 1024 @ 48 kHz).
 */
export function watchSpeaking(
  stream: MediaStream,
  onChange: (speaking: boolean) => void,
  startThreshold = 0.012,  // RMS 0..1 — tweak via settings (default ~-38 dBFS)
): () => void {
  let ctx: AudioContext | null = null;
  let rafId: number | null = null;

  try {
    ctx = new AudioContext({ sampleRate: 48000 });
    const src = ctx.createMediaStreamSource(stream);

    // Analyser on time-domain for RMS
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.0; // no smoothing — we do it ourselves
    src.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);

    let speaking      = false;
    let lastSpeakTime = 0;

    const STOP_THR = startThreshold * 0.55; // hysteresis — stop at 55% of start threshold
    const HOLD_MS  = 280;                   // hold "speaking" 280 ms after energy drops

    // Smoothed RMS via exponential moving average (τ ≈ 60 ms)
    let smoothedRms = 0;
    const ALPHA     = 0.15; // EMA coefficient

    function tick() {
      analyser.getFloatTimeDomainData(buf);

      // RMS over entire frame
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
      const rms    = Math.sqrt(sumSq / buf.length);
      smoothedRms  = ALPHA * rms + (1 - ALPHA) * smoothedRms;

      const now = Date.now();
      const thr = speaking ? STOP_THR : startThreshold;

      if (smoothedRms > thr) {
        lastSpeakTime = now;
        if (!speaking) { speaking = true; onChange(true); }
      } else if (speaking && now - lastSpeakTime > HOLD_MS) {
        speaking = false; onChange(false);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    ctx.resume().catch(() => {});
  } catch { /* AudioContext not available, skip */ }

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (ctx) ctx.close().catch(() => {});
  };
}

// ─── SDP Helpers ─────────────────────────────────────────────────────────────
/**
 * Reorder m=video payload types to prefer H264 over VP8/VP9.
 * H264 hardware encoding gives better performance + less CPU for screen share.
 */
export function preferH264(sdp: string): string {
  try {
    const lines = sdp.split('\n');
    let inVideo   = false;
    const h264pts: string[] = [];

    // First pass: collect H264 payload types
    for (const line of lines) {
      if (line.startsWith('m=video')) { inVideo = true; continue; }
      if (line.startsWith('m=') && inVideo) break;
      if (!inVideo) continue;
      const m = line.match(/^a=rtpmap:(\d+) H264/i);
      if (m) h264pts.push(m[1]);
    }

    if (h264pts.length === 0) return sdp; // H264 not available — don't change

    // Second pass: reorder m=video payload list
    return lines.map(line => {
      if (!line.startsWith('m=video')) return line;
      const parts   = line.split(' ');
      const header  = parts.slice(0, 3);           // e.g. "m=video 9 UDP/TLS/RTP/SAVPF"
      const allPts  = parts.slice(3);              // all payload type numbers
      const rest    = allPts.filter(p => !h264pts.includes(p.trim()));
      return [...header, ...h264pts, ...rest].join(' ');
    }).join('\n');
  } catch {
    return sdp; // never break negotiation
  }
}

/**
 * Set encoding parameters on all audio senders: high priority + correct Opus bitrate.
 * Call after setLocalDescription or after adding tracks.
 */
export function tuneAudioSender(pc: RTCPeerConnection, bitrateKbps = 64): void {
  pc.getSenders().forEach(sender => {
    if (sender.track?.kind !== 'audio') return;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate    = bitrateKbps * 1_000;
      (params.encodings[0] as any).priority        = 'high';
      (params.encodings[0] as any).networkPriority = 'high';
      sender.setParameters(params).catch(() => {});
    } catch {}
  });
}

/**
 * Set encoding parameters on all video senders (screen share):
 * max 8 Mbps @ 60 fps — minimum for crisp 1080p.
 * Also demotes any webcam senders to medium priority.
 */
export function tuneVideoSenders(
  pc: RTCPeerConnection,
  screenStream: MediaStream | null,
  maxBitrateMbps = 8,
  maxFps         = 60,
): void {
  pc.getSenders().forEach(sender => {
    if (sender.track?.kind !== 'video') return;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];

      const isScreen = screenStream?.getVideoTracks().includes(sender.track as MediaStreamTrack) ?? false;

      if (isScreen) {
        params.encodings[0].maxBitrate               = maxBitrateMbps * 1_000_000;
        params.encodings[0].maxFramerate              = maxFps;
        (params.encodings[0] as any).priority        = 'high';
        (params.encodings[0] as any).networkPriority = 'high';
      } else {
        // Webcam — lower priority so screen share gets the bandwidth
        params.encodings[0].maxBitrate               = 1_500_000; // 1.5 Mbps
        params.encodings[0].maxFramerate              = 30;
        (params.encodings[0] as any).priority        = 'medium';
        (params.encodings[0] as any).networkPriority = 'medium';
      }
      sender.setParameters(params).catch(() => {});
    } catch {}
  });
}

// ─── DeepFilterNet3 AI Noise Suppression ─────────────────────────────────────
/**
 * Wraps a raw microphone stream with DeepFilterNet3 AI noise suppression.
 * Loads WASM + model from CDN on first call (~1–2 s). Falls back to null
 * on any failure so the caller can fall back to the classic noise gate.
 */
export async function applyDeepFilter(rawStream: MediaStream): Promise<NoisePipeline | null> {
  setDFStatus('loading');
  try {
    const { DeepFilterNet3Core } = await import('deepfilternet3-noise-filter');
    const { STATIC_BASE } = await import('./api');
    const ctx  = new AudioContext({ sampleRate: 48000 });
    // CRITICAL: AudioContext may start suspended if created after async await chain.
    // Must resume before building the pipeline — otherwise dest.stream outputs silence.
    await ctx.resume();
    // Use nginx proxy (/df-cdn/) instead of cdn.mezon.ai directly — avoids CORS block.
    // STATIC_BASE: '' on web same-origin, 'https://cordyn.pl' in Tauri (where /df-cdn is nginx proxy)
    // nginx adds Access-Control-Allow-Origin:* so Tauri cross-origin fetch works too.
    const dfCdnUrl = `${STATIC_BASE}/df-cdn`;
    const core = new DeepFilterNet3Core({ sampleRate: 48000, noiseReductionLevel: 70, cdnUrl: dfCdnUrl });
    await core.initialize();                              // fetch WASM + model from CDN
    const worklet = await core.createAudioWorkletNode(ctx);
    const source  = ctx.createMediaStreamSource(rawStream);
    const dest    = ctx.createMediaStreamDestination();
    source.connect(worklet);
    worklet.connect(dest);
    setDFStatus('active');
    return {
      processedStream: dest.stream,
      cleanup: () => {
        rawStream.getTracks().forEach(t => t.stop());
        core.destroy();
        ctx.close().catch(() => {});
        setDFStatus('idle');
      },
      setEnabled:   (v) => core.setNoiseSuppressionEnabled(v),
      setThreshold: (v) => core.setSuppressionLevel(Math.round(v * 100)), // 0-1 → 0-100
    };
  } catch (e) {
    console.warn('[Cordis] DeepFilterNet3 unavailable, will use noise gate:', e);
    setDFStatus('failed');
    return null;
  }
}

// ─── Noise Gate AudioWorklet Pipeline ────────────────────────────────────────
export interface NoisePipeline {
  /** Processed stream to send to peer connections (noise-gated audio). */
  processedStream: MediaStream;
  /** Call to stop raw mic + close AudioContext. */
  cleanup: () => void;
  /** Change enabled/threshold live without re-acquiring mic. */
  setEnabled: (v: boolean) => void;
  setThreshold: (v: number) => void;
}

/**
 * Wraps a raw microphone stream with the CordisNoiseProcessor AudioWorklet.
 * Returns null if the browser does not support AudioWorklet (graceful fallback).
 */
export async function applyNoiseGate(rawStream: MediaStream): Promise<NoisePipeline | null> {
  try {
    const ctx = new AudioContext({ sampleRate: 48000 });
    // Load the worklet processor from the public folder
    await ctx.audioWorklet.addModule('/noise-processor.js');
    // CRITICAL: AudioContext may start suspended if created after async await chain.
    // Must resume before building the pipeline — otherwise dest.stream outputs silence.
    await ctx.resume();

    const source  = ctx.createMediaStreamSource(rawStream);
    const worklet = new AudioWorkletNode(ctx, 'cordis-noise-processor');
    const dest    = ctx.createMediaStreamDestination();

    // Voice frequency emphasis: high-pass at 80 Hz (cut rumble) + low-pass at 8 kHz (cut hiss)
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 80; hpf.Q.value = 0.7;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';  lpf.frequency.value = 8000; lpf.Q.value = 0.7;

    // Chain: source → HPF → LPF → noise gate worklet → destination
    source.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(worklet);
    worklet.connect(dest);

    const enabledParam   = worklet.parameters.get('enabled');
    const thresholdParam = worklet.parameters.get('threshold');

    return {
      processedStream: dest.stream,
      cleanup: () => {
        rawStream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
      },
      setEnabled:   (v) => { if (enabledParam)   enabledParam.setValueAtTime(v ? 1 : 0, ctx.currentTime); },
      setThreshold: (v) => { if (thresholdParam) thresholdParam.setValueAtTime(v, ctx.currentTime); },
    };
  } catch (e) {
    // AudioWorklet unsupported or worklet file not found — fall back gracefully
    console.warn('[Cordis] Noise gate worklet unavailable, using raw stream:', e);
    return null;
  }
}

// ─── Device Enumeration ──────────────────────────────────────────────────────
export async function getMediaDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices) return [];
  try {
    // Request mic permission first — without it browsers return devices with empty labels
    await navigator.mediaDevices.getUserMedia({ audio: true })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(() => {});
    return navigator.mediaDevices.enumerateDevices();
  } catch { return []; }
}
