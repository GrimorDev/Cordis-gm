// ─── Global 1:1 DM call UI ────────────────────────────────────────────────
// Rendered once at the app root (app/_layout.tsx) so an incoming call is
// reachable from any screen. Driven entirely by store.activeCall — actual
// signaling/media lives in src/webrtc.ts (voiceMesh) and the socket
// listeners wired in _layout.tsx.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from './UserAvatar';
import { C } from '../theme';
import { useStore } from '../store';
import { STATIC_BASE } from '../config';

function resolveAvatar(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CallOverlay({
  onAccept,
  onDecline,
  onHangup,
  onToggleMute,
  muted,
}: {
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  muted: boolean;
}) {
  const { activeCall } = useStore();
  const [minimized, setMinimized] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const connectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeCall?.status === 'connected') {
      if (connectedAtRef.current === null) connectedAtRef.current = Date.now();
      const interval = setInterval(() => {
        setDurationSec(Math.floor((Date.now() - (connectedAtRef.current ?? Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
    connectedAtRef.current = null;
    setDurationSec(0);
  }, [activeCall?.status]);

  useEffect(() => {
    if (!activeCall) setMinimized(false);
  }, [activeCall]);

  if (!activeCall) return null;

  // Ringing (incoming or outgoing) — full-screen takeover, like a real phone call.
  if (activeCall.status === 'incoming' || activeCall.status === 'outgoing') {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.ringingOverlay}>
          <View style={styles.ringingCard}>
            <UserAvatar url={resolveAvatar(activeCall.peerAvatar)} username={activeCall.peerUsername} size={96} />
            <Text style={styles.peerName}>{activeCall.peerUsername}</Text>
            <Text style={styles.callStatus}>
              {activeCall.status === 'incoming' ? 'Połączenie głosowe…' : 'Dzwonię…'}
            </Text>

            {activeCall.status === 'incoming' ? (
              <View style={styles.ringingActions}>
                <TouchableOpacity style={[styles.ringingBtn, styles.declineBtn]} onPress={onDecline}>
                  <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ringingBtn, styles.acceptBtn]} onPress={onAccept}>
                  <Ionicons name="call" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ringingActions}>
                <TouchableOpacity style={[styles.ringingBtn, styles.declineBtn]} onPress={onDecline}>
                  <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // Connected + minimized — compact floating bar, tap to expand back to full screen.
  if (minimized) {
    return (
      <TouchableOpacity
        style={styles.connectedBar}
        activeOpacity={0.85}
        onPress={() => setMinimized(false)}
      >
        <UserAvatar url={resolveAvatar(activeCall.peerAvatar)} username={activeCall.peerUsername} size={28} />
        <Text style={styles.connectedName} numberOfLines={1}>{activeCall.peerUsername}</Text>
        <Text style={styles.connectedDuration}>{fmtDuration(durationSec)}</Text>
        <TouchableOpacity style={styles.miniBtn} onPress={onToggleMute}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={16} color={muted ? '#ef4444' : '#22c55e'} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.miniBtn, styles.hangupBtn]} onPress={onHangup}>
          <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // Connected — full-screen call UI (default), like a real phone call screen.
  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.ringingOverlay}>
        <TouchableOpacity style={styles.minimizeBtn} onPress={() => setMinimized(true)}>
          <Ionicons name="chevron-down" size={26} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={styles.ringingCard}>
          <UserAvatar url={resolveAvatar(activeCall.peerAvatar)} username={activeCall.peerUsername} size={112} />
          <Text style={styles.peerName}>{activeCall.peerUsername}</Text>
          <View style={styles.connectedStatusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.callStatus}>{fmtDuration(durationSec)}</Text>
          </View>

          <View style={styles.ringingActions}>
            <TouchableOpacity style={[styles.ringingBtn, styles.muteBtn, muted && styles.muteBtnActive]} onPress={onToggleMute}>
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ringingBtn, styles.declineBtn]} onPress={onHangup}>
              <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ringingOverlay: {
    flex: 1, backgroundColor: 'rgba(5,5,10,0.97)',
    alignItems: 'center', justifyContent: 'center',
  },
  minimizeBtn: {
    position: 'absolute', top: 50, left: 16,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ringingCard: { alignItems: 'center', gap: 8 },
  peerName: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 18 },
  callStatus: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  connectedStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  ringingActions: { flexDirection: 'row', gap: 28, marginTop: 48 },
  ringingBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: { backgroundColor: '#22c55e' },
  declineBtn: { backgroundColor: '#ef4444' },
  muteBtn: { backgroundColor: 'rgba(255,255,255,0.1)' },
  muteBtnActive: { backgroundColor: '#ef4444' },

  connectedBar: {
    position: 'absolute', top: 50, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f1a12', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
    borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 10, zIndex: 999,
  },
  connectedName: { flex: 1, color: C.text, fontSize: 13, fontWeight: '700' },
  connectedDuration: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  miniBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  hangupBtn: { backgroundColor: C.danger },
});
