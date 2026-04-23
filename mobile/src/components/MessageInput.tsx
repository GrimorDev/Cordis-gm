import React, { useState, useRef } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, Text,
  Image, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C } from '../theme';
import { API_URL } from '../api';
import { storage } from '../storage';
import type { Message } from '../api';

interface Props {
  placeholder?: string;
  replyTo?: Message | null;
  onClearReply?: () => void;
  onSend: (text: string, attachmentUrl?: string) => Promise<void>;
  onTyping?: () => void;
}

async function uploadAttachment(uri: string, mimeType: string, fileName: string): Promise<string> {
  const token = await storage.getItemAsync('cordyn_token');
  const formData = new FormData();
  formData.append('file', { uri, type: mimeType, name: fileName } as any);
  const res = await fetch(`${API_URL}/uploads/attachment`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.url as string;
}

export function MessageInput({
  placeholder = 'Napisz wiadomość…',
  replyTo,
  onClearReply,
  onSend,
  onTyping,
}: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; mimeType: string; fileName: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isSendingRef = useRef(false);
  const sendAnim = useRef(new Animated.Value(1)).current;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Brak uprawnień', 'Musisz przyznać dostęp do galerii.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingImage({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
    });
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingImage) return;
    if (sending || uploadingImage || isSendingRef.current) return;

    // Button press animation
    Animated.sequence([
      Animated.timing(sendAnim, { toValue: 0.88, duration: 60, useNativeDriver: true }),
      Animated.spring(sendAnim, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }),
    ]).start();

    isSendingRef.current = true;
    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      if (pendingImage) {
        setUploadingImage(true);
        attachmentUrl = await uploadAttachment(pendingImage.uri, pendingImage.mimeType, pendingImage.fileName);
        setUploadingImage(false);
      }
      setText('');
      setPendingImage(null);
      await onSend(trimmed, attachmentUrl);
    } catch (e: any) {
      setUploadingImage(false);
      Alert.alert('Błąd', e.message ?? 'Nie udało się wysłać wiadomości');
      setText(text);
    } finally {
      isSendingRef.current = false;
      setSending(false);
    }
  };

  const canSend = (text.trim().length > 0 || !!pendingImage) && !sending && !uploadingImage;

  return (
    <View style={styles.wrapper}>
      {/* Reply bar */}
      {replyTo && (
        <View style={styles.replyBar}>
          <Ionicons name="return-up-forward" size={14} color={C.accentLight} />
          <Text style={styles.replyText} numberOfLines={1}>
            <Text style={styles.replyName}>{replyTo.sender_username}: </Text>
            {replyTo.content || '📎 Załącznik'}
          </Text>
          <TouchableOpacity onPress={onClearReply} style={styles.replyClose}>
            <Ionicons name="close" size={14} color={C.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Image preview */}
      {pendingImage && (
        <View style={styles.imagePreviewRow}>
          <View style={styles.imagePreviewCard}>
            <Image source={{ uri: pendingImage.uri }} style={styles.imagePreview} />
            {uploadingImage && (
              <View style={styles.imageUploadOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setPendingImage(null)}>
            <Ionicons name="close-circle" size={22} color={C.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input row */}
      <View style={[styles.row, focused && styles.rowFocused]}>
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
          <Ionicons name="image-outline" size={19} color={focused ? C.textSub : C.textMuted} />
        </TouchableOpacity>

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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        <Animated.View style={{ transform: [{ scale: sendAnim }] }}>
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {sending || uploadingImage
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={16} color={canSend ? '#fff' : C.textMuted} />
            }
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accentMuted,
    borderRadius: 10,
    padding: 9,
    marginBottom: 7,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  replyText: { flex: 1, color: C.textSub, fontSize: 12.5 },
  replyName: { color: C.accentLight, fontWeight: '700' },
  replyClose: { padding: 2 },

  // Image preview
  imagePreviewRow: {
    marginBottom: 8,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreviewCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  imagePreview: {
    width: 110,
    height: 85,
    backgroundColor: C.bgCard,
  },
  imageUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: C.bg,
    borderRadius: 12,
  },

  // Input row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: C.bgCard,
    borderRadius: 22,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  rowFocused: {
    borderColor: C.borderFocus,
    backgroundColor: C.bgElevated,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.accent,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  sendDisabled: {
    backgroundColor: C.bgElevated,
    shadowOpacity: 0,
    elevation: 0,
  },
});
