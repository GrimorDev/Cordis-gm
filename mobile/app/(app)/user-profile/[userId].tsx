import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi, friendsApi, type User } from '../../../src/api';
import { useStore } from '../../../src/store';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../../src/theme';

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  idle: 'Nieaktywny',
  dnd: 'Nie przeszkadzać',
  offline: 'Offline',
};

export default function UserProfileScreen() {
  const { userId, username } = useLocalSearchParams<{ userId: string; username?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, friends } = useStore();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const isSelf = currentUser?.id === userId;
  const isFriend = friends.some((f) => f.id === userId);

  useEffect(() => {
    if (!userId) return;
    usersApi
      .get(userId)
      .then(setUser)
      .catch(() => Alert.alert('Błąd', 'Nie udało się załadować profilu.'))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSendFriendRequest = async () => {
    if (!user) return;
    setSending(true);
    try {
      await friendsApi.send(user.username);
      Alert.alert('Gotowe', 'Zaproszenie do znajomych wysłane!');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się wysłać zaproszenia.');
    } finally {
      setSending(false);
    }
  };

  const handleSendDm = () => {
    router.push({ pathname: '/(app)/dm/[userId]', params: { userId } });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Nie znaleziono użytkownika.</Text>
      </View>
    );
  }

  const status = user.preferred_status ?? user.status ?? 'offline';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{user.username}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + Status section */}
        <View style={styles.avatarSection}>
          <UserAvatar
            url={user.avatar_url}
            username={user.username}
            size={80}
            status={status}
            showStatus
          />
          <View style={styles.nameRow}>
            <Text style={styles.username}>{user.username}</Text>
            {user.is_admin && (
              <Ionicons name="shield-checkmark" size={18} color={C.accent} style={{ marginLeft: 6 }} />
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[status] ?? C.offline }]}>
            <Text style={styles.statusLabel}>{STATUS_LABEL[status] ?? status}</Text>
          </View>
          <Text style={styles.joinDate}>
            Dołączył: {new Date(user.created_at).toLocaleDateString('pl-PL')}
          </Text>
        </View>

        {/* About me */}
        {!!user.about_me && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>O mnie</Text>
            <Text style={styles.cardBody}>{user.about_me}</Text>
          </View>
        )}

        {/* Actions */}
        {!isSelf && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSendDm}>
              <Ionicons name="chatbubble-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>Wyślij wiadomość</Text>
            </TouchableOpacity>
            {!isFriend && (
              <TouchableOpacity
                style={[styles.btnSecondary, sending && styles.btnDisabled]}
                onPress={handleSendFriendRequest}
                disabled={sending}
              >
                <Ionicons name="person-add-outline" size={18} color={C.text} />
                <Text style={styles.btnTextSecondary}>
                  {sending ? 'Wysyłanie…' : 'Dodaj do znajomych'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: C.textSub,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    padding: 20,
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  username: {
    color: C.text,
    fontSize: 22,
    fontWeight: '700',
  },
  statusBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  joinDate: {
    marginTop: 8,
    color: C.textMuted,
    fontSize: 13,
  },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  cardTitle: {
    color: C.textSub,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  cardBody: {
    color: C.text,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: 10,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.bgElevated,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnTextSecondary: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
