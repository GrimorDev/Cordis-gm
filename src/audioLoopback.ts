/**
 * Tauri WASAPI loopback → MediaStreamTrackGenerator bridge.
 * Captures system audio (what's playing through Windows speakers) via Rust,
 * and exposes it as a MediaStreamTrack for WebRTC.
 *
 * Requires: Chromium 94+ (MediaStreamTrackGenerator + AudioData API).
 * Only active when isTauri is true.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

let _unlisten: UnlistenFn | null = null;
let _generator: any = null;
let _writer: WritableStreamDefaultWriter | null = null;
let _timestamp = 0;          // microseconds, monotonic
let _sampleRate = 48000;
let _channels = 2;

/** Start Rust-side WASAPI loopback and return a MediaStreamTrack (audio). */
export async function startLoopbackCapture(): Promise<MediaStreamTrack | null> {
  // MediaStreamTrackGenerator requires Chromium 94+ (WebView2 on Win10/11 ✔)
  if (!('MediaStreamTrackGenerator' in window)) {
    console.warn('[Loopback] MediaStreamTrackGenerator not available');
    return null;
  }

  // Stop any running capture first
  await stopLoopbackCapture();

  try {
    const info = await invoke<{ sample_rate: number; channels: number }>('start_audio_loopback');
    _sampleRate = info.sample_rate;
    _channels   = info.channels;
    _timestamp  = 0;

    _generator = new (window as any).MediaStreamTrackGenerator({ kind: 'audio' });
    _writer    = _generator.writable.getWriter();

    _unlisten = await listen<string>('audio_loopback_chunk', async (event) => {
      if (!_writer || _generator?.readyState === 'ended') return;
      try {
        // Decode base64 → bytes → Float32Array
        const bin   = atob(event.payload);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const samples = new Float32Array(bytes.buffer);

        const nFrames = Math.floor(samples.length / _channels);
        if (nFrames === 0) return;

        const ad = new (window as any).AudioData({
          format:           'f32',
          sampleRate:       _sampleRate,
          numberOfFrames:   nFrames,
          numberOfChannels: _channels,
          timestamp:        _timestamp,
          data:             samples,
        });
        _timestamp += (nFrames / _sampleRate) * 1_000_000; // advance microseconds

        await _writer.write(ad);
        ad.close();
      } catch (e) {
        console.warn('[Loopback] chunk error:', e);
      }
    });

    console.log(`[Loopback] started — ${_sampleRate}Hz × ${_channels}ch`);
    return _generator as MediaStreamTrack;
  } catch (e) {
    console.warn('[Loopback] failed to start:', e);
    await stopLoopbackCapture();
    return null;
  }
}

/** Stop Rust-side capture and close the track. */
export async function stopLoopbackCapture(): Promise<void> {
  if (_unlisten) { _unlisten(); _unlisten = null; }
  try { await invoke('stop_audio_loopback'); } catch {}
  try { await _writer?.close(); } catch {}
  _writer    = null;
  _generator = null;
}
