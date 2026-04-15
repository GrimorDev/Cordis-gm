/**
 * Cordis – Cluster entry point
 *
 * Spawns one worker per CPU core (or CLUSTER_WORKERS env var).
 * Each worker runs the full Express + Socket.IO server.
 * Workers share state through Redis (Socket.IO Redis Adapter + shared Redis cache).
 *
 * Usage:
 *   node dist/cluster.js            (production — replaces dist/index.js in Dockerfile)
 *   CLUSTER_WORKERS=2 node dist/cluster.js   (pin to 2 workers)
 *   CLUSTER_WORKERS=1 node dist/cluster.js   (single-process, useful for debugging)
 *
 * Why cluster mode instead of PM2?
 *  - Zero extra deps in production image
 *  - Works inside Docker without a process manager daemon
 *  - Automatic worker restart on crash (handled below)
 *  - NODE_OPTIONS / --max-old-space-size is inherited by each worker
 */

import cluster from 'cluster';
import os from 'os';

const cpuCount   = os.cpus().length;
const requested  = parseInt(process.env.CLUSTER_WORKERS || '0', 10);
// 0 → auto (one per core); explicit value → use that
const numWorkers = requested > 0 ? requested : cpuCount;

if (cluster.isPrimary) {
  console.log(`[cluster] Primary PID ${process.pid} | CPUs: ${cpuCount} | Workers: ${numWorkers}`);

  // Fork initial workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  // Respawn dead workers so a crash never silently reduces capacity
  cluster.on('exit', (worker, code, signal) => {
    const reason = signal ?? `code ${code}`;
    console.warn(`[cluster] Worker ${worker.process.pid} died (${reason}) — restarting`);
    cluster.fork();
  });

  cluster.on('online', (worker) => {
    console.log(`[cluster] Worker ${worker.process.pid} online`);
  });

  // Graceful shutdown: let workers finish in-flight requests
  const shutdown = (sig: string) => {
    console.log(`[cluster] ${sig} received — shutting down workers gracefully`);
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill('SIGTERM');
    }
    // Give workers 15 s to drain, then force-exit primary
    setTimeout(() => process.exit(0), 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

} else {
  // Worker process — load the actual application
  // Using require() so TypeScript compiles this as CommonJS (same as backend)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./index');
}
