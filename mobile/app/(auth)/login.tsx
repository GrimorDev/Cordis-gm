import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../src/theme';
import { authApi } from '../../src/api';
import { useStore } from '../../src/store';
import { connectSocket } from '../../src/socket';
import { useT } from '../../src/i18n';

function FocusInput({
  value, onChangeText, placeholder, secureTextEntry, returnKeyType, onSubmitEditing, autoCapitalize,
}: {
  value: string; onChangeText: (t: string) => void; placeholder: string;
  secureTextEntry?: boolean; returnKeyType?: any; onSubmitEditing?: () => void;
  autoCapitalize?: any;
}) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);
  return (
    <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        secureTextEntry={secureTextEntry && !showPass}
        returnKeyType={returnKeyType ?? 'next'}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPass(p => !p)} style={styles.eyeBtn}>
          <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function LoginScreen() {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();

  const btnAnim = useRef(new Animated.Value(1)).current;

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t.errLoginEmpty);
      return;
    }
    setLoading(true);
    setError('');
    Animated.sequence([
      Animated.timing(btnAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    try {
      const { token, user } = await authApi.login(username.trim(), password);
      await setAuth(token, user);
      await connectSocket();
      router.replace('/(app)');
    } catch (e: any) {
      setError(e.message ?? t.errLoginFail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoRing}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.appName}>Cordyn</Text>
          <Text style={styles.tagline}>{t.appTaglineLogin}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{t.loginTitle}</Text>
          <Text style={styles.subtitle}>{t.loginSubtitle}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t.fieldUsername}</Text>
            <FocusInput
              value={username}
              onChangeText={setUsername}
              placeholder={t.phUsername}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t.fieldPassword}</Text>
            <FocusInput
              value={password}
              onChangeText={setPassword}
              placeholder={t.phPass}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={handleLogin}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Animated.View style={{ transform: [{ scale: btnAnim }] }}>
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{t.loginBtn}</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {t.noAccount}{' '}
            <Text style={styles.switchLink}>{t.registerLink}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },

  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoRing: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: C.accentMuted, borderWidth: 2, borderColor: C.borderAccent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  logoImg: { width: 72, height: 72, borderRadius: 20 },
  appName: { color: C.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  tagline: { color: C.textMuted, fontSize: 13, marginTop: 6 },

  card: {
    backgroundColor: C.bgCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    gap: 0,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  title: { color: C.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { color: C.textMuted, fontSize: 13, marginBottom: 20 },

  field: { marginBottom: 16 },
  label: { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputWrapFocused: {
    borderColor: C.borderFocus,
    backgroundColor: C.bgElevated,
  },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 15,
    paddingVertical: 13,
  },
  eyeBtn: { padding: 4 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.dangerMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.danger + '33',
  },
  errorText: { color: C.danger, fontSize: 13, flex: 1 },

  btn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: C.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  switchRow: { marginTop: 24, alignItems: 'center' },
  switchText: { color: C.textMuted, fontSize: 14 },
  switchLink: { color: C.accentLight, fontWeight: '700' },
});
