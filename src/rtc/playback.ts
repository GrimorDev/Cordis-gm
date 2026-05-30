// ─── Remote audio playback — plain <audio>, no WebAudio ──────────────────────
//
// The previous implementation routed remote streams through
// AudioContext.createMediaStreamSource() → MediaStreamDestination → <audio>.
// That graph is SILENT in WebView2 / WebKitGTK (a remote WebRTC stream produces
// no samples inside WebAudio), which is why desktop "heard nobody".
//
// This module plays each remote stream through a real, in-DOM, autoplay <audio>
// element — the path that works identically on Chrome, WebView2, WebKitGTK and
// WKWebView. Volume is el.volume; output device is el.setSinkId(). No WebAudio.

interface Slot { el: HTMLAudioElement; }

const micAudios    = new Map<string, Slot>(); // remote microphone audio
const screenAudios = new Map<string, Slot>(); // remote screen-share audio (separate)

let selectedSinkId: string | null = null;

function makeEl(): HTMLAudioElement {
  const el = document.createElement('audio');
  el.autoplay = true;
  (el as any).playsInline = true;
  el.style.display = 'none';
  document.body.appendChild(el);
  if (selectedSinkId && 'setSinkId' in el) {
    (el as any).setSinkId(selectedSinkId).catch(() => {});
  }
  return el;
}

/** Play a stream through an element, retrying on the next user gesture if the
 *  autoplay policy blocks the first attempt. */
function playWithRetry(el: HTMLAudioElement): void {
  el.play().catch(() => {
    const retry = () => {
      el.play().catch(() => {});
      document.removeEventListener('click', retry);
      document.removeEventListener('keydown', retry);
      document.removeEventListener('pointerdown', retry);
    };
    document.addEventListener('click', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
    document.addEventListener('pointerdown', retry, { once: true });
  });
}

/** Attach (or re-attach) a remote user's microphone stream for playback. */
export function attachRemoteAudio(userId: string, stream: MediaStream): void {
  let slot = micAudios.get(userId);
  if (!slot) { slot = { el: makeEl() }; micAudios.set(userId, slot); }
  slot.el.muted = false;
  slot.el.srcObject = stream;
  playWithRetry(slot.el);
  console.log(`[playback] attachRemoteAudio(${userId})`);
}

/** Attach a remote user's screen-share audio (separate element so it doesn't
 *  clobber their mic audio). Starts MUTED — caller un-mutes on "join watching". */
export function attachRemoteScreenAudio(userId: string, stream: MediaStream): void {
  let slot = screenAudios.get(userId);
  if (!slot) { slot = { el: makeEl() }; screenAudios.set(userId, slot); }
  slot.el.srcObject = stream;
  playWithRetry(slot.el);
}

export function detachRemoteAudio(userId: string): void {
  const m = micAudios.get(userId);
  if (m) { m.el.srcObject = null; m.el.remove(); micAudios.delete(userId); }
  const s = screenAudios.get(userId);
  if (s) { s.el.srcObject = null; s.el.remove(); screenAudios.delete(userId); }
}

/** Tear down every remote audio element (e.g. when leaving a call). */
export function detachAllRemote(): void {
  micAudios.forEach(m => { m.el.srcObject = null; m.el.remove(); });
  screenAudios.forEach(s => { s.el.srcObject = null; s.el.remove(); });
  micAudios.clear();
  screenAudios.clear();
}

export function setRemoteVolume(userId: string, volumePct: number): void {
  const m = micAudios.get(userId);
  if (m) m.el.volume = Math.max(0, Math.min(1, volumePct / 100));
}

export function setRemoteScreenVolume(userId: string, volumePct: number): void {
  const s = screenAudios.get(userId);
  if (!s) return;
  s.el.volume = Math.max(0, Math.min(1, volumePct / 100));
  if (volumePct > 0) s.el.muted = false;
}

export function muteRemoteScreenStream(userId: string, muted: boolean): void {
  const s = screenAudios.get(userId);
  if (s) s.el.muted = muted;
}

export function muteRemoteUser(userId: string, muted: boolean): void {
  const m = micAudios.get(userId);
  if (m) m.el.muted = muted;
  const s = screenAudios.get(userId);
  if (s) s.el.muted = muted;
}

export function muteAllRemote(muted: boolean): void {
  micAudios.forEach(m => { m.el.muted = muted; });
  screenAudios.forEach(s => { s.el.muted = muted; });
}

/** Route all remote audio to the selected output device (and remember it for
 *  elements created later). */
export async function setOutputDevice(deviceId: string): Promise<void> {
  selectedSinkId = deviceId;
  const all = [...micAudios.values(), ...screenAudios.values()];
  for (const { el } of all) {
    if ('setSinkId' in el) {
      try { await (el as any).setSinkId(deviceId); } catch {}
    }
  }
}
