/**
 * Expo Push Notifications — token registration & permission helpers.
 * Call `registerForPushNotifications()` once after login.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { API_URL } from './config';
import { storage } from './storage';

// How notifications appear while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getToken(): Promise<string | null> {
  return storage.getItemAsync('cordyn_token');
}

/**
 * Request permission & register the Expo push token with the backend.
 * Safe to call multiple times — de-duplicates via ON CONFLICT on the backend.
 */
export async function registerForPushNotifications(): Promise<void> {
  // Physical device required — emulators don't have push notification support
  if (!Device.isDevice) {
    console.log('[push] Skipping — not a physical device');
    return;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[push] Permission denied by user');
    return;
  }

  // Android channel (required for Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Cordyn',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
      sound: 'default',
    });
  }

  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: '7dbdc4c2-5cc6-4d85-8a1a-e7510fe8b9ad', // from app.json extra.eas.projectId
    });

    const token = await getToken();
    if (!token) return;

    await fetch(`${API_URL}/push/expo-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        token: pushToken.data,
        platform: Platform.OS,
      }),
    });

    console.log('[push] Registered Expo push token:', pushToken.data);
  } catch (err) {
    console.warn('[push] Failed to register push token:', err);
  }
}

/**
 * Unregister all Expo push tokens for this user (call on logout).
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await getToken();
    if (!token) return;
    await fetch(`${API_URL}/push/expo-token`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* best-effort */ }
}
