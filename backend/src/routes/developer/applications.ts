import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../../db/pool';
import { redis } from '../../redis/client';
import { authMiddleware } from '../../middleware/auth';
import { AuthRequest } from '../../types';

const router = Router();

function auditLog(appId: string, userId: string, action: string, details: object = {}, ip?: string) {
  query(
    `INSERT INTO developer_audit_logs (app_id, user_id, action, details, ip) VALUES ($1, $2, $3, $4, $5)`,
    [appId, userId, action, JSON.stringify(details), ip || null]
  ).catch(err => console.error('[audit]', err.message));
}

function getIp(req: AuthRequest): string {
  return (req.headers['x-real-ip'] as string) || req.ip || 'unknown';
}

// GET /api/developer/applications
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT da.*, u.username AS bot_username, u.avatar_url AS bot_avatar
       FROM developer_applications da
       LEFT JOIN users u ON u.id = da.bot_user_id
       WHERE da.owner_id = $1
       ORDER BY da.created_at DESC`,
      [req.user!.id]
    );
    res.json(rows.map(r => ({ ...r, client_secret: undefined, webhook_secret: undefined })));
  } catch (err) {
    console.error('GET /developer/applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/developer/applications
router.post('/', authMiddleware,
  body('name').isString().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { name, description } = req.body;
      const rawSecret = crypto.randomBytes(32).toString('hex');
      const secretHash = await bcrypt.hash(rawSecret, 10);
      const webhookSecret = crypto.randomBytes(32).toString('hex');
      const { rows } = await query(
        `INSERT INTO developer_applications (owner_id, name, description, client_secret, webhook_secret)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user!.id, name, description || null, secretHash, webhookSecret]
      );
      auditLog(rows[0].id, req.user!.id, 'app_created', { name }, getIp(req));
      res.status(201).json({ ...rows[0], client_secret: rawSecret, webhook_secret: undefined });
    } catch (err) {
      console.error('POST /developer/applications error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/developer/applications/:appId
router.get('/:appId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT da.*, u.username AS bot_username, u.avatar_url AS bot_avatar, u.is_bot
       FROM developer_applications da
       LEFT JOIN users u ON u.id = da.bot_user_id
       WHERE da.id = $1 AND da.owner_id = $2`,
      [req.params.appId, req.user!.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ ...rows[0], client_secret: undefined, webhook_secret: undefined });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/developer/applications/:appId
router.patch('/:appId', authMiddleware,
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('redirect_uris').optional().isArray({ max: 20 }),
  body('redirect_uris.*').optional().isURL(),
  body('is_public').optional().isBoolean(),
  body('terms_url').optional().isURL(),
  body('privacy_url').optional().isURL(),
  body('webhook_url').optional().isURL(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      const allowed = ['name', 'description', 'redirect_uris', 'is_public', 'terms_url', 'privacy_url', 'icon_url', 'webhook_url'];
      const changed: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates.push(`${key} = $${i++}`);
          values.push(req.body[key]);
          changed[key] = req.body[key];
        }
      }
      if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
      updates.push(`updated_at = NOW()`);
      values.push(req.params.appId, req.user!.id);
      const { rows } = await query(
        `UPDATE developer_applications SET ${updates.join(', ')}
         WHERE id = $${i} AND owner_id = $${i + 1} RETURNING *`,
        values
      );
      if (!rows.length) return res.status(404).json({ error: 'Application not found' });
      auditLog(req.params.appId, req.user!.id, 'app_updated', changed, getIp(req));
      res.json({ ...rows[0], client_secret: undefined, webhook_secret: undefined });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/developer/applications/:appId
router.delete('/:appId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'DELETE FROM developer_applications WHERE id = $1 AND owner_id = $2 RETURNING id, name',
      [req.params.appId, req.user!.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/developer/applications/:appId/secret
router.post('/:appId/secret', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query(
      'SELECT 1 FROM developer_applications WHERE id = $1 AND owner_id = $2',
      [req.params.appId, req.user!.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Application not found' });
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const secretHash = await bcrypt.hash(rawSecret, 10);
    await query('UPDATE developer_applications SET client_secret = $1, updated_at = NOW() WHERE id = $2', [secretHash, req.params.appId]);
    auditLog(req.params.appId, req.user!.id, 'secret_regenerated', {}, getIp(req));
    res.json({ client_secret: rawSecret });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/developer/applications/:appId/webhook-secret
router.get('/:appId/webhook-secret', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      'SELECT webhook_secret FROM developer_applications WHERE id = $1 AND owner_id = $2',
      [req.params.appId, req.user!.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ webhook_secret: rows[0].webhook_secret });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/developer/applications/:appId/webhook-secret
router.post('/:appId/webhook-secret', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query(
      'SELECT 1 FROM developer_applications WHERE id = $1 AND owner_id = $2',
      [req.params.appId, req.user!.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Application not found' });
    const newSecret = crypto.randomBytes(32).toString('hex');
    await query('UPDATE developer_applications SET webhook_secret = $1, updated_at = NOW() WHERE id = $2', [newSecret, req.params.appId]);
    auditLog(req.params.appId, req.user!.id, 'webhook_secret_regenerated', {}, getIp(req));
    res.json({ webhook_secret: newSecret });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/developer/applications/:appId/audit-logs
router.get('/:appId/audit-logs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query('SELECT 1 FROM developer_applications WHERE id = $1 AND owner_id = $2', [req.params.appId, req.user!.id]);
    if (!rowCount) return res.status(404).json({ error: 'Application not found' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;
    const { rows } = await query(
      `SELECT dal.*, u.username AS actor_username
       FROM developer_audit_logs dal
       JOIN users u ON u.id = dal.user_id
       WHERE dal.app_id = $1
       ORDER BY dal.created_at DESC LIMIT $2 OFFSET $3`,
      [req.params.appId, limit, offset]
    );
    const { rows: countRows } = await query('SELECT COUNT(*)::int AS total FROM developer_audit_logs WHERE app_id = $1', [req.params.appId]);
    res.json({ logs: rows, total: countRows[0].total, page, pages: Math.ceil(countRows[0].total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/developer/applications/:appId/rate-limits
router.get('/:appId/rate-limits', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query('SELECT 1 FROM developer_applications WHERE id = $1 AND owner_id = $2', [req.params.appId, req.user!.id]);
    if (!rowCount) return res.status(404).json({ error: 'Application not found' });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const hourKeys: string[] = [];
    const hourLabels: string[] = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
      const label = `${day}-${pad(d.getUTCHours())}`;
      hourKeys.push(`ratelimit:bot:${req.params.appId}:hour:${label}`);
      hourLabels.push(label);
    }
    const todayStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())}`;
    const todayKey = `ratelimit:bot:${req.params.appId}:day:${todayStr}`;
    const thisHourKey = hourKeys[hourKeys.length - 1];
    const values = await redis.mget([...hourKeys, todayKey, thisHourKey]);
    const hourly = values.slice(0, 24).map((v, i) => ({ hour: hourLabels[i], count: parseInt(v || '0', 10) }));
    res.json({ today: parseInt(values[24] || '0', 10), this_hour: parseInt(values[25] || '0', 10), hourly });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/developer/applications/:appId/analytics
router.get('/:appId/analytics', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query('SELECT 1 FROM developer_applications WHERE id = $1 AND owner_id = $2', [req.params.appId, req.user!.id]);
    if (!rowCount) return res.status(404).json({ error: 'Application not found' });
    const { rows } = await query(
      `SELECT date, messages_processed, commands_executed, unique_user_count, servers_active
       FROM bot_analytics WHERE app_id = $1 ORDER BY date DESC LIMIT 30`,
      [req.params.appId]
    );
    const totals = rows.reduce((acc, r) => ({ messages: acc.messages + r.messages_processed, commands: acc.commands + r.commands_executed }), { messages: 0, commands: 0 });
    res.json({ days: rows.reverse(), totals });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
