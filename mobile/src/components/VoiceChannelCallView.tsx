// ─── Full-screen voice-channel call view ─────────────────────────────────
// Shows a tile per connected participant (avatar, mute state) and, when a
// peer is sharing their screen, renders their video track via RTCView
// instead of the avatar. Minimizes to the existing compact voice bar in
// (app)/index.tsx — this component owns only the expanded state.

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from './UserAvatar';
import { C } from '../theme';
import { useStore } from '../store';
import { voiceMesh, type RemoteStreams } from '../webrtc';

export function VoiceChannelCallView({
  visible,
  channelId,
  channelName,
  onMinimize,
  onLeave,
  onToggleMute,
  muted,
}: {
  visible: boolean;
  channelId: string;
  channelName: string;
  onMinimize: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  muted: boolean;
}) {
  const { voiceUsers, voiceUserMuted, currentUser } = useStore();
  const participants = voiceUsers[channelId] ?? [];
  const [remoteStreams, setRemoteStreams] = useState<Record<string, RemoteStreams>>({});

  useEffect(() => {
    voiceMesh.configure({
      onRemoteStreamsChanged: (peerId, streams) => {
        setRemoteStreams(prev => ({ ...prev, [peerId]: streams }));
      },
      onPeerRemoved: (peerId) => {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      },
      onError: (message) => console.warn('[Cordyn] voice mesh error:', message),
    });
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.minimizeBtn} onPress={onMinimize}>
            <Ionicons name="chevron-down" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={styles.channelName} numberOfLines={1}>#{channelName}</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={participants}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={32} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>Tylko Ty jesteś w tym kanale</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.id === currentUser?.id;
            const isMuted = isMe ? muted : (voiceUserMuted[item.id] ?? false);
            const screen = remoteStreams[item.id]?.video;
            return (
              <View style={styles.tile}>
                {screen ? (
                  <RTCView streamURL={screen.toURL()} style={styles.tileVideo} objectFit="cover" />
                ) : (
                  <View style={styles.tileAvatarWrap}>
                    <UserAvatar url={item.avatar_url} username={item.username} size={56} />
                  </View>
                )}
                <View style={styles.tileFooter}>
                  <Text style={styles.tileName} numberOfLines={1}>{isMe ? 'Ty' : item.username}</Text>
                  <Ionicons
                    name={isMuted ? 'mic-off' : 'mic'}
                    size={13}
                    color={isMuted ? '#ef4444' : '#22c55e'}
                  />
                </View>
                {screen && (
                  <View style={styles.sharingBadge}>
                    <Ionicons name="tv-outline" size={11} color="#fff" />
                    <Text style={styles.sharingBadgeText}>Udostępnia</Text>
                  </View>
                )}
              </View>
            );
          }}
        />

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.controlBtn, muted && styles.controlBtnActive]} onPress={onToggleMute}>
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, styles.hangupBtn]} onPress={onLeave}>
            <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050a08' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
  },
  minimizeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  channelName: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '700' },
  grid: { padding: 12, gap: 10, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  tile: {
    flex: 1, aspectRatio: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  tileVideo: { ...StyleSheet.absoluteFillObject },
  tileAvatarWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tileFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6,
  },
  tileName: { color: '#fff', fontSize: 12, fontWeight: '600', maxWidth: '75%' },
  sharingBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(99,102,241,0.85)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  sharingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  controls: {
    flexDirection: 'row', justifyContent: 'center', gap: 24,
    paddingVertical: 24, paddingBottom: 40,
  },
  controlBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  controlBtnActive: { backgroundColor: '#ef4444' },
  hangupBtn: { backgroundColor: C.danger },
});
