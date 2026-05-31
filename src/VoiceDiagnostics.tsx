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

  // Mic test state
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);          // 0..1 RMS
  const [micInfo, setMicInfo] = useState<string>('');
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef<number | null>(null);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, autoGainControl: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;
      const tracks = stream.getAudioTracks();
      setMicInfo(tracks.map(t => `"${t.label || 'mic'}" state=${t.readyState} enabled=${t.enabled} muted=${t.muted}`).join(' | ') || 'BRAK ścieżek audio!');

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

  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: '16px' }}>
      <span style={{ color: '#888', minWidth: 92 }}>{k}</span>
      <span style={{ color: '#ddd', wordBreak: 'break-all' }}>{v}</span>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="Diagnostyka głosu (Ctrl+Shift+D)"
        style={{
          position: 'fixed', right: 10, bottom: 10, zIndex: 99998,
          width: 34, height: 34, borderRadius: 8, border: '1px solid #444',
          background: open ? '#3b82f6' : 'rgba(20,20,24,.85)', color: '#fff',
          cursor: 'pointer', fontSize: 16,
        }}
      >🔧</button>

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
          {row('tryb', bundled ? 'BUNDLED (binarka v1206)' : 'remote (cordyn.pl)')}
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
          {row('local→send', localKinds.length ? localKinds.join(', ') : '— (brak mikrofonu w engine)')}
          {peers.length === 0 && row('', <i style={{ color: '#888' }}>brak połączeń — nikogo na kanale lub sygnalizacja nie zadziałała</i>)}
          {peers.map(p => (
            <div key={p.id} style={{ border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 6px', margin: '3px 0' }}>
              {row('peer', p.id.slice(0, 8))}
              {row('conn', <b style={{ color: p.conn === 'connected' ? '#4ade80' : p.conn === 'failed' ? '#f87171' : '#fbbf24' }}>{p.conn}</b>)}
              {row('ice/sig', `${p.ice} / ${p.sig}`)}
              {row('send/recv', `[${p.send.join(',') || '∅'}] / [${p.recv.join(',') || '∅'}]`)}
            </div>
          ))}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', margin: '8px 0 2px' }}>Test mikrofonu</div>
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>{micInfo || 'kliknij Start i mów do mikrofonu'}</div>
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
