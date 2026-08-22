import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
  const [, fontsError] = useFonts({ ...Ionicons.font });
  useEffect(() => {
    if (fontsError) console.warn('[Cordyn] Ionicons font failed to load:', fontsError);
  }, [fontsError]);

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
