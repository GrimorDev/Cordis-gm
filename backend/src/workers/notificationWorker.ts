/**
 * Cordis – Notification + Push BullMQ Workers
 *
 * Started once by the cluster PRIMARY (or by the single process in dev).
 * Workers run in the same Node.js process, not a separate binary.
 *
 * notificationWorker — inserts DB rows for @mention / @everyone notifications.
 * pushWorker         — sends Web Push payloads to subscribed devices.
 *
 * Why offload to BullMQ?
 *  @everyone in a 10 000-member server = 10 000 DB inserts.
 *  Doing that synchronously in the HTTP handler blocks for ~5 s.
 *  Offloading puts it in the background: response returns in <50 ms,
 *  queue drains over the next few seconds with concurrency control.
 */

import { Worker } from 'bullmq';
import { bullmqConnection } from '../queues';
import { query } from '../db/pool';
import { sendPushToUser } from '../services/push';
import { queueDepth } from '../metrics';

// ── Notification worker ───────────────────────────────────────────────
export const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    const { type, data } = job.data as {
      type: 'mention' | 'everyone';
      data: Record<string, any>;
    };

    if (type === 'mention') {
      // Single mention notification insert
      const { userId, messageId, channelId, serverId, fromUserId, content } = data;
      await query(
        `INSERT INTO notifications (user_id, type, message_id, channel_id, server_id, from_user_id, content)
         VALUES ($1, 'mention', $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [userId, messageId, channelId, serverId, fromUserId, content?.slice(0, 200)]
      );

    } else if (type === 'everyone') {
      // Bulk @everyone / @here — chunked INSERT for thousands of members
      const { members, messageId, channelId, serverId, fromUserId, content } = data as {
        members: string[]; messageId: string; channelId: string;
        serverId: string; fromUserId: string; content: string;
      };

      // Batch in chunks of 500 rows to stay under pg's parameter limit
      const CHUNK = 500;
      for (let i = 0; i < members.length; i += CHUNK) {
        const chunk = members.slice(i, i + CHUNK);
        const vals  = chunk.map((_: string, j: number) =>
          `($${j * 6 + 1}, 'everyone', $${j * 6 + 2}, $${j * 6 + 3}, $${j * 6 + 4}, $${j * 6 + 5}, $${j * 6 + 6})`
        ).join(', ');
        const params = chunk.flatMap((uid: string) => [
          uid, messageId, channelId, serverId, fromUserId, content?.slice(0, 200),
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
    concurrency: 10,  // process 10 jobs in parallel
    limiter: {
      max: 500,        // max 500 jobs per second per worker instance
      duration: 1000,
    },
  }
);

// ── Push notification worker ─────────────────────────────────────────
export const pushWorker = new Worker(
  'push',
  async (job) => {
    const { userId, title, body, data, tag } = job.data as {
      userId: string; title: string; body: string;
      data?: Record<string, any>; tag?: string;
    };
    await sendPushToUser(userId, { title, body, data, tag } as any);
  },
  {
    connection: bullmqConnection,
    concurrency: 20,  // push is I/O-bound (external HTTP), high concurrency ok
    limiter: {
      max: 200,
      duration: 1000,
    },
  }
);

// Update queue depth metrics every 30 s
async function updateQueueMetrics() {
  try {
    const { Queue } = await import('bullmq');
    const conn = bullmqConnection;
    const nq = new Queue('notifications', { connection: conn });
    const pq = new Queue('push', { connection: conn });
    const [nWaiting, pWaiting] = await Promise.all([nq.getWaitingCount(), pq.getWaitingCount()]);
    queueDepth.set({ queue: 'notifications' }, nWaiting);
    queueDepth.set({ queue: 'push' }, pWaiting);
    await nq.close();
    await pq.close();
  } catch { /* non-fatal */ }
}

setInterval(updateQueueMetrics, 30_000).unref();

notificationWorker.on('failed', (job, err) => {
  console.error(`[notif-worker] job ${job?.id} failed:`, err.message);
});

pushWorker.on('failed', (job, err) => {
  console.error(`[push-worker] job ${job?.id} failed:`, err.message);
});

console.log('[workers] Notification + Push BullMQ workers started');
