import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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

export default function ChannelScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const insets = useSafeAreaInsets();
  const { messages, setMessages, prependMessages, addMessage, updateMessage, removeMessage, currentUser, setTyping, typingUsers } = useStore();
  const msgs = messages[id] ?? [];
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await messagesApi.list(id);
      setMessages(id, list);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    getSocket()?.emit('join_channel', id);

    const sock = getSocket();
    const onUpdate = (msg: any) => { if (msg.channel_id === id) updateMessage(id, msg); };
    const onDelete = ({ id: msgId }: any) => removeMessage(id, msgId);
    const onTyping = ({ username }: any) => {
      setTyping(id, [...(typingUsers[id] ?? []).filter(u => u !== username), username]);
      setTimeout(() => setTyping(id, (typingUsers[id] ?? []).filter(u => u !== username)), 3500);
    };
    sock?.on('message_updated', onUpdate);
    sock?.on('message_deleted', onDelete);
    sock?.on('user_typing', onTyping);

    return () => {
      getSocket()?.emit('leave_channel', id);
      sock?.off('message_updated', onUpdate);
      sock?.off('message_deleted', onDelete);
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

  const handleSend = async (text: string) => {
    await messagesApi.send(id, text, replyTo?.id);
    setReplyTo(null);
  };

  const handleTyping = () => {
    getSocket()?.emit('typing_start', { channel_id: id });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      getSocket()?.emit('typing_stop', { channel_id: id });
    }, 2000);
  };

  const handleDelete = async (msgId: string) => {
    try { await messagesApi.delete(msgId); }
    catch { /* ignore */ }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    try { await messagesApi.react(msgId, emoji); }
    catch { /* ignore */ }
  };

  const typing = typingUsers[id] ?? [];

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Ionicons name="hash-outline" size={18} color={C.textMuted} />
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
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
            return (
              <MessageBubble
                msg={item}
                isOwn={item.sender_id === currentUser?.id}
                showHeader={showHeader}
                onReply={setReplyTo}
                onDelete={handleDelete}
                onReact={handleReact}
              />
            );
          }}
        />
      )}

      {typing.length > 0 && (
        <View style={styles.typingBar}>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  back: { padding: 4 },
  title: { color: C.text, fontSize: 17, fontWeight: '700', flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  typingBar: { paddingHorizontal: 16, paddingBottom: 4 },
  typingText: { color: C.textMuted, fontSize: 12 },
});
