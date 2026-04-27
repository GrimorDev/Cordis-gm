import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../src/theme';
import { authApi } from '../../src/api';
import { useStore } from '../../src/store';
import { connectSocket } from '../../src/socket';
import { useT } from '../../src/i18n';

function FocusInput({
  value, onChangeText, placeholder, secureTextEntry, returnKeyType, onSubmitEditing,
}: {
  value: string; onChangeText: (t: string) => void; placeholder: string;
  secureTextEntry?: boolean; returnKeyType?: any; onSubmitEditing?: () => void;
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
        autoCapitalize="none"
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

export default function RegisterScreen() {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();

  const handleRegister = async () => {
    if (!username.trim() || !password) { setError(t.errFillFields); return; }
    if (password.length < 6) { setError(t.errPassMin6); return; }
    if (password !== confirm) { setError(t.errPassMismatch); return; }
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(username)) {
      setError(t.errUsernameFormat);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { token, user } = await authApi.register(username.trim(), password);
      await setAuth(token, user);
      await connectSocket();
      router.replace('/(app)');
    } catch (e: any) {
      setError(e.message ?? t.error);
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
          <Text style={styles.tagline}>{t.appTaglineRegister}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{t.registerTitle}</Text>
          <Text style={styles.subtitle}>{t.registerSubtitle}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t.fieldUsername}</Text>
            <FocusInput value={username} onChangeText={setUsername} placeholder={t.phUsername} />
            <Text style={styles.hint}>{t.usernameHint}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t.fieldPassword}</Text>
            <FocusInput value={password} onChangeText={setPassword} placeholder={t.phPass} secureTextEntry />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t.fieldConfirmPass}</Text>
            <FocusInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t.phPass}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={handleRegister}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{t.registerBtn}</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.switchRow}>
          <Text style={styles.switchText}>
            {t.hasAccount} <Text style={styles.switchLink}>{t.loginLink}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },

  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoRing: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: C.accentMuted, borderWidth: 2, borderColor: C.borderAccent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  logoImg: { width: 68, height: 68, borderRadius: 18 },
  appName: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: C.textMuted, fontSize: 13, marginTop: 5 },

  card: {
    backgroundColor: C.bgCard, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  title: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 3 },
  subtitle: { color: C.textMuted, fontSize: 13, marginBottom: 20 },

  field: { marginBottom: 14 },
  label: { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  hint: { color: C.textMuted, fontSize: 11, marginTop: 5 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bgInput, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14,
  },
  inputWrapFocused: { borderColor: C.borderFocus, backgroundColor: C.bgElevated },
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 13 },
  eyeBtn: { padding: 4 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.dangerMuted, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: C.danger + '33',
  },
  errorText: { color: C.danger, fontSize: 13, flex: 1 },

  btn: {
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
    shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  switchRow: { marginTop: 22, alignItems: 'center' },
  switchText: { color: C.textMuted, fontSize: 14 },
  switchLink: { color: C.accentLight, fontWeight: '700' },
});
