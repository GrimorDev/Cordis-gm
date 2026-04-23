import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Text, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageBubble } from '../../../src/components/MessageBubble';
import { MessageInput } from '../../../src/components/MessageInput';
import { C } from '../../../src/theme';
import { messagesApi } from '../../../src/api';
import { useStore } from '../../../src/store';
import { getSocket } from '../../../src/socket';
import type { Message } from '../../../src/api';

// Translate backend error codes to Polish
function friendlyError(msg: string): string {
  if (msg === 'No access' || msg === 'Brak dostępu') {
    return 'Nie masz dostępu do tego kanału.\nMoże być prywatny lub wymaga specjalnych uprawnień.';
  }
  return msg;
}

export default function ChannelScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const insets = useSafeAreaInsets();
  const {
    messages, setMessages, prependMessages, addMessage, updateMessage, removeMessage,
    currentUser, setTyping, typingUsers, activeServer,
  } = useStore();
  const msgs = messages[id] ?? [];

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Guard against double-sends
  const sendingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const list = await messagesApi.list(id);
      setMessages(id, list);
    } catch (e: any) {
      setError(friendlyError(e.message ?? 'Nie udało się załadować wiadomości'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const sock = getSocket();
    // NOTE: new_message, message_updated, message_deleted are handled GLOBALLY in _layout.tsx
    // to avoid double-add. We only handle channel-specific events here.
    sock?.emit('join_channel', id);

    const onTyping = ({ username }: any) => {
      setTyping(id, [...(typingUsers[id] ?? []).filter(u => u !== username), username]);
      setTimeout(() => setTyping(id, (typingUsers[id] ?? []).filter(u => u !== username)), 3500);
    };
    sock?.on('user_typing', onTyping);

    return () => {
      getSocket()?.emit('leave_channel', id);
      sock?.off('user_typing', onTyping);
    };
  }, [id]);

  const loadMore = async () => {
    if (loadingMore || msgs.length === 0) return;
    setLoadingMore(true);
    try {
      const older = await messagesApi.list(id, msgs[0]?.id);
      if (older.length > 0) prependMessages(id, older);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async (text: string, attachmentUrl?: string) => {
    // Hard guard — prevents any double-send even if state hasn't flushed
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      await messagesApi.send(id, text, replyTo?.id, attachmentUrl);
      setReplyTo(null);
    } finally {
      sendingRef.current = false;
    }
  };

  const handleTyping = () => {
    getSocket()?.emit('typing_start', { channel_id: id });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      getSocket()?.emit('typing_stop', { channel_id: id });
    }, 2000);
  };

  const handleDelete = async (msgId: string) => {
    try {
      await messagesApi.delete(msgId);
      removeMessage(id, msgId);
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się usunąć wiadomości');
    }
  };

  const handleEdit = async (msgId: string, newContent: string) => {
    try {
      const updated = await messagesApi.edit(msgId, newContent);
      updateMessage(id, updated);
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się edytować wiadomości');
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    try { await messagesApi.react(msgId, emoji); }
    catch { /* ignore */ }
  };

  const isOwner = currentUser?.id === activeServer?.owner_id;
  const typing = typingUsers[id] ?? [];

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Ionicons name="chatbox-outline" size={18} color={C.textMuted} />
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={styles.headerRight}>
          {isOwner && activeServer && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push({ pathname: '/(app)/server-settings/[serverId]', params: { serverId: activeServer.id } } as any)}
            >
              <Ionicons name="settings-outline" size={19} color={C.textSub} />
            </TouchableOpacity>
          )}
          {activeServer && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push({ pathname: '/(app)/member-list/[serverId]', params: { serverId: activeServer.id } } as any)}
            >
              <Ionicons name="people-outline" size={19} color={C.textSub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorBox}>
            <View style={styles.errorIcon}>
              <Ionicons name="lock-closed" size={32} color={C.textMuted} />
            </View>
            <Text style={styles.errorTitle}>Brak dostępu</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <Text style={styles.retryText}>Spróbuj ponownie</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : msgs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbox-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyText}>Brak wiadomości</Text>
          <Text style={styles.emptySubtext}>Napisz pierwszą wiadomość!</Text>
        </View>
      ) : (
        <FlatList
          data={[...msgs].reverse()}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={loadingMore ? <ActivityIndicator color={C.accent} style={{ padding: 12 }} /> : null}
          renderItem={({ item, index }) => {
            const reversedMsgs = [...msgs].reverse();
            const prev = reversedMsgs[index + 1];
            const showHeader = !prev || prev.sender_id !== item.sender_id ||
              (new Date(item.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60_000;
            const isSysMsg = item.sender_id === '__system__';
            return (
              <MessageBubble
                msg={item}
                isOwn={item.sender_id === currentUser?.id}
                showHeader={showHeader && !isSysMsg}
                onReply={setReplyTo}
                onDelete={isSysMsg ? undefined : handleDelete}
                onEdit={isSysMsg ? undefined : handleEdit}
                onReact={isSysMsg ? undefined : handleReact}
                isSystem={isSysMsg}
                onAvatarPress={(uid) => {
                  if (uid !== currentUser?.id) {
                    router.push({ pathname: '/(app)/user-profile/[userId]', params: { userId: uid } } as any);
                  }
                }}
              />
            );
          }}
        />
      )}

      {typing.length > 0 && (
        <View style={styles.typingBar}>
          <View style={styles.typingDots}>
            <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} />
          </View>
          <Text style={styles.typingText}>
            {typing.slice(0, 2).join(', ')} {typing.length === 1 ? 'pisze…' : 'piszą…'}
          </Text>
        </View>
      )}

      <View style={{ paddingBottom: insets.bottom }}>
        <MessageInput
          placeholder={`Napisz na #${name}`}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onSend={handleSend}
          onTyping={handleTyping}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bgCard,
  },
  back: { padding: 4 },
  title: { color: C.text, fontSize: 17, fontWeight: '700', flex: 1 },
  headerRight: { flexDirection: 'row', gap: 6 },
  headerBtn: {
    padding: 7, borderRadius: 10,
    backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  // Error state
  errorBox: {
    alignItems: 'center', gap: 12,
    backgroundColor: C.bgCard, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    padding: 32, width: '100%',
  },
  errorIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.bgElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  errorTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  errorText: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 4, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: C.accent, borderRadius: 10,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Empty state
  emptyText: { color: C.textSub, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptySubtext: { color: C.textMuted, fontSize: 13, marginTop: 4 },

  // Typing
  typingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  typingDots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.textMuted },
  typingText: { color: C.textMuted, fontSize: 12 },
});
