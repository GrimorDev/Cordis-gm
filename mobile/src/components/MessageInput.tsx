import React, { useState, useRef } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, Text,
  Image, ActivityIndicator, Alert,
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
  const inputRef = useRef<TextInput>(null);

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
    if (sending || uploadingImage) return;

    setSending(true);
    try {
      let attachmentUrl: string | undefined;
      if (pendingImage) {
        setUploadingImage(true);
        attachmentUrl = await uploadAttachment(pendingImage.uri, pendingImage.mimeType, pendingImage.fileName);
        setUploadingImage(false);
      }
      const content = trimmed || (attachmentUrl ? '' : '');
      setText('');
      setPendingImage(null);
      await onSend(content, attachmentUrl);
    } catch (e: any) {
      setUploadingImage(false);
      Alert.alert('Błąd', e.message ?? 'Nie udało się wysłać wiadomości');
      // restore
      setText(text);
    } finally {
      setSending(false);
    }
  };

  const canSend = (text.trim().length > 0 || !!pendingImage) && !sending && !uploadingImage;

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

      {/* Image preview */}
      {pendingImage && (
        <View style={styles.imagePreviewRow}>
          <Image source={{ uri: pendingImage.uri }} style={styles.imagePreview} />
          {uploadingImage && (
            <View style={styles.imageUploadOverlay}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          )}
          <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setPendingImage(null)}>
            <Ionicons name="close-circle" size={20} color={C.danger} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.row}>
        {/* Attachment picker */}
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
          <Ionicons name="image-outline" size={20} color={C.textMuted} />
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
        />

        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {sending || uploadingImage
            ? <ActivityIndicator color="#fff" size="small" />
            : <Ionicons name="send" size={18} color={canSend ? '#fff' : C.textMuted} />
          }
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
    borderLeftWidth: 3, borderLeftColor: C.accent,
  },
  replyText: { flex: 1, color: C.textMuted, fontSize: 12 },
  replyName: { color: C.text, fontWeight: '600' },

  // Image preview
  imagePreviewRow: {
    marginBottom: 8, position: 'relative', alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 120, height: 90, borderRadius: 10,
    backgroundColor: C.bgCard,
  },
  imageUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: C.bg, borderRadius: 12,
  },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
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
