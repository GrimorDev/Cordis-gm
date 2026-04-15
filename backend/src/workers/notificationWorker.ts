/**
 * Cordis – Notification + Push BullMQ Workers
 *
 * Started once by the cluster PRIMARY (or by the single process in dev).
 *
 * notificationWorker — inserts DB rows for @mention / @everyone notifications.
 * pushWorker         — sends Web Push payloads to subscribed devices.
 */

import { Worker } from 'bullmq';
import { bullmqConnection } from '../queues';
import { query } from '../db/pool';
import { sendPushToUser, PushPayload } from '../services/push';
import { queueDepth } from '../metrics';

// ── Notification worker ───────────────────────────────────────────────
export const notificationWorker = new Worker(
  'notifications',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (job: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobData: Record<string, any> = job.data ?? {};
    const { type } = jobData;

    if (type === 'mention') {
      const { userId, messageId, channelId, serverId, fromUserId, content } = jobData.data ?? {};
      await query(
        `INSERT INTO notifications (user_id, type, message_id, channel_id, server_id, from_user_id, content)
         VALUES ($1, 'mention', $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [userId, messageId, channelId, serverId, fromUserId, String(content ?? '').slice(0, 200)]
      );

    } else if (type === 'everyone') {
      // Bulk @everyone / @here — chunked INSERT for thousands of members
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: Record<string, any> = jobData.data ?? {};
      const members: string[]  = Array.isArray(d.members) ? d.members : [];
      const { messageId, channelId, serverId, fromUserId, content } = d;

      const CHUNK = 500;
      for (let i = 0; i < members.length; i += CHUNK) {
        const chunk  = members.slice(i, i + CHUNK);
        const vals   = chunk.map((_: string, j: number) =>
          `($${j * 6 + 1}, 'everyone', $${j * 6 + 2}, $${j * 6 + 3}, $${j * 6 + 4}, $${j * 6 + 5}, $${j * 6 + 6})`
        ).join(', ');
        const params = chunk.flatMap((uid: string) => [
          uid, messageId, channelId, serverId, fromUserId,
          String(content ?? '').slice(0, 200),
        ]);
        await query(
          `INSERT INTO notifications (user_id, type, message_id, channel_id, server_id, from_user_id, content)
           VALUES ${vals} ON CONFLICT DO NOTHING`,
          params
        );
      }
    }
  },
  {
    connection: bullmqConnection,
    concurrency: 10,
    limiter: { max: 500, duration: 1000 },
  }
);

// ── Push notification worker ─────────────────────────────────────────
export const pushWorker = new Worker(
  'push',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (job: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: Record<string, any> = job.data ?? {};
    const payload: PushPayload = {
      title: String(d.title ?? ''),
      body:  String(d.body  ?? ''),
      tag:   d.tag  ? String(d.tag)  : undefined,
      url:   d.url  ? String(d.url)  : undefined,
      icon:  d.icon ? String(d.icon) : undefined,
    };
    // sendPushToUser accepts userId typed as number but DB returns UUIDs (string).
    // The function internally passes it as a query param ($1) so any value works.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendPushToUser(d.userId as any, payload);
  },
  {
    connection: bullmqConnection,
    concurrency: 20,
    limiter: { max: 200, duration: 1000 },
  }
);

// ── Queue depth metrics — updated every 30 s ─────────────────────────
async function updateQueueMetrics(): Promise<void> {
  try {
    const { Queue } = await import('bullmq');
    const nq = new Queue('notifications', { connection: bullmqConnection });
    const pq = new Queue('push',          { connection: bullmqConnection });
    const [nWaiting, pWaiting] = await Promise.all([
      nq.getWaitingCount(),
      pq.getWaitingCount(),
    ]);
    queueDepth.set({ queue: 'notifications' }, nWaiting);
    queueDepth.set({ queue: 'push' },          pWaiting);
    await nq.close();
    await pq.close();
  } catch { /* non-fatal */ }
}

setInterval(updateQueueMetrics, 30_000).unref();

notificationWorker.on('failed', (job, err) => {
  console.error(`[notif-worker] job ${job?.id ?? '?'} failed:`, err.message);
});

pushWorker.on('failed', (job, err) => {
  console.error(`[push-worker] job ${job?.id ?? '?'} failed:`, err.message);
});

console.log('[workers] Notification + Push BullMQ workers started');
