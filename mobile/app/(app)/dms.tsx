import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../src/theme';
import { dmsApi } from '../../src/api';
import { useStore } from '../../src/store';
import { format, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { enGB } from 'date-fns/locale';
import { useT } from '../../src/i18n';

function fmtTime(dateStr?: string | null, lang: 'pl' | 'en' = 'pl', yesterday = 'Wczoraj') {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return yesterday;
    return format(d, 'd MMM', { locale: lang === 'pl' ? pl : enGB });
  } catch { return ''; }
}

function DmRow({ item, status, onPress }: { item: any; status: string; onPress: () => void }) {
  const t = useT();
  const { language } = useStore();
  const hasUnread = (item.unread_count ?? 0) > 0;
  const anim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(anim, { toValue: 0.97, useNativeDriver: true, damping: 20 }).start();
  const handlePressOut = () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 20 }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.row, hasUnread && styles.rowUnread, { transform: [{ scale: anim }] }]}>
        {hasUnread && <View style={styles.unreadStripe} />}

        <View style={styles.avatarWrap}>
          <UserAvatar
            url={item.other_avatar}
            username={item.other_username}
            size={48}
            status={status}
            showStatus
          />
        </View>

        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowName, hasUnread && styles.rowNameBold]} numberOfLines={1}>
              {item.is_group ? (item.group_name || 'Grupa') : item.other_username}
            </Text>
            <Text style={[styles.rowTime, hasUnread && styles.rowTimeUnread]}>
              {fmtTime(item.last_message_at, language, t.yesterday)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <Text
              style={[styles.rowPreview, hasUnread && styles.rowPreviewBold]}
              numberOfLines={1}
            >
              {item.last_message || t.startConvo}
            </Text>
            {hasUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.unread_count! > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function DmsScreen() {
  const t = useT();
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

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t.dmsTitle}</Text>
          <Text style={styles.headerSub}>
            {dmConversations.length > 0 ? t.dmsCount(dmConversations.length) : t.noConversations}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newDmBtn}
          onPress={() => router.push('/(app)/friends')}
        >
          <Ionicons name="create-outline" size={18} color={C.accentLight} />
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
          contentContainerStyle={dmConversations.length === 0 ? styles.emptyContainer : { paddingTop: 4, paddingBottom: 12 }}
          renderItem={({ item }) => {
            const effectiveStatus = userStatuses[item.other_user_id] ?? item.other_status;
            return (
              <DmRow
                item={item}
                status={effectiveStatus}
                onPress={() => router.push({
                  pathname: '/(app)/dm/[userId]',
                  params: { userId: item.other_user_id, username: item.other_username, avatar: item.other_avatar ?? '' },
                })}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubbles" size={36} color={C.accent} />
              </View>
              <Text style={styles.emptyTitle}>{t.noDmsTitle}</Text>
              <Text style={styles.emptySubtext}>{t.noDmsSubtext}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(app)/friends')}>
                <Ionicons name="people" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>{t.friendsBtn}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { color: C.textMuted, fontSize: 12, marginTop: 1 },
  newDmBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.accentMuted,
    borderWidth: 1,
    borderColor: C.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  rowUnread: {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  unreadStripe: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  avatarWrap: { marginRight: 12 },
  rowInfo: { flex: 1, gap: 4 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowName: { color: C.textSub, fontSize: 15, fontWeight: '500', flex: 1, marginRight: 8 },
  rowNameBold: { color: C.text, fontWeight: '700' },
  rowTime: { color: C.textMuted, fontSize: 11 },
  rowTimeUnread: { color: C.accentLight },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowPreview: { color: C.textMuted, fontSize: 13, flex: 1, marginRight: 8 },
  rowPreviewBold: { color: C.textSub },

  badge: {
    backgroundColor: C.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Empty
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.accentMuted,
    borderWidth: 1,
    borderColor: C.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  emptySubtext: {
    color: C.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 4,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
