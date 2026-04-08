import { Router, Request, Response } from 'express';
import { query } from '../db/pool';

const router = Router();

// GET /api/status  — public
router.get('/', async (_req: Request, res: Response) => {
  try {
    const SERVICE_IDS = ['api', 'database', 'redis', 'socket'];
    const SERVICE_NAMES: Record<string, string> = {
      api: 'API', database: 'Database', redis: 'Cache (Redis)', socket: 'Gateway',
    };
    const SERVICE_DESC: Record<string, string> = {
      api:      'Endpointy REST API i autoryzacja',
      database: 'Baza danych PostgreSQL',
      redis:    'Cache i kolejki wiadomości',
      socket:   'WebSocket i połączenia real-time',
    };

    // Latest check per service
    const { rows: latest } = await query(`
      SELECT DISTINCT ON (service) service, status, response_ms, checked_at
      FROM service_checks
      ORDER BY service, checked_at DESC
    `);

    // 90-day daily aggregates per service
    const { rows: history } = await query(`
      SELECT
        service,
        DATE(checked_at) AS day,
        MODE() WITHIN GROUP (ORDER BY status) AS status,
        ROUND(AVG(response_ms)) AS avg_ms,
        COUNT(*) AS checks
      FROM service_checks
      WHERE checked_at > NOW() - INTERVAL '90 days'
      GROUP BY service, DATE(checked_at)
      ORDER BY service, day DESC
    `);

    // Uptime % per service (last 90 days)
    const { rows: uptime } = await query(`
      SELECT
        service,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'operational') / NULLIF(COUNT(*), 0), 2) AS uptime_pct
      FROM service_checks
      WHERE checked_at > NOW() - INTERVAL '90 days'
      GROUP BY service
    `);

    // Response time last 24h (for sparkline) — api only
    const { rows: sparkline } = await query(`
      SELECT
        DATE_TRUNC('hour', checked_at) AS hour,
        ROUND(AVG(response_ms)) AS avg_ms
      FROM service_checks
      WHERE service = 'api' AND checked_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', checked_at)
      ORDER BY hour ASC
    `);

    // Incidents (last 30 days)
    const { rows: incidents } = await query(`
      SELECT i.*, json_agg(
        json_build_object('id', u.id, 'status', u.status, 'message', u.message, 'created_at', u.created_at)
        ORDER BY u.created_at DESC
      ) FILTER (WHERE u.id IS NOT NULL) AS updates
      FROM status_incidents i
      LEFT JOIN status_incident_updates u ON u.incident_id = i.id
      WHERE i.created_at > NOW() - INTERVAL '30 days'
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);

    // Build service map
    const latestMap: Record<string, any> = {};
    for (const r of latest) latestMap[r.service] = r;

    const historyMap: Record<string, any[]> = {};
    for (const r of history) {
      if (!historyMap[r.service]) historyMap[r.service] = [];
      historyMap[r.service].push(r);
    }

    const uptimeMap: Record<string, number> = {};
    for (const r of uptime) uptimeMap[r.service] = parseFloat(r.uptime_pct);

    const services = SERVICE_IDS.map(id => ({
      id,
      name: SERVICE_NAMES[id],
      description: SERVICE_DESC[id],
      status: latestMap[id]?.status ?? 'operational',
      response_ms: latestMap[id]?.response_ms ?? null,
      uptime_90d: uptimeMap[id] ?? 100,
      last_check: latestMap[id]?.checked_at ?? null,
      history: historyMap[id] ?? [],
    }));

    // Overall status
    const anyOutage = services.some(s => s.status === 'outage');
    const anyDegraded = services.some(s => s.status === 'degraded');
    const overall = anyOutage ? 'outage' : anyDegraded ? 'degraded' : 'operational';

    res.json({
      overall,
      services,
      sparkline,
      incidents,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GET /api/status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
