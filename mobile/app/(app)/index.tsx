import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, Modal, ActivityIndicator, Alert,
  ScrollView, Animated, Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../src/components/UserAvatar';
import { STATIC_BASE } from '../../src/config';
import { C } from '../../src/theme';
import { serversApi, channelsApi } from '../../src/api';
import { useStore } from '../../src/store';
import { getSocket } from '../../src/socket';
import type { Server, Channel } from '../../src/api';

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
}

// ── Server List ───────────────────────────────────────────────────────────────
export default function ServersScreen() {
  const insets = useSafeAreaInsets();
  const { servers, setServers, activeServer, setActiveServer, channels, setChannels, addServer } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [serversLoading, setServersLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  // Modals
  const [modal, setModal] = useState<'none' | 'create' | 'join'>('none');
  const [joinCode, setJoinCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Server action sheet
  const [actionServer, setActionServer] = useState<Server | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await serversApi.list();
      setServers(list);
    } catch (e: any) {
      Alert.alert('Błąd', 'Nie udało się załadować serwerów.');
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
      getSocket()?.emit('join_server_room' as any, srv.id);
    } catch (e: any) {
      Alert.alert('Błąd', 'Nie udało się załadować kanałów: ' + (e.message ?? ''));
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setModalLoading(true);
    try {
      const srv = await serversApi.join(joinCode.trim());
      addServer(srv);
      setModal('none');
      setJoinCode('');
      openServer(srv);
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nieprawidłowy kod zaproszenia');
    } finally { setModalLoading(false); }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setModalLoading(true);
    try {
      const srv = await serversApi.create(createName.trim(), createDesc.trim() || undefined);
      addServer(srv);
      setModal('none');
      setCreateName('');
      setCreateDesc('');
      openServer(srv);
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się stworzyć serwera');
    } finally { setModalLoading(false); }
  };

  const handleLeave = (srv: Server) => {
    Alert.alert('Opuść serwer', `Czy na pewno chcesz opuścić "${srv.name}"?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Opuść', style: 'destructive', onPress: async () => {
        try {
          await serversApi.leave(srv.id);
          setServers(servers.filter(s => s.id !== srv.id));
          setActionServer(null);
          if (activeServer?.id === srv.id) setShowChannels(false);
        } catch (e: any) {
          Alert.alert('Błąd', e.message ?? 'Nie udało się opuścić serwera');
        }
      }},
    ]);
  };

  const handleShareInvite = async (srv: Server) => {
    try {
      const { code } = await serversApi.generateInvite(srv.id);
      setActionServer(null);
      await Share.share({ message: `Dołącz do serwera "${srv.name}" na Cordyn!\nKod: ${code}` });
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się wygenerować zaproszenia');
    }
  };

  // ── Channel list view ──────────────────────────────────────────────────────
  if (showChannels && activeServer) {
    const textChannels = channels.filter(c => c.type === 'text');
    const voiceChannels = channels.filter(c => c.type === 'voice');
    const announcementChannels = channels.filter(c => c.type === 'announcement');

    // Group by category
    const categories = Array.from(
      new Set(channels.map(c => c.category_id ?? null))
    );

    const grouped: { catId: string | null; catName: string | null; channels: Channel[] }[] = [];
    const catMap = new Map<string | null, { catId: string | null; catName: string | null; channels: Channel[] }>();

    for (const ch of channels) {
      const key = ch.category_id ?? null;
      if (!catMap.has(key)) {
        catMap.set(key, { catId: key, catName: ch.category_name ?? null, channels: [] });
      }
      catMap.get(key)!.channels.push(ch);
    }
    catMap.forEach(v => grouped.push(v));

    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.chHeader}>
          <TouchableOpacity onPress={() => setShowChannels(false)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <UserAvatar url={resolveUrl(activeServer.icon_url)} username={activeServer.name} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={styles.chTitle} numberOfLines={1}>{activeServer.name}</Text>
            {activeServer.description ? (
              <Text style={styles.chSubtitle} numberOfLines={1}>{activeServer.description}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.serverMenuBtn}
            onPress={() => setActionServer(activeServer)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={C.textMuted} />
          </TouchableOpacity>
        </View>

        {channelsLoading ? (
          <View style={styles.centerFlex}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.loadingText}>Ładowanie kanałów…</Text>
          </View>
        ) : channels.length === 0 ? (
          <View style={styles.centerFlex}>
            <Ionicons name="chatbubble-outline" size={44} color={C.textMuted} />
            <Text style={styles.emptyText}>Brak kanałów</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
            {grouped.map(group => (
              <View key={group.catId ?? '__no_cat'}>
                {group.catName && (
                  <View style={styles.catHeader}>
                    <Text style={styles.catLabel}>{group.catName.toUpperCase()}</Text>
                  </View>
                )}
                {group.channels.map(ch => {
                  const isText = ch.type === 'text';
                  const isAnnouncement = ch.type === 'announcement';
                  const isVoice = ch.type === 'voice';
                  const icon = isVoice ? 'volume-medium-outline'
                    : isAnnouncement ? 'megaphone-outline'
                    : 'hash-outline';

                  if (isVoice) {
                    return (
                      <View key={ch.id} style={[styles.channelRow, styles.channelRowVoice]}>
                        <Ionicons name={icon} size={18} color={C.textMuted} />
                        <Text style={[styles.channelName, { color: C.textMuted }]}>{ch.name}</Text>
                        <View style={styles.voiceBadge}>
                          <Text style={styles.voiceBadgeText}>Wkrótce</Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={ch.id}
                      style={styles.channelRow}
                      onPress={() => router.push({ pathname: '/(app)/channel/[id]', params: { id: ch.id, name: ch.name, serverId: activeServer.id } })}
                    >
                      <Ionicons name={icon} size={18} color={C.accent} />
                      <Text style={styles.channelName}>{ch.name}</Text>
                      <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Server action sheet */}
        <ServerActionSheet
          server={actionServer}
          onClose={() => setActionServer(null)}
          onLeave={handleLeave}
          onInvite={handleShareInvite}
        />
      </View>
    );
  }

  // ── Server list ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Serwery</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setModal('join')}>
            <Ionicons name="link-outline" size={18} color={C.textSub} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, styles.headerBtnAccent]} onPress={() => setModal('create')}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={servers}
        keyExtractor={(s) => s.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor={C.accent}
          />
        }
        contentContainerStyle={{ padding: 12, gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.serverCard}
            onPress={() => openServer(item)}
            onLongPress={() => setActionServer(item)}
            activeOpacity={0.8}
          >
            <View style={styles.serverIconWrap}>
              <UserAvatar url={resolveUrl(item.icon_url)} username={item.name} size={52} />
            </View>
            <View style={styles.serverInfo}>
              <Text style={styles.serverName} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.serverDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
              {item.member_count != null && (
                <View style={styles.memberCountRow}>
                  <View style={[styles.statusDot, { backgroundColor: C.success }]} />
                  <Text style={styles.memberCount}>{item.member_count} członków</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {serversLoading
              ? <ActivityIndicator color={C.accent} size="large" />
              : (
                <>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="server-outline" size={36} color={C.accent} />
                  </View>
                  <Text style={styles.emptyTitle}>Brak serwerów</Text>
                  <Text style={styles.emptySubtext}>Stwórz własny serwer lub dołącz do istniejącego kodem zaproszenia</Text>
                  <View style={styles.emptyBtns}>
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => setModal('create')}>
                      <Ionicons name="add-circle-outline" size={16} color="#fff" />
                      <Text style={styles.emptyBtnText}>Stwórz serwer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.emptyBtn, styles.emptyBtnSecondary]} onPress={() => setModal('join')}>
                      <Ionicons name="link-outline" size={16} color={C.textSub} />
                      <Text style={[styles.emptyBtnText, { color: C.textSub }]}>Dołącz kodem</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )
            }
          </View>
        }
      />

      {/* Server action sheet */}
      <ServerActionSheet
        server={actionServer}
        onClose={() => setActionServer(null)}
        onLeave={handleLeave}
        onInvite={handleShareInvite}
      />

      {/* Create server modal */}
      <Modal visible={modal === 'create'} transparent animationType="slide" onRequestClose={() => setModal('none')}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModal('none')}>
          <View style={styles.modalCard}>
            <View style={styles.modalDragBar} />
            <Text style={styles.modalTitle}>Stwórz serwer</Text>
            <Text style={styles.modalLabel}>NAZWA SERWERA</Text>
            <TextInput
              style={styles.input}
              value={createName}
              onChangeText={setCreateName}
              placeholder="np. Mój serwer"
              placeholderTextColor={C.textMuted}
              autoFocus
              maxLength={100}
            />
            <Text style={styles.modalLabel}>OPIS (OPCJONALNIE)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={createDesc}
              onChangeText={setCreateDesc}
              placeholder="Krótki opis serwera…"
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.modalBtn, (!createName.trim() || modalLoading) && styles.modalBtnDisabled]}
              onPress={handleCreate}
              disabled={!createName.trim() || modalLoading}
            >
              {modalLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalBtnText}>Stwórz serwer</Text>
              }
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Join server modal */}
      <Modal visible={modal === 'join'} transparent animationType="slide" onRequestClose={() => setModal('none')}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModal('none')}>
          <View style={styles.modalCard}>
            <View style={styles.modalDragBar} />
            <Text style={styles.modalTitle}>Dołącz do serwera</Text>
            <Text style={styles.modalLabel}>KOD ZAPROSZENIA</Text>
            <TextInput
              style={styles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="np. ABC123"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoFocus
              maxLength={20}
            />
            <TouchableOpacity
              style={[styles.modalBtn, (!joinCode.trim() || modalLoading) && styles.modalBtnDisabled]}
              onPress={handleJoin}
              disabled={!joinCode.trim() || modalLoading}
            >
              {modalLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalBtnText}>Dołącz</Text>
              }
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Server Action Sheet ─────────────────────────────────────────────────────
function ServerActionSheet({
  server, onClose, onLeave, onInvite,
}: {
  server: Server | null;
  onClose: () => void;
  onLeave: (s: Server) => void;
  onInvite: (s: Server) => void;
}) {
  if (!server) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.actionSheet}>
          <View style={styles.modalDragBar} />
          <Text style={styles.actionSheetTitle}>{server.name}</Text>
          <ActionRow icon="link-outline" label="Wyślij zaproszenie" onPress={() => onInvite(server)} />
          <View style={styles.actionDivider} />
          <ActionRow icon="log-out-outline" label="Opuść serwer" color={C.danger} onPress={() => { onClose(); onLeave(server); }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function ActionRow({ icon, label, color, onPress }: { icon: string; label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={color ?? C.textSub} />
      <Text style={[styles.actionLabel, color ? { color } : {}]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: C.textMuted, fontSize: 14, marginTop: 8 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  headerBtnAccent: { backgroundColor: C.accent, borderColor: C.accent },

  // Server card
  serverCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.bgCard, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border },
  serverIconWrap: { borderRadius: 14, overflow: 'hidden' },
  serverInfo: { flex: 1 },
  serverName: { color: C.text, fontSize: 16, fontWeight: '700' },
  serverDesc: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  memberCountRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  memberCount: { color: C.textMuted, fontSize: 12 },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  emptyBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnSecondary: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { color: C.textMuted, fontSize: 15 },

  // Channel list header
  chHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { padding: 4 },
  chTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  chSubtitle: { color: C.textMuted, fontSize: 11, marginTop: 1 },
  serverMenuBtn: { padding: 6 },

  // Category & channels
  catHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  catLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 16, marginHorizontal: 8, borderRadius: 10 },
  channelRowVoice: { opacity: 0.5 },
  channelName: { color: C.textSub, fontSize: 15, flex: 1, fontWeight: '500' },
  voiceBadge: { backgroundColor: C.bgElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  voiceBadgeText: { color: C.textMuted, fontSize: 11 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, borderTopWidth: 1, borderColor: C.border },
  modalDragBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: -4 },
  input: { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15 },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  modalBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  modalBtnDisabled: { opacity: 0.45 },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Action sheet
  actionSheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24, borderTopWidth: 1, borderColor: C.border },
  actionSheetTitle: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  actionDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 },
  actionLabel: { color: C.textSub, fontSize: 16 },
});
