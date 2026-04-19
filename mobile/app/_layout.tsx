import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useStore } from '../src/store';
import { authApi } from '../src/api';
import { connectSocket } from '../src/socket';

export default function RootLayout() {
  const { setAuth, isAuthenticated } = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('cordyn_token');
        if (token) {
          const user = await authApi.me();
          await setAuth(token, user);
          await connectSocket();
        }
      } catch {
        await SecureStore.deleteItemAsync('cordyn_token');
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
