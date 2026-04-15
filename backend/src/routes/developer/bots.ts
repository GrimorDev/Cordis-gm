import { Router, Response } from 'express';
import crypto from 'crypto';
import { query } from '../../db/pool';
import { authMiddleware } from '../../middleware/auth';
import { AuthRequest } from '../../types';
import { redis } from '../../redis/client';

const router = Router({ mergeParams: true }); // inherits :appId

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function getOwnedApp(appId: string, userId: string) {
  const { rows } = await query(
    'SELECT * FROM developer_applications WHERE id = $1 AND owner_id = $2',
    [appId, userId]
  );
  return rows[0] || null;
}

// POST /api/developer/applications/:appId/bot — create bot user for this app
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const app = await getOwnedApp(req.params.appId, req.user!.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.bot_user_id) return res.status(409).json({ error: 'Bot already exists for this application' });

    // Create bot user (username = sanitized app name + short hex suffix for uniqueness)
    const baseName = app.name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'bot';
    const suffix = crypto.randomBytes(3).toString('hex');
    const uniqueUsername = `${baseName}_${suffix}`;

    const dummyEmail = `bot_${app.id}@bots.cordyn.internal`;
    const dummyHash = await (await import('bcryptjs')).hash(crypto.randomBytes(32).toString('hex'), 8);

    const { rows: [botUser] } = await query(
      `INSERT INTO users (username, email, password_hash, is_bot, custom_status)
       VALUES ($1, $2, $3, TRUE, $4) RETURNING id, username, avatar_url, is_bot`,
      [uniqueUsername, dummyEmail, dummyHash, `Bot for ${app.name}`]
    );

    await query(
      'UPDATE developer_applications SET bot_user_id = $1, updated_at = NOW() WHERE id = $2',
      [botUser.id, app.id]
    );

    res.status(201).json({ bot: botUser });
  } catch (err) {
    console.error('POST bot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/developer/applications/:appId/bot
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const app = await getOwnedApp(req.params.appId, req.user!.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (!app.bot_user_id) return res.status(404).json({ error: 'No bot for this application' });

    // Remove bot from all servers
    await query('DELETE FROM server_members WHERE user_id = $1', [app.bot_user_id]);
    await query('DELETE FROM member_roles WHERE user_id = $1', [app.bot_user_id]);
    await query('DELETE FROM bot_tokens WHERE bot_user_id = $1', [app.bot_user_id]);
    await query('UPDATE developer_applications SET bot_user_id = NULL, updated_at = NOW() WHERE id = $1', [app.id]);
    await query('DELETE FROM users WHERE id = $1 AND is_bot = TRUE', [app.bot_user_id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/developer/applications/:appId/bot/token — generate/regenerate bot token
router.post('/token', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const app = await getOwnedApp(req.params.appId, req.user!.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (!app.bot_user_id) return res.status(400).json({ error: 'Create a bot first' });

    // Revoke existing token
    const { rows: oldTokens } = await query(
      'SELECT token_hash FROM bot_tokens WHERE application_id = $1 AND revoked_at IS NULL',
      [app.id]
    );
    if (oldTokens.length) {
      await query('UPDATE bot_tokens SET revoked_at = NOW() WHERE application_id = $1', [app.id]);
      // Invalidate Redis cache
      for (const t of oldTokens) {
        await redis.del(`bot:token:${t.token_hash.slice(0, 16)}`).catch(() => {});
      }
    }

    // Generate new token: base64url(appId[0:8]).randomBytes(32).hex
    const rawToken = `${Buffer.from(app.id.replace(/-/g, '').slice(0, 8)).toString('base64url')}.${crypto.randomBytes(32).toString('hex')}`;
    const hash = sha256(rawToken);
    const prefix = hash.slice(0, 16);

    await query(
      `INSERT INTO bot_tokens (application_id, bot_user_id, token_hash, token_prefix)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (application_id) DO UPDATE SET token_hash = $3, token_prefix = $4, created_at = NOW(), revoked_at = NULL, last_used_at = NULL`,
      [app.id, app.bot_user_id, hash, prefix]
    );

    res.json({ token: rawToken }); // shown only once!
  } catch (err) {
    console.error('POST bot/token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/developer/applications/:appId/bot/invite-url
router.get('/invite-url', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const app = await getOwnedApp(req.params.appId, req.user!.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (!app.bot_user_id) return res.status(400).json({ error: 'Create a bot first' });

    const baseUrl = process.env.FRONTEND_URL || 'https://cordyn.pl';
    const inviteUrl = `${baseUrl}/invite?client_id=${app.client_id}&scope=bot`;

    res.json({ invite_url: inviteUrl, client_id: app.client_id });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/developer/applications/:appId/bot/servers — list servers where bot is installed
router.get('/servers', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const app = await getOwnedApp(req.params.appId, req.user!.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const { rows } = await query(
      `SELECT bsi.server_id, bsi.installed_at, bsi.granted_scopes, s.name, s.icon_url,
              (SELECT COUNT(*) FROM server_members sm WHERE sm.server_id = s.id)::int AS member_count
       FROM bot_server_installations bsi
       JOIN servers s ON s.id = bsi.server_id
       WHERE bsi.application_id = $1`,
      [app.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
