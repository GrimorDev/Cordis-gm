import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Alert, ScrollView, Platform, ActivityIndicator,
  RefreshControl, Switch, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { UserAvatar } from '../../src/components/UserAvatar';
import { Sheet } from '../../src/components/Sheet';
import { C, STATUS_COLOR } from '../../src/theme';
import { authApi, usersApi, friendsApi, type BlockedUser, type Session, type UserStats } from '../../src/api';
import { useStore } from '../../src/store';
import { disconnectSocket } from '../../src/socket';
import { unregisterPushNotifications } from '../../src/notifications';
import Constants from 'expo-constants';
import { STATIC_BASE } from '../../src/config';
import { useT, getT, LANGUAGES } from '../../src/i18n';

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${STATIC_BASE}${url}`;
}

function getStatusOptions(t: ReturnType<typeof useT>) {
  return [
    { key: 'online',  label: t.statusOnline,  icon: 'ellipse' as const,         color: C.online  },
    { key: 'idle',    label: t.statusIdle,    icon: 'moon' as const,            color: C.idle    },
    { key: 'dnd',     label: t.statusDnd,     icon: 'remove-circle' as const,   color: C.dnd     },
    { key: 'offline', label: t.statusOffline, icon: 'ellipse-outline' as const, color: C.offline },
  ];
}

type Sheet = 'none' | 'editBio' | 'changeUsername' | 'changePassword' | 'status' | 'blocked' | 'customStatus' | 'sessions' | 'stats';

const PRIVACY_TOGGLES: { key: keyof Pick<import('../../src/api').User,
  'privacy_status_visible' | 'privacy_typing_visible' | 'privacy_read_receipts' |
  'privacy_friend_requests' | 'privacy_dm_from_strangers'>; label: string; hint: string }[] = [
  { key: 'privacy_status_visible',    label: 'Pokazuj status online',        hint: 'Inni widzą, kiedy jesteś online' },
  { key: 'privacy_typing_visible',    label: 'Pokazuj "pisze…"',             hint: 'Inni widzą, gdy piszesz wiadomość' },
  { key: 'privacy_read_receipts',     label: 'Potwierdzenia odczytu',        hint: 'Inni widzą, że przeczytałeś/aś wiadomość' },
  { key: 'privacy_friend_requests',   label: 'Zaproszenia do znajomych',     hint: 'Pozwól obcym wysyłać Ci zaproszenia' },
  { key: 'privacy_dm_from_strangers', label: 'Wiadomości od obcych',         hint: 'Pozwól pisać do Ciebie osobom spoza znajomych' },
];

export default function ProfileScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { currentUser, setCurrentUser, clearAuth, language, setLanguage } = useStore();
  const STATUS_OPTIONS = getStatusOptions(t);

  const [sheet, setSheet] = useState<Sheet>('none');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const [aboutMe, setAboutMe] = useState(currentUser?.bio ?? '');
  const [newUsername, setNewUsername] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [customStatusText, setCustomStatusText] = useState(currentUser?.custom_status ?? '');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadBlocked = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const list = await friendsApi.blocked();
      setBlockedUsers(list);
    } catch { } finally { setBlockedLoading(false); }
  }, []);

  useEffect(() => { loadBlocked(); }, []);

  const handleUnblock = (user: BlockedUser) => {
    const gt = t;
    Alert.alert(
      gt.unblockTitle,
      gt.unblockConfirm(user.username),
      [
        { text: gt.cancel, style: 'cancel' },
        {
          text: gt.unblockBtn,
          onPress: async () => {
            try {
              await friendsApi.unblock(user.id);
              setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
            } catch (e: any) {
              Alert.alert(gt.error, e.message ?? gt.errUnblockFailed);
            }
          },
        },
      ],
    );
  };

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try { setSessions(await authApi.sessions()); }
    catch { }
    finally { setSessionsLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await usersApi.getStats()); }
    catch { }
    finally { setStatsLoading(false); }
  }, []);

  const handleRevokeSession = (id: string) => {
    Alert.alert('Wyloguj urządzenie', 'To urządzenie zostanie wylogowane.', [
      { text: t.cancel, style: 'cancel' },
      {
        text: 'Wyloguj', style: 'destructive', onPress: async () => {
          try {
            await authApi.revokeSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
          } catch (e: any) { Alert.alert(t.error, e.message); }
        },
      },
    ]);
  };

  const handleRevokeAllSessions = () => {
    Alert.alert('Wyloguj wszystkie urządzenia', 'Zostaniesz wylogowany/a wszędzie, łącznie z tym urządzeniem.', [
      { text: t.cancel, style: 'cancel' },
      {
        text: 'Wyloguj wszystkie', style: 'destructive', onPress: async () => {
          try {
            await authApi.revokeAllSessions();
            await unregisterPushNotifications().catch(() => {});
            disconnectSocket();
            await clearAuth();
            router.replace('/(auth)/login');
          } catch (e: any) { Alert.alert(t.error, e.message); }
        },
      },
    ]);
  };

  if (!currentUser) return null;

  const currentStatus = currentUser.preferred_status ?? currentUser.status ?? 'online';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleAvatarUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.noPermission, t.galleryPermission);
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
      Alert.alert(t.done, t.avatarUpdated);
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? t.error);
    } finally { setUploadingAvatar(false); }
  };

  const handleBannerUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.noPermission, t.galleryPermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('banner', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'banner.jpg' } as any);
    setUploadingBanner(true);
    try {
      const { banner_url } = await usersApi.updateBanner(formData);
      setCurrentUser({ ...currentUser, banner_url });
    } catch (e: any) {
      Alert.alert(t.error, e.message ?? t.error);
    } finally { setUploadingBanner(false); }
  };

  const handleSaveCustomStatus = async () => {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({ custom_status: customStatusText.trim() || undefined });
      setCurrentUser(updated);
      setSheet('none');
    } catch (e: any) { Alert.alert(t.error, e.message); }
    finally { setSaving(false); }
  };

  const togglePrivacy = async (key: typeof PRIVACY_TOGGLES[number]['key'], value: boolean) => {
    // Optimistic — flip immediately, roll back on failure so the switch
    // doesn't lag behind a finger's worth of latency.
    setCurrentUser({ ...currentUser, [key]: value });
    try {
      await usersApi.updateMe({ [key]: value } as any);
    } catch (e: any) {
      setCurrentUser({ ...currentUser, [key]: !value });
      Alert.alert(t.error, e.message);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await usersApi.updateStatus(status);
      setCurrentUser({ ...currentUser, preferred_status: status });
      setSheet('none');
    } catch (e: any) { const gt = getT(); Alert.alert(gt.error, e.message); }
  };

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe({ bio: aboutMe });
      setCurrentUser(updated);
      setSheet('none');
    } catch (e: any) { Alert.alert(t.error, e.message); }
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
    } catch (e: any) { Alert.alert(t.error, e.message); }
    finally { setSaving(false); }
  };

  const handleSavePassword = async () => {
    if (newPass !== confirmPass) { Alert.alert(t.error, t.errPassSame); return; }
    if (newPass.length < 8) { Alert.alert(t.error, t.errPassMin8); return; }
    setSaving(true);
    try {
      await usersApi.changePassword(currentPass, newPass);
      Alert.alert(t.done, t.passwordChanged);
      setSheet('none');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (e: any) { Alert.alert(t.error, e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert(t.logoutTitle, t.logoutConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logoutAction, style: 'destructive', onPress: async () => {
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
          <TouchableOpacity style={styles.heroBanner} onPress={handleBannerUpload} activeOpacity={0.85}>
            {currentUser.banner_url ? (
              <Image
                source={{ uri: currentUser.banner_url.startsWith('http') ? currentUser.banner_url : `${STATIC_BASE}${currentUser.banner_url}` }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.bannerEditBadge}>
              {uploadingBanner ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="camera" size={13} color="#fff" />}
            </View>
          </TouchableOpacity>
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
                  {(t.statusLabels as Record<string, string>)[currentStatus] ?? t.statusLabels.online}
                </Text>
                <Ionicons name="chevron-down" size={12} color={statusColor} />
              </TouchableOpacity>
            </View>
          </View>

          {currentUser.bio ? (
            <Text style={styles.heroAbout} numberOfLines={3}>{currentUser.bio}</Text>
          ) : null}
        </View>

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.sectionAccount}</Text>
          <View style={styles.card}>
            <SettingRow
              icon="person-outline"
              label={t.changeUsername}
              value={currentUser.username}
              onPress={() => { setNewUsername(''); setSheet('changeUsername'); }}
            />
            <SettingRow
              icon="lock-closed-outline"
              label={t.changePassword}
              value="••••••••"
              onPress={() => setSheet('changePassword')}
              border
            />
            <SettingRow
              icon="document-text-outline"
              label={t.bioLabel}
              value={currentUser.bio || t.bioEmpty}
              onPress={() => { setAboutMe(currentUser.bio ?? ''); setSheet('editBio'); }}
              border
            />
            <SettingRow
              icon="chatbubble-ellipses-outline"
              label="Status niestandardowy"
              value={currentUser.custom_status || 'Brak'}
              onPress={() => { setCustomStatusText(currentUser.custom_status ?? ''); setSheet('customStatus'); }}
              border
            />
            <SettingRow
              icon="laptop-outline"
              label="Aktywne sesje"
              value="Zarządzaj urządzeniami"
              onPress={() => { setSheet('sessions'); loadSessions(); }}
              border
            />
          </View>
        </View>

        {/* Privacy toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prywatność i bezpieczeństwo</Text>
          <View style={styles.card}>
            {PRIVACY_TOGGLES.map((opt, idx) => (
              <View key={opt.key} style={[styles.toggleRow, idx > 0 && styles.rowBorder]}>
                <View style={styles.toggleContent}>
                  <Text style={styles.settingLabel}>{opt.label}</Text>
                  <Text style={styles.toggleHint}>{opt.hint}</Text>
                </View>
                <Switch
                  value={currentUser[opt.key] ?? true}
                  onValueChange={(v) => togglePrivacy(opt.key, v)}
                  trackColor={{ false: C.bgElevated, true: C.accent }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statystyki</Text>
          <View style={styles.card}>
            <SettingRow
              icon="stats-chart-outline"
              label="Twoja aktywność"
              value="Wiadomości, serwery, znajomi"
              onPress={() => { setSheet('stats'); loadStats(); }}
            />
          </View>
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.sectionInfo}</Text>
          <View style={styles.card}>
            <InfoRow label={t.userId} value={currentUser.id.slice(0, 8) + '…'} selectable />
            <InfoRow
              label={t.accountCreated}
              value={(() => {
                if (!currentUser.created_at) return t.noData;
                const d = new Date(currentUser.created_at);
                if (isNaN(d.getTime())) return t.noData;
                return language === 'pl'
                  ? d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' })
                  : d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long' });
              })()}
              border
            />
            <InfoRow label={t.appVersion} value={`v${appVersion}`} border />
            <InfoRow label={t.system} value={Platform.OS === 'ios' ? 'iOS' : 'Android'} border />
          </View>
        </View>

        {/* Language section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.sectionLanguage}</Text>
          <View style={styles.card}>
            {LANGUAGES.map((lang, idx) => (
              <TouchableOpacity
                key={lang.key}
                style={[styles.langRow, idx > 0 && styles.rowBorder]}
                onPress={() => setLanguage(lang.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, language === lang.key && { color: C.accent, fontWeight: '700' }]}>
                  {lang.label}
                </Text>
                {language === lang.key && (
                  <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.sectionPrivacy}</Text>
          <View style={styles.card}>
            <SettingRow
              icon="ban-outline"
              label={t.blockedUsers}
              value={blockedUsers.length > 0 ? t.blockedCount(blockedUsers.length) : t.noBlocked}
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
            <Text style={styles.logoutText}>{t.logoutBtn}</Text>
            <Ionicons name="chevron-forward" size={16} color={C.danger + '80'} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Status sheet */}
      <BottomSheet visible={sheet === 'status'} onClose={() => setSheet('none')} title={t.setStatus}>
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
      <BottomSheet visible={sheet === 'editBio'} onClose={() => setSheet('none')} title={t.bioLabel}>
        <TextInput
          style={[styles.sheetInput, styles.sheetInputMulti]}
          value={aboutMe}
          onChangeText={setAboutMe}
          placeholder={t.bioPlaceholder}
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
          <Text style={styles.sheetBtnText}>{saving ? t.saving : t.save}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Username sheet */}
      <BottomSheet visible={sheet === 'changeUsername'} onClose={() => setSheet('none')} title={t.changeNameTitle}>
        <Text style={styles.sheetHint}>{t.currentName} <Text style={{ color: C.accent }}>{currentUser.username}</Text></Text>
        <TextInput
          style={styles.sheetInput}
          value={newUsername}
          onChangeText={setNewUsername}
          placeholder={t.newUsername}
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
          <Text style={styles.sheetBtnText}>{saving ? t.saving : t.changeNameBtn}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Blocked users sheet */}
      <Sheet visible={sheet === 'blocked'} onClose={() => setSheet('none')}>
          <View style={[styles.sheet, { maxHeight: '75%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.dragBar} />
            <View style={styles.blockedHeader}>
              <Text style={styles.sheetTitle}>{t.blockedUsers}</Text>
              <TouchableOpacity onPress={loadBlocked}>
                <Ionicons name="refresh-outline" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {blockedLoading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: 24 }} />
            ) : blockedUsers.length === 0 ? (
              <View style={styles.blockedEmpty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={C.success} />
                <Text style={styles.blockedEmptyText}>{t.noBlocked}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                {blockedUsers.map(u => (
                  <View key={u.id} style={styles.blockedRow}>
                    <UserAvatar url={resolveAvatar(u.avatar_url)} username={u.username} size={42} />
                    <View style={styles.blockedInfo}>
                      <Text style={styles.blockedName}>{u.username}</Text>
                      <Text style={styles.blockedDate}>
                        {new Date(u.blocked_at).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => { setSheet('none'); setTimeout(() => handleUnblock(u), 350); }}
                    >
                      <Text style={styles.unblockBtnText}>{t.unblockBtn}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
      </Sheet>

      {/* Password sheet */}
      <BottomSheet visible={sheet === 'changePassword'} onClose={() => setSheet('none')} title={t.changePassword}>
        <TextInput
          style={styles.sheetInput}
          value={currentPass}
          onChangeText={setCurrentPass}
          placeholder={t.currentPass}
          placeholderTextColor={C.textMuted}
          secureTextEntry={!showPass}
          autoFocus
        />
        <TextInput
          style={styles.sheetInput}
          value={newPass}
          onChangeText={setNewPass}
          placeholder={t.newPass}
          placeholderTextColor={C.textMuted}
          secureTextEntry={!showPass}
        />
        <TextInput
          style={styles.sheetInput}
          value={confirmPass}
          onChangeText={setConfirmPass}
          placeholder={t.confirmNewPass}
          placeholderTextColor={C.textMuted}
          secureTextEntry={!showPass}
        />
        <TouchableOpacity style={styles.showPassRow} onPress={() => setShowPass(p => !p)}>
          <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={16} color={C.textMuted} />
          <Text style={styles.showPassText}>{showPass ? t.hidePasswords : t.showPasswords}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sheetBtn, (!currentPass || !newPass || !confirmPass || saving) && styles.sheetBtnDisabled]}
          onPress={handleSavePassword}
          disabled={!currentPass || !newPass || !confirmPass || saving}
        >
          <Text style={styles.sheetBtnText}>{saving ? t.saving : t.changePassword}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Custom status sheet */}
      <BottomSheet visible={sheet === 'customStatus'} onClose={() => setSheet('none')} title="Status niestandardowy">
        <TextInput
          style={styles.sheetInput}
          value={customStatusText}
          onChangeText={setCustomStatusText}
          placeholder="Np. Gram w coś fajnego…"
          placeholderTextColor={C.textMuted}
          maxLength={128}
          autoFocus
        />
        <TouchableOpacity
          style={[styles.sheetBtn, saving && styles.sheetBtnDisabled]}
          onPress={handleSaveCustomStatus}
          disabled={saving}
        >
          <Text style={styles.sheetBtnText}>{saving ? t.saving : t.save}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Sessions sheet */}
      <Sheet visible={sheet === 'sessions'} onClose={() => setSheet('none')}>
          <View style={[styles.sheet, { maxHeight: '75%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.dragBar} />
            <View style={styles.blockedHeader}>
              <Text style={styles.sheetTitle}>Aktywne sesje</Text>
              <TouchableOpacity onPress={loadSessions}>
                <Ionicons name="refresh-outline" size={20} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {sessionsLoading ? (
              <ActivityIndicator color={C.accent} style={{ marginVertical: 24 }} />
            ) : sessions.length === 0 ? (
              <View style={styles.blockedEmpty}>
                <Ionicons name="laptop-outline" size={36} color={C.textMuted} />
                <Text style={styles.blockedEmptyText}>Brak aktywnych sesji</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {sessions.map(s => (
                  <View key={s.id} style={styles.blockedRow}>
                    <View style={styles.sessionIcon}>
                      <Ionicons name="phone-portrait-outline" size={18} color={C.accent} />
                    </View>
                    <View style={styles.blockedInfo}>
                      <Text style={styles.blockedName} numberOfLines={1}>{s.user_agent || 'Nieznane urządzenie'}</Text>
                      <Text style={styles.blockedDate}>
                        {s.ip_address ?? '?'} · ostatnio {new Date(s.last_seen_at).toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevokeSession(s.id)}>
                      <Text style={styles.revokeBtnText}>Wyloguj</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {sessions.length > 0 && (
              <TouchableOpacity style={[styles.sheetBtn, styles.dangerBtn]} onPress={handleRevokeAllSessions}>
                <Text style={styles.sheetBtnText}>Wyloguj wszystkie urządzenia</Text>
              </TouchableOpacity>
            )}
          </View>
      </Sheet>

      {/* Stats sheet */}
      <BottomSheet visible={sheet === 'stats'} onClose={() => setSheet('none')} title="Twoja aktywność">
        {statsLoading || !stats ? (
          <ActivityIndicator color={C.accent} style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.statsGrid}>
            <StatTile label="Wiadomości" value={stats.messages_sent} />
            <StatTile label="W tym miesiącu" value={stats.messages_this_month} />
            <StatTile label="DM-y" value={stats.dms_sent} />
            <StatTile label="Serwery" value={stats.servers_joined} />
            <StatTile label="Znajomi" value={stats.friends_count} />
            <StatTile label="Reakcje dodane" value={stats.reactions_given} />
            <StatTile label="Reakcje otrzymane" value={stats.reactions_received} />
          </View>
        )}
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

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.sheet} onStartShouldSetResponder={() => true}>
        <View style={styles.dragBar} />
        <Text style={styles.sheetTitle}>{title}</Text>
        {children}
      </View>
    </Sheet>
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
    overflow: 'hidden',
    position: 'relative',
  },
  bannerEditBadge: {
    position: 'absolute', bottom: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
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

  // Language picker
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  langFlag: { fontSize: 22 },
  langLabel: { flex: 1, color: C.textSub, fontSize: 15 },

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

  // Privacy toggles
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  toggleContent: { flex: 1, gap: 2 },
  toggleHint: { color: C.textMuted, fontSize: 12 },

  // Sessions
  sessionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.accentMuted, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.borderAccent,
  },
  revokeBtn: {
    backgroundColor: C.dangerMuted, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: C.danger + '44',
  },
  revokeBtnText: { color: C.danger, fontSize: 13, fontWeight: '700' },
  dangerBtn: { backgroundColor: C.danger, marginTop: 12 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: {
    width: '31%', backgroundColor: C.bgElevated, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 12, alignItems: 'center', gap: 4,
  },
  statValue: { color: C.accent, fontSize: 20, fontWeight: '800' },
  statLabel: { color: C.textMuted, fontSize: 11, textAlign: 'center' },
});
