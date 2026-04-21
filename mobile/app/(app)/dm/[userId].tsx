import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { STATIC_BASE } from '../../../src/config';

function resolveAvatar(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${STATIC_BASE}${url}`;
}
import { MessageInput } from '../../../src/components/MessageInput';
import { C } from '../../../src/theme';
import { dmsApi } from '../../../src/api';
import { useStore } from '../../../src/store';
import { getSocket } from '../../../src/socket';
import { format, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { DmMessage } from '../../../src/api';

function fmtTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Wczoraj ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM HH:mm', { locale: pl });
}

export default function DmChatScreen() {
  const { userId, username, avatar } = useLocalSearchParams<{ userId: string; username: string; avatar: string }>();
  const insets = useSafeAreaInsets();
  const { dmMessages, setDmMessages, addDmMessage, currentUser, userStatuses } = useStore();
  const msgs = dmMessages[userId] ?? [];
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await dmsApi.messages(userId);
      setDmMessages(userId, list);
    } catch { } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    load();
    const sock = getSocket();

    // Local new_dm listener for this conversation — updates messages immediately
    const onNewDm = (msg: any) => {
      const otherId = msg.sender_id === currentUser?.id ? msg.receiver_id : msg.sender_id;
      if (otherId !== userId && msg.sender_id !== userId) return;
      addDmMessage(userId, msg);
    };
    const onTyping = ({ user_id }: any) => {
      if (user_id !== userId) return;
      setIsTyping(true);
      if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
      remoteTypingTimerRef.current = setTimeout(() => setIsTyping(false), 3500);
    };
    const onStopTyping = ({ user_id }: any) => {
      if (user_id !== userId) return;
      setIsTyping(false);
    };
    sock?.on('new_dm', onNewDm);
    sock?.on('dm_user_typing', onTyping);
    sock?.on('dm_user_stop_typing', onStopTyping);
    return () => {
      sock?.off('new_dm', onNewDm);
      sock?.off('dm_user_typing', onTyping);
      sock?.off('dm_user_stop_typing', onStopTyping);
    };
  }, [userId]);

  const loadMore = async () => {
    if (loadingMore || msgs.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await dmsApi.messages(userId, msgs[0]?.id);
      if (older.length) setDmMessages(userId, [...older, ...msgs]);
    } finally { setLoadingMore(false); }
  };

  const handleSend = async (text: string) => {
    const msg = await dmsApi.send(userId, text);
    addDmMessage(userId, msg);
  };

  const handleTyping = () => {
    getSocket()?.emit('dm_typing_start', userId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => getSocket()?.emit('dm_typing_stop', userId), 2000);
  };

  const status = userStatuses[userId] ?? 'offline';

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <UserAvatar url={resolveAvatar(avatar)} username={username} size={36} status={status} showStatus />
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{username}</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : (
        <FlatList
          data={[...msgs].reverse()}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          renderItem={({ item, index }) => {
            const reversed = [...msgs].reverse();
            const prev = reversed[index + 1];
            const showHeader = !prev || prev.sender_id !== item.sender_id ||
              (new Date(item.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60_000;
            const isOwn = item.sender_id === currentUser?.id;
            return (
              <View style={[styles.msgWrapper, isOwn && styles.msgOwn]}>
                {showHeader && !isOwn && (
                  <View style={styles.msgHeader}>
                    <UserAvatar url={resolveAvatar(item.sender_avatar)} username={item.sender_username} size={32} />
                    <Text style={styles.msgUsername}>{item.sender_username}</Text>
                    <Text style={styles.msgTime}>{fmtTime(item.created_at)}</Text>
                  </View>
                )}
                <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, showHeader && !isOwn && styles.bubbleIndented]}>
                  <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{item.content}</Text>
                </View>
                {showHeader && isOwn && (
                  <Text style={styles.ownTime}>{fmtTime(item.created_at)}</Text>
                )}
              </View>
            );
          }}
        />
      )}

      {isTyping && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>{username} pisze…</Text>
        </View>
      )}

      <View style={{ paddingBottom: insets.bottom }}>
        <MessageInput
          placeholder={`Wiadomość do @${username}`}
          onSend={handleSend}
          onTyping={handleTyping}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { padding: 4 },
  headerInfo: { flex: 1 },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  statusText: { color: C.textMuted, fontSize: 12, textTransform: 'capitalize' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgWrapper: { paddingHorizontal: 12, marginBottom: 2 },
  msgOwn: { alignItems: 'flex-end' },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2 },
  msgUsername: { color: C.text, fontWeight: '600', fontSize: 13 },
  msgTime: { color: C.textMuted, fontSize: 11 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, marginTop: 1 },
  bubbleIndented: { marginLeft: 40 },
  bubbleOther: { backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border, borderTopLeftRadius: 4 },
  bubbleOwn: { backgroundColor: C.accent, borderTopRightRadius: 4 },
  bubbleText: { color: C.text, fontSize: 15, lineHeight: 21 },
  bubbleTextOwn: { color: '#fff' },
  ownTime: { color: C.textMuted, fontSize: 11, marginTop: 2, marginRight: 4 },
  typingBar: { paddingHorizontal: 16, paddingBottom: 4 },
  typingText: { color: C.textMuted, fontSize: 12 },
});
