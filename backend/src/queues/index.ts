/**
 * Cordis – BullMQ Queue Registry
 *
 * Centralised queue definitions. Workers import the same Queue instances
 * so BullMQ can match producers to consumers by queue name.
 *
 * All queues use the shared Redis connection.
 * At 100k users the queues absorb spikes from @everyone mentions,
 * push notifications, and email — so these never block the HTTP response.
 */

import { Queue, QueueEvents } from 'bullmq';
import { config } from '../config';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

// ── Notification queue ────────────────────────────────────────────────
// Jobs: { type: 'mention' | 'everyone', ... }
// Processed by: workers/notificationWorker.ts
export const notificationQueue = new Queue('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail:    { count: 500  },
  },
});

// ── Push notification queue ───────────────────────────────────────────
// Jobs: { userId, title, body, data }
// Processed by: workers/notificationWorker.ts (same worker, different job type)
export const pushQueue = new Queue('push', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail:    { count: 200 },
  },
});

// ── Queue events (optional — used for metrics) ───────────────────────
export const notificationQueueEvents = new QueueEvents('notifications', { connection });
export const pushQueueEvents         = new QueueEvents('push',          { connection });

export { connection as bullmqConnection };
