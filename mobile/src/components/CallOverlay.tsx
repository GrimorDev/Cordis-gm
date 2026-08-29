// ─── Global 1:1 DM call UI ────────────────────────────────────────────────
// Rendered once at the app root (app/_layout.tsx) so an incoming call is
// reachable from any screen. Driven entirely by store.activeCall — actual
// signaling/media lives in src/webrtc.ts (voiceMesh) and the socket
// listeners wired in _layout.tsx.

import React from 'react';
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

  // Connected — compact floating bar so the user can keep browsing the app.
  return (
    <View style={styles.connectedBar}>
      <UserAvatar url={resolveAvatar(activeCall.peerAvatar)} username={activeCall.peerUsername} size={28} />
      <Text style={styles.connectedName} numberOfLines={1}>{activeCall.peerUsername}</Text>
      <TouchableOpacity style={styles.miniBtn} onPress={onToggleMute}>
        <Ionicons name={muted ? 'mic-off' : 'mic'} size={16} color={muted ? '#ef4444' : '#22c55e'} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.miniBtn, styles.hangupBtn]} onPress={onHangup}>
        <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  ringingOverlay: {
    flex: 1, backgroundColor: 'rgba(5,5,10,0.97)',
    alignItems: 'center', justifyContent: 'center',
  },
  ringingCard: { alignItems: 'center', gap: 8 },
  peerName: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 18 },
  callStatus: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  ringingActions: { flexDirection: 'row', gap: 28, marginTop: 48 },
  ringingBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: { backgroundColor: '#22c55e' },
  declineBtn: { backgroundColor: '#ef4444' },

  connectedBar: {
    position: 'absolute', top: 50, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0f1a12', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
    borderRadius: 16, paddingVertical: 8, paddingHorizontal: 10,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 10, zIndex: 999,
  },
  connectedName: { flex: 1, color: C.text, fontSize: 13, fontWeight: '700' },
  miniBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  hangupBtn: { backgroundColor: C.danger },
});
