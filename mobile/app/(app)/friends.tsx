import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C, STATUS_COLOR, STATUS_LABEL } from '../../src/theme';
import { friendsApi } from '../../src/api';
import { useStore } from '../../src/store';
import { useT, getT } from '../../src/i18n';

type Tab = 'online' | 'all' | 'requests';

function FriendRow({ item, status, onChat, onRemove }: {
  item: any; status: string; onChat: () => void; onRemove: () => void;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPress={onChat}
      onPressIn={() => Animated.spring(anim, { toValue: 0.97, useNativeDriver: true, damping: 20 }).start()}
      onPressOut={() => Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 20 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[styles.friendRow, { transform: [{ scale: anim }] }]}>
        <UserAvatar url={item.avatar_url} username={item.username} size={46} status={status} showStatus />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.username}</Text>
          <Text style={[styles.friendStatus, { color: STATUS_COLOR[status] ?? C.textMuted }]}>
            {STATUS_LABEL[status] ?? 'Offline'}
          </Text>
        </View>
        <TouchableOpacity style={styles.chatBtn} onPress={onChat}>
          <Ionicons name="chatbubble" size={17} color={C.accentLight} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
          <Ionicons name="close" size={17} color={C.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

function RequestRow({ item, onAccept, onReject }: {
  item: any; onAccept: () => void; onReject: () => void;
}) {
  const t = useT();
  return (
    <View style={styles.requestCard}>
      <UserAvatar url={item.from_avatar} username={item.from_username} size={46} />
      <View style={styles.requestInfo}>
        <Text style={styles.friendName}>{item.from_username}</Text>
        <Text style={styles.requestDir}>
          {item.direction === 'incoming' ? t.incomingRequest : t.awaitingAccept}
        </Text>
      </View>
      {item.direction === 'incoming' ? (
        <View style={styles.requestBtns}>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
            <Ionicons name="close" size={18} color={C.danger} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>{t.pending}</Text>
        </View>
      )}
    </View>
  );
}

export default function FriendsScreen() {
  const t = useT();
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'online',   label: t.tabOnline,    icon: 'ellipse' },
    { key: 'all',      label: t.tabAll,       icon: 'people'  },
    { key: 'requests', label: t.tabRequests,  icon: 'mail'    },
  ];
  const insets = useSafeAreaInsets();
  const { friends, setFriends, friendRequests, setFriendRequests, userStatuses } = useStore();
  const [tab, setTab] = useState<Tab>('online');
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addFocused, setAddFocused] = useState(false);

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
      const gt = getT();
      Alert.alert(gt.friendRequestSent, gt.friendRequestMsg(addInput.trim()));
      setAddInput('');
    } catch (e: any) {
      const gt = getT();
      Alert.alert(gt.error, e.message ?? gt.errSendRequest);
    } finally { setAddLoading(false); }
  };

  const handleAccept = async (id: string) => {
    try { await friendsApi.accept(id); await load(); } catch { }
  };

  const handleReject = async (id: string) => {
    try {
      await friendsApi.reject(id);
      setFriendRequests(friendRequests.filter(r => r.id !== id));
    } catch { }
  };

  const handleRemove = (id: string, username: string) => {
    const gt = getT();
    Alert.alert(gt.removeFriendTitle, gt.removeFriendMsg(username), [
      { text: gt.cancel, style: 'cancel' },
      {
        text: gt.remove, style: 'destructive', onPress: async () => {
          try { await friendsApi.remove(id); setFriends(friends.filter(f => f.id !== id)); }
          catch { }
        }
      },
    ]);
  };

  const displayFriends = tab === 'online'
    ? friends.filter(f => (userStatuses[f.id] ?? f.status) !== 'offline')
    : friends;

  const incoming = friendRequests.filter(r => r.direction === 'incoming');

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.friendsTitle}</Text>
        <View style={styles.headerStats}>
          <View style={styles.statPill}>
            <View style={[styles.statDot, { backgroundColor: C.online }]} />
            <Text style={styles.statText}>
              {friends.filter(f => (userStatuses[f.id] ?? f.status) !== 'offline').length} online
            </Text>
          </View>
        </View>
      </View>

      {/* Add friend bar */}
      <View style={[styles.addBar, addFocused && styles.addBarFocused]}>
        <Ionicons name="person-add-outline" size={18} color={addFocused ? C.accentLight : C.textMuted} />
        <TextInput
          style={styles.addInput}
          value={addInput}
          onChangeText={setAddInput}
          placeholder={t.addFriendPh}
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          returnKeyType="send"
          onSubmitEditing={handleAdd}
          onFocus={() => setAddFocused(true)}
          onBlur={() => setAddFocused(false)}
        />
        {addInput.length > 0 && (
          <TouchableOpacity
            style={[styles.addBtn, addLoading && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={addLoading}
          >
            {addLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={16} color="#fff" />
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(({ key, label, icon }) => {
          const active = tab === key;
          const count = key === 'requests' ? incoming.length : key === 'online'
            ? friends.filter(f => (userStatuses[f.id] ?? f.status) !== 'offline').length
            : friends.length;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(active ? icon : `${icon}-outline`) as any}
                size={14}
                color={active ? C.accentLight : C.textMuted}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, active ? styles.tabBadgeActive : {}]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {tab === 'requests' ? (
        <FlatList
          data={friendRequests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => (
            <RequestRow
              item={item}
              onAccept={() => handleAccept(item.id)}
              onReject={() => handleReject(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptySmall}>
              <Ionicons name="mail-open-outline" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>{t.noRequests}</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={displayFriends}
          keyExtractor={(f) => f.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} />
          }
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 8, gap: 4 }}
          renderItem={({ item }) => {
            const status = userStatuses[item.id] ?? item.status;
            return (
              <FriendRow
                item={item}
                status={status}
                onChat={() => router.push({
                  pathname: '/(app)/dm/[userId]',
                  params: { userId: item.id, username: item.username, avatar: item.avatar_url ?? '' }
                })}
                onRemove={() => handleRemove(item.id, item.username)}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptySmall}>
              <Ionicons name="people-outline" size={44} color={C.textMuted} />
              <Text style={styles.emptyText}>
                {tab === 'online' ? t.noneOnline : t.noFriends}
              </Text>
              <Text style={styles.emptySubtext}>{t.addFriendHint}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },

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
  headerStats: { flexDirection: 'row', gap: 8 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.successMuted,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.success + '33',
  },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statText: { color: C.success, fontSize: 12, fontWeight: '600' },

  // Add bar
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBarFocused: {
    borderColor: C.borderFocus,
    backgroundColor: C.bgElevated,
  },
  addInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.bgGlass,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: C.accentMuted,
    borderColor: C.borderAccent,
  },
  tabText: { color: C.textMuted, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: C.accentLight, fontWeight: '700' },
  tabBadge: {
    backgroundColor: C.bgElevated,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: C.accent },
  tabBadgeText: { color: C.textMuted, fontSize: 10, fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },

  // Friend rows
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  friendInfo: { flex: 1 },
  friendName: { color: C.text, fontSize: 15, fontWeight: '600' },
  friendStatus: { fontSize: 12, marginTop: 2 },
  chatBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentMuted,
    borderWidth: 1,
    borderColor: C.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Request cards
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  requestInfo: { flex: 1 },
  requestDir: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.dangerMuted,
    borderWidth: 1,
    borderColor: C.danger + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    backgroundColor: C.warningMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.warning + '33',
  },
  pendingText: { color: C.warning, fontSize: 12, fontWeight: '600' },

  // Empty
  emptySmall: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { color: C.textSub, fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: C.textMuted, fontSize: 13 },
});
