/**
 * Cordis – Prometheus metrics (prom-client)
 *
 * Exposes GET /metrics — scraped by Prometheus every 15 s.
 * Includes:
 *   - Default Node.js metrics (heap, GC, event loop, CPU)
 *   - HTTP request duration histogram (by route + status code)
 *   - WebSocket connection gauge
 *   - PostgreSQL pool stats
 *   - Redis cache hit/miss counters
 *   - BullMQ queue depth gauge (optional)
 *
 * Workers in cluster mode each expose their own metrics on /metrics.
 * Prometheus aggregates across workers via multi-process mode (tmpdir).
 */

import { register, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { pool } from './db/pool';

// ── Default Node.js metrics (heap, GC, eventloop lag, CPU) ──────────
collectDefaultMetrics({ register });

// ── HTTP request duration ────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name: 'cordis_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// ── WebSocket connections ────────────────────────────────────────────
export const wsConnections = new Gauge({
  name: 'cordis_websocket_connections_total',
  help: 'Number of active Socket.IO connections',
  registers: [register],
});

// ── Redis cache counters (updated by cache helpers) ──────────────────
export const redisCacheHits = new Counter({
  name: 'cordis_redis_cache_hits_total',
  help: 'Number of Redis cache hits',
  labelNames: ['cache'],
  registers: [register],
});

export const redisCacheMisses = new Counter({
  name: 'cordis_redis_cache_misses_total',
  help: 'Number of Redis cache misses',
  labelNames: ['cache'],
  registers: [register],
});

// ── PostgreSQL pool stats ────────────────────────────────────────────
export const pgPoolTotal = new Gauge({
  name: 'cordis_pg_pool_total',
  help: 'Total PostgreSQL pool connections',
  registers: [register],
  collect() {
    this.set(pool.totalCount);
  },
});

export const pgPoolIdle = new Gauge({
  name: 'cordis_pg_pool_idle',
  help: 'Idle PostgreSQL pool connections',
  registers: [register],
  collect() {
    this.set(pool.idleCount);
  },
});

export const pgPoolWaiting = new Gauge({
  name: 'cordis_pg_pool_waiting',
  help: 'Queued requests waiting for a PostgreSQL connection',
  registers: [register],
  collect() {
    this.set(pool.waitingCount);
  },
});

// ── BullMQ queue depth (optional — only if BullMQ is loaded) ─────────
export const queueDepth = new Gauge({
  name: 'cordis_queue_depth',
  help: 'Number of jobs waiting in BullMQ queues',
  labelNames: ['queue'],
  registers: [register],
});

// ── Expose the registry ──────────────────────────────────────────────
export { register };
