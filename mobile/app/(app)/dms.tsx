import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../src/theme';
import { dmsApi } from '../../src/api';
import { useStore } from '../../src/store';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function DmsScreen() {
  const insets = useSafeAreaInsets();
  const { dmConversations, setDmConversations, userStatuses } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await dmsApi.conversations();
      setDmConversations(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, []);

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: pl }); }
    catch { return ''; }
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wiadomości</Text>
      </View>

      <FlatList
        data={dmConversations}
        keyExtractor={(c) => c.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />
        }
        contentContainerStyle={{ padding: 12, gap: 4 }}
        renderItem={({ item }) => {
          const effectiveStatus = userStatuses[item.other_user_id] ?? item.other_status;
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push({ pathname: '/(app)/dm/[userId]', params: { userId: item.other_user_id, username: item.other_username, avatar: item.other_avatar ?? '' } })}
            >
              <UserAvatar
                url={item.other_avatar}
                username={item.other_username}
                size={48}
                status={effectiveStatus}
                showStatus
              />
              <View style={styles.rowInfo}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.other_username}</Text>
                  {item.last_message_at && <Text style={styles.rowTime}>{formatTime(item.last_message_at)}</Text>}
                </View>
                {item.last_message && (
                  <Text style={styles.rowPreview} numberOfLines={1}>{item.last_message}</Text>
                )}
              </View>
              {(item.unread_count ?? 0) > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyText}>Brak wiadomości</Text>
            <Text style={styles.emptySubtext}>Zacznij rozmowę ze znajomymi</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14 },
  rowInfo: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { color: C.text, fontSize: 15, fontWeight: '600', flex: 1 },
  rowTime: { color: C.textMuted, fontSize: 12 },
  rowPreview: { color: C.textMuted, fontSize: 13 },
  badge: { backgroundColor: C.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: C.textSub, fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: C.textMuted, fontSize: 14 },
});
