import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await dmsApi.conversations();
      setDmConversations(list);
    } catch { }
    finally { setLoading(false); }
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
        <TouchableOpacity style={styles.newDmBtn} onPress={() => router.push('/(app)/friends')}>
          <Ionicons name="create-outline" size={18} color={C.textSub} />
        </TouchableOpacity>
      </View>

      {loading && dmConversations.length === 0 ? (
        <View style={styles.centerFlex}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={dmConversations}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
              tintColor={C.accent}
            />
          }
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const effectiveStatus = userStatuses[item.other_user_id] ?? item.other_status;
            const hasUnread = (item.unread_count ?? 0) > 0;
            return (
              <TouchableOpacity
                style={[styles.row, hasUnread && styles.rowUnread]}
                onPress={() => router.push({
                  pathname: '/(app)/dm/[userId]',
                  params: { userId: item.other_user_id, username: item.other_username, avatar: item.other_avatar ?? '' },
                })}
                activeOpacity={0.75}
              >
                <UserAvatar
                  url={item.other_avatar}
                  username={item.other_username}
                  size={50}
                  status={effectiveStatus}
                  showStatus
                />
                <View style={styles.rowInfo}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowName, hasUnread && styles.rowNameBold]} numberOfLines={1}>
                      {item.is_group ? (item.group_name || 'Grupa') : item.other_username}
                    </Text>
                    {item.last_message_at && (
                      <Text style={styles.rowTime}>{formatTime(item.last_message_at)}</Text>
                    )}
                  </View>
                  {item.last_message ? (
                    <Text style={[styles.rowPreview, hasUnread && styles.rowPreviewBold]} numberOfLines={1}>
                      {item.last_message}
                    </Text>
                  ) : (
                    <Text style={styles.rowPreviewEmpty}>Zacznij rozmowę</Text>
                  )}
                </View>
                {hasUnread && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.unread_count! > 99 ? '99+' : item.unread_count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={32} color={C.accent} />
              </View>
              <Text style={styles.emptyTitle}>Brak wiadomości</Text>
              <Text style={styles.emptySubtext}>Odwiedź zakładkę Znajomi, aby zacząć rozmowę</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(app)/friends')}>
                <Text style={styles.emptyBtnText}>Przejdź do znajomych</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  newDmBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  rowUnread: { backgroundColor: C.bgCard + 'aa' },
  rowInfo: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { color: C.textSub, fontSize: 15, fontWeight: '500', flex: 1 },
  rowNameBold: { color: C.text, fontWeight: '700' },
  rowTime: { color: C.textMuted, fontSize: 12 },
  rowPreview: { color: C.textMuted, fontSize: 13 },
  rowPreviewBold: { color: C.textSub, fontWeight: '500' },
  rowPreviewEmpty: { color: C.textMuted, fontSize: 13, fontStyle: 'italic' },
  separator: { height: 1, backgroundColor: C.border + '55', marginHorizontal: 16 },
  badge: {
    backgroundColor: C.accent, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  // Empty state
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  emptySubtext: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
