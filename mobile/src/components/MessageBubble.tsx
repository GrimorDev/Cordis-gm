import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  TextInput, Modal, Image, Pressable, Dimensions, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { format, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { enGB } from 'date-fns/locale';
import { router } from 'expo-router';
import { UserAvatar } from './UserAvatar';
import { C } from '../theme';
import { useT, getT } from '../i18n';
import { useStore } from '../store';
import { serversApi } from '../api';
import { STATIC_BASE } from '../config';
import type { Message } from '../api';

function resolveStatic(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
}

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  msg: Message;
  isOwn: boolean;
  showHeader: boolean;
  onReply: (msg: Message) => void;
  onDelete?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onAvatarPress?: (userId: string) => void;
  /** If true, render as a system/call message pill instead of normal bubble */
  isSystem?: boolean;
  /** If true, moderator-level delete is allowed regardless of ownership */
  canModerate?: boolean;
  /** Backend enforces the pin_messages permission — show the option to everyone
   *  and surface a 403 as an alert rather than hiding it behind a client-side check. */
  onPin?: (id: string, pinned: boolean) => void;
}

function fmtTime(dateStr: string, lang: 'pl' | 'en' = 'en', yesterday = 'Yesterday') {
  const d = new Date(dateStr);
  const locale = lang === 'pl' ? pl : enGB;
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `${yesterday} ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM HH:mm', { locale });
}

const QUICK_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢', '🎉', '👀', '💯', '😍', '🤔', '⚡'];

/** Detect if content looks like a system/call message */
function isCallMessage(content: string) {
  return (
    content.startsWith('Rozmowa głosowa') ||
    content.startsWith('Rozmowa wideo') ||
    content === 'Połączenie nieodebrane' ||
    content.startsWith('Połączenie')
  );
}

function callIcon(content: string): string {
  if (content.includes('wideo')) return 'videocam';
  if (content === 'Połączenie nieodebrane') return 'call';
  return 'call';
}

function callColor(content: string): string {
  if (content === 'Połączenie nieodebrane') return C.danger;
  return '#22c55e';
}

/** Server-invite-via-DM payload: `CINV|serverId|code|serverName|iconUrl|bannerUrl`
 *  (mirrors desktop's src/App.tsx). Mobile never rendered this specially before —
 *  it just dumped the raw pipe-delimited string as message text. */
function ServerInviteCard({ content }: { content: string }) {
  const t = useT();
  const { servers, addServer, setActiveServer } = useStore();
  const [joining, setJoining] = useState(false);
  const parts = content.split('|');
  const [, srvId, code, srvName, iconUrl, bannerUrl] = parts;
  const iconSrc = resolveStatic(iconUrl);
  const bannerSrc = resolveStatic(bannerUrl);
  const alreadyMember = servers.some(s => s.id === srvId);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const joined = await serversApi.join(code);
      addServer(joined);
      setActiveServer(joined);
      router.push('/(app)');
    } catch (e: any) {
      const gt = getT();
      Alert.alert(gt.error, e.message ?? gt.error);
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={inviteStyles.card}>
      <View style={inviteStyles.banner}>
        {bannerSrc ? (
          <Image source={{ uri: bannerSrc }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, inviteStyles.bannerFallback]} />
        )}
        <View style={inviteStyles.bannerShade} />
      </View>
      <View style={inviteStyles.head}>
        {iconSrc ? (
          <Image source={{ uri: iconSrc }} style={inviteStyles.icon} />
        ) : (
          <View style={[inviteStyles.icon, inviteStyles.iconFallback]}>
            <Text style={inviteStyles.iconFallbackText}>{(srvName?.[0] ?? 'S').toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={inviteStyles.label}>{t.serverInviteLabel}</Text>
          <Text style={inviteStyles.name} numberOfLines={1}>{srvName || '?'}</Text>
        </View>
      </View>
      <View style={inviteStyles.footer}>
        {alreadyMember ? (
          <View style={inviteStyles.memberPill}>
            <Text style={inviteStyles.memberPillText}>{t.alreadyMember}</Text>
          </View>
        ) : (
          <TouchableOpacity style={inviteStyles.joinBtn} onPress={handleJoin} disabled={joining} activeOpacity={0.85}>
            {joining
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={inviteStyles.joinBtnText}>{t.joinServerBtn}</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function MessageBubble({
  msg, isOwn, showHeader, onReply, onDelete, onReact, onEdit, onAvatarPress, isSystem, canModerate, onPin,
}: Props) {
  const t = useT();
  const { language } = useStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  // ── System / call message pill ───────────────────────────────────────────────
  if (isSystem || isCallMessage(msg.content)) {
    const color = callColor(msg.content);
    const icon = callIcon(msg.content);
    return (
      <View style={styles.systemRow}>
        <View style={[styles.systemPill, { borderColor: color + '55' }]}>
          <Ionicons name={icon as any} size={13} color={color} />
          <Text style={[styles.systemText, { color }]}>{msg.content}</Text>
          <Text style={styles.systemTime}>{fmtTime(msg.created_at, language, t.yesterday)}</Text>
        </View>
      </View>
    );
  }

  const handleLongPress = () => setMenuVisible(true);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(msg.content);
    setMenuVisible(false);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    const gt = getT();
    Alert.alert(gt.deleteMsg, gt.deleteMsgConfirm, [
      { text: gt.cancel, style: 'cancel' },
      { text: gt.delete, style: 'destructive', onPress: () => onDelete?.(msg.id) },
    ]);
  };

  const handleEditPress = () => {
    setEditText(msg.content);
    setEditMode(true);
    setMenuVisible(false);
  };

  const handleEditSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== msg.content) {
      onEdit?.(msg.id, trimmed);
    }
    setEditMode(false);
  };

  const handleEditCancel = () => {
    setEditText(msg.content);
    setEditMode(false);
  };

  return (
    <View style={styles.wrapper}>
      {/* Header row (avatar + username + time) */}
      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => onAvatarPress?.(msg.sender_id)}
            disabled={!onAvatarPress}
            activeOpacity={0.7}
          >
            <UserAvatar url={msg.sender_avatar} username={msg.sender_username} size={36} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.username}>{msg.sender_username}</Text>
            <Text style={styles.time}>{fmtTime(msg.created_at, language, t.yesterday)}</Text>
            {msg.pinned && <Ionicons name="pin" size={11} color={C.accentLight} style={{ transform: [{ rotate: '30deg' }] }} />}
          </View>
        </View>
      )}

      {/* Reply bar */}
      {msg.reply_to_id && (
        <View style={styles.replyBar}>
          <Ionicons name="return-up-forward" size={12} color={C.textMuted} />
          <Text style={styles.replyText} numberOfLines={1}>
            <Text style={styles.replyUsername}>{msg.reply_to_username ?? '?'}: </Text>
            {msg.reply_to_content ?? '…'}
          </Text>
        </View>
      )}

      {/* Message bubble / edit mode */}
      {editMode ? (
        <View style={[styles.bubble, showHeader ? styles.bubbleWithHeader : styles.bubbleNoHeader, styles.editContainer]}>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            maxLength={2000}
            placeholderTextColor={C.textMuted}
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.editCancelBtn} onPress={handleEditCancel}>
              <Text style={styles.editCancelText}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editSaveBtn, !editText.trim() && styles.editSaveBtnDisabled]}
              onPress={handleEditSave}
              disabled={!editText.trim()}
            >
              <Text style={styles.editSaveText}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={handleLongPress}
          style={[styles.bubble, showHeader ? styles.bubbleWithHeader : styles.bubbleNoHeader]}
        >
          {msg.content?.startsWith('CINV|') ? (
            <ServerInviteCard content={msg.content} />
          ) : msg.content ? (
            <Text style={styles.content}>{msg.content}</Text>
          ) : null}
          {msg.is_edited && !msg.content?.startsWith('CINV|') && <Text style={styles.edited}>{t.editedMark}</Text>}

          {/* Image attachment */}
          {msg.attachment_url && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setLightboxVisible(true)}
              style={styles.attachmentContainer}
            >
              <Image
                source={{ uri: msg.attachment_url }}
                style={styles.attachmentImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )}

      {/* Reactions */}
      {msg.reactions && msg.reactions.length > 0 && (
        <View style={styles.reactions}>
          {msg.reactions.map((r) => (
            <TouchableOpacity
              key={r.emoji}
              style={[styles.reactionChip, r.reacted && styles.reactionOwn]}
              onPress={() => onReact?.(msg.id, r.emoji)}
            >
              <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              <Text style={styles.reactionCount}>{r.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Context menu (Modal, so it's not clipped by FlatList) ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
            {/* Quick reactions */}
            <View style={styles.quickReactions}>
              {QUICK_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={styles.quickEmoji}
                  onPress={() => { onReact?.(msg.id, e); setMenuVisible(false); }}
                >
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={() => { onReply(msg); setMenuVisible(false); }}>
              <Ionicons name="return-up-forward-outline" size={18} color={C.text} />
              <Text style={styles.menuLabel}>{t.reply}</Text>
            </TouchableOpacity>

            {isOwn && onEdit && (
              <TouchableOpacity style={styles.menuItem} onPress={handleEditPress}>
                <Ionicons name="pencil-outline" size={18} color={C.text} />
                <Text style={styles.menuLabel}>{t.edit}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={18} color={C.text} />
              <Text style={styles.menuLabel}>{t.copyText}</Text>
            </TouchableOpacity>

            {onPin && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { onPin(msg.id, !msg.pinned); setMenuVisible(false); }}
              >
                <Ionicons name="pin-outline" size={18} color={C.text} />
                <Text style={styles.menuLabel}>{msg.pinned ? t.unpinMessage : t.pinMessage}</Text>
              </TouchableOpacity>
            )}

            {(isOwn || canModerate) && onDelete && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={18} color={C.danger} />
                <Text style={[styles.menuLabel, { color: C.danger }]}>{t.deleteMsg}</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Image lightbox ── */}
      {msg.attachment_url && (
        <Modal
          visible={lightboxVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxVisible(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxVisible(false)}>
            <Image
              source={{ uri: msg.attachment_url }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
            <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxVisible(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, marginBottom: 2 },

  // System / call message
  systemRow: { alignItems: 'center', marginVertical: 8 },
  systemPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.bgCard, borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  systemText: { fontSize: 13, fontWeight: '500' },
  systemTime: { color: C.textMuted, fontSize: 11, marginLeft: 4 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  headerText: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  username: { color: C.text, fontWeight: '600', fontSize: 14 },
  time: { color: C.textMuted, fontSize: 11 },

  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingLeft: 46, paddingBottom: 2,
  },
  replyText: { color: C.textMuted, fontSize: 12, flex: 1 },
  replyUsername: { color: C.textSub, fontWeight: '600' },

  bubble: { paddingLeft: 46 },
  bubbleWithHeader: { paddingTop: 2 },
  bubbleNoHeader: { paddingTop: 0 },

  content: { color: C.text, fontSize: 15, lineHeight: 22 },
  edited: { color: C.textMuted, fontSize: 11, marginTop: 2 },

  // Attachment
  attachmentContainer: { marginTop: 6, borderRadius: 12, overflow: 'hidden' },
  attachmentImage: {
    width: SCREEN_W - 80,
    height: (SCREEN_W - 80) * 0.6,
    borderRadius: 12,
    backgroundColor: C.bgCard,
  },

  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingLeft: 46, marginTop: 5 },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.bgSurface, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
  },
  reactionOwn: { borderColor: C.accentLight, backgroundColor: C.accentMuted },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: C.textSub, fontSize: 12, fontWeight: '600' },

  // Inline edit
  editContainer: { paddingRight: 0 },
  editInput: {
    color: C.text, fontSize: 15, lineHeight: 22,
    backgroundColor: C.bgInput, borderRadius: 10, borderWidth: 1, borderColor: C.borderFocus,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  editCancelBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
  },
  editCancelText: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  editSaveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: C.accent },
  editSaveBtnDisabled: { opacity: 0.45 },
  editSaveText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Context menu Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  menu: {
    backgroundColor: C.bgSurface, borderRadius: 20, padding: 8,
    minWidth: 260, maxWidth: SCREEN_W - 40,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.7, shadowRadius: 24, elevation: 20,
  },
  quickReactions: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 4, gap: 2,
  },
  quickEmoji: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bgElevated,
  },
  menuDivider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
  },
  menuLabel: { color: C.text, fontSize: 15, fontWeight: '500' },

  // Lightbox
  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  lightboxImage: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6,
  },
});

// ── Server invite card ──────────────────────────────────────────────────────
const inviteStyles = StyleSheet.create({
  card: {
    width: 260, borderRadius: 16, overflow: 'hidden',
    backgroundColor: C.bgSurface, borderWidth: 1, borderColor: C.border,
    marginTop: 2,
  },
  banner: { height: 60, backgroundColor: C.accentDark },
  bannerFallback: { backgroundColor: C.accentDark },
  bannerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  head: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 0, marginTop: -22, paddingBottom: 6,
  },
  icon: { width: 46, height: 46, borderRadius: 14, borderWidth: 3, borderColor: C.bgSurface },
  iconFallback: { backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  iconFallbackText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  label: { color: C.textMuted, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  name: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 1 },
  footer: { paddingHorizontal: 12, paddingBottom: 12 },
  joinBtn: {
    backgroundColor: C.accent, borderRadius: 11, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  joinBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  memberPill: {
    backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 11, paddingVertical: 10, alignItems: 'center',
  },
  memberPillText: { color: C.textMuted, fontSize: 12.5, fontWeight: '600' },
});
