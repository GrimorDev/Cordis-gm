// ─── Ongoing-call Android notification ───────────────────────────────────
//
// Was implemented as a full Android foreground service (notifee
// asForegroundService + FOREGROUND_SERVICE_TYPE_MICROPHONE). That crashed
// the app on accepting a call, with no device logs available to confirm
// exactly why — most likely notifee's precompiled service module and the
// Android 14+ manifest-side foreground-service-type requirement not lining
// up (can't inspect notifee's compiled .aar to be sure). Since a crash is a
// strictly worse outcome than "no persistent notification", this drops the
// foreground-service mechanism entirely: a plain `ongoing: true` local
// notification still shows in the shade and can't be swiped away, it's
// just not a formal foreground service. In-app awareness ("in this call")
// still comes from CallOverlay's connected-state bar regardless.

import notifee, { AndroidImportance, AndroidCategory, EventType } from '@notifee/react-native';

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
    try { await notifee.cancelNotification(activeNotificationId); } catch {}
    activeNotificationId = null;
  }
}
