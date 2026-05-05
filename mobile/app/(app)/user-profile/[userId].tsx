import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi, friendsApi, type User } from '../../../src/api';
import { useStore } from '../../../src/store';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../../src/theme';
import { useT, getT } from '../../../src/i18n';

export default function UserProfileScreen() {
  const t = useT();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, friends, userStatuses, language } = useStore();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const isSelf = currentUser?.id === userId;
  const isFriend = friends.some((f) => f.id === userId);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      usersApi.get(userId),
      friendsApi.blocked(),
    ])
      .then(([userData, blocked]) => {
        setUser(userData);
        setIsBlocked(blocked.some(b => b.id === userId));
      })
      .catch(() => { const gt = getT(); Alert.alert(gt.error, gt.errLoadProfile); })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSendFriendRequest = async () => {
    if (!user) return;
    setSending(true);
    try {
      await friendsApi.send(user.username);
      const gt = getT();
      Alert.alert(gt.friendRequestSent, gt.friendRequestSentAlert);
    } catch (e: any) {
      const gt = getT();
      Alert.alert(gt.error, e.message ?? gt.errSendFriend);
    } finally { setSending(false); }
  };

  const handleSendDm = () => {
    if (!user) return;
    router.push({ pathname: '/(app)/dm/[userId]', params: { userId, username: user.username, avatar: user.avatar_url ?? '' } });
  };

  const handleBlock = () => {
    if (!user) return;
    const gt = getT();
    Alert.alert(
      gt.blockUser,
      gt.blockConfirmMsg(user.username),
      [
        { text: gt.cancel, style: 'cancel' },
        {
          text: gt.blockUser,
          style: 'destructive',
          onPress: async () => {
            setBlockLoading(true);
            try {
              await friendsApi.block(userId);
              setIsBlocked(true);
              const gt2 = getT();
              Alert.alert(gt2.blocked, `${user.username} ${gt2.blockedLabel.toLowerCase()}.`);
            } catch (e: any) {
              const gt2 = getT();
              Alert.alert(gt2.error, e.message ?? gt2.errBlock);
            } finally { setBlockLoading(false); }
          },
        },
      ],
    );
  };

  const handleUnblock = async () => {
    if (!user) return;
    setBlockLoading(true);
    try {
      await friendsApi.unblock(userId);
      setIsBlocked(false);
      const gt = getT();
      Alert.alert(gt.unblockedLabel, `${user.username} ${gt.unblockBtn.toLowerCase()}.`);
    } catch (e: any) {
      const gt = getT();
      Alert.alert(gt.error, e.message ?? gt.errUnblock);
    } finally { setBlockLoading(false); }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="person-outline" size={48} color={C.textMuted} />
        <Text style={styles.errorText}>{t.userNotFound}</Text>
      </View>
    );
  }

  const status = userStatuses[userId] ?? user.preferred_status ?? user.status ?? 'offline';
  const statusColor = STATUS_COLOR[status] ?? C.offline;
  const joinLocale = language === 'pl' ? 'pl-PL' : 'en-GB';
  const joinDateStr = (() => {
    if (!user.created_at) return t.noData;
    const d = new Date(user.created_at);
    return isNaN(d.getTime()) ? t.noData : d.toLocaleDateString(joinLocale, { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{user.username}</Text>
        {/* Block/unblock kebab for non-self */}
        {!isSelf ? (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={isBlocked ? handleUnblock : handleBlock}
            disabled={blockLoading}
          >
            {blockLoading
              ? <ActivityIndicator color={C.textMuted} size="small" />
              : <Ionicons name={isBlocked ? 'lock-open-outline' : 'ban-outline'} size={20} color={isBlocked ? C.success : C.danger} />
            }
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          {/* Banner */}
          <View style={[styles.banner, { backgroundColor: isBlocked ? C.danger + '18' : statusColor + '28' }]}>
            <View style={[styles.bannerStripe, { backgroundColor: isBlocked ? C.danger + '44' : statusColor + '44' }]} />
          </View>

          {/* Avatar overlapping banner */}
          <View style={styles.avatarArea}>
            <View style={[styles.avatarRing, { borderColor: isBlocked ? C.danger + '44' : statusColor + '66' }]}>
              <UserAvatar url={user.avatar_url} username={user.username} size={80} status={isBlocked ? 'offline' : status} showStatus={!isBlocked} />
            </View>
            {user.is_admin && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color={C.warning} />
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
            {isBlocked && (
              <View style={styles.blockedBadge}>
                <Ionicons name="ban-outline" size={12} color={C.danger} />
                <Text style={styles.blockedBadgeText}>{t.blockedLabel}</Text>
              </View>
            )}
          </View>

          {/* Name & status */}
          <View style={styles.nameSection}>
            <Text style={styles.displayName}>{user.username}</Text>
            {!isBlocked ? (
              <View style={[styles.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {(t.statusLabels as Record<string, string>)[status] ?? t.statusLabels.offline}
                </Text>
              </View>
            ) : (
              <View style={[styles.statusPill, { backgroundColor: C.dangerMuted, borderColor: C.danger + '33' }]}>
                <Ionicons name="ban-outline" size={11} color={C.danger} />
                <Text style={[styles.statusText, { color: C.danger }]}>{t.blockedLabel}</Text>
              </View>
            )}
          </View>

          {/* About me */}
          {user.about_me && !isBlocked ? (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutLabel}>{t.aboutMe}</Text>
              <Text style={styles.aboutText}>{user.about_me}</Text>
            </View>
          ) : null}

          {/* Member since */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
              <Text style={styles.infoLabel}>{t.joinedAt}</Text>
              <Text style={styles.infoValue}>{joinDateStr}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Ionicons name="id-card-outline" size={14} color={C.textMuted} />
              <Text style={styles.infoLabel}>{t.idLabel}</Text>
              <Text style={styles.infoValue} selectable>{user.id.slice(0, 8)}…</Text>
            </View>
          </View>
        </View>

        {/* Action buttons (not for self) */}
        {!isSelf && (
          <View style={styles.actions}>
            {!isBlocked && (
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSendDm} activeOpacity={0.85}>
                <Ionicons name="chatbubble" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>{t.sendMessage}</Text>
              </TouchableOpacity>
            )}

            {!isBlocked && !isFriend && (
              <TouchableOpacity
                style={[styles.btnSecondary, sending && { opacity: 0.55 }]}
                onPress={handleSendFriendRequest}
                disabled={sending}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator color={C.accentLight} size="small" />
                  : <Ionicons name="person-add-outline" size={18} color={C.accentLight} />
                }
                <Text style={styles.btnSecondaryText}>
                  {sending ? t.sendingFriend : t.addFriend}
                </Text>
              </TouchableOpacity>
            )}

            {!isBlocked && isFriend && (
              <View style={styles.friendBadge}>
                <Ionicons name="people" size={16} color={C.success} />
                <Text style={styles.friendBadgeText}>{t.alreadyFriends}</Text>
              </View>
            )}

            {/* Block / Unblock button */}
            <TouchableOpacity
              style={[styles.btnDanger, blockLoading && { opacity: 0.55 }]}
              onPress={isBlocked ? handleUnblock : handleBlock}
              disabled={blockLoading}
              activeOpacity={0.85}
            >
              {blockLoading
                ? <ActivityIndicator color={C.danger} size="small" />
                : <Ionicons name={isBlocked ? 'lock-open-outline' : 'ban-outline'} size={18} color={C.danger} />
              }
              <Text style={styles.btnDangerText}>
                {isBlocked ? t.unblockUser : t.blockUser}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: C.textSub, fontSize: 16, fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bgCard,
  },
  backBtn: { width: 40, alignItems: 'flex-start', padding: 4 },
  moreBtn: { width: 40, alignItems: 'flex-end', padding: 4 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

  // Profile card
  profileCard: {
    margin: 16,
    backgroundColor: C.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  banner: {
    height: 90,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bannerStripe: { height: 2 },
  avatarArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: -44,
    marginBottom: 12,
  },
  avatarRing: {
    padding: 3, borderRadius: 50, borderWidth: 3, backgroundColor: C.bgCard,
  },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.warningMuted, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.warning + '44',
    marginBottom: 4,
  },
  adminText: { color: C.warning, fontSize: 11, fontWeight: '800' },
  blockedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.dangerMuted, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: C.danger + '44',
    marginBottom: 4,
  },
  blockedBadgeText: { color: C.danger, fontSize: 11, fontWeight: '800' },

  nameSection: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  displayName: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },

  aboutSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  aboutLabel: {
    color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2,
    marginBottom: 8,
  },
  aboutText: { color: C.text, fontSize: 14, lineHeight: 22 },

  infoSection: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 11,
  },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: C.border },
  infoLabel: { color: C.textMuted, fontSize: 13, flex: 1 },
  infoValue: { color: C.textSub, fontSize: 13, fontWeight: '500' },

  // Actions
  actions: { marginHorizontal: 16, gap: 10 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 15,
    shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.accentMuted, borderRadius: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: C.borderAccent,
  },
  btnSecondaryText: { color: C.accentLight, fontSize: 16, fontWeight: '700' },
  friendBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.successMuted, borderRadius: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: C.success + '33',
  },
  friendBadgeText: { color: C.success, fontSize: 15, fontWeight: '600' },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.dangerMuted, borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: C.danger + '33',
  },
  btnDangerText: { color: C.danger, fontSize: 15, fontWeight: '600' },
});
