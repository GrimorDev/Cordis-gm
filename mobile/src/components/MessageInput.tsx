import React, { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import type { Message } from '../api';

interface Props {
  placeholder?: string;
  replyTo?: Message | null;
  onClearReply?: () => void;
  onSend: (text: string) => Promise<void>;
  onTyping?: () => void;
}

export function MessageInput({ placeholder = 'Napisz wiadomość…', replyTo, onClearReply, onSend, onTyping }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await onSend(trimmed);
    } catch {
      setText(trimmed); // restore on error
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      {replyTo && (
        <View style={styles.replyBar}>
          <Ionicons name="return-up-forward" size={14} color={C.accent} />
          <Text style={styles.replyText} numberOfLines={1}>
            Odpowiedź do <Text style={styles.replyName}>{replyTo.sender_username}</Text>: {replyTo.content}
          </Text>
          <TouchableOpacity onPress={onClearReply}>
            <Ionicons name="close" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={(v) => { setText(v); onTyping?.(); }}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          multiline
          maxLength={2000}
          returnKeyType="default"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Ionicons name="send" size={18} color={text.trim() ? '#fff' : C.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 8,
  },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.bgCard, borderRadius: 8, padding: 8, marginBottom: 6,
  },
  replyText: { flex: 1, color: C.textMuted, fontSize: 12 },
  replyName: { color: C.text, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1, color: C.text, fontSize: 15,
    backgroundColor: C.bgInput, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    maxHeight: 120, borderWidth: 1, borderColor: C.border,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: C.bgCard },
});
