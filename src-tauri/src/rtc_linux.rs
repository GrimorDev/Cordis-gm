// ── Native WebRTC for Linux ─────────────────────────────────────────────────
//
// Provides Tauri commands that implement the RTCPeerConnection API natively
// using webrtc-rs (ICE, DTLS, SRTP, RTP, Opus) + cpal (mic/speaker I/O).
//
// Key design decisions:
//   • cpal::Stream is !Send, so it CANNOT live in Tauri's managed state
//     (which requires Send + Sync).  We run a dedicated std::thread that
//     owns the streams; the Tauri state only holds Send+Sync channel senders
//     and an Arc<AtomicBool> stop signal.
//   • Output audio from all remote peers is buffered in a shared ring buffer
//     (Arc<Mutex<VecDeque<f32>>>) that the cpal output thread reads from.
//   • Mic audio is broadcast from the cpal input thread to all encoder tasks
//     via a tokio broadcast channel.

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::time::Duration;

use bytes::Bytes;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use opus::{Channels, Decoder as OpusDecoder, Encoder as OpusEncoder};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::{MediaEngine, MIME_TYPE_OPUS};
use webrtc::api::APIBuilder;
use webrtc::ice_transport::ice_candidate::RTCIceCandidateInit;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::interceptor::registry::Registry;
use webrtc::media::Sample;
use webrtc::peer_connection::RTCPeerConnection;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::sdp::sdp_type::RTCSdpType;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::rtp_transceiver::rtp_codec::RTCRtpCodecCapability;
use webrtc::track::track_local::TrackLocal;
use webrtc::track::track_local::track_local_static_sample::TrackLocalStaticSample;
use webrtc::track::track_remote::TrackRemote;

// ── Constants ────────────────────────────────────────────────────────────────
const SAMPLE_RATE: u32  = 48_000;
const CHANNELS: u16     = 1;
const FRAME_SAMPLES: usize = 960;     // 20 ms at 48 kHz mono
const MIC_BUF_CAP: usize   = 16;      // broadcast channel capacity

// ── Tauri event payload types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct IceCandidatePayload {
    pub pc_id:           String,
    pub candidate:       String,
    pub sdp_mid:         Option<String>,
    pub sdp_mline_index: Option<u16>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatePayload { pub pc_id: String, pub state: String }

#[derive(Debug, Clone, Serialize)]
pub struct TrackPayload { pub pc_id: String, pub kind: String }

// ── IceServer config from JS ─────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct IceServerCfg {
    pub urls:       Vec<String>,
    pub username:   Option<String>,
    pub credential: Option<String>,
}

// ── Output ring buffer (shared between decoder tasks + cpal output) ──────────

type OutputRing = Arc<std::sync::Mutex<VecDeque<f32>>>;

// ── Per-connection state ─────────────────────────────────────────────────────

struct Peer {
    pc:          Arc<RTCPeerConnection>,
    audio_track: Arc<TrackLocalStaticSample>,
}

// ── Global RTC state (must be Send + Sync for tauri::manage) ─────────────────
//
// cpal::Stream is !Send — it NEVER lives here.
// Audio lives in a dedicated std::thread (see `start_audio`).
pub struct RtcState {
    peers:       HashMap<String, Peer>,
    mic_tx:      Option<broadcast::Sender<Vec<f32>>>,
    output_ring: Option<OutputRing>,
    audio_stop:  Option<Arc<AtomicBool>>,
}

impl RtcState {
    pub fn new() -> Self {
        RtcState { peers: HashMap::new(), mic_tx: None, output_ring: None, audio_stop: None }
    }
}

pub type SharedRtcState = Arc<tokio::sync::Mutex<RtcState>>;

// ── Audio I/O (dedicated std::thread — no Send requirement for cpal streams) ──

fn build_streams(
    mic_tx:     broadcast::Sender<Vec<f32>>,
    ring:       OutputRing,
    err_flag:   Arc<AtomicBool>,
) -> (Option<cpal::Stream>, Option<cpal::Stream>) {
    let host = cpal::default_host();

    // ── Mic (input) ──────────────────────────────────────────────────────────
    let in_stream: Option<cpal::Stream> = host.default_input_device().and_then(|dev| {
        // Try exact config first; fall back to whatever the device supports.
        let supported = dev.default_input_config().ok()?;
        let cfg = cpal::StreamConfig {
            channels:    CHANNELS,
            sample_rate: cpal::SampleRate(SAMPLE_RATE),
            buffer_size: cpal::BufferSize::Fixed(FRAME_SAMPLES as u32),
        };
        let _ = supported; // keep for reference
        let tx  = mic_tx.clone();
        let ef  = Arc::clone(&err_flag);
        let mut acc: Vec<f32> = Vec::with_capacity(FRAME_SAMPLES * 2);
        dev.build_input_stream(
            &cfg,
            move |data: &[f32], _| {
                acc.extend_from_slice(data);
                while acc.len() >= FRAME_SAMPLES {
                    let frame: Vec<f32> = acc.drain(..FRAME_SAMPLES).collect();
                    if tx.send(frame).is_err() { break; }
                }
            },
            move |e| {
                eprintln!("[rtc_linux] mic error: {e}");
                ef.store(true, Ordering::Relaxed);
            },
            None,
        ).ok()
    });

    // ── Speaker (output) ─────────────────────────────────────────────────────
    // Most Linux audio stacks (PipeWire, PulseAudio, many ALSA devices) require
    // stereo (2-channel) output; mono fails with "channel count not supported".
    // Try stereo first (duplicate mono sample to both L+R channels), then fall
    // back to mono.  If both fail, log the error so we can diagnose.
    let out_stream: Option<cpal::Stream> = host.default_output_device().and_then(|dev| {
        let ring_s = Arc::clone(&ring);
        let ef_s   = Arc::clone(&err_flag);
        let cfg_stereo = cpal::StreamConfig {
            channels:    2,
            sample_rate: cpal::SampleRate(SAMPLE_RATE),
            buffer_size: cpal::BufferSize::Default,
        };
        let stereo = dev.build_output_stream(
            &cfg_stereo,
            move |out: &mut [f32], _| {
                if let Ok(mut q) = ring_s.lock() {
                    for chunk in out.chunks_mut(2) {
                        let s = q.pop_front().unwrap_or(0.0);
                        chunk[0] = s;
                        if chunk.len() > 1 { chunk[1] = s; }
                    }
                }
            },
            move |e| {
                eprintln!("[rtc_linux] speaker stereo error: {e}");
                ef_s.store(true, Ordering::Relaxed);
            },
            None,
        );
        if let Ok(s) = stereo { return Some(s); }

        // Fallback: mono
        let ring_m = Arc::clone(&ring);
        let ef_m   = Arc::clone(&err_flag);
        let cfg_mono = cpal::StreamConfig {
            channels:    CHANNELS,
            sample_rate: cpal::SampleRate(SAMPLE_RATE),
            buffer_size: cpal::BufferSize::Default,
        };
        match dev.build_output_stream(
            &cfg_mono,
            move |out: &mut [f32], _| {
                if let Ok(mut q) = ring_m.lock() {
                    for s in out.iter_mut() { *s = q.pop_front().unwrap_or(0.0); }
                }
            },
            move |e| {
                eprintln!("[rtc_linux] speaker mono error: {e}");
                ef_m.store(true, Ordering::Relaxed);
            },
            None,
        ) {
            Ok(s) => Some(s),
            Err(e) => { eprintln!("[rtc_linux] speaker: could not open output device: {e}"); None }
        }
    });

    (in_stream, out_stream)
}

fn start_audio(s: &mut RtcState) {
    if s.audio_stop.is_some() { return; }

    let (mic_tx, _) = broadcast::channel::<Vec<f32>>(MIC_BUF_CAP);
    let output_ring: OutputRing = Arc::new(std::sync::Mutex::new(VecDeque::new()));
    let stop = Arc::new(AtomicBool::new(false));

    let mic_tx_t = mic_tx.clone();
    let ring_t   = Arc::clone(&output_ring);
    let stop_t   = Arc::clone(&stop);

    std::thread::spawn(move || {
        // Outer loop: rebuild streams when device changes / error occurs.
        // On Linux with PipeWire, ALSA errors on device hot-plug; we recover
        // by dropping the old streams and opening new ones with the current
        // default device (PipeWire routes to the currently active sink).
        'outer: loop {
            if stop_t.load(Ordering::Relaxed) { break; }

            let err_flag = Arc::new(AtomicBool::new(false));
            let (in_s, out_s) = build_streams(
                mic_tx_t.clone(), Arc::clone(&ring_t), Arc::clone(&err_flag),
            );

            if let Some(ref s) = in_s  { let _ = s.play(); }
            if let Some(ref s) = out_s { let _ = s.play(); }

            // Keep alive until stop or device error
            loop {
                if stop_t.load(Ordering::Relaxed) { break 'outer; }
                if err_flag.load(Ordering::Relaxed) {
                    eprintln!("[rtc_linux] audio device changed — rebuilding streams");
                    // Clear stale audio from ring buffer on device switch
                    if let Ok(mut q) = ring_t.lock() { q.clear(); }
                    std::thread::sleep(Duration::from_millis(300));
                    break; // drop in_s/out_s → rebuild
                }
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    });

    s.mic_tx      = Some(mic_tx);
    s.output_ring = Some(output_ring);
    s.audio_stop  = Some(stop);
}

fn stop_audio(s: &mut RtcState) {
    if let Some(stop) = s.audio_stop.take() { stop.store(true, Ordering::Relaxed); }
    s.mic_tx      = None;
    s.output_ring = None;
}

// ── webrtc-rs setup helpers ───────────────────────────────────────────────────

async fn make_api() -> Result<webrtc::api::API, String> {
    let mut me = MediaEngine::default();
    me.register_default_codecs().map_err(|e| e.to_string())?;
    let mut reg = Registry::new();
    reg = register_default_interceptors(reg, &mut me).map_err(|e| e.to_string())?;
    Ok(APIBuilder::new().with_media_engine(me).with_interceptor_registry(reg).build())
}

fn make_config(servers: &[IceServerCfg]) -> RTCConfiguration {
    let ice: Vec<RTCIceServer> = if servers.is_empty() {
        vec![RTCIceServer { urls: vec!["stun:stun.l.google.com:19302".into()], ..Default::default() }]
    } else {
        servers.iter().map(|s| RTCIceServer {
            urls:       s.urls.clone(),
            username:   s.username.clone().unwrap_or_default(),
            credential: s.credential.clone().unwrap_or_default(),
            ..Default::default()
        }).collect()
    };
    RTCConfiguration { ice_servers: ice, ..Default::default() }
}

// ── Tauri commands ────────────────────────────────────────────────────────────

/// Create a native RTCPeerConnection (JS polyfill calls this).
#[tauri::command]
pub async fn rtc_create_pc(
    id:          String,
    ice_servers: Vec<IceServerCfg>,
    app:         AppHandle,
    state:       tauri::State<'_, SharedRtcState>,
) -> Result<(), String> {

    let api    = make_api().await?;
    let pc     = Arc::new(api.new_peer_connection(make_config(&ice_servers)).await.map_err(|e| e.to_string())?);

    // Local Opus audio track (mic → this connection)
    let audio_track = Arc::new(TrackLocalStaticSample::new(
        RTCRtpCodecCapability {
            mime_type:  MIME_TYPE_OPUS.to_owned(),
            clock_rate: SAMPLE_RATE,
            channels:   CHANNELS,
            ..Default::default()
        },
        "audio".to_owned(),
        format!("cordyn-{}", &id[..8.min(id.len())]),
    ));
    pc.add_track(Arc::clone(&audio_track) as Arc<dyn TrackLocal + Send + Sync>)
        .await.map_err(|e| e.to_string())?;

    // ── Event wiring ─────────────────────────────────────────────────────────

    {   // ICE candidate → JS
        let (a, i) = (app.clone(), id.clone());
        pc.on_ice_candidate(Box::new(move |c| {
            let (a, i) = (a.clone(), i.clone());
            Box::pin(async move {
                if let Some(c) = c {
                    if let Ok(j) = c.to_json() {
                        let _ = a.emit("rtc_ice_candidate", IceCandidatePayload {
                            pc_id:           i,
                            candidate:       j.candidate,
                            sdp_mid:         j.sdp_mid,
                            sdp_mline_index: j.sdp_mline_index,
                        });
                    }
                }
            })
        }));
    }

    {   // Connection state → JS
        let (a, i) = (app.clone(), id.clone());
        pc.on_peer_connection_state_change(Box::new(move |s: RTCPeerConnectionState| {
            let (a, i) = (a.clone(), i.clone());
            Box::pin(async move {
                let st = match s {
                    RTCPeerConnectionState::New          => "new",
                    RTCPeerConnectionState::Connecting   => "connecting",
                    RTCPeerConnectionState::Connected    => "connected",
                    RTCPeerConnectionState::Disconnected => "disconnected",
                    RTCPeerConnectionState::Failed       => "failed",
                    RTCPeerConnectionState::Closed       => "closed",
                    _                                    => "unknown",
                };
                let _ = a.emit("rtc_connection_state", StatePayload { pc_id: i, state: st.to_owned() });
            })
        }));
    }

    // NOTE: We do NOT wire on_negotiation_needed to a Tauri event here.
    // Reason: Rust fires this immediately when the audio track is added, before
    // JS has a chance to call setRemoteDescription (offer).  The premature
    // onnegotiationneeded causes engine.ts to call setLocalDescription(offer)
    // which sets current_local_description, and then create_answer() fails with
    // "new sdp does not match previous answer" because webrtc-rs tries to match
    // the new answer against the already-cached local offer.
    //
    // Instead, onnegotiationneeded is fired from the JS polyfill's addTrack()
    // which is called synchronously by engine.ts in the correct order.

    {   // Remote track → Opus decode → output ring buffer
        let (a, i)    = (app.clone(), id.clone());
        let s_clone   = Arc::clone(state.inner());

        // In webrtc-rs 0.11, on_track gives Arc<TrackRemote> (not Option)
        pc.on_track(Box::new(move |track: Arc<TrackRemote>, _recv, _trans| {
            let (a, i)  = (a.clone(), i.clone());
            let s_clone = Arc::clone(&s_clone);
            Box::pin(async move {
                if track.kind().to_string() != "audio" { return; }
                let _ = a.emit("rtc_track_added", TrackPayload { pc_id: i, kind: "audio".into() });

                // Grab ring buffer reference (release lock immediately)
                let ring = {
                    let g = s_clone.lock().await;
                    g.output_ring.clone()
                };
                let Some(ring) = ring else { return };

                let mut dec = match OpusDecoder::new(SAMPLE_RATE, Channels::Mono) {
                    Ok(d) => d,
                    Err(e) => { eprintln!("[rtc_linux] opus decoder init: {e}"); return; }
                };
                let mut pcm_buf = vec![0f32; FRAME_SAMPLES * 6];

                loop {
                    let Ok((rtp, _)) = track.read_rtp().await else { break };
                    if rtp.payload.is_empty() { continue; }
                    match dec.decode_float(rtp.payload.as_ref(), &mut pcm_buf, false) {
                        Ok(n) => {
                            if let Ok(mut q) = ring.lock() {
                                q.extend(pcm_buf[..n].iter().copied());
                            }
                        }
                        Err(e) => eprintln!("[rtc_linux] opus decode: {e}"),
                    }
                }
            })
        }));
    }

    // ── Start audio I/O, subscribe to mic, insert peer ───────────────────────
    let mic_rx = {
        let mut g = state.inner().lock().await;
        start_audio(&mut g);
        let rx = g.mic_tx.as_ref().map(|tx| tx.subscribe());
        g.peers.insert(id.clone(), Peer { pc, audio_track: Arc::clone(&audio_track) });
        rx
    };

    // ── Encoder task: mic frames → Opus → webrtc-rs audio track ─────────────
    if let Some(mut rx) = mic_rx {
        tokio::spawn(async move {
            let mut enc = match OpusEncoder::new(SAMPLE_RATE, Channels::Mono, opus::Application::Voip) {
                Ok(e) => e,
                Err(e) => { eprintln!("[rtc_linux] opus encoder init: {e}"); return; }
            };
            let mut encoded = vec![0u8; 4000];

            loop {
                let frame: Vec<f32> = match rx.recv().await {
                    Ok(f) => f,
                    Err(_) => break, // sender dropped → peer closed
                };
                match enc.encode_float(&frame, &mut encoded) {
                    Ok(n) => {
                        let sample = Sample {
                            data:     Bytes::copy_from_slice(&encoded[..n]),
                            duration: Duration::from_millis(20),
                            ..Default::default()
                        };
                        if audio_track.write_sample(&sample).await.is_err() { break; }
                    }
                    Err(e) => eprintln!("[rtc_linux] opus encode: {e}"),
                }
            }
        });
    }

    Ok(())
}

/// Create an SDP offer and set it as local description.
#[tauri::command]
pub async fn rtc_create_offer(
    id:    String,
    state: tauri::State<'_, SharedRtcState>,
) -> Result<String, String> {
    // Extract Arc<RTCPeerConnection>, drop lock before awaiting.
    // Do NOT set local description here — JS will call setLocalDescription(mungedSdp)
    // after munging (preferH264, preferOpusStereo).  Calling set_local_description twice
    // (once here with original SDP and once from JS with munged SDP) puts webrtc-rs into
    // an invalid signaling state and breaks the answer flow.
    let pc  = state.inner().lock().await
        .peers.get(&id).ok_or("peer not found")?.pc.clone();
    let sdp = pc.create_offer(None).await.map_err(|e| e.to_string())?.sdp;
    Ok(sdp)
}

/// Create an SDP answer (called by JS after setRemoteDescription(offer)).
/// Returns the raw answer SDP; JS will call setLocalDescription with it.
#[tauri::command]
pub async fn rtc_create_answer(
    id:    String,
    state: tauri::State<'_, SharedRtcState>,
) -> Result<String, String> {
    let pc  = state.inner().lock().await
        .peers.get(&id).ok_or("peer not found")?.pc.clone();
    let sdp = pc.create_answer(None).await.map_err(|e| e.to_string())?.sdp;
    Ok(sdp)
}

/// Set local description (JS calls after createOffer/createAnswer returns the SDP).
#[tauri::command]
pub async fn rtc_set_local_description(
    id:     String,
    r#type: String,
    sdp:    String,
    state:  tauri::State<'_, SharedRtcState>,
) -> Result<(), String> {
    let pc = state.inner().lock().await
        .peers.get(&id).ok_or("peer not found")?.pc.clone();
    let desc = if r#type == "offer" {
        RTCSessionDescription::offer(sdp).map_err(|e| e.to_string())?
    } else {
        RTCSessionDescription::answer(sdp).map_err(|e| e.to_string())?
    };
    pc.set_local_description(desc).await.map_err(|e| e.to_string())
}

/// Set remote description.  Always returns "".
#[tauri::command]
pub async fn rtc_set_remote_description(
    id:     String,
    r#type: String,
    sdp:    String,
    state:  tauri::State<'_, SharedRtcState>,
) -> Result<String, String> {
    let pc = state.inner().lock().await
        .peers.get(&id).ok_or("peer not found")?.pc.clone();

    let desc = if r#type == "offer" {
        RTCSessionDescription::offer(sdp).map_err(|e| e.to_string())?
    } else {
        RTCSessionDescription::answer(sdp).map_err(|e| e.to_string())?
    };
    pc.set_remote_description(desc).await.map_err(|e| e.to_string())?;
    Ok(String::new())
}

/// Add a remote ICE candidate.
#[tauri::command]
pub async fn rtc_add_ice_candidate(
    id:              String,
    candidate:       String,
    sdp_mid:         Option<String>,
    sdp_mline_index: Option<u16>,
    state:           tauri::State<'_, SharedRtcState>,
) -> Result<(), String> {
    let pc = state.inner().lock().await
        .peers.get(&id).ok_or("peer not found")?.pc.clone();
    // RTCIceCandidateInit field names (webrtc-rs 0.11):
    let init = RTCIceCandidateInit {
        candidate,
        sdp_mid:           sdp_mid,
        sdp_mline_index:   sdp_mline_index,
        username_fragment: None,
    };
    pc.add_ice_candidate(init).await.map_err(|e| e.to_string())
}

/// Close and remove a peer connection.
#[tauri::command]
pub async fn rtc_close_pc(
    id:    String,
    state: tauri::State<'_, SharedRtcState>,
) -> Result<(), String> {
    let pc = {
        let mut g = state.inner().lock().await;
        let peer = g.peers.remove(&id);
        if g.peers.is_empty() { stop_audio(&mut g); }
        peer.map(|p| p.pc)
    };
    if let Some(pc) = pc { let _ = pc.close().await; }
    Ok(())
}

/// List available audio devices via cpal.
/// Returns [{id, name, kind}] where kind = "input" | "output".
/// Use this on Linux instead of navigator.mediaDevices.enumerateDevices()
/// which may miss output devices or fail to update after hot-plug.
#[tauri::command]
pub async fn rtc_list_audio_devices() -> Vec<serde_json::Value> {
    use cpal::traits::HostTrait;
    use cpal::traits::DeviceTrait;
    let host = cpal::default_host();
    let mut result = Vec::new();

    // host.input_devices() → Result<impl Iterator<Item=Device>, _>
    // After if-let the inner value IS the iterator — no .flatten() needed.
    if let Ok(inputs) = host.input_devices() {
        for dev in inputs {
            let name = dev.name().unwrap_or_else(|_| "Unknown".to_owned());
            result.push(serde_json::json!({ "id": name.clone(), "name": name, "kind": "input" }));
        }
    }
    if let Ok(outputs) = host.output_devices() {
        for dev in outputs {
            let name = dev.name().unwrap_or_else(|_| "Unknown".to_owned());
            result.push(serde_json::json!({ "id": name.clone(), "name": name, "kind": "output" }));
        }
    }
    result
}

/// Set remote peer audio volume (0.0–1.0).  Stub — full per-peer mixing later.
#[tauri::command]
pub async fn rtc_set_volume(
    _id:    String,
    _vol:   f32,
    _state: tauri::State<'_, SharedRtcState>,
) -> Result<(), String> { Ok(()) }

/// Mute/unmute local mic.  Stub — silence injection in encoder task later.
#[tauri::command]
pub async fn rtc_set_muted(
    _id:    String,
    _muted: bool,
    _state: tauri::State<'_, SharedRtcState>,
) -> Result<(), String> { Ok(()) }
