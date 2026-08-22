import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { storage } from '../src/storage';
import { useStore } from '../src/store';
import { authApi } from '../src/api';
import { connectSocket } from '../src/socket';
import type { Lang } from '../src/i18n';
// Registers the notifee foreground-service handler as a side effect of this
// import — must happen once at app startup, before any voice-channel join.
import '../src/callNotification';

export default function RootLayout() {
  const { setAuth, setLanguage } = useStore();
  const [ready, setReady] = useState(false);

  // Expo Go auto-registers @expo/vector-icons fonts — a standalone build
  // (like this one) does not, so every Ionicons glyph renders as a blank
  // box until the font is explicitly loaded here. Deliberately NOT gating
  // the whole app's render on this — if font loading errors or hangs on a
  // given device, worst case is blank icons for a moment, not a black
  // screen forever (which is what blocking on it caused in testing).
  const [fontsLoaded, fontsError] = useFonts({ ...Ionicons.font });
  useEffect(() => {
    if (fontsError) {
      console.warn('[Cordyn] Ionicons font failed to load:', fontsError);
      // TEMP diagnostic — console isn't visible on a real device, and this
      // bug has resisted every other diagnosis attempt. Remove once the
      // real cause is confirmed from what this dialog reports.
      Alert.alert(
        'Debug: font load failed',
        String((fontsError as any)?.message ?? fontsError),
      );
    } else if (fontsLoaded) {
      console.log('[Cordyn] Ionicons font loaded OK');
    }
  }, [fontsError, fontsLoaded]);

  // TEMP diagnostic — distinguishes "load hangs forever" from "load fails
  // fast" from "load actually succeeds" when neither branch above fires.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fontsLoaded && !fontsError) {
        Alert.alert('Debug: font load status', 'Still pending after 5s (neither loaded nor errored).');
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontsError]);

  useEffect(() => {
    (async () => {
      try {
        // Restore language preference
        const savedLang = await storage.getItemAsync('cordyn_lang');
        if (savedLang === 'pl' || savedLang === 'en') {
          await setLanguage(savedLang as Lang);
        }
        // Restore auth
        const token = await storage.getItemAsync('cordyn_token');
        if (token) {
          const user = await authApi.me();
          await setAuth(token, user);
          await connectSocket();
        }
      } catch {
        await storage.deleteItemAsync('cordyn_token');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#09090b' } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
