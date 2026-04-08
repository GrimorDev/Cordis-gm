import { query } from '../db/pool';
import { redis } from '../redis/client';
import http from 'http';

const SERVICES = [
  { id: 'api',      name: 'API' },
  { id: 'database', name: 'Database' },
  { id: 'redis',    name: 'Redis' },
  { id: 'socket',   name: 'Gateway' },
];

async function checkApi(port: number): Promise<{ status: 'operational'|'degraded'|'outage'; ms: number }> {
  return new Promise(resolve => {
    const start = Date.now();
    const timeout = setTimeout(() => resolve({ status: 'outage', ms: 9999 }), 5000);
    const req = http.request({ hostname: 'localhost', port, path: '/health', method: 'GET' }, (res) => {
      clearTimeout(timeout);
      const ms = Date.now() - start;
      res.resume();
      resolve({ status: res.statusCode === 200 ? (ms > 1000 ? 'degraded' : 'operational') : 'outage', ms });
    });
    req.on('error', () => { clearTimeout(timeout); resolve({ status: 'outage', ms: 9999 }); });
    req.end();
  });
}

async function checkDatabase(): Promise<{ status: 'operational'|'degraded'|'outage'; ms: number }> {
  try {
    const start = Date.now();
    await query('SELECT 1');
    const ms = Date.now() - start;
    return { status: ms > 2000 ? 'degraded' : 'operational', ms };
  } catch {
    return { status: 'outage', ms: 9999 };
  }
}

async function checkRedis(): Promise<{ status: 'operational'|'degraded'|'outage'; ms: number }> {
  try {
    const start = Date.now();
    await redis.ping();
    const ms = Date.now() - start;
    return { status: ms > 500 ? 'degraded' : 'operational', ms };
  } catch {
    return { status: 'outage', ms: 9999 };
  }
}

export async function runHealthChecks(port: number = 4000): Promise<void> {
  try {
    const [api, database, redisResult] = await Promise.all([
      checkApi(port),
      checkDatabase(),
      checkRedis(),
    ]);

    const results = [
      { service: 'api',      ...api },
      { service: 'database', ...database },
      { service: 'redis',    ...redisResult },
      { service: 'socket',   status: api.status, ms: api.ms }, // socket is colocated
    ];

    for (const r of results) {
      await query(
        `INSERT INTO service_checks (service, status, response_ms) VALUES ($1, $2, $3)`,
        [r.service, r.status, r.ms === 9999 ? null : r.ms]
      );
    }

    console.log(`[healthChecker] checked ${results.length} services at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[healthChecker] error:', err);
  }
}

export function startHealthChecker(port: number = 4000): void {
  // Run immediately on start
  runHealthChecks(port);
  // Then every 10 minutes
  setInterval(() => runHealthChecks(port), 10 * 60 * 1000);
}
