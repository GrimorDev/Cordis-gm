/**
 * Expo Push Notifications service.
 * Uses the Expo Push API directly (no SDK needed) — just HTTP.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
import { query } from '../db/pool';

interface ExpoPushMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

interface ExpoResponse {
  data: { status: 'ok' | 'error'; id?: string; message?: string; details?: unknown }[];
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notifications to one or more Expo push tokens.
 * Silently swaps bad tokens for the "DeviceNotRegistered" error.
 */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages.length) return;

  // Chunk into groups of 100 (Expo limit)
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const json = (await res.json()) as ExpoResponse;

      // Clean up tokens that are no longer valid
      for (let j = 0; j < json.data.length; j++) {
        const result = json.data[j];
        if (result.status === 'error' && result.details) {
          const details = result.details as { error?: string };
          if (details.error === 'DeviceNotRegistered') {
            const badToken = chunk[j].to;
            await query('DELETE FROM expo_push_tokens WHERE token = $1', [badToken]).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('[expoPush] send error:', err);
    }
  }
}

/**
 * Get all Expo push tokens for a given user.
 */
export async function getUserPushTokens(userId: string): Promise<string[]> {
  try {
    const { rows } = await query<{ token: string }>(
      'SELECT token FROM expo_push_tokens WHERE user_id = $1',
      [userId]
    );
    return rows.map(r => r.token);
  } catch {
    return [];
  }
}

/**
 * Send a DM push notification to a recipient.
 */
export async function sendDmPush(recipientId: string, senderUsername: string, content: string): Promise<void> {
  const tokens = await getUserPushTokens(recipientId);
  if (!tokens.length) return;

  await sendExpoPush(tokens.map(token => ({
    to: token,
    title: `💬 ${senderUsername}`,
    body: content.length > 100 ? content.slice(0, 97) + '…' : content,
    sound: 'default',
    data: { type: 'dm', senderUsername },
  })));
}

/**
 * Send a channel message push to all members who have notifications enabled
 * (simplified: just sends to everyone in the server for now).
 */
export async function sendChannelPush(
  channelName: string,
  senderUsername: string,
  content: string,
  recipientIds: string[],
): Promise<void> {
  if (!recipientIds.length) return;

  // Get all tokens for these users in one query
  const placeholders = recipientIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await query<{ token: string }>(
    `SELECT token FROM expo_push_tokens WHERE user_id IN (${placeholders})`,
    recipientIds
  ).catch(() => ({ rows: [] }));

  if (!rows.length) return;

  await sendExpoPush(rows.map(r => ({
    to: r.token,
    title: `#${channelName}`,
    body: `${senderUsername}: ${content.length > 80 ? content.slice(0, 77) + '…' : content}`,
    sound: 'default',
    data: { type: 'channel', senderUsername, channelName },
  })));
}
