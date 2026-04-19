/**
 * Native storage — uses expo-secure-store (encrypted Keychain / Keystore).
 * Metro picks storage.web.ts for web builds, so this file is native-only.
 */
import * as SecureStore from 'expo-secure-store';

export const storage = {
  getItemAsync:  SecureStore.getItemAsync,
  setItemAsync:  SecureStore.setItemAsync,
  deleteItemAsync: SecureStore.deleteItemAsync,
};
