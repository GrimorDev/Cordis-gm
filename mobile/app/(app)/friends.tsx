import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../src/theme';
import { friendsApi } from '../../src/api';
import { useStore } from '../../src/store';

type Tab = 'online' | 'all' | 'requests';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { friends, setFriends, friendRequests, setFriendRequests, userStatuses } = useStore();
  const [tab, setTab] = useState<Tab>('online');
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
      setFriends(f);
      setFriendRequests(r);
    } catch { }
  }, []);

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!addInput.trim()) return;
    setAddLoading(true);
    try {
      await friendsApi.send(addInput.trim());
      Alert.alert('Wysłano!', `Zaproszenie do ${addInput.trim()} zostało wysłane.`);
      setAddInput('');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się wysłać zaproszenia');
    } finally { setAddLoading(false); }
  };

  const handleAccept = async (id: string) => {
    try {
      await friendsApi.accept(id);
      await load();
    } catch { }
  };

  const handleReject = async (id: string) => {
    try {
      await friendsApi.reject(id);
      setFriendRequests(friendRequests.filter(r => r.id !== id));
    } catch { }
  };

  const handleRemove = (id: string, username: string) => {
    Alert.alert('Usuń znajomego', `Czy na pewno chcesz usunąć ${username} ze znajomych?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: async () => {
        try { await friendsApi.remove(id); setFriends(friends.filter(f => f.id !== id)); }
        catch { }
      }},
    ]);
  };

  const displayFriends = tab === 'online'
    ? friends.filter(f => (userStatuses[f.id] ?? f.status) !== 'offline')
    : friends;

  const incoming = friendRequests.filter(r => r.direction === 'incoming');

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Znajomi</Text>
      </View>

      {/* Add friend */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={addInput}
          onChangeText={setAddInput}
          placeholder="Dodaj znajomego (nazwa_użytkownika)"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          returnKeyType="send"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={addLoading}>
          {addLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="person-add" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([['online', 'Online'], ['all', 'Wszyscy'], ['requests', `Zaproszenia${incoming.length > 0 ? ` (${incoming.length})` : ''}`]] as [Tab, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'requests' ? (
        <FlatList
          data={friendRequests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.requestCard}>
              <UserAvatar url={item.from_avatar} username={item.from_username} size={44} />
              <View style={styles.requestInfo}>
                <Text style={styles.friendName}>{item.from_username}</Text>
                <Text style={styles.requestDir}>{item.direction === 'incoming' ? 'wysłał(-a) Ci zaproszenie' : 'oczekuje na akceptację'}</Text>
              </View>
              {item.direction === 'incoming' && (
                <View style={styles.requestBtns}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                    <Ionicons name="close" size={18} color={C.danger} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Brak zaproszeń</Text>}
        />
      ) : (
        <FlatList
          data={displayFriends}
          keyExtractor={(f) => f.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />}
          contentContainerStyle={{ padding: 12, gap: 6 }}
          renderItem={({ item }) => {
            const status = userStatuses[item.id] ?? item.status;
            return (
              <TouchableOpacity style={styles.friendRow}
                onPress={() => router.push({ pathname: '/(app)/dm/[userId]', params: { userId: item.id, username: item.username, avatar: item.avatar_url ?? '' } })}
                onLongPress={() => handleRemove(item.id, item.username)}
              >
                <UserAvatar url={item.avatar_url} username={item.username} size={44} status={status} showStatus />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{item.username}</Text>
                  <Text style={[styles.friendStatus, { color: STATUS_COLOR[status] ?? C.textMuted }]}>
                    {status === 'online' ? 'Online' : status === 'idle' ? 'Bezczynny' : status === 'dnd' ? 'Nie przeszkadzać' : 'Offline'}
                  </Text>
                </View>
                <Ionicons name="chatbubble-outline" size={18} color={C.textMuted} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={C.textMuted} />
              <Text style={styles.emptyText}>{tab === 'online' ? 'Brak znajomych online' : 'Brak znajomych'}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  addInput: { flex: 1, backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: C.text, fontSize: 14 },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabActive: { backgroundColor: C.bgCard },
  tabText: { color: C.textMuted, fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: C.text, fontWeight: '700' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12 },
  friendInfo: { flex: 1 },
  friendName: { color: C.text, fontSize: 15, fontWeight: '600' },
  friendStatus: { fontSize: 12, marginTop: 2 },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
  requestInfo: { flex: 1 },
  requestDir: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: C.textMuted, fontSize: 15, textAlign: 'center' },
});
