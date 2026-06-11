// ─── On-screen voice diagnostics ─────────────────────────────────────────────
// A self-contained panel that makes the invisible visible on desktop where the
// devtools console is unavailable. Toggle with the 🔧 button (bottom-right) or
// Ctrl+Shift+D. Shows: build/origin, socket state, per-peer WebRTC state, and a
// LIVE microphone level meter (independent of WebRTC) so we can tell at a glance
// whether the mic actually captures audio on this machine.

import { useEffect, useRef, useState } from 'react';
import { API_BASE, STATIC_BASE } from './api';
import { getSocket, SOCKET_URL } from './socket';
import type { VoiceEngine } from './rtc/engine';

interface Props {
  engineRef: React.MutableRefObject<VoiceEngine | null>;
}

export default function VoiceDiagnostics({ engineRef }: Props) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  // ── Real outbound/inbound audio RTP byte counters (ground truth) ─────────
  // connectionState can read "connected" while the actual media path is dead
  // silent (exactly the "I light up but nobody hears me" desktop bug). Polling
  // getStats() and showing the byte-rate makes that distinction visible:
  //   rate > 0   → audio genuinely flows
  //   rate == 0  → connection is up but NO audio data is leaving/arriving
  const [rtpStats, setRtpStats] = useState<Record<string, { outRate: number; outPackets: number; inRate: number; inPackets: number }>>({});
  const prevRtpRef = useRef<Record<string, { outBytes: number; inBytes: number; ts: number }>>({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const poll = async () => {
      const eng = engineRef.current;
      if (!eng) return;
      const stats = await eng.audioRtpStats();
      if (cancelled) return;
      const now = Date.now();
      const next: typeof rtpStats = {};
      for (const s of stats) {
        const prev = prevRtpRef.current[s.id];
        const dt = prev ? Math.max(0.25, (now - prev.ts) / 1000) : 1;
        next[s.id] = {
          outRate: prev ? Math.max(0, (s.outBytes - prev.outBytes) / dt) : 0,
          inRate:  prev ? Math.max(0, (s.inBytes  - prev.inBytes ) / dt) : 0,
          outPackets: s.outPackets, inPackets: s.inPackets,
        };
        prevRtpRef.current[s.id] = { outBytes: s.outBytes, inBytes: s.inBytes, ts: now };
      }
      setRtpStats(next);
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, engineRef]);

  // Mic test state
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);          // 0..1 RMS
  const [micInfo, setMicInfo] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selDev, setSelDev] = useState<string>('');     // '' = system default
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef<number | null>(null);

  const enumerate = () => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then(list => setDevices(list.filter(d => d.kind === 'audioinput')))
      .catch(() => {});
  };
  useEffect(() => { if (open) enumerate(); }, [open]);

  // Toggle via Ctrl+Shift+D
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Refresh peer/socket state while open
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => force(n => n + 1), 800);
    return () => clearInterval(id);
  }, [open]);

  const stopMicTest = () => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    micRafRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;
    setMicTesting(false);
    setMicLevel(0);
  };

  // Runs inside the click gesture → AudioContext starts "running" even in WebViews.
  const startMicTest = async () => {
    try {
      setMicInfo('proszę o dostęp do mikrofonu…');
      const audio: MediaTrackConstraints = {
        echoCancellation: true, autoGainControl: true, noiseSuppression: true,
        ...(selDev ? { deviceId: { exact: selDev } } : {}),
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      micStreamRef.current = stream;
      const tracks = stream.getAudioTracks();
      // Show the ACTUAL device that was captured (settings.deviceId) vs what we asked
      // for — reveals when the WebView ignores deviceId and forces the OS default.
      const got = tracks[0]?.getSettings?.().deviceId || '?';
      const wanted = selDev || '(default)';
      setMicInfo(`chciałem=${wanted.slice(0,8)} dostałem=${String(got).slice(0,8)} | ` +
        (tracks.map(t => `"${t.label || 'mic'}" state=${t.readyState} muted=${t.muted}`).join(' | ') || 'BRAK ścieżek audio!'));
      enumerate(); // labels populate after grant

      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new Ctx({ sampleRate: 48000 });
      micCtxRef.current = ctx;
      await ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      setMicTesting(true);

      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        setMicLevel(Math.min(1, rms * 4));   // scale for visibility
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e: any) {
      setMicInfo(`BŁĄD getUserMedia: ${e?.name || ''} ${e?.message || e}`);
      setMicTesting(false);
    }
  };

  useEffect(() => () => stopMicTest(), []);

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const bundled = origin.startsWith('tauri://') || origin.includes('tauri.localhost');
  let sock: any = null;
  try { sock = getSocket(); } catch {}
  const peers = engineRef.current?.peerDiagnostics() ?? [];
  const localKinds = engineRef.current?.localTrackKinds() ?? [];
  const st = engineRef.current?.diagnosticsStats?.();
  const rtcOk = typeof RTCPeerConnection === 'function';
  const nativePolyfill = (window as any).__nativeRtcPolyfill === true;

  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: '16px' }}>
      <span style={{ color: '#888', minWidth: 92 }}>{k}</span>
      <span style={{ color: '#ddd', wordBreak: 'break-all' }}>{v}</span>
    </div>
  );

  // Floating button removed per request — panel still opens with Ctrl+Shift+D.
  return (
    <>
      {open && (
        <div style={{
          position: 'fixed', right: 10, bottom: 52, zIndex: 99999,
          width: 360, maxHeight: '70vh', overflowY: 'auto',
          background: 'rgba(12,12,16,.97)', border: '1px solid #333', borderRadius: 10,
          padding: 12, color: '#ddd', fontFamily: 'monospace',
          boxShadow: '0 8px 32px rgba(0,0,0,.6)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#fff' }}>
            🔊 Diagnostyka rozmów
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', margin: '6px 0 2px' }}>Środowisko</div>
          {row('tryb', bundled ? 'BUNDLED (lokalny JS w binarce)' : 'remote (cordyn.pl)')}
          {row('isTauri', String(isTauri))}
          {row('origin', origin)}
          {row('API_BASE', API_BASE)}
          {row('SOCKET_URL', SOCKET_URL)}
          {row('STATIC', STATIC_BASE)}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', margin: '8px 0 2px' }}>Socket</div>
          {row('connected', <b style={{ color: sock?.connected ? '#4ade80' : '#f87171' }}>{String(!!sock?.connected)}</b>)}
          {row('id', sock?.id || '—')}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', margin: '8px 0 2px' }}>
            WebRTC ({peers.length} peer{peers.length !== 1 ? 'ów' : ''})
          </div>
          {row('RTCPeerConn', <b style={{ color: rtcOk ? '#4ade80' : '#f87171' }}>{rtcOk ? 'available' : 'MISSING — WebRTC OFF!'}</b>)}
          {row('backend', nativePolyfill
            ? <b style={{ color: '#fbbf24' }}>Rust/cpal polyfill — TYLKO AUDIO (brak kamery/ekranu)</b>
            : <b style={{ color: '#4ade80' }}>WebKitGTK natywny — kamera + ekran OK</b>)}
          {row('local→send', localKinds.length ? localKinds.join(', ') : '— (brak mikrofonu w engine)')}
          {(() => {
            const mic = engineRef.current?.localAudioTrackInfo?.();
            if (!mic) return null;
            const ok = mic.enabled && mic.readyState === 'live' && !mic.muted;
            return row('mic track', <span>
              "{mic.label || '?'}" enabled=<b style={{ color: mic.enabled ? '#4ade80' : '#f87171' }}>{String(mic.enabled)}</b>{' '}
              state={mic.readyState} muted={String(mic.muted)}{' '}
              {!ok && <b style={{ color: '#f87171' }}>← TU JEST PROBLEM (track nie transmituje!)</b>}
            </span>);
          })()}
          {st && row('signaling', `offers↓${st.offersRecv} answers↓${st.answersRecv} ice↓${st.iceRecv}`)}
          {st && row('connect()', `calls=${st.connectCalls} peersMade=${st.peersCreated}`)}
          {st && st.lastError && row('lastError', <span style={{ color: '#f87171' }}>{st.lastError}</span>)}
          {peers.length === 0 && row('', <i style={{ color: '#888' }}>brak połączeń — sprawdź powyższe liczniki</i>)}
          {peers.map(p => {
            const rtp = rtpStats[p.id];
            const sendingAudio = p.send.includes('audio');
            const outDead = sendingAudio && p.conn === 'connected' && rtp && rtp.outPackets > 0 && rtp.outRate < 50;
            return (
            <div key={p.id} style={{ border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 6px', margin: '3px 0' }}>
              {row('peer', p.id.slice(0, 8))}
              {row('conn', <b style={{ color: p.conn === 'connected' ? '#4ade80' : p.conn === 'failed' ? '#f87171' : '#fbbf24' }}>{p.conn}</b>)}
              {row('ice/sig', `${p.ice} / ${p.sig}`)}
              {row('send/recv', `[${p.send.join(',') || '∅'}] / [${p.recv.join(',') || '∅'}]`)}
              {sendingAudio && row('audio ↑ (realnie)', rtp
                ? <span>
                    <b style={{ color: rtp.outRate >= 50 ? '#4ade80' : '#f87171' }}>{(rtp.outRate / 1000).toFixed(2)} KB/s</b>
                    {' · '}{rtp.outPackets} pakietów
                    {outDead && <b style={{ color: '#f87171' }}> ← WYSYŁA 0 BAJTÓW! (cisza mimo "connected")</b>}
                  </span>
                : 'mierzę…')}
              {p.recv.includes('audio') && row('audio ↓ (realnie)', rtp
                ? <span><b style={{ color: rtp.inRate >= 50 ? '#4ade80' : '#fbbf24' }}>{(rtp.inRate / 1000).toFixed(2)} KB/s</b>{' · '}{rtp.inPackets} pakietów</span>
                : 'mierzę…')}
            </div>
          );})}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', margin: '8px 0 2px' }}>Test mikrofonu</div>
          <select
            value={selDev}
            onChange={e => { setSelDev(e.target.value); if (micTesting) { stopMicTest(); } }}
            style={{ width: '100%', fontSize: 10, padding: '4px 6px', marginBottom: 5,
                     background: '#1a1a20', color: '#ddd', border: '1px solid #333', borderRadius: 6 }}
          >
            <option value="">— systemowy domyślny —</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 12)}</option>
            ))}
          </select>
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>{micInfo || 'wybierz urządzenie, kliknij Start i mów'}</div>
          <div style={{ height: 14, background: '#222', borderRadius: 7, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              height: '100%', width: `${Math.round(micLevel * 100)}%`,
              background: micLevel > 0.05 ? '#4ade80' : '#555', transition: 'width .05s linear',
            }} />
          </div>
          <div style={{ fontSize: 10, color: micLevel > 0.05 ? '#4ade80' : '#888', marginBottom: 6 }}>
            poziom: {(micLevel * 100).toFixed(0)}% {micTesting && micLevel < 0.02 ? '← CISZA (mikrofon nie łapie!)' : micLevel > 0.05 ? '← ŁAPIE ✓' : ''}
          </div>
          {!micTesting
            ? <button onClick={startMicTest} style={btn('#16a34a')}>▶ Start testu</button>
            : <button onClick={stopMicTest} style={btn('#dc2626')}>■ Stop</button>}
        </div>
      )}
    </>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  };
}
