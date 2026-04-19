import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../src/theme';
import { authApi, usersApi } from '../../src/api';
import { useStore } from '../../src/store';
import { disconnectSocket } from '../../src/socket';

const STATUS_OPTIONS = [
  { key: 'online', label: 'Online', icon: 'ellipse' as const },
  { key: 'idle', label: 'Bezczynny', icon: 'moon' as const },
  { key: 'dnd', label: 'Nie przeszkadzać', icon: 'remove-circle' as const },
  { key: 'offline', label: 'Niewidoczny', icon: 'ellipse-outline' as const },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser, clearAuth } = useStore();
  const [editing, setEditing] = useState(false);
  const [aboutMe, setAboutMe] = useState(currentUser?.about_me ?? '');
  const [saving, setSaving] = useState(false);

  if (!currentUser) return null;

  const handleStatusChange = async (status: string) => {
    try {
      await usersApi.updateStatus(status);
      setCurrentUser({ ...currentUser, preferred_status: status });
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({ about_me: aboutMe });
      setCurrentUser(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Wyloguj się', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyloguj', style: 'destructive', onPress: async () => {
        try { await authApi.logout(); } catch { }
        disconnectSocket();
        await clearAuth();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const currentStatus = currentUser.preferred_status ?? currentUser.status ?? 'online';

  return (
    <ScrollView style={[styles.flex, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <UserAvatar url={currentUser.avatar_url} username={currentUser.username} size={88} status={currentStatus} showStatus />
        <Text style={styles.username}>{currentUser.username}</Text>
        <Text style={styles.joinDate}>
          Konto od {new Date(currentUser.created_at).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>STATUS</Text>
        <View style={styles.card}>
          {STATUS_OPTIONS.map((opt, idx) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.statusRow, idx < STATUS_OPTIONS.length - 1 && styles.statusRowBorder]}
              onPress={() => handleStatusChange(opt.key)}
            >
              <Ionicons name={opt.icon} size={16} color={STATUS_COLOR[opt.key] ?? C.textMuted} />
              <Text style={styles.statusLabel}>{opt.label}</Text>
              {currentStatus === opt.key && <Ionicons name="checkmark" size={18} color={C.accent} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* About me */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>O MNIE</Text>
          <TouchableOpacity onPress={() => editing ? handleSaveProfile() : setEditing(true)}>
            <Text style={styles.editBtn}>{editing ? (saving ? 'Zapisuję…' : 'Zapisz') : 'Edytuj'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {editing ? (
            <TextInput
              style={styles.aboutInput}
              value={aboutMe}
              onChangeText={setAboutMe}
              placeholder="Opisz siebie…"
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={190}
            />
          ) : (
            <Text style={styles.aboutText}>{currentUser.about_me || 'Brak opisu.'}</Text>
          )}
        </View>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>KONTO</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID użytkownika</Text>
            <Text style={styles.infoValue} selectable>{currentUser.id}</Text>
          </View>
          {currentUser.is_admin && (
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>Rola</Text>
              <Text style={[styles.infoValue, { color: C.warning }]}>Administrator</Text>
            </View>
          )}
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={C.danger} />
          <Text style={styles.logoutText}>Wyloguj się</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  avatarSection: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  username: { color: C.text, fontSize: 22, fontWeight: '800' },
  joinDate: { color: C.textMuted, fontSize: 13 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  editBtn: { color: C.accent, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  statusRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  statusLabel: { flex: 1, color: C.text, fontSize: 15 },
  aboutInput: { color: C.text, fontSize: 15, padding: 14, minHeight: 80, textAlignVertical: 'top' },
  aboutText: { color: C.text, fontSize: 15, padding: 14, lineHeight: 22 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  infoLabel: { color: C.textMuted, fontSize: 14 },
  infoValue: { color: C.text, fontSize: 14, fontWeight: '500', maxWidth: '60%' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  logoutText: { color: C.danger, fontSize: 16, fontWeight: '600' },
});
