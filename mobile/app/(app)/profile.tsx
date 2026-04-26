import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Alert, ScrollView, Modal, Platform, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { UserAvatar } from '../../src/components/UserAvatar';
import { C, STATUS_COLOR, STATUS_LABEL } from '../../src/theme';
import { authApi, usersApi, friendsApi, type BlockedUser } from '../../src/api';
import { useStore } from '../../src/store';
import { disconnectSocket } from '../../src/socket';
import { unregisterPushNotifications } from '../../src/notifications';
import Constants from 'expo-constants';
import { STATIC_BASE } from '../../src/config';

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${STATIC_BASE}${url}`;
}

const STATUS_OPTIONS = [
  { key: 'online',  label: 'Online',           icon: 'ellipse' as const,         color: C.online  },
  { key: 'idle',    label: 'Bezczynny',         icon: 'moon' as const,            color: C.idle    },
  { key: 'dnd',     label: 'Nie przeszkadzać',  icon: 'remove-circle' as const,   color: C.dnd     },
  { key: 'offline', label: 'Niewidoczny',        icon: 'ellipse-outline' as const, color: C.offline },
];

type Sheet = 'none' | 'editBio' | 'changeUsername' | 'changePassword' | 'status' | 'blocked';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser, clearAuth } = useStore();

  const [sheet, setSheet] = useState<Sheet>('none');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const [aboutMe, setAboutMe] = useState(currentUser?.about_me ?? '');
  const [newUsername, setNewUsername] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  const loadBlocked = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const list = await friendsApi.blocked();
      setBlockedUsers(list);
    } catch { } finally { setBlockedLoading(false); }
  }, []);

  useEffect(() => { loadBlocked(); }, []);

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      'Odblokuj użytkownika',
      `Odblokować ${user.username}?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Odblokuj',
          onPress: async () => {
            try {
              await friendsApi.unblock(user.id);
              setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
            } catch (e: any) {
              Alert.alert('Błąd', e.message ?? 'Nie udało się odblokować.');
            }
          },
        },
      ],
    );
  };

  if (!currentUser) return null;

  const currentStatus = currentUser.preferred_status ?? currentUser.status ?? 'online';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleAvatarUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Brak uprawnień', 'Musisz przyznać dostęp do galerii.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('avatar', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'avatar.jpg' } as any);
    setUploadingAvatar(true);
    try {
      const updated = await usersApi.updateAvatar(formData);
      setCurrentUser(updated);
      Alert.alert('Gotowe!', 'Avatar został zaktualizowany.');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się zmienić avatara.');
    } finally { setUploadingAvatar(false); }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await usersApi.updateStatus(status);
      setCurrentUser({ ...currentUser, preferred_status: status });
      setSheet('none');
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
      Alert.alert('Gotowe!', 'Hasło zostało zmienione.');
      setSheet('none');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (e: any) { Alert.alert('Błąd', e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert('Wyloguj się', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyloguj', style: 'destructive', onPress: async () => {
          try { await authApi.logout(); } catch { }
          await unregisterPushNotifications().catch(() => {});
          disconnectSocket();
          await clearAuth();
          router.replace('/(auth)/login');
        }
      },
    ]);
  };

  const statusColor = STATUS_COLOR[currentStatus] ?? C.online;

  return (
    <>
      <ScrollView
        style={[styles.flex, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero banner */}
        <View style={styles.hero}>
          <View style={styles.heroBanner} />
          <View style={styles.heroContent}>
            <TouchableOpacity onPress={handleAvatarUpload} activeOpacity={0.85} style={styles.avatarWrap}>
              <View style={[styles.avatarRing, { borderColor: statusColor + '55' }]}>
                <UserAvatar
                  url={currentUser.avatar_url}
                  username={currentUser.username}
                  size={88}
                  status={currentStatus}
                  showStatus
                />
              </View>
              {uploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              ) : (
                <View style={styles.cameraBtn}>
                  <Ionicons name="camera" size={13} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName}>{currentUser.username}</Text>
                {currentUser.is_admin && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={11} color={C.warning} />
                    <Text style={styles.adminText}>Admin</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.statusPill, { borderColor: statusColor + '44', backgroundColor: statusColor + '18' }]}
                onPress={() => setSheet('status')}
              >
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusPillText, { color: statusColor }]}>
                  {STATUS_LABEL[currentStatus] ?? 'Online'}
                </Text>
                <Ionicons name="chevron-down" size={12} color={statusColor} />
              </TouchableOpacity>
            </View>
          </View>

          {currentUser.about_me ? (
            <Text style={styles.heroAbout} numberOfLines={3}>{currentUser.about_me}</Text>
          ) : null}
        </View>

        {/* Account section */}
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
              label="O mnie / Bio"
              value={currentUser.about_me || 'Brak opisu'}
              onPress={() => { setAboutMe(currentUser.about_me ?? ''); setSheet('editBio'); }}
              border
            />
          </View>
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMACJE</Text>
          <View style={styles.card}>
            <InfoRow label="ID użytkownika" value={currentUser.id.slice(0, 8) + '…'} selectable />
            <InfoRow
              label="Konto założone"
              value={(() => {
                if (!currentUser.created_at) return 'Brak danych';
                const d = new Date(currentUser.created_at);
                return isNaN(d.getTime()) ? 'Brak danych' : d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
              })()}
              border
            />
            <InfoRow label="Wersja aplikacji" value={`v${appVersion}`} border />
            <InfoRow label="System" value={Platform.OS === 'ios' ? 'iOS' : 'Android'} border />
          </View>
        </View>

        {/* Privacy section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRYWATNOŚĆ</Text>
          <View style={styles.card}>
            <SettingRow
              icon="ban-outline"
              label="Zablokowani użytkownicy"
              value={blockedUsers.length > 0 ? `${blockedUsers.length} zablokowanych` : 'Brak zablokowanych'}
              onPress={() => setSheet('blocked')}
            />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={18} color={C.danger} />
            </View>
            <Text style={styles.logoutText}>Wyloguj się</Text>
            <Ionicons name="chevron-forward" size={16} color={C.danger + '80'} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Status sheet */}
      <BottomSheet visible={sheet === 'status'} onClose={() => setSheet('none')} title="Ustaw status">
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.statusOption, currentStatus === opt.key && styles.statusOptionActive]}
            onPress={() => handleStatusChange(opt.key)}
          >
            <View style={[styles.statusOptionDot, { backgroundColor: opt.color }]} />
            <Text style={[styles.statusOptionLabel, { color: opt.color }]}>{opt.label}</Text>
            {currentStatus === opt.key && (
              <Ionicons name="checkmark-circle" size={20} color={opt.color} />
            )}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* Bio sheet */}
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

      {/* Username sheet */}
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

      {/* Blocked users sheet */}
      <Modal
        visible={sheet === 'blocked'}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet('none')}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSheet('none')}>
          <View style={[styles.sheet, { maxHeight: '75%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.dragBar} />
            <View style={styles.blockedHeader}>
              <Text style={styles.sheetTitle}>Zablokowani użytkownicy</Text>
              <TouchableOpacity onPress={loadBlocked}>
                <Ionicons name="refresh-outline" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {blockedLoading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: 24 }} />
            ) : blockedUsers.length === 0 ? (
              <View style={styles.blockedEmpty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={C.success} />
                <Text style={styles.blockedEmptyText}>Brak zablokowanych użytkowników</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                {blockedUsers.map(u => (
                  <View key={u.id} style={styles.blockedRow}>
                    <UserAvatar url={resolveAvatar(u.avatar_url)} username={u.username} size={42} />
                    <View style={styles.blockedInfo}>
                      <Text style={styles.blockedName}>{u.username}</Text>
                      <Text style={styles.blockedDate}>
                        Zablokowany {new Date(u.blocked_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => { setSheet('none'); setTimeout(() => handleUnblock(u), 350); }}
                    >
                      <Text style={styles.unblockBtnText}>Odblokuj</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Password sheet */}
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

function SettingRow({ icon, label, value, onPress, border }: {
  icon: string; label: string; value?: string; onPress: () => void; border?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.settingRow, border && styles.rowBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingIconWrap}>
        <Ionicons name={icon as any} size={16} color={C.accent} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {value ? <Text style={styles.settingValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
    </TouchableOpacity>
  );
}

function InfoRow({ label, value, border, selectable }: {
  label: string; value: string; border?: boolean; selectable?: boolean;
}) {
  return (
    <View style={[styles.infoRow, border && styles.rowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable={selectable} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function BottomSheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
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

  // Hero
  hero: {
    marginBottom: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  heroBanner: {
    height: 100,
    backgroundColor: C.accentMuted,
    borderBottomWidth: 1,
    borderBottomColor: C.borderAccent,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginTop: -44,
    gap: 14,
  },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    padding: 3,
    borderRadius: 52,
    borderWidth: 3,
    backgroundColor: C.bg,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 3, left: 3, right: 3, bottom: 3,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.bg,
  },
  heroInfo: { flex: 1, paddingBottom: 2, gap: 6 },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroName: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.warningMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.warning + '44',
  },
  adminText: { color: C.warning, fontSize: 10, fontWeight: '800' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  heroAbout: {
    color: C.textSub,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginTop: 14,
  },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  // Setting rows
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  settingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
  settingContent: { flex: 1 },
  settingLabel: { color: C.text, fontSize: 15 },
  settingValue: { color: C.textMuted, fontSize: 12, marginTop: 1 },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  infoLabel: { color: C.textMuted, fontSize: 14 },
  infoValue: { color: C.textSub, fontSize: 13, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.dangerMuted,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.danger + '33',
  },
  logoutIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.danger + '44',
  },
  logoutText: { color: C.danger, fontSize: 16, fontWeight: '700', flex: 1 },

  // Status options
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusOptionActive: { backgroundColor: C.bgElevated, borderColor: C.border },
  statusOptionDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionLabel: { flex: 1, fontSize: 15, fontWeight: '500' },

  // Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  sheetHint: { color: C.textMuted, fontSize: 13 },
  sheetInput: {
    backgroundColor: C.bgInput,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.text,
    fontSize: 15,
  },
  sheetInputMulti: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { color: C.textMuted, fontSize: 12, textAlign: 'right', marginTop: -6 },
  sheetBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  sheetBtnDisabled: { opacity: 0.4 },
  sheetBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  showPassRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  showPassText: { color: C.textMuted, fontSize: 13 },

  // Blocked users
  blockedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  blockedEmpty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  blockedEmptyText: { color: C.textSub, fontSize: 14, fontWeight: '600' },
  blockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  blockedInfo: { flex: 1 },
  blockedName: { color: C.text, fontSize: 15, fontWeight: '600' },
  blockedDate: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  unblockBtn: {
    backgroundColor: C.successMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.success + '44',
  },
  unblockBtnText: { color: C.success, fontSize: 13, fontWeight: '700' },
});
