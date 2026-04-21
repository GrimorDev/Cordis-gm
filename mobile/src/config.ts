import { Platform } from 'react-native';

/** Backend API base URL.
 *  - Web (PWA): auto-detects from browser origin → same domain, /api path
 *  - Native (APK): uses EXPO_PUBLIC_API_URL env var (set in eas.json)
 */
export const API_URL: string = (() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url || url.includes('YOUR_VPS')) {
    console.warn('[Cordyn] EXPO_PUBLIC_API_URL is not set! Edit eas.json before building.');
  }
  return url ?? 'https://YOUR_VPS_DOMAIN_OR_IP/api';
})();

/** Socket.IO server URL (without /api suffix). */
export const SOCKET_URL: string = (() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_SOCKET_URL ?? API_URL.replace(/\/api$/, '');
})();

/** Base URL for static assets (avatars, uploads) — strips /api suffix. */
export const STATIC_BASE: string = (() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return API_URL.replace(/\/api$/, '');
})();
