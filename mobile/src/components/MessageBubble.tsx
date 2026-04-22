import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { format, isToday, isYesterday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { UserAvatar } from './UserAvatar';
import { C } from '../theme';
import type { Message } from '../api';

interface Props {
  msg: Message;
  isOwn: boolean;
  showHeader: boolean;
  onReply: (msg: Message) => void;
  onDelete?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onEdit?: (id: string, newContent: string) => void;
  onAvatarPress?: (userId: string) => void;
}

function fmtTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Wczoraj ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM HH:mm', { locale: pl });
}

const QUICK_EMOJIS = ['❤️', '😂', '👍', '😮', '😢'];

export function MessageBubble({ msg, isOwn, showHeader, onReply, onDelete, onReact, onEdit, onAvatarPress }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  const handleLongPress = () => setMenuVisible(true);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(msg.content);
    setMenuVisible(false);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert('Usuń wiadomość', 'Na pewno chcesz usunąć tę wiadomość?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => onDelete?.(msg.id) },
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
      {showHeader && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => onAvatarPress?.(msg.sender_id)}
            disabled={!onAvatarPress}
          >
            <UserAvatar url={msg.sender_avatar} username={msg.sender_username} size={36} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.username}>{msg.sender_username}</Text>
            <Text style={styles.time}>{fmtTime(msg.created_at)}</Text>
          </View>
        </View>
      )}

      {msg.reply_to_id && (
        <View style={styles.replyBar}>
          <Ionicons name="return-up-forward" size={12} color={C.textMuted} />
          <Text style={styles.replyText} numberOfLines={1}>
            <Text style={styles.replyUsername}>{msg.reply_to_username ?? '?'}: </Text>
            {msg.reply_to_content ?? '…'}
          </Text>
        </View>
      )}

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
          <Text style={styles.content}>{msg.content}</Text>
          {msg.is_edited && <Text style={styles.edited}>(edytowano)</Text>}
        </TouchableOpacity>
      )}

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

      {/* Context menu */}
      {menuVisible && (
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            {/* Quick reactions */}
            <View style={styles.quickReactions}>
              {QUICK_EMOJIS.map((e) => (
                <TouchableOpacity key={e} style={styles.quickEmoji}
                  onPress={() => { onReact?.(msg.id, e); setMenuVisible(false); }}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { onReply(msg); setMenuVisible(false); }}>
              <Ionicons name="return-up-forward-outline" size={16} color={C.text} />
              <Text style={styles.menuLabel}>Odpowiedz</Text>
            </TouchableOpacity>
            {isOwn && onEdit && (
              <TouchableOpacity style={styles.menuItem} onPress={handleEditPress}>
                <Ionicons name="pencil-outline" size={16} color={C.text} />
                <Text style={styles.menuLabel}>Edytuj</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={16} color={C.text} />
              <Text style={styles.menuLabel}>Kopiuj tekst</Text>
            </TouchableOpacity>
            {isOwn && onDelete && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={16} color={C.danger} />
                <Text style={[styles.menuLabel, { color: C.danger }]}>Usuń</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, marginBottom: 2 },
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
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingLeft: 46, marginTop: 4 },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.bgCard, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: C.border,
  },
  reactionOwn: { borderColor: C.accent, backgroundColor: 'rgba(99,102,241,0.15)' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: C.textSub, fontSize: 12 },
  // Inline edit
  editContainer: { paddingRight: 0 },
  editInput: {
    color: C.text, fontSize: 15, lineHeight: 22,
    backgroundColor: C.bgInput, borderRadius: 10, borderWidth: 1, borderColor: C.borderFocus,
    paddingHorizontal: 10, paddingVertical: 8, marginRight: 0,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  editCancelBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border,
  },
  editCancelText: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  editSaveBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: C.accent,
  },
  editSaveBtnDisabled: { opacity: 0.45 },
  editSaveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  // Context menu overlay
  menuOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100, justifyContent: 'center', alignItems: 'center',
  },
  menu: {
    backgroundColor: C.bgElevated, borderRadius: 16, padding: 8, minWidth: 220,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12,
  },
  quickReactions: { flexDirection: 'row', justifyContent: 'space-around', padding: 8 },
  quickEmoji: { padding: 4 },
  menuDivider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  menuLabel: { color: C.text, fontSize: 15 },
});
