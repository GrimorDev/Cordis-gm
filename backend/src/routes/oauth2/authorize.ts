import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../../db/pool';
import { authMiddleware } from '../../middleware/auth';
import { AuthRequest } from '../../types';

const router = Router();

const VALID_SCOPES = ['identify', 'email', 'guilds', 'guilds.members.read', 'messages.read', 'messages.send', 'messages.history', 'reactions', 'bot', 'webhook.incoming'];

// GET /api/oauth2/authorize — validate and return app info for consent UI
router.get('/', async (req: Request, res: Response) => {
  const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query as Record<string, string>;

  if (response_type !== 'code') return res.status(400).json({ error: 'unsupported_response_type' });
  if (!client_id || !redirect_uri) return res.status(400).json({ error: 'invalid_request' });

  const { rows } = await query(
    'SELECT id, name, description, icon_url, redirect_uris, is_public, is_verified FROM developer_applications WHERE client_id = $1',
    [client_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Application not found' });
  const app = rows[0];

  // Validate redirect_uri
  if (!app.redirect_uris.includes(redirect_uri) && redirect_uri !== 'urn:ietf:wg:oauth:2.0:oob') {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }

  const requestedScopes = (scope || 'identify').split(/[\s+,]/).filter(s => VALID_SCOPES.includes(s));

  res.json({
    app: { id: app.id, name: app.name, description: app.description, icon_url: app.icon_url, is_verified: app.is_verified },
    scopes: requestedScopes,
    state,
    redirect_uri,
    code_challenge,
    code_challenge_method,
  });
});

// POST /api/oauth2/authorize — user approves → issue code → redirect
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, redirect_uri, scopes, state, code_challenge, code_challenge_method } = req.body;

    const { rows } = await query(
      'SELECT id, redirect_uris FROM developer_applications WHERE client_id = $1',
      [client_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = rows[0];

    if (!app.redirect_uris.includes(redirect_uri) && redirect_uri !== 'urn:ietf:wg:oauth:2.0:oob') {
      return res.status(400).json({ error: 'invalid_redirect_uri' });
    }

    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await query(
      `INSERT INTO oauth2_authorization_codes
         (code, application_id, user_id, scopes, redirect_uri, code_challenge, code_challenge_method, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [code, app.id, req.user!.id, scopes || ['identify'], redirect_uri, code_challenge || null, code_challenge_method || null, expiresAt]
    );

    const redirectUrl = redirect_uri === 'urn:ietf:wg:oauth:2.0:oob'
      ? null
      : `${redirect_uri}?code=${code}${state ? `&state=${encodeURIComponent(state)}` : ''}`;

    res.json({ code, redirect_url: redirectUrl });
  } catch (err) {
    console.error('POST /oauth2/authorize error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
