import webpush from 'web-push';
import { query } from '../db/pool';
import { config } from '../config';

// Initialise VAPID only when keys are present (skips silently in dev without keys)
if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(
    `mailto:${config.vapid.email}`,
    config.vapid.publicKey,
    config.vapid.privateKey,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

/**
 * Send a Web-Push notification to all subscriptions for the given user.
 * Never throws — errors are logged and stale subscriptions are removed.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!config.vapid.publicKey || !config.vapid.privateKey) return;

  let rows: any[];
  try {
    ({ rows } = await query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId],
    ));
  } catch (err) {
    console.error('[push] DB read error:', err);
    return;
  }

  if (rows.length === 0) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          json,
          { TTL: 86400 },
        );
      } catch (err: any) {
        // 410 Gone / 404 Not Found = subscription expired → clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]).catch(() => {});
        } else {
          console.error('[push] send error for', row.endpoint, err.statusCode, err.body);
        }
      }
    }),
  );
}
