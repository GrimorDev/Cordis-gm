// ─── WebRTC Utilities for Cordis ─────────────────────────────────────────────

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

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
const remoteAudios = new Map<string, HTMLAudioElement>();

export function attachRemoteAudio(userId: string, stream: MediaStream) {
  let el = remoteAudios.get(userId);
  if (!el) {
    el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    remoteAudios.set(userId, el);
  }
  el.srcObject = stream;
}

export function detachRemoteAudio(userId: string) {
  const el = remoteAudios.get(userId);
  if (el) { el.srcObject = null; el.remove(); remoteAudios.delete(userId); }
}

export function muteAllRemote(muted: boolean) {
  remoteAudios.forEach(el => { el.muted = muted; });
}

export async function setOutputDevice(deviceId: string) {
  for (const el of remoteAudios.values()) {
    if ('setSinkId' in el) {
      try { await (el as any).setSinkId(deviceId); } catch {}
    }
  }
}

// ─── Speaking Detection ──────────────────────────────────────────────────────
export function watchSpeaking(
  stream: MediaStream,
  onChange: (speaking: boolean) => void,
  threshold = 18,
): () => void {
  let ctx: AudioContext | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  try {
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    src.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false;

    interval = setInterval(() => {
      analyser.getByteFrequencyData(data);
      // Voice frequency range roughly bins 2–28
      let sum = 0;
      for (let i = 2; i < 28; i++) sum += data[i];
      const avg = sum / 26;
      const now = avg > threshold;
      if (now !== speaking) { speaking = now; onChange(now); }
    }, 80);
  } catch { /* AudioContext not available, skip */ }

  return () => {
    if (interval) clearInterval(interval);
    if (ctx) ctx.close().catch(() => {});
  };
}

// ─── Device Enumeration ──────────────────────────────────────────────────────
export async function getMediaDevices(): Promise<MediaDeviceInfo[]> {
  try {
    // Need permission first to get labels
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
    return navigator.mediaDevices.enumerateDevices();
  } catch { return []; }
}
