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
import { Sheet } from '../../../src/components/Sheet';
import { C } from '../../../src/theme';
import { messagesApi } from '../../../src/api';
import { useStore } from '../../../src/store';
import { getSocket } from '../../../src/socket';
import { useT, getT } from '../../../src/i18n';
import type { Message } from '../../../src/api';

export default function ChannelScreen() {
  const t = useT();
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
  const [pinnedVisible, setPinnedVisible] = useState(false);
  const [pinnedMsgs, setPinnedMsgs] = useState<Message[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);

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
      const gt = getT();
      const msg: string = e.message ?? '';
      if (msg === 'No access' || msg === 'Brak dostępu') {
        setError(gt.noAccessMsg);
      } else {
        setError(msg || gt.error);
      }
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

    const onMessagePinned = ({ message_id, channel_id, pinned }: any) => {
      if (channel_id !== id) return;
      const current = useStore.getState().messages[id] ?? [];
      const msg = current.find(m => m.id === message_id);
      if (msg) updateMessage(id, { ...msg, pinned });
      setPinnedMsgs(prev => pinned
        ? (msg && !prev.some(p => p.id === message_id) ? [{ ...msg, pinned }, ...prev] : prev)
        : prev.filter(p => p.id !== message_id));
    };
    sock?.on('message_pinned', onMessagePinned);

    return () => {
      getSocket()?.emit('leave_channel', id);
      sock?.off('user_typing', onTyping);
      sock?.off('message_pinned', onMessagePinned);
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
      const gt = getT();
      Alert.alert(gt.error, e.message ?? gt.deleteFailed);
    }
  };

  const handleEdit = async (msgId: string, newContent: string) => {
    try {
      const updated = await messagesApi.edit(msgId, newContent);
      updateMessage(id, updated);
    } catch (e: any) {
      const gt = getT();
      Alert.alert(gt.error, e.message ?? gt.editFailed);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    try { await messagesApi.react(msgId, emoji); }
    catch { /* ignore */ }
  };

  const handlePin = async (msgId: string, pinned: boolean) => {
    // Optimistic — the message_pinned socket event (handled below) reconciles
    // this across everyone in the channel, including us.
    const msg = msgs.find(m => m.id === msgId);
    if (msg) updateMessage(id, { ...msg, pinned });
    try {
      await messagesApi.togglePin(msgId, pinned);
    } catch (e: any) {
      if (msg) updateMessage(id, { ...msg, pinned: !pinned });
      const gt = getT();
      Alert.alert(gt.error, e.message ?? gt.pinFailed);
    }
  };

  const loadPinned = useCallback(async () => {
    if (!id) return;
    setPinnedLoading(true);
    try { setPinnedMsgs(await messagesApi.getPinned(id)); }
    catch { /* ignore */ }
    finally { setPinnedLoading(false); }
  }, [id]);

  const isOwner = currentUser?.id === activeServer?.owner_id;
  const typing = typingUsers[id] ?? [];

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.channelIconBg}>
          <Ionicons name="chatbox" size={15} color={C.accentLight} />
        </View>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => { setPinnedVisible(true); loadPinned(); }}
          >
            <Ionicons name="pin-outline" size={19} color={C.textSub} />
          </TouchableOpacity>
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
            <Text style={styles.errorTitle}>{t.noAccess}</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load}>
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <Text style={styles.retryText}>{t.retryBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : msgs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbox-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyText}>{t.noMessages}</Text>
          <Text style={styles.emptySubtext}>{t.noMessagesFirst}</Text>
        </View>
      ) : (
        <FlatList
          data={[...msgs].reverse()}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.accent} style={{ padding: 12 }} /> : null}
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
                onPin={isSysMsg ? undefined : handlePin}
                isSystem={isSysMsg}
                canModerate={isOwner}
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
            {typing.slice(0, 2).join(', ')} {typing.length === 1 ? t.typingOne : t.typingMany}
          </Text>
        </View>
      )}

      <View style={{ paddingBottom: insets.bottom }}>
        <MessageInput
          placeholder={t.writeTo(name ?? '')}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onSend={handleSend}
          onTyping={handleTyping}
        />
      </View>

      {/* Pinned messages sheet */}
      <Sheet visible={pinnedVisible} onClose={() => setPinnedVisible(false)}>
          <View style={[styles.pinnedSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.pinnedHeader}>
              <Ionicons name="pin" size={16} color={C.accentLight} />
              <Text style={styles.pinnedTitle}>{t.pinnedMessages}</Text>
              <TouchableOpacity onPress={() => setPinnedVisible(false)}>
                <Ionicons name="close" size={22} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            {pinnedLoading ? (
              <ActivityIndicator color={C.accent} style={{ padding: 24 }} />
            ) : pinnedMsgs.length === 0 ? (
              <Text style={styles.pinnedEmpty}>{t.noPinnedMessages}</Text>
            ) : (
              <FlatList
                data={pinnedMsgs}
                keyExtractor={(m) => m.id}
                style={{ maxHeight: 420 }}
                renderItem={({ item }) => (
                  <View style={styles.pinnedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pinnedSender}>{item.sender_username}</Text>
                      <Text style={styles.pinnedContent} numberOfLines={3}>{item.content}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handlePin(item.id, false)} style={styles.pinnedUnpinBtn}>
                      <Ionicons name="close-circle-outline" size={20} color={C.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#111118',
  },
  back: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  channelIconBg: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.25)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#f0f0f8', fontSize: 16, fontWeight: '800', flex: 1, letterSpacing: -0.2 },
  headerRight: { flexDirection: 'row', gap: 6 },
  headerBtn: {
    padding: 8, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
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
  typingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 5, paddingTop: 2,
  },
  typingDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent + 'aa' },
  typingText: { color: C.textMuted, fontSize: 12 },

  // Pinned messages sheet
  pinnedSheet: {
    backgroundColor: C.bgSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: C.border, paddingTop: 16, paddingHorizontal: 16,
  },
  pinnedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12 },
  pinnedTitle: { flex: 1, color: C.text, fontSize: 16, fontWeight: '700' },
  pinnedEmpty: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  pinnedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  pinnedSender: { color: C.accentLight, fontSize: 12.5, fontWeight: '700', marginBottom: 2 },
  pinnedContent: { color: C.textSub, fontSize: 13.5, lineHeight: 18 },
  pinnedUnpinBtn: { padding: 4 },
});
