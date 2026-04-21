import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C } from '../../src/theme';
import { serversApi, channelsApi } from '../../src/api';
import { useStore } from '../../src/store';
import { getSocket } from '../../src/socket';
import type { Server, Channel } from '../../src/api';

// ── Server List ───────────────────────────────────────────────────────────────
export default function ServersScreen() {
  const insets = useSafeAreaInsets();
  const { servers, setServers, activeServer, setActiveServer, channels, setChannels, addServer } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [serversLoading, setServersLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await serversApi.list();
      setServers(list);
    } catch (e: any) {
      Alert.alert('Błąd', 'Nie udało się załadować serwerów: ' + (e.message ?? ''));
    } finally {
      setServersLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const openServer = async (srv: Server) => {
    setActiveServer(srv);
    setChannels([]);
    setShowChannels(true);
    setChannelsLoading(true);
    try {
      const chs = await channelsApi.list(srv.id);
      setChannels(chs);
      // Join socket server room so we receive channel events
      getSocket()?.emit('join_server_room' as any, srv.id);
    } catch (e: any) {
      Alert.alert('Błąd', 'Nie udało się załadować kanałów: ' + (e.message ?? ''));
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    try {
      const srv = await serversApi.join(joinCode.trim());
      addServer(srv);
      setJoinModal(false);
      setJoinCode('');
      openServer(srv);
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nieprawidłowy kod');
    } finally {
      setJoinLoading(false);
    }
  };

  // ── Channel list (after picking a server) ───────────────────────────────
  if (showChannels && activeServer) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.chHeader}>
          <TouchableOpacity onPress={() => setShowChannels(false)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.chTitle} numberOfLines={1}>{activeServer.name}</Text>
        </View>

        {/* Channels grouped by category */}
        <FlatList
          data={channels.filter(c => c.type === 'text')}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            channels.filter(c => c.type === 'voice').length > 0 ? (
              <View>
                <Text style={styles.catLabel}>KANAŁY TEKSTOWE</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.channelRow}
              onPress={() => router.push({ pathname: '/(app)/channel/[id]', params: { id: item.id, name: item.name, serverId: activeServer.id } })}
            >
              <Ionicons name="hash-outline" size={18} color={C.textMuted} />
              <Text style={styles.channelName}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            channels.filter(c => c.type === 'voice').length > 0 ? (
              <View>
                <Text style={[styles.catLabel, { marginTop: 16 }]}>KANAŁY GŁOSOWE</Text>
                {channels.filter(c => c.type === 'voice').map(c => (
                  <View key={c.id} style={styles.channelRow}>
                    <Ionicons name="volume-medium-outline" size={18} color={C.textMuted} />
                    <Text style={styles.channelName}>{c.name}</Text>
                    <Text style={styles.voiceBadge}>Wkrótce</Text>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {channelsLoading
                ? <ActivityIndicator color={C.accent} />
                : <>
                    <Ionicons name="chatbubble-outline" size={40} color={C.textMuted} />
                    <Text style={styles.emptyText}>Brak kanałów tekstowych</Text>
                  </>
              }
            </View>
          }
        />
      </View>
    );
  }

  // ── Server list ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Serwery</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setJoinModal(true)}>
          <Ionicons name="add" size={22} color={C.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={servers}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.serverCard} onPress={() => openServer(item)}>
            <UserAvatar url={item.icon_url} username={item.name} size={48} />
            <View style={styles.serverInfo}>
              <Text style={styles.serverName} numberOfLines={1}>{item.name}</Text>
              {item.member_count != null && (
                <Text style={styles.serverMeta}>{item.member_count} członków</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {serversLoading
              ? <ActivityIndicator color={C.accent} size="large" />
              : <>
                  <Ionicons name="server-outline" size={48} color={C.textMuted} />
                  <Text style={styles.emptyText}>Brak serwerów</Text>
                  <Text style={styles.emptySubtext}>Dołącz do serwera używając kodu zaproszenia</Text>
                </>
            }
          </View>
        }
      />

      {/* Join modal */}
      <Modal visible={joinModal} transparent animationType="slide" onRequestClose={() => setJoinModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setJoinModal(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Dołącz do serwera</Text>
            <TextInput
              style={styles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="Kod zaproszenia"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity style={styles.modalBtn} onPress={handleJoin} disabled={joinLoading}>
              {joinLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Dołącz</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center' },
  serverCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.bgCard, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border },
  serverInfo: { flex: 1 },
  serverName: { color: C.text, fontSize: 16, fontWeight: '600' },
  serverMeta: { color: C.textMuted, fontSize: 13, marginTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: C.textSub, fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  input: { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  modalBtn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { padding: 4 },
  chTitle: { color: C.text, fontSize: 18, fontWeight: '700', flex: 1 },
  catLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, paddingHorizontal: 4 },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10 },
  channelName: { color: C.textSub, fontSize: 15, flex: 1 },
  voiceBadge: { color: C.textMuted, fontSize: 11, backgroundColor: C.bgElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
});
