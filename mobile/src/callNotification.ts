// ─── Ongoing-call Android notification (foreground service) ─────────────────
//
// expo-notifications (already used for remote push) can't do a persistent/
// ongoing Android notification tied to a foreground service — that's what
// notifee is for. This is what makes the OS (and the user) actually aware
// a call is active, instead of the app silently holding a mic stream with
// no visible trace.
//
// notifee.registerForegroundService(...) must run once at app startup — see
// mobile/app/_layout.tsx (module-level import triggers this file's own
// top-level registerForegroundService call below).

import notifee, { AndroidImportance, AndroidCategory, AndroidForegroundServiceType, EventType } from '@notifee/react-native';

const CHANNEL_ID = 'voice-call';

let channelReady: Promise<void> | null = null;
function ensureChannel(): Promise<void> {
  if (!channelReady) {
    channelReady = notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Połączenie głosowe',
      importance: AndroidImportance.HIGH,
    }).then(() => undefined);
  }
  return channelReady;
}

// Keeps the foreground service alive until stopForegroundService() is called
// from hideOngoingCallNotification(). Registered once at module load.
notifee.registerForegroundService(() => {
  return new Promise(() => {
    // Intentionally never resolves — the service stays alive until
    // notifee.stopForegroundService() is called explicitly on hangup/leave.
  });
});

let activeNotificationId: string | null = null;
let unsubscribeAction: (() => void) | null = null;

export async function showOngoingCallNotification(channelName: string, onHangup: () => void): Promise<void> {
  await ensureChannel();

  unsubscribeAction?.();
  unsubscribeAction = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'hangup') {
      onHangup();
    }
  });

  activeNotificationId = await notifee.displayNotification({
    title: 'Połączony z kanałem głosowym',
    body: `#${channelName}`,
    android: {
      channelId: CHANNEL_ID,
      ongoing: true,
      asForegroundService: true,
      // Android 14+ (this app targets SDK 35) requires foreground services
      // that use the microphone to declare that type explicitly — omitting
      // it throws MissingForegroundServiceTypeException and kills the app
      // right as the service starts, i.e. right when a call connects.
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE],
      category: AndroidCategory.CALL,
      // expo-notifications' config plugin (already configured in app.json)
      // generates this drawable resource from assets/icon.png — reuse it
      // rather than referencing an icon name that may not exist.
      smallIcon: 'notification_icon',
      color: '#6366f1',
      actions: [{ title: 'Rozłącz', pressAction: { id: 'hangup' } }],
      pressAction: { id: 'default' },
    },
  });
}

export async function hideOngoingCallNotification(): Promise<void> {
  unsubscribeAction?.();
  unsubscribeAction = null;
  if (activeNotificationId) {
    try { await notifee.stopForegroundService(); } catch {}
    try { await notifee.cancelNotification(activeNotificationId); } catch {}
    activeNotificationId = null;
  }
}
