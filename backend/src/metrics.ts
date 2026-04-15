/**
 * Cordis – Prometheus metrics (prom-client)
 *
 * Exposes GET /metrics — scraped by Prometheus every 15 s.
 */

import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { pool } from './db/pool';

// ── Default Node.js metrics (heap, GC, eventloop lag, CPU) ───────────
collectDefaultMetrics({ register });

// ── HTTP request duration ─────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name: 'cordis_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// ── WebSocket connections ─────────────────────────────────────────────
export const wsConnections = new Gauge({
  name: 'cordis_websocket_connections_total',
  help: 'Number of active Socket.IO connections',
  registers: [register],
});

// ── Redis cache counters ──────────────────────────────────────────────
export const redisCacheHits = new Counter({
  name: 'cordis_redis_cache_hits_total',
  help: 'Number of Redis cache hits',
  labelNames: ['cache'] as const,
  registers: [register],
});

export const redisCacheMisses = new Counter({
  name: 'cordis_redis_cache_misses_total',
  help: 'Number of Redis cache misses',
  labelNames: ['cache'] as const,
  registers: [register],
});

// ── PostgreSQL pool stats ─────────────────────────────────────────────
export const pgPoolTotal   = new Gauge({ name: 'cordis_pg_pool_total',   help: 'Total PG pool connections',   registers: [register] });
export const pgPoolIdle    = new Gauge({ name: 'cordis_pg_pool_idle',    help: 'Idle PG pool connections',    registers: [register] });
export const pgPoolWaiting = new Gauge({ name: 'cordis_pg_pool_waiting', help: 'Requests waiting for PG conn', registers: [register] });

// Update PG stats every 15 s (avoids `this` typing issues in strict mode)
setInterval(() => {
  pgPoolTotal.set(pool.totalCount);
  pgPoolIdle.set(pool.idleCount);
  pgPoolWaiting.set(pool.waitingCount);
}, 15_000).unref();

// ── BullMQ queue depth ────────────────────────────────────────────────
export const queueDepth = new Gauge({
  name: 'cordis_queue_depth',
  help: 'Number of jobs waiting in BullMQ queues',
  labelNames: ['queue'] as const,
  registers: [register],
});

export { register };
