// ─── WebRTC Utilities for Cordis ─────────────────────────────────────────────

// ─── Screen share quality ────────────────────────────────────────────────────
export type ScreenQuality = 'hd' | 'fhd';

/**
 * Capture screen with the selected quality preset.
 * HD  = 1280×720 @ 30 fps  — lower bitrate, smoother on weak connections
 * FHD = 1920×1080 @ 60 fps — crisp text, best for presentations & code
 * Falls back to video-only if system audio capture is not supported.
 */
export async function captureScreen(quality: ScreenQuality): Promise<MediaStream> {
  // Both qualities get 60 fps — it's the sharer's upload that's consumed, not the server.
  // HD vs FHD only differs in resolution; fps is always maxed out.
  const videoConstraints = quality === 'fhd'
    ? { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    : { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1280 }, height: { ideal: 720  } };

  try {
    return await navigator.mediaDevices.getDisplayMedia({ video: videoConstraints, audio: true });
  } catch (e: any) {
    const n = e?.name ?? '';
    if (n === 'NotSupportedError' || n === 'TypeError' || n === 'OverconstrainedError') {
      // System audio not supported — retry video-only
      return navigator.mediaDevices.getDisplayMedia({ video: videoConstraints, audio: false });
    }
    throw e; // user cancelled or real error
  }
}

// ─── Adaptive bitrate profile ────────────────────────────────────────────────
export interface BitrateProfile {
  audioBitrateKbps:  number; // Opus audio per sender
  screenBitrateMbps: number; // Screen share video
  webcamBitrateMbps: number; // Webcam video (lower priority)
  webcamMaxFps:      number; // Webcam max framerate
}

/**
 * Returns per-sender bitrate limits based on participant count.
 *
 * In a full mesh each user sends N-1 audio streams. Scaling bitrate down
 * as participants grow keeps total upstream manageable without quality loss:
 *   1-2 people  : 64 kbps Opus — studio quality
 *   3-4 people  : 32 kbps Opus — CD quality, still clear speech
 *   5-8 people  : 24 kbps Opus — voice band, intelligible
 *   9+ people   : 16 kbps Opus — minimum usable Opus
 *
 * Screen share bitrate stays high because there is typically ONE sharer:
 *   FHD 1080p60 : 8 Mbps — matches Netflix HD tier, crisp text
 *   HD  720p60  : 3 Mbps — lower resolution, same 60 fps (sharer's upload, not server)
 */
export function getBitrateProfile(
  participantCount: number,
  hasScreen: boolean,
  quality: ScreenQuality = 'fhd',
): BitrateProfile {
  const audioBitrateKbps =
    participantCount <= 2  ? 64 :
    participantCount <= 4  ? 32 :
    participantCount <= 8  ? 24 : 16;

  if (!hasScreen) {
    return { audioBitrateKbps, screenBitrateMbps: 0, webcamBitrateMbps: 0, webcamMaxFps: 0 };
  }

  const fhd = quality === 'fhd';
  const screenBitrateMbps =
    participantCount <= 2  ? (fhd ? 8   : 4  ) :
    participantCount <= 4  ? (fhd ? 8   : 3  ) :
    participantCount <= 8  ? (fhd ? 5   : 2  ) : (fhd ? 3   : 1.5);

  const webcamBitrateMbps =
    participantCount <= 2  ? 1.5 :
    participantCount <= 4  ? (fhd ? 0.5 : 0.8) :
    participantCount <= 8  ? 0.3 : 0.2;

  const webcamMaxFps = participantCount <= 4 ? 30 : 15;

  return { audioBitrateKbps, screenBitrateMbps, webcamBitrateMbps, webcamMaxFps };
}

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
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    // Bundle all m= sections onto one 5-tuple → fewer ports, less NAT hairpinning
    bundlePolicy:      'max-bundle',
    // Require RTP/RTCP multiplexing — reduces port usage and avoids RTCP-only failures
    rtcpMuxPolicy:     'require',
    // Pre-gather 10 candidates before first offer so ICE completes faster
    iceCandidatePoolSize: 10,
  });
  pc.onicecandidate = e => { if (e.candidate) onIce(e.candidate.toJSON()); };
  pc.ontrack = onTrack;
  return pc;
}

// ─── Remote Audio Elements ───────────────────────────────────────────────────
const remoteAudios = new Map<string, HTMLAudioElement>();       // microphone audio
const remoteScreenAudios = new Map<string, HTMLAudioElement>(); // screen-share audio (separate element)
// "Pump" elements: a MUTED <audio> fed the RAW remote stream. Required by a
// Chromium/WebView bug — a remote WebRTC MediaStream produces SILENCE when fed
// into a WebAudio MediaStreamAudioSourceNode UNLESS the same stream is also
// sunk into an HTMLMediaElement. Web (real Chrome) tolerates this; WebView2 and
// WebKitGTK do NOT, which is why desktop "hears nobody" while web works.
const remotePumps = new Map<string, HTMLAudioElement>();

function makeAudioEl(): HTMLAudioElement {
  const el = document.createElement('audio');
  el.autoplay = true;
  el.style.display = 'none';
  document.body.appendChild(el);
  return el;
}

// ─── Shared AudioContexts (Tauri/WebView2 fix) ───────────────────────────────
// In Tauri/WebView2, <audio srcObject=MediaStream> is silently broken — audio
// arrives but produces no sound. AudioContext.createMediaStreamSource() routes
// audio through the native pipeline and works reliably.
//
// Three shared contexts:
//   _playCtx — for remote audio PLAYBACK (attachRemoteAudio)
//   _recCtx  — for local mic PROCESSING (applyNoiseGate / noise gate worklet)
//   _vadCtx  — for speaking detection (watchSpeaking RMS analyser → "poświata")
//
// All MUST be created and resumed inside a user-gesture handler.
// Call primePlaybackContext() when the user clicks join/accept for a call —
// it primes ALL contexts so they are in "running" state before any async ops.
let _playCtx: AudioContext | null = null;
let _recCtx:  AudioContext | null = null;
let _vadCtx:  AudioContext | null = null;
interface AudioPlayNode { source: MediaStreamAudioSourceNode; gain: GainNode; merger?: ChannelMergerNode; }
const _playNodes   = new Map<string, AudioPlayNode>(); // userId → WebRTC audio nodes
const _playVolumes = new Map<string, number>();        // userId → volume 0..1

// Map from userId → the MediaStream we last attached, so we can re-attach after resume
const _pendingReattach = new Map<string, MediaStream>();

function makeResumedCtx(): AudioContext {
  const ctx = new AudioContext({ sampleRate: 48000 });
  // ── Force stereo output ────────────────────────────────────────────────────
  // WebKitGTK on Linux: the AudioContext destination defaults to mono (or to
  // channelInterpretation='discrete'), which routes a 1-channel stream to the
  // LEFT speaker only.  Explicitly setting 2-ch + 'speakers' interpretation
  // causes mono sources to be upmixed symmetrically to both L and R channels.
  try {
    ctx.destination.channelCount          = Math.min(2, ctx.destination.maxChannelCount);
    ctx.destination.channelCountMode      = 'explicit';
    ctx.destination.channelInterpretation = 'speakers';
  } catch { /* read-only in some edge cases, ignore */ }
  ctx.resume().catch(() => {});
  // Auto-resume if the browser suspends the context (e.g. WebView2 focus loss)
  // After resume, re-attach any pending audio streams so sound resumes immediately.
  ctx.addEventListener('statechange', () => {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    } else if (ctx.state === 'running' && _pendingReattach.size > 0) {
      // Re-attach streams that were attached while context was suspended
      _pendingReattach.forEach((stream, userId) => {
        attachRemoteAudio(userId, stream);
      });
      _pendingReattach.clear();
    }
  });
  return ctx;
}

/**
 * Create / resume the shared playback + recording AudioContexts.
 * MUST be called within a user-gesture handler (button click) so the contexts
 * are allowed to start in the running state.
 * Primes _playCtx (remote audio), _recCtx (noise gate) and _vadCtx (speaking
 * detection) so all three start in "running" state before any async ops.
 */
export function primePlaybackContext(): void {
  try {
    if (!_playCtx || _playCtx.state === 'closed') _playCtx = makeResumedCtx();
    else _playCtx.resume().catch(() => {});
  } catch {}
  try {
    if (!_recCtx || _recCtx.state === 'closed') _recCtx = makeResumedCtx();
    else _recCtx.resume().catch(() => {});
  } catch {}
  try {
    // VAD context for the speaking indicator. Primed in-gesture so it starts
    // "running" — otherwise (created later inside watchSpeaking, after the
    // `await getUserMedia`) WebViews start it "suspended" and the glow never
    // lights up even though the mic is capturing. This is THE desktop-only bug.
    if (!_vadCtx || _vadCtx.state === 'closed') _vadCtx = makeResumedCtx();
    else _vadCtx.resume().catch(() => {});
  } catch {}
}

/**
 * Attach a remote WebRTC audio stream for playback.
 *
 * Primary path (Tauri + web): AudioContext — routes stream directly to speaker
 * via createMediaStreamSource → GainNode → ctx.destination.
 * Works in WebView2 where <audio srcObject=MediaStream> produces no sound.
 *
 * Fallback (no primed ctx): <audio srcObject> with muted→play→unmute trick
 * to bypass autoplay restrictions.
 */
export function attachRemoteAudio(userId: string, stream: MediaStream) {
  // Register stream for re-attachment after a suspended context wakes back up.
  // Cleared below if the AudioContext path succeeds while already running.
  _pendingReattach.set(userId, stream);

  // ── Pump: keep the raw remote stream sunk into a MUTED <audio> element ───────
  // Without this, createMediaStreamSource(remoteStream) below yields SILENCE in
  // WebView2 / WebKitGTK (the remote track is never "pulled"). The element stays
  // muted so it produces no audible output of its own — the AudioContext graph
  // below is what the user actually hears. This is the desktop-receive fix.
  try {
    let pump = remotePumps.get(userId);
    if (!pump) { pump = makeAudioEl(); pump.muted = true; remotePumps.set(userId, pump); }
    pump.muted = true;
    pump.srcObject = stream;
    pump.play().catch(() => {
      const retry = () => { pump!.play().catch(() => {}); document.removeEventListener('click', retry); document.removeEventListener('keydown', retry); document.removeEventListener('pointerdown', retry); };
      document.addEventListener('click', retry, { once: true });
      document.addEventListener('keydown', retry, { once: true });
      document.addEventListener('pointerdown', retry, { once: true });
    });
  } catch {}

  // ── AudioContext path ────────────────────────────────────────────────────────
  if (_playCtx && _playCtx.state !== 'closed') {
    // Kick resume regardless — harmless if already running, needed if suspended.
    _playCtx.resume().catch(() => {});
    const prev = _playNodes.get(userId);
    if (prev) { try { prev.source.disconnect(); prev.gain.disconnect(); prev.merger?.disconnect(); } catch {} _playNodes.delete(userId); }
    try {
      const source = _playCtx.createMediaStreamSource(stream);
      const gain   = _playCtx.createGain();
      gain.gain.value = _playVolumes.get(userId) ?? 1.0;

      // ── Route via MediaStreamDestinationNode ────────────────────────────────
      // AudioContext.destination always plays through the system DEFAULT output.
      // To honour user-selected speaker (setSinkId), we pipe the graph into a
      // MediaStreamDestinationNode and feed its stream into an <audio> element.
      // setSinkId on that element then routes to the selected device correctly.
      //
      // Also inserts a ChannelMergerNode (stereo upmix) so a mono WebRTC stream
      // fills both L and R channels — fixes left-ear-only on Linux/WebKitGTK.
      let el = remoteAudios.get(userId);
      if (!el) { el = makeAudioEl(); remoteAudios.set(userId, el); }

      try {
        const merger  = _playCtx.createChannelMerger(2);
        const destNode = _playCtx.createMediaStreamDestination();
        source.connect(gain);
        gain.connect(merger, 0, 0); // gain ch-0 → merger L
        gain.connect(merger, 0, 1); // gain ch-0 → merger R
        merger.connect(destNode);
        // Play through <audio> element — setSinkId() on it controls the output device
        el.muted = false;
        el.srcObject = destNode.stream;
        el.play().catch(() => {
          // Retry on next user interaction (autoplay policy)
          const retry = () => { el!.play().catch(() => {}); document.removeEventListener('click', retry); };
          document.addEventListener('click', retry, { once: true });
        });
        _playNodes.set(userId, { source, gain, merger });
      } catch {
        // Fallback: connect directly to ctx.destination (no output device switching)
        source.connect(gain);
        gain.connect(_playCtx.destination);
        el.muted = true;
        el.srcObject = stream;
        _playNodes.set(userId, { source, gain });
      }
      // Nodes are live — audio flows now (running) or will flow on resume (suspended).
      // Either way the statechange re-attach would just recreate the same nodes,
      // so we can clear the pending entry.
      _pendingReattach.delete(userId);
      console.log(`[Cordis] attachRemoteAudio(${userId}): AudioContext+Dest path, state=${_playCtx.state}`);
      return;
    } catch (err) {
      console.warn('[Cordis] attachRemoteAudio AudioContext path failed, falling back to <audio>:', err);
    }
  }

  // ── Fallback: native <audio srcObject> ──────────────────────────────────────
  let el = remoteAudios.get(userId);
  if (!el) { el = makeAudioEl(); remoteAudios.set(userId, el); }
  el.srcObject = stream;
  // muted→play→unmute bypasses autoplay policy on all browsers/WebViews.
  // After unmute we also attempt to move to AudioContext path on next prime.
  el.muted = true;
  const tryPlay = () => {
    el!.play()
      .then(() => { if (el) el.muted = false; })
      .catch(err => {
        if (el) el.muted = false;
        console.warn('[Cordis] attachRemoteAudio play() blocked:', err.name, '— retry on next interaction');
        // Retry on any user interaction
        const retry = () => {
          el!.muted = true;
          el!.play().then(() => { if (el) el!.muted = false; }).catch(() => { if (el) el!.muted = false; });
          document.removeEventListener('click',      retry);
          document.removeEventListener('keydown',    retry);
          document.removeEventListener('pointerdown',retry);
        };
        document.addEventListener('click',      retry, { once: true });
        document.addEventListener('keydown',    retry, { once: true });
        document.addEventListener('pointerdown',retry, { once: true });
      });
  };
  tryPlay();
  console.log(`[Cordis] attachRemoteAudio(${userId}): <audio> fallback path`);
}

/** Separate element for screen-share audio so it doesn't overwrite mic audio. */
export function attachRemoteScreenAudio(userId: string, stream: MediaStream) {
  let el = remoteScreenAudios.get(userId);
  if (!el) { el = makeAudioEl(); remoteScreenAudios.set(userId, el); }
  el.srcObject = stream;
  el.play().catch(() => {});
}

export function detachRemoteAudio(userId: string) {
  _pendingReattach.delete(userId);
  const node = _playNodes.get(userId);
  if (node) { try { node.source.disconnect(); node.gain.disconnect(); node.merger?.disconnect(); } catch {} _playNodes.delete(userId); }
  _playVolumes.delete(userId);
  const el = remoteAudios.get(userId);
  if (el) { el.srcObject = null; el.remove(); remoteAudios.delete(userId); }
  const pump = remotePumps.get(userId);
  if (pump) { pump.srcObject = null; pump.remove(); remotePumps.delete(userId); }
  const sel = remoteScreenAudios.get(userId);
  if (sel) { sel.srcObject = null; sel.remove(); remoteScreenAudios.delete(userId); }
}

export function setRemoteVolume(userId: string, volumePct: number) {
  const vol = Math.max(0, Math.min(1, volumePct / 100));
  _playVolumes.set(userId, vol);
  const node = _playNodes.get(userId);
  if (node) { node.gain.gain.value = vol; return; }
  // Fallback: <audio> element
  const el = remoteAudios.get(userId);
  if (el) el.volume = vol;
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
  const node = _playNodes.get(userId);
  if (node) {
    node.gain.gain.value = muted ? 0 : (_playVolumes.get(userId) ?? 1.0);
    const sel = remoteScreenAudios.get(userId);
    if (sel) sel.muted = muted;
    return;
  }
  const el = remoteAudios.get(userId);
  if (el) el.muted = muted;
  const sel = remoteScreenAudios.get(userId);
  if (sel) sel.muted = muted;
}

export function muteAllRemote(muted: boolean) {
  _playNodes.forEach((node, userId) => {
    node.gain.gain.value = muted ? 0 : (_playVolumes.get(userId) ?? 1.0);
  });
  remoteAudios.forEach(el => { el.muted = muted; });
  remoteScreenAudios.forEach(el => { el.muted = muted; });
}

export async function setOutputDevice(deviceId: string) {
  // Route all <audio> elements (which carry the MediaStreamDestinationNode output)
  // to the selected device.  This is the primary path for output device switching.
  for (const el of [...remoteAudios.values(), ...remoteScreenAudios.values()]) {
    if ('setSinkId' in el) {
      try { await (el as any).setSinkId(deviceId); } catch {}
    }
  }
  // Additionally, try AudioContext.setSinkId if the browser supports it (Chrome 110+).
  // This covers any audio going directly to ctx.destination (fallback path).
  if (_playCtx && 'setSinkId' in _playCtx) {
    try { await (_playCtx as any).setSinkId(deviceId); } catch {}
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
  let ownCtx = false; // true only when we had to create a private fallback context
  let src: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId: number | null = null;
  let resumeTimer: ReturnType<typeof setInterval> | null = null;
  const gestureHandler = () => { ctx?.resume().catch(() => {}); };

  try {
    // ── Prefer the shared VAD context primed inside the join/accept click ─────
    // _vadCtx was created in primePlaybackContext() during the user gesture, so
    // it is already "running". Reusing it means the speaking indicator works
    // IMMEDIATELY on desktop WebViews. Only fall back to a fresh context (which
    // a WebView would start "suspended") if priming never happened.
    if (_vadCtx && _vadCtx.state !== 'closed') {
      ctx = _vadCtx;
      ownCtx = false;
    } else {
      ctx = new AudioContext({ sampleRate: 48000 });
      ownCtx = true;
    }
    src = ctx.createMediaStreamSource(stream);

    // Analyser on time-domain for RMS
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.0; // no smoothing — we do it ourselves
    src.connect(analyser);

    const an = analyser; // non-null capture for the closure below
    const buf = new Float32Array(an.fftSize);

    let speaking      = false;
    let lastSpeakTime = 0;

    const STOP_THR = startThreshold * 0.55; // hysteresis — stop at 55% of start threshold
    const HOLD_MS  = 280;                   // hold "speaking" 280 ms after energy drops

    // Smoothed RMS via exponential moving average (τ ≈ 60 ms)
    let smoothedRms = 0;
    const ALPHA     = 0.15; // EMA coefficient

    function tick() {
      an.getFloatTimeDomainData(buf);

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

    // ── Robust resume for WebViews (Windows/Linux/macOS) ──────────────────────
    // watchSpeaking is invoked AFTER `await getUserMedia`, i.e. OUTSIDE the original
    // user gesture. In a WebView the new AudioContext therefore starts "suspended"
    // and the single resume() above is rejected → analyser reads silence forever →
    // the speaking indicator ("poświata") never lights up even though the mic IS
    // actually capturing and sending audio. We retry resume on an interval until the
    // context is running, and also force resume on the next user interaction.
    if (ctx.state !== 'running') {
      resumeTimer = setInterval(() => {
        if (!ctx || ctx.state === 'running' || ctx.state === 'closed') {
          if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
          return;
        }
        ctx.resume().catch(() => {});
      }, 400);
      document.addEventListener('click',       gestureHandler, { passive: true });
      document.addEventListener('keydown',     gestureHandler, { passive: true });
      document.addEventListener('pointerdown', gestureHandler, { passive: true });
    }
  } catch { /* AudioContext not available, skip */ }

  return () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
    document.removeEventListener('click',       gestureHandler);
    document.removeEventListener('keydown',     gestureHandler);
    document.removeEventListener('pointerdown', gestureHandler);
    // Always disconnect our nodes (critical when reusing the shared _vadCtx so
    // sources/analysers don't accumulate across joins). Only CLOSE the context
    // if it was a private fallback — never close the shared _vadCtx.
    try { src?.disconnect(); } catch {}
    try { analyser?.disconnect(); } catch {}
    if (ownCtx && ctx) ctx.close().catch(() => {});
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
 * Rewrites the Opus codec fmtp line to enable stereo + higher bitrate.
 * Must be called on the local SDP before setLocalDescription.
 * stereo=1         → full stereo encoding
 * sprop-stereo=1   → tells remote to expect stereo
 * maxaveragebitrate=510000 → ~510 kbps ceiling (Opus tops out here)
 * usedtx=1         → discontinuous transmission — saves bandwidth in silence
 * useinbandfec=1   → in-band FEC for packet loss recovery
 */
export function preferOpusStereo(sdp: string): string {
  try {
    const lines  = sdp.split('\n');
    let inAudio  = false;
    let opusPt   = '';
    let hasFmtp  = false;
    for (const line of lines) {
      if (line.startsWith('m=audio')) { inAudio = true; continue; }
      if (line.startsWith('m=') && inAudio) break;
      if (!inAudio) continue;
      const m = line.match(/^a=rtpmap:(\d+)\s+opus/i);
      if (m) { opusPt = m[1]; }
      if (opusPt && line.startsWith(`a=fmtp:${opusPt} `)) hasFmtp = true;
    }
    if (!opusPt) return sdp;
    const opusFmtp = `a=fmtp:${opusPt} minptime=10;useinbandfec=1;usedtx=1;stereo=1;sprop-stereo=1;maxaveragebitrate=510000`;
    if (hasFmtp) {
      // Replace existing fmtp line
      return lines.map(line =>
        line.startsWith(`a=fmtp:${opusPt} `) ? opusFmtp : line
      ).join('\n');
    } else {
      // Insert fmtp after the rtpmap line
      return lines.flatMap(line => {
        if (line.match(new RegExp(`^a=rtpmap:${opusPt}\\s+opus`, 'i'))) return [line, opusFmtp];
        return [line];
      }).join('\n');
    }
  } catch {
    return sdp; // never break negotiation
  }
}

/**
 * Set encoding parameters on all audio senders: high priority + correct Opus bitrate.
 * Accepts either a raw kbps number (legacy) or a BitrateProfile (adaptive).
 * Default 128 kbps — noticeably better than 64 kbps for voice/music.
 */
export function tuneAudioSender(pc: RTCPeerConnection, bitrateKbpsOrProfile: number | BitrateProfile = 128): void {
  const bitrateKbps = typeof bitrateKbpsOrProfile === 'number'
    ? bitrateKbpsOrProfile
    : bitrateKbpsOrProfile.audioBitrateKbps;

  pc.getSenders().forEach(sender => {
    if (sender.track?.kind !== 'audio') return;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate             = bitrateKbps * 1_000;
      (params.encodings[0] as any).priority        = 'high';
      (params.encodings[0] as any).networkPriority = 'high';
      sender.setParameters(params).catch(() => {});
    } catch {}
  });
}

/**
 * Set encoding parameters on all video senders.
 * Accepts either legacy (maxBitrateMbps, maxFps) or a BitrateProfile for adaptive quality.
 * Screen share always gets high priority; webcam gets medium priority + lower bitrate.
 */
export function tuneVideoSenders(
  pc: RTCPeerConnection,
  screenStream: MediaStream | null,
  profileOrMaxMbps: BitrateProfile | number = 8,
  quality: ScreenQuality | number = 'fhd',
): void {
  // Resolve profile vs legacy call
  let screenBitrateMbps: number;
  let webcamBitrateMbps: number;
  let webcamMaxFps: number;
  let screenMaxFps: number;

  if (typeof profileOrMaxMbps === 'object') {
    // New adaptive path: BitrateProfile
    screenBitrateMbps = profileOrMaxMbps.screenBitrateMbps || 8;
    webcamBitrateMbps = profileOrMaxMbps.webcamBitrateMbps || 1.5;
    webcamMaxFps      = profileOrMaxMbps.webcamMaxFps || 30;
    screenMaxFps      = (quality === 'hd') ? 30 : 60;
  } else {
    // Legacy path: tuneVideoSenders(pc, stream, 8, 60)
    screenBitrateMbps = profileOrMaxMbps;
    webcamBitrateMbps = 1.5;
    webcamMaxFps      = 30;
    screenMaxFps      = typeof quality === 'number' ? quality : 60;
  }

  pc.getSenders().forEach(sender => {
    if (sender.track?.kind !== 'video') return;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];

      const isScreen = screenStream?.getVideoTracks().includes(sender.track as MediaStreamTrack) ?? false;

      if (isScreen) {
        params.encodings[0].maxBitrate               = screenBitrateMbps * 1_000_000;
        params.encodings[0].maxFramerate              = screenMaxFps;
        (params.encodings[0] as any).priority        = 'high';
        (params.encodings[0] as any).networkPriority = 'high';
      } else {
        // Webcam — lower priority so screen share gets the bandwidth
        params.encodings[0].maxBitrate               = webcamBitrateMbps * 1_000_000;
        params.encodings[0].maxFramerate              = webcamMaxFps;
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
    // cdnUrl is cast via `as any` — property not in published typedefs of v1.2.1
    const core = new DeepFilterNet3Core({ sampleRate: 48000, noiseReductionLevel: 70, cdnUrl: dfCdnUrl } as any);
    await core.initialize();                              // fetch WASM + model from CDN
    const worklet = await core.createAudioWorkletNode(ctx);
    const source  = ctx.createMediaStreamSource(rawStream);
    const dest    = ctx.createMediaStreamDestination();
    source.connect(worklet);
    worklet.connect(dest);
    setDFStatus('active');
    return {
      processedStream: dest.stream,
      isRunning: () => ctx.state === 'running',
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
  /** Returns true if the underlying AudioContext is actually running (not suspended).
   *  If false, the processedStream is silent — caller should fall back to raw stream. */
  isRunning: () => boolean;
}

/**
 * Wraps a raw microphone stream with the CordisNoiseProcessor AudioWorklet.
 * Returns null if the browser does not support AudioWorklet (graceful fallback).
 */
export async function applyNoiseGate(rawStream: MediaStream): Promise<NoisePipeline | null> {
  try {
    // Reuse the pre-primed _recCtx if available (already in "running" state from user gesture).
    // Creating a new AudioContext here would be after several awaits (getUserMedia etc.),
    // outside the user-gesture call stack — new context would start suspended → silent output.
    const ctx = (_recCtx && _recCtx.state !== 'closed') ? _recCtx : makeResumedCtx();
    // Ensure running (belt + suspenders)
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    // Load the worklet processor from the public folder
    await ctx.audioWorklet.addModule('/noise-processor.js');
    // Resume again — addModule() is async and may have triggered a browser suspension
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

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

    console.log('[Cordis] Noise gate active, ctx.state=', ctx.state, 'dest tracks:', dest.stream.getTracks().length);

    return {
      processedStream: dest.stream,
      cleanup: () => {
        rawStream.getTracks().forEach(t => t.stop());
        // Only close the context if we created a fresh one (not the shared _recCtx)
        if (ctx !== _recCtx) ctx.close().catch(() => {});
      },
      isRunning: () => ctx.state === 'running',
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
    // Request BOTH audio + video permissions before enumerating.
    // Linux (WebKitGTK) and macOS return empty labels for ungranted devices.
    // We stop all tracks immediately — we just need the permission grant.
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(async () => {
        // Camera unavailable or denied — try audio-only so mics still get labels
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then(s => s.getTracks().forEach(t => t.stop()))
          .catch(() => {});
      });
    return navigator.mediaDevices.enumerateDevices();
  } catch { return []; }
}
