/**
 * Cross-platform storage abstraction.
 * - Native: expo-secure-store (encrypted Keychain / Keystore)
 * - Web:    localStorage (no secure store available on web)
 */
import { Platform } from 'react-native';

async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  const { getItemAsync: get } = await import('expo-secure-store');
  return get(key);
}

async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  const { setItemAsync: set } = await import('expo-secure-store');
  return set(key, value);
}

async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  const { deleteItemAsync: del } = await import('expo-secure-store');
  return del(key);
}

export const storage = { getItemAsync, setItemAsync, deleteItemAsync };
