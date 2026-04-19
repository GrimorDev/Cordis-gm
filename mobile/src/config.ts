import { Platform } from 'react-native';

/** Backend API base URL.
 *  - Web (PWA): auto-detects from browser origin → same domain, /api path
 *  - Native (Expo Go / APK): uses EXPO_PUBLIC_API_URL env var
 */
export const API_URL: string = (() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'https://your-domain.com/api';
})();

/** Socket.IO server URL (without /api suffix). */
export const SOCKET_URL: string = (() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return API_URL.replace(/\/api$/, '');
})();
