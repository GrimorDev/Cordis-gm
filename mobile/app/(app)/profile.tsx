import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Alert, ScrollView, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../src/theme';
import { authApi, usersApi } from '../../src/api';
import { useStore } from '../../src/store';
import { disconnectSocket } from '../../src/socket';
import { unregisterPushNotifications } from '../../src/notifications';
import Constants from 'expo-constants';

const STATUS_OPTIONS = [
  { key: 'online',  label: 'Online',           icon: 'ellipse' as const,        color: C.online },
  { key: 'idle',    label: 'Bezczynny',         icon: 'moon' as const,           color: C.idle   },
  { key: 'dnd',     label: 'Nie przeszkadzać',  icon: 'remove-circle' as const,  color: C.dnd    },
  { key: 'offline', label: 'Niewidoczny',        icon: 'ellipse-outline' as const, color: C.offline },
];

type Sheet = 'none' | 'editBio' | 'changeUsername' | 'changePassword';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser, clearAuth } = useStore();

  const [sheet, setSheet] = useState<Sheet>('none');
  const [saving, setSaving] = useState(false);

  // Bio edit
  const [aboutMe, setAboutMe] = useState(currentUser?.about_me ?? '');

  // Username change
  const [newUsername, setNewUsername] = useState('');

  // Password change
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  if (!currentUser) return null;

  const currentStatus = currentUser.preferred_status ?? currentUser.status ?? 'online';

  const handleStatusChange = async (status: string) => {
    try {
      await usersApi.updateStatus(status);
      setCurrentUser({ ...currentUser, preferred_status: status });
    } catch (e: any) { Alert.alert('Błąd', e.message); }
  };

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({ about_me: aboutMe });
      setCurrentUser(updated);
      setSheet('none');
    } catch (e: any) { Alert.alert('Błąd', e.message); }
    finally { setSaving(false); }
  };

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) return;
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({ username: newUsername.trim() });
      setCurrentUser(updated);
      setSheet('none');
      setNewUsername('');
    } catch (e: any) { Alert.alert('Błąd', e.message); }
    finally { setSaving(false); }
  };

  const handleSavePassword = async () => {
    if (newPass !== confirmPass) { Alert.alert('Błąd', 'Hasła nie są takie same'); return; }
    if (newPass.length < 8) { Alert.alert('Błąd', 'Hasło musi mieć co najmniej 8 znaków'); return; }
    setSaving(true);
    try {
      await usersApi.changePassword(currentPass, newPass);
      Alert.alert('Gotowe', 'Hasło zostało zmienione.');
      setSheet('none');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (e: any) { Alert.alert('Błąd', e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Wyloguj się', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyloguj', style: 'destructive', onPress: async () => {
        try { await authApi.logout(); } catch { }
        await unregisterPushNotifications().catch(() => {});
        disconnectSocket();
        await clearAuth();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <>
      <ScrollView
        style={[styles.flex, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>

        {/* Avatar + username hero */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <UserAvatar
              url={currentUser.avatar_url}
              username={currentUser.username}
              size={84}
              status={currentStatus}
              showStatus
            />
          </View>
          <Text style={styles.username}>{currentUser.username}</Text>
          {currentUser.is_admin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color={C.warning} />
              <Text style={styles.adminBadgeText}>Administrator</Text>
            </View>
          )}
          {currentUser.created_at ? (
            <Text style={styles.joinDate}>
              Konto od {new Date(currentUser.created_at).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' })}
            </Text>
          ) : null}
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STATUS</Text>
          <View style={styles.card}>
            {STATUS_OPTIONS.map((opt, idx) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.row, idx < STATUS_OPTIONS.length - 1 && styles.rowBorder]}
                onPress={() => handleStatusChange(opt.key)}
              >
                <Ionicons name={opt.icon} size={16} color={opt.color} />
                <Text style={styles.rowLabel}>{opt.label}</Text>
                {currentStatus === opt.key && (
                  <Ionicons name="checkmark-circle" size={18} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Account settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KONTO</Text>
          <View style={styles.card}>
            <SettingRow
              icon="person-outline"
              label="Zmień nazwę użytkownika"
              value={currentUser.username}
              onPress={() => { setNewUsername(''); setSheet('changeUsername'); }}
            />
            <SettingRow
              icon="lock-closed-outline"
              label="Zmień hasło"
              value="••••••••"
              onPress={() => setSheet('changePassword')}
              border
            />
            <SettingRow
              icon="document-text-outline"
              label="O mnie"
              value={currentUser.about_me || 'Brak opisu'}
              onPress={() => { setAboutMe(currentUser.about_me ?? ''); setSheet('editBio'); }}
              border
            />
          </View>
        </View>

        {/* Account info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMACJE</Text>
          <View style={styles.card}>
            <View style={[styles.infoRow]}>
              <Text style={styles.infoLabel}>ID użytkownika</Text>
              <Text style={styles.infoValue} selectable numberOfLines={1}>{currentUser.id.slice(0, 8)}…</Text>
            </View>
            <View style={[styles.infoRow, styles.rowBorder]}>
              <Text style={styles.infoLabel}>Wersja aplikacji</Text>
              <Text style={styles.infoValue}>v{appVersion}</Text>
            </View>
            <View style={[styles.infoRow, styles.rowBorder]}>
              <Text style={styles.infoLabel}>System</Text>
              <Text style={styles.infoValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
            </View>
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

      {/* Edit Bio Sheet */}
      <BottomSheet visible={sheet === 'editBio'} onClose={() => setSheet('none')} title="O mnie">
        <TextInput
          style={[styles.sheetInput, styles.sheetInputMulti]}
          value={aboutMe}
          onChangeText={setAboutMe}
          placeholder="Opisz siebie…"
          placeholderTextColor={C.textMuted}
          multiline
          maxLength={190}
          autoFocus
        />
        <Text style={styles.charCount}>{aboutMe.length}/190</Text>
        <TouchableOpacity
          style={[styles.sheetBtn, saving && styles.sheetBtnDisabled]}
          onPress={handleSaveBio}
          disabled={saving}
        >
          <Text style={styles.sheetBtnText}>{saving ? 'Zapisuję…' : 'Zapisz'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Change Username Sheet */}
      <BottomSheet visible={sheet === 'changeUsername'} onClose={() => setSheet('none')} title="Zmień nazwę">
        <Text style={styles.sheetHint}>Obecna: <Text style={{ color: C.accent }}>{currentUser.username}</Text></Text>
        <TextInput
          style={styles.sheetInput}
          value={newUsername}
          onChangeText={setNewUsername}
          placeholder="Nowa nazwa użytkownika"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          autoFocus
          maxLength={32}
        />
        <TouchableOpacity
          style={[styles.sheetBtn, (!newUsername.trim() || saving) && styles.sheetBtnDisabled]}
          onPress={handleSaveUsername}
          disabled={!newUsername.trim() || saving}
        >
          <Text style={styles.sheetBtnText}>{saving ? 'Zapisuję…' : 'Zmień nazwę'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Change Password Sheet */}
      <BottomSheet visible={sheet === 'changePassword'} onClose={() => setSheet('none')} title="Zmień hasło">
        <TextInput
          style={styles.sheetInput}
          value={currentPass}
          onChangeText={setCurrentPass}
          placeholder="Obecne hasło"
          placeholderTextColor={C.textMuted}
          secureTextEntry={!showPass}
          autoFocus
        />
        <TextInput
          style={styles.sheetInput}
          value={newPass}
          onChangeText={setNewPass}
          placeholder="Nowe hasło (min. 8 znaków)"
          placeholderTextColor={C.textMuted}
          secureTextEntry={!showPass}
        />
        <TextInput
          style={styles.sheetInput}
          value={confirmPass}
          onChangeText={setConfirmPass}
          placeholder="Powtórz nowe hasło"
          placeholderTextColor={C.textMuted}
          secureTextEntry={!showPass}
        />
        <TouchableOpacity style={styles.showPassRow} onPress={() => setShowPass(p => !p)}>
          <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={16} color={C.textMuted} />
          <Text style={styles.showPassText}>{showPass ? 'Ukryj hasła' : 'Pokaż hasła'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sheetBtn, (!currentPass || !newPass || !confirmPass || saving) && styles.sheetBtnDisabled]}
          onPress={handleSavePassword}
          disabled={!currentPass || !newPass || !confirmPass || saving}
        >
          <Text style={styles.sheetBtnText}>{saving ? 'Zapisuję…' : 'Zmień hasło'}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </>
  );
}

// ── Reusable components ───────────────────────────────────────────────────────
function SettingRow({ icon, label, value, onPress, border }: {
  icon: string; label: string; value?: string; onPress: () => void; border?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, border && styles.rowBorder]}
      onPress={onPress}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon as any} size={16} color={C.accent} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
    </TouchableOpacity>
  );
}

function BottomSheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.dragBar} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },

  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: '700' },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  avatarRing: { padding: 3, borderRadius: 48, borderWidth: 2, borderColor: C.accent + '55' },
  username: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.warning + '22', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: C.warning + '44' },
  adminBadgeText: { color: C.warning, fontSize: 11, fontWeight: '700' },
  joinDate: { color: C.textMuted, fontSize: 12 },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  card: { backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },

  // Rows
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  rowIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.accent + '22', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: C.text, fontSize: 15, flex: 1 },
  rowValue: { color: C.textMuted, fontSize: 12, marginTop: 1 },
  rowContent: { flex: 1 },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  infoLabel: { color: C.textMuted, fontSize: 14 },
  infoValue: { color: C.textSub, fontSize: 13, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },

  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bgCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border },
  logoutText: { color: C.danger, fontSize: 16, fontWeight: '600' },

  // Bottom sheet overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, borderTopWidth: 1, borderColor: C.border },
  dragBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  sheetHint: { color: C.textMuted, fontSize: 13 },
  sheetInput: { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: C.text, fontSize: 15 },
  sheetInputMulti: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { color: C.textMuted, fontSize: 12, textAlign: 'right', marginTop: -6 },
  sheetBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  sheetBtnDisabled: { opacity: 0.4 },
  sheetBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  showPassRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  showPassText: { color: C.textMuted, fontSize: 13 },
});
