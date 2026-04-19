import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { C } from '../../src/theme';
import { authApi } from '../../src/api';
import { useStore } from '../../src/store';
import { connectSocket } from '../../src/socket';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Wpisz login i hasło.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { token, user } = await authApi.login(username.trim(), password);
      await setAuth(token, user);
      await connectSocket();
      router.replace('/(app)');
    } catch (e: any) {
      setError(e.message ?? 'Błąd logowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>C</Text>
          </View>
          <Text style={styles.appName}>Cordyn</Text>
          <Text style={styles.tagline}>Twoja społeczność, Twoje miejsce</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Witaj z powrotem!</Text>

          <View style={styles.field}>
            <Text style={styles.label}>NAZWA UŻYTKOWNIKA</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="nazwa_użytkownika"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>HASŁO</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Zaloguj się</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Nie masz konta?{' '}
            <Text style={styles.switchLink}>Zarejestruj się</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  appName: { color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: C.textMuted, fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: C.bgCard, borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: C.border,
  },
  title: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { color: C.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 15,
  },
  error: { color: C.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText: { color: C.textMuted, fontSize: 14 },
  switchLink: { color: C.accent, fontWeight: '600' },
});
