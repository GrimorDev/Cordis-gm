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

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();

  const handleRegister = async () => {
    if (!username.trim() || !password) { setError('Wypełnij wszystkie pola.'); return; }
    if (password.length < 6) { setError('Hasło musi mieć min. 6 znaków.'); return; }
    if (password !== confirm) { setError('Hasła się nie zgadzają.'); return; }
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(username)) {
      setError('Nazwa: 2-32 znaki, tylko litery, cyfry i _');
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
      setError(e.message ?? 'Błąd rejestracji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>C</Text>
          </View>
          <Text style={styles.appName}>Cordyn</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Utwórz konto</Text>

          {(['username', 'password', 'confirm'] as const).map((field) => (
            <View key={field} style={styles.field}>
              <Text style={styles.label}>
                {field === 'username' ? 'NAZWA UŻYTKOWNIKA' : field === 'password' ? 'HASŁO' : 'POTWIERDŹ HASŁO'}
              </Text>
              <TextInput
                style={styles.input}
                value={field === 'username' ? username : field === 'password' ? password : confirm}
                onChangeText={field === 'username' ? setUsername : field === 'password' ? setPassword : setConfirm}
                placeholder={field === 'username' ? 'nazwa_użytkownika' : '••••••••'}
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={field !== 'username'}
                returnKeyType={field === 'confirm' ? 'go' : 'next'}
                onSubmitEditing={field === 'confirm' ? handleRegister : undefined}
              />
            </View>
          ))}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Zarejestruj się</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Masz już konto? <Text style={styles.switchLink}>Zaloguj się</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  appName: { color: C.text, fontSize: 26, fontWeight: '800' },
  card: { backgroundColor: C.bgCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
  title: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  field: { marginBottom: 14 },
  label: { color: C.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 },
  error: { color: C.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: { marginTop: 20, alignItems: 'center' },
  switchText: { color: C.textMuted, fontSize: 14 },
  switchLink: { color: C.accent, fontWeight: '600' },
});
