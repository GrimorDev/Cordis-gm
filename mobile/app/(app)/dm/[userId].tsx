import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Text, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { MessageBubble } from '../../../src/components/MessageBubble';
import { MessageInput } from '../../../src/components/MessageInput';
import { C } from '../../../src/theme';
import { dmsApi, API_URL } from '../../../src/api';
import { useStore } from '../../../src/store';
import { getSocket } from '../../../src/socket';
import { storage } from '../../../src/storage';
import { STATIC_BASE } from '../../../src/config';
import { format, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { DmMessage, Message } from '../../../src/api';

function resolveAvatar(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${STATIC_BASE}${url}`;
}

function resolveAttachment(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${STATIC_BASE}${url}`;
}

function fmtTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Wczoraj ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM HH:mm', { locale: pl });
}

/**
 * Cast a DmMessage to the shape MessageBubble expects (Message interface).
 * Fields missing from DmMessage are set to undefined/null.
 */
function dmToMsg(dm: DmMessage): Message {
  return {
    id: dm.id,
    channel_id: dm.conversation_id,
    sender_id: dm.sender_id,
    sender_username: dm.sender_username,
    sender_avatar: dm.sender_avatar,
    content: dm.content,
    created_at: dm.created_at,
    updated_at: null,
    is_edited: dm.is_edited,
    reply_to_id: dm.reply_to_id ?? null,
    reply_to_content: dm.reply_to_content ?? null,
    reply_to_username: dm.reply_to_username ?? null,
    attachment_url: dm.attachment_url ?? null,
    reactions: (dm as any).reactions ?? [],
  };
}

async function getAuthToken(): Promise<string | null> {
  return storage.getItemAsync('cordyn_token');
}

async function markDmRead(userId: string): Promise<void> {
  try {
    const token = await getAuthToken();
    await fetch(`${API_URL}/dms/${userId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch { /* non-critical */ }
}

export default function DmChatScreen() {
  const { userId, username, avatar } = useLocalSearchParams<{ userId: string; username: string; avatar: string }>();
  const insets = useSafeAreaInsets();
  const {
    dmMessages, setDmMessages, addDmMessage, updateDmMessage, removeDmMessage,
    currentUser, userStatuses,
  } = useStore();
  const msgs = dmMessages[userId] ?? [];

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await dmsApi.messages(userId);
      setDmMessages(userId, list);
    } catch { } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    load();
    markDmRead(userId);

    const sock = getSocket();

    const onNewDm = (msg: any) => {
      const otherId = msg.sender_id === currentUser?.id ? msg.receiver_id : msg.sender_id;
      if (otherId !== userId && msg.sender_id !== userId) return;
      addDmMessage(userId, msg);
    };
    const onDmUpdated = (msg: any) => {
      if (msg.sender_id === userId || msg.receiver_id === userId) {
        updateDmMessage(userId, msg);
      }
    };
    const onDmDeleted = ({ id: msgId }: any) => {
      removeDmMessage(userId, msgId);
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
    sock?.on('dm_updated', onDmUpdated);
    sock?.on('dm_deleted', onDmDeleted);
    sock?.on('dm_user_typing', onTyping);
    sock?.on('dm_user_stop_typing', onStopTyping);
    return () => {
      sock?.off('new_dm', onNewDm);
      sock?.off('dm_updated', onDmUpdated);
      sock?.off('dm_deleted', onDmDeleted);
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

  const handleSend = async (text: string, attachmentUrl?: string) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      const msg = await dmsApi.send(userId, text, attachmentUrl);
      addDmMessage(userId, msg);
    } finally {
      sendingRef.current = false;
    }
  };

  const handleTyping = () => {
    getSocket()?.emit('dm_typing_start', userId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => getSocket()?.emit('dm_typing_stop', userId), 2000);
  };

  const handleEdit = async (id: string, newContent: string) => {
    try {
      const updated = await dmsApi.editMessage(id, newContent);
      updateDmMessage(userId, updated);
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się edytować wiadomości');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dmsApi.deleteMessage(id);
      removeDmMessage(userId, id);
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się usunąć wiadomości');
    }
  };

  const handleCallPress = () => {
    Alert.alert(
      'Połączenie',
      'Wybierz typ połączenia',
      [
        {
          text: 'Połączenie głosowe',
          onPress: () => Alert.alert('Wkrótce', 'Połączenia głosowe nie są jeszcze dostępne w aplikacji mobilnej.'),
        },
        {
          text: 'Połączenie wideo',
          onPress: () => Alert.alert('Wkrótce', 'Połączenia wideo nie są jeszcze dostępne w aplikacji mobilnej.'),
        },
        { text: 'Anuluj', style: 'cancel' },
      ],
    );
  };

  const status = userStatuses[userId] ?? 'offline';

  const replyToAsMessage: Message | null = replyTo ? dmToMsg(replyTo) : null;

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(app)/user-profile/[userId]', params: { userId } } as any)}
          activeOpacity={0.8}
        >
          <UserAvatar url={resolveAvatar(avatar)} username={username} size={36} status={status} showStatus />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{username}</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={handleCallPress}>
          <Ionicons name="call-outline" size={20} color={C.textSub} />
        </TouchableOpacity>
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
          ListHeaderComponent={loadingMore ? <ActivityIndicator color={C.accent} style={{ padding: 12 }} /> : null}
          renderItem={({ item, index }) => {
            // System messages
            if (item.sender_id === '__system__') {
              const isMissed = item.content.toLowerCase().includes('nieodebrane');
              return (
                <View style={styles.systemPill}>
                  <Ionicons
                    name="call-outline"
                    size={13}
                    color={isMissed ? C.danger : C.textMuted}
                  />
                  <Text style={[styles.systemText, isMissed && styles.systemTextMissed]}>
                    {item.content}
                  </Text>
                </View>
              );
            }

            const reversed = [...msgs].reverse();
            const prev = reversed[index + 1];
            const showHeader = !prev || prev.sender_id !== item.sender_id ||
              (new Date(item.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60_000;

            const attachmentUrl = resolveAttachment((item as any).attachment_url);
            const isImage = attachmentUrl && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(attachmentUrl);

            return (
              <View>
                <MessageBubble
                  msg={dmToMsg(item)}
                  isOwn={item.sender_id === currentUser?.id}
                  showHeader={showHeader}
                  onReply={(m) => {
                    const orig = msgs.find(dm => dm.id === m.id) ?? null;
                    setReplyTo(orig);
                  }}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onAvatarPress={(uid) => {
                    if (uid !== currentUser?.id) {
                      router.push({ pathname: '/(app)/user-profile/[userId]', params: { userId: uid } } as any);
                    }
                  }}
                />
                {isImage && attachmentUrl && (
                  <TouchableOpacity
                    style={styles.imageWrapper}
                    onPress={() => setLightboxUrl(attachmentUrl)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: attachmentUrl }}
                      style={styles.attachmentImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
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
          replyTo={replyToAsMessage}
          onClearReply={() => setReplyTo(null)}
          onSend={handleSend}
          onTyping={handleTyping}
        />
      </View>

      {/* Image lightbox */}
      <Modal
        visible={!!lightboxUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <TouchableOpacity
          style={styles.lightboxOverlay}
          activeOpacity={1}
          onPress={() => setLightboxUrl(null)}
        >
          {lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  back: { padding: 4 },
  headerInfo: { flex: 1 },
  headerBtn: {
    padding: 8, borderRadius: 10,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
  },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  statusText: { color: C.textMuted, fontSize: 12, textTransform: 'capitalize' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // System message pill
  systemPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', backgroundColor: C.bgCard,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
    marginVertical: 6, borderWidth: 1, borderColor: C.border,
  },
  systemText: { color: C.textMuted, fontSize: 12 },
  systemTextMissed: { color: C.danger },
  // Attachment image
  imageWrapper: { paddingLeft: 58, paddingRight: 12, marginTop: 4 },
  attachmentImage: {
    width: '100%', height: 200, borderRadius: 12,
    backgroundColor: C.bgCard,
  },
  // Typing indicator
  typingBar: { paddingHorizontal: 16, paddingBottom: 4 },
  typingText: { color: C.textMuted, fontSize: 12 },
  // Lightbox
  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '80%' },
  lightboxClose: {
    position: 'absolute', top: 48, right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6,
  },
});
