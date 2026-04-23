import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, Modal, ActivityIndicator, Alert,
  ScrollView, Share, Animated, LayoutAnimation, Platform, UIManager,
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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
}

type ChannelIconName = 'chatbox' | 'chatbox-outline' | 'mic' | 'mic-outline' | 'megaphone' | 'megaphone-outline' | 'albums' | 'albums-outline';

function channelIcon(type: string, focused = false): ChannelIconName {
  if (type === 'voice') return focused ? 'mic' : 'mic-outline';
  if (type === 'announcement') return focused ? 'megaphone' : 'megaphone-outline';
  if (type === 'forum') return focused ? 'albums' : 'albums-outline';
  return focused ? 'chatbox' : 'chatbox-outline';
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ServersScreen() {
  const insets = useSafeAreaInsets();
  const {
    servers, setServers, activeServer, setActiveServer,
    channels, setChannels, addServer, currentUser, voiceUsers,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [serversLoading, setServersLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string | null>>(new Set());
  const [activeVoice, setActiveVoice] = useState<{ channelId: string; channelName: string } | null>(null);

  // Modals
  const [modal, setModal] = useState<'none' | 'create' | 'join'>('none');
  const [joinCode, setJoinCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveServer(srv);
    setChannels([]);
    setShowChannels(true);
    setChannelsLoading(true);
    setCollapsedCats(new Set());
    try {
      const chs = await channelsApi.list(srv.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
      {
        text: 'Opuść', style: 'destructive', onPress: async () => {
          try {
            await serversApi.leave(srv.id);
            setServers(servers.filter(s => s.id !== srv.id));
            setActionServer(null);
            if (activeServer?.id === srv.id) {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowChannels(false);
            }
          } catch (e: any) {
            Alert.alert('Błąd', e.message ?? 'Nie udało się opuścić serwera');
          }
        },
      },
    ]);
  };

  const handleShareInvite = async (srv: Server) => {
    try {
      const { code } = await serversApi.generateInvite(srv.id);
      setActionServer(null);
      await Share.share({ message: `Dołącz do "${srv.name}" na Cordyn! Kod: ${code}` });
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się wygenerować zaproszenia');
    }
  };

  const handleJoinVoice = (ch: Channel) => {
    if (activeVoice?.channelId === ch.id) return; // already in this channel
    if (activeVoice) {
      // Leave previous voice channel first
      getSocket()?.emit('voice_leave', { channel_id: activeVoice.channelId });
    }
    getSocket()?.emit('voice_join', { channel_id: ch.id });
    setActiveVoice({ channelId: ch.id, channelName: ch.name });
  };

  const handleLeaveVoice = () => {
    if (activeVoice) {
      getSocket()?.emit('voice_leave', { channel_id: activeVoice.channelId });
      setActiveVoice(null);
    }
  };

  const toggleCategory = (catId: string | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedCats(prev => {
      const next = new Set(prev);
      const key = catId ?? '__null__';
      if (next.has(key as any)) next.delete(key as any);
      else next.add(key as any);
      return next;
    });
  };

  // ── Channel list view ──────────────────────────────────────────────────────
  if (showChannels && activeServer) {
    const isOwner = currentUser?.id === activeServer.owner_id;

    const grouped: { catId: string | null; catName: string | null; channels: Channel[] }[] = [];
    const catMap = new Map<string, { catId: string | null; catName: string | null; channels: Channel[] }>();

    for (const ch of channels) {
      const key = ch.category_id ?? '__null__';
      if (!catMap.has(key)) {
        catMap.set(key, { catId: ch.category_id ?? null, catName: ch.category_name ?? null, channels: [] });
      }
      catMap.get(key)!.channels.push(ch);
    }
    catMap.forEach(v => grouped.push(v));

    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.chHeader}>
          <TouchableOpacity onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowChannels(false);
          }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <UserAvatar url={resolveUrl(activeServer.icon_url)} username={activeServer.name} size={30} />
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={styles.chTitle} numberOfLines={1}>{activeServer.name}</Text>
            {activeServer.description ? (
              <Text style={styles.chSubtitle} numberOfLines={1}>{activeServer.description}</Text>
            ) : null}
          </View>
          <View style={styles.chHeaderRight}>
            <TouchableOpacity
              style={styles.chHeaderBtn}
              onPress={() => router.push({ pathname: '/(app)/member-list/[serverId]', params: { serverId: activeServer.id } } as any)}
            >
              <Ionicons name="people-outline" size={19} color={C.textSub} />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                style={styles.chHeaderBtn}
                onPress={() => router.push({ pathname: '/(app)/server-settings/[serverId]', params: { serverId: activeServer.id } } as any)}
              >
                <Ionicons name="settings-outline" size={19} color={C.textSub} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.serverMenuBtn} onPress={() => setActionServer(activeServer)}>
              <Ionicons name="ellipsis-vertical" size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {channelsLoading ? (
          <View style={styles.centerFlex}>
            <ActivityIndicator color={C.accent} size="large" />
            <Text style={styles.loadingText}>Ładowanie kanałów…</Text>
          </View>
        ) : channels.length === 0 ? (
          <View style={styles.centerFlex}>
            <Ionicons name="chatbox-outline" size={44} color={C.textMuted} />
            <Text style={styles.emptyText}>Brak kanałów</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            {grouped.map(group => {
              const isCollapsed = collapsedCats.has((group.catId ?? '__null__') as any);
              return (
                <View key={group.catId ?? '__null__'}>
                  {/* Category header */}
                  {group.catName && (
                    <TouchableOpacity
                      style={styles.catHeader}
                      onPress={() => toggleCategory(group.catId)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={12}
                        color={C.textMuted}
                      />
                      <Text style={styles.catLabel}>{group.catName.toUpperCase()}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Channels in this category */}
                  {!isCollapsed && group.channels.map(ch => {
                    const isVoice = ch.type === 'voice';
                    const vUsers = voiceUsers[ch.id] ?? [];
                    const isInThisVoice = activeVoice?.channelId === ch.id;

                    if (isVoice) {
                      return (
                        <View key={ch.id}>
                          <TouchableOpacity
                            style={[styles.channelRow, isInThisVoice && styles.channelRowActive]}
                            onPress={() => handleJoinVoice(ch)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.channelIconWrap, {
                              backgroundColor: isInThisVoice ? '#22c55e33' : vUsers.length > 0 ? '#22c55e22' : C.bgInput,
                            }]}>
                              <Ionicons
                                name={isInThisVoice ? 'mic' : channelIcon(ch.type)}
                                size={15}
                                color={isInThisVoice || vUsers.length > 0 ? '#22c55e' : C.textMuted}
                              />
                            </View>
                            <Text style={[styles.channelName, (isInThisVoice || vUsers.length > 0) && { color: '#22c55e', fontWeight: '600' }]}>
                              {ch.name}
                            </Text>
                            {isInThisVoice ? (
                              <View style={styles.voiceConnectedBadge}>
                                <Text style={styles.voiceConnectedText}>Połączony</Text>
                              </View>
                            ) : vUsers.length > 0 && (
                              <View style={styles.voiceCountBadge}>
                                <Ionicons name="person" size={10} color="#22c55e" />
                                <Text style={styles.voiceCountText}>{vUsers.length}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          {vUsers.length > 0 && (
                            <View style={styles.voicePresenceRow}>
                              {vUsers.map(u => (
                                <TouchableOpacity
                                  key={u.id}
                                  style={styles.voicePresenceUser}
                                  onPress={() => router.push({ pathname: '/(app)/user-profile/[userId]', params: { userId: u.id } } as any)}
                                >
                                  <UserAvatar url={u.avatar_url} username={u.username} size={18} />
                                  <Text style={styles.voicePresenceUsername} numberOfLines={1}>{u.username}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    }

                    const unread = (ch as any).unread_count ?? 0;

                    return (
                      <TouchableOpacity
                        key={ch.id}
                        style={[styles.channelRow, unread > 0 && styles.channelRowUnread]}
                        onPress={() => router.push({
                          pathname: '/(app)/channel/[id]',
                          params: { id: ch.id, name: ch.name, serverId: activeServer.id },
                        })}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.channelIconWrap, { backgroundColor: C.accent + '22' }]}>
                          <Ionicons name={channelIcon(ch.type)} size={15} color={C.accent} />
                        </View>
                        <Text style={[styles.channelName, unread > 0 && { color: C.text, fontWeight: '700' }]}>
                          {ch.name}
                        </Text>
                        {unread > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={13} color={C.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Active voice channel bar */}
        {activeVoice && (
          <View style={styles.voiceBar}>
            <View style={styles.voiceBarLeft}>
              <View style={styles.voicePulse}>
                <Ionicons name="mic" size={14} color="#22c55e" />
              </View>
              <View>
                <Text style={styles.voiceBarTitle}>Połączony z głosowym</Text>
                <Text style={styles.voiceBarChannel}>#{activeVoice.channelName}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.voiceLeaveBtn} onPress={handleLeaveVoice}>
              <Ionicons name="call" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

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
            activeOpacity={0.75}
          >
            <UserAvatar url={resolveUrl(item.icon_url)} username={item.name} size={50} />
            <View style={styles.serverInfo}>
              <Text style={styles.serverName} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.serverDesc} numberOfLines={1}>{item.description}</Text>
              ) : null}
              {item.member_count != null && (
                <View style={styles.memberCountRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={styles.memberCount}>{item.member_count} członków</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
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
                  <Text style={styles.emptySubtext}>Stwórz własny lub dołącz przez kod zaproszenia</Text>
                  <View style={styles.emptyBtns}>
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => setModal('create')}>
                      <Ionicons name="add-circle-outline" size={16} color="#fff" />
                      <Text style={styles.emptyBtnText}>Stwórz</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.emptyBtn, styles.emptyBtnSecondary]} onPress={() => setModal('join')}>
                      <Ionicons name="link-outline" size={16} color={C.textSub} />
                      <Text style={[styles.emptyBtnText, { color: C.textSub }]}>Dołącz</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )
            }
          </View>
        }
      />

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
              placeholder="Krótki opis…"
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

// ── Server Action Sheet ────────────────────────────────────────────────────────
function ServerActionSheet({ server, onClose, onLeave, onInvite }: {
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
  loadingText: { color: C.textMuted, fontSize: 14 },

  // Server list header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  headerBtnAccent: { backgroundColor: C.accent, borderColor: C.accent },

  // Server card
  serverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.bgCard, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  serverInfo: { flex: 1 },
  serverName: { color: C.text, fontSize: 16, fontWeight: '700' },
  serverDesc: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  memberCountRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  memberCount: { color: C.textMuted, fontSize: 12 },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 26,
    backgroundColor: 'rgba(99,102,241,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  emptyBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11,
  },
  emptyBtnSecondary: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { color: C.textMuted, fontSize: 15 },

  // Channel list header
  chHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
    gap: 8,
  },
  backBtn: { padding: 4 },
  chTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  chSubtitle: { color: C.textMuted, fontSize: 11, marginTop: 1 },
  chHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chHeaderBtn: {
    padding: 7, borderRadius: 10,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
  },
  serverMenuBtn: { padding: 6 },

  // Category
  catHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6,
  },
  catLabel: { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },

  // Channel rows
  channelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 12,
    marginHorizontal: 8, marginVertical: 1, borderRadius: 12,
  },
  channelRowUnread: {
    backgroundColor: C.bgCard,
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)',
  },
  channelIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  channelName: { color: C.textSub, fontSize: 14, flex: 1, fontWeight: '500' },
  unreadBadge: {
    backgroundColor: C.danger, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  channelRowActive: { backgroundColor: 'rgba(34,197,94,0.08)' },
  voiceCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  voiceCountText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  voiceConnectedBadge: {
    backgroundColor: 'rgba(34,197,94,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    borderWidth: 1, borderColor: '#22c55e55',
  },
  voiceConnectedText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  voicePresenceRow: { flexDirection: 'row', flexWrap: 'wrap', paddingLeft: 52, paddingBottom: 4, gap: 8 },
  voicePresenceUser: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voicePresenceUsername: { color: C.textMuted, fontSize: 11, maxWidth: 72 },
  // Voice bar at bottom of channel list
  voiceBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0f1a12', borderTopWidth: 1, borderTopColor: '#22c55e44',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  voiceBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voicePulse: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#22c55e22', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#22c55e55',
  },
  voiceBarTitle: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  voiceBarChannel: { color: C.textMuted, fontSize: 11 },
  voiceLeaveBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center',
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12, borderTopWidth: 1, borderColor: C.border,
  },
  modalDragBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 8 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  modalLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: -4 },
  input: {
    backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15,
  },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  modalBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  modalBtnDisabled: { opacity: 0.45 },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Action sheet
  actionSheet: {
    backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 24, borderTopWidth: 1, borderColor: C.border,
  },
  actionSheetTitle: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  actionDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 },
  actionLabel: { color: C.textSub, fontSize: 16 },
});
