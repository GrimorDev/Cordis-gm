import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../../db/pool';

const router = Router();

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/oauth2/token
router.post('/', async (req: Request, res: Response) => {
  try {
    const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token, code_verifier } = req.body;

    // Validate client credentials
    const { rows: appRows } = await query(
      'SELECT * FROM developer_applications WHERE client_id = $1',
      [client_id]
    );
    if (!appRows.length) return res.status(401).json({ error: 'invalid_client' });
    const app = appRows[0];

    // Verify client_secret (unless PKCE)
    if (!code_verifier && client_secret) {
      const secretValid = await bcrypt.compare(client_secret, app.client_secret);
      if (!secretValid) return res.status(401).json({ error: 'invalid_client' });
    }

    if (grant_type === 'authorization_code') {
      if (!code || !redirect_uri) return res.status(400).json({ error: 'invalid_request' });

      const { rows: codeRows } = await query(
        `SELECT * FROM oauth2_authorization_codes
         WHERE code = $1 AND application_id = $2 AND NOT used AND expires_at > NOW()`,
        [code, app.id]
      );
      if (!codeRows.length) return res.status(400).json({ error: 'invalid_grant' });
      const authCode = codeRows[0];

      if (authCode.redirect_uri !== redirect_uri) return res.status(400).json({ error: 'invalid_grant' });

      // PKCE verification
      if (authCode.code_challenge) {
        if (!code_verifier) return res.status(400).json({ error: 'invalid_grant' });
        const challenge = authCode.code_challenge_method === 'S256'
          ? crypto.createHash('sha256').update(code_verifier).digest('base64url')
          : code_verifier;
        if (challenge !== authCode.code_challenge) return res.status(400).json({ error: 'invalid_grant' });
      }

      // Mark code as used
      await query('UPDATE oauth2_authorization_codes SET used = TRUE WHERE code = $1', [code]);

      // Issue tokens
      const rawAccess = generateOpaqueToken();
      const rawRefresh = generateOpaqueToken();
      const now = new Date();
      const accessExpires = new Date(now.getTime() + 3600 * 1000);        // 1 hour
      const refreshExpires = new Date(now.getTime() + 30 * 86400 * 1000); // 30 days

      await query(
        `INSERT INTO oauth2_tokens (application_id, user_id, access_token, refresh_token, scopes, access_expires, refresh_expires)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [app.id, authCode.user_id, sha256(rawAccess), sha256(rawRefresh), authCode.scopes, accessExpires, refreshExpires]
      );

      return res.json({
        access_token: rawAccess,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: rawRefresh,
        scope: authCode.scopes.join(' '),
      });
    }

    if (grant_type === 'refresh_token') {
      if (!refresh_token) return res.status(400).json({ error: 'invalid_request' });

      const { rows } = await query(
        `SELECT * FROM oauth2_tokens
         WHERE refresh_token = $1 AND application_id = $2 AND NOT revoked AND refresh_expires > NOW()`,
        [sha256(refresh_token), app.id]
      );
      if (!rows.length) return res.status(400).json({ error: 'invalid_grant' });
      const existing = rows[0];

      // Rotate tokens
      const rawAccess = generateOpaqueToken();
      const rawRefresh = generateOpaqueToken();
      const accessExpires = new Date(Date.now() + 3600 * 1000);
      const refreshExpires = new Date(Date.now() + 30 * 86400 * 1000);

      await query('UPDATE oauth2_tokens SET revoked = TRUE WHERE id = $1', [existing.id]);
      await query(
        `INSERT INTO oauth2_tokens (application_id, user_id, access_token, refresh_token, scopes, access_expires, refresh_expires)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [app.id, existing.user_id, sha256(rawAccess), sha256(rawRefresh), existing.scopes, accessExpires, refreshExpires]
      );

      return res.json({
        access_token: rawAccess,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: rawRefresh,
        scope: existing.scopes.join(' '),
      });
    }

    return res.status(400).json({ error: 'unsupported_grant_type' });
  } catch (err) {
    console.error('POST /oauth2/token error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/oauth2/token/revoke
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { token, token_type_hint } = req.body;
    if (!token) return res.status(400).json({ error: 'invalid_request' });
    const hash = sha256(token);
    if (token_type_hint === 'refresh_token') {
      await query('UPDATE oauth2_tokens SET revoked = TRUE WHERE refresh_token = $1', [hash]);
    } else {
      await query('UPDATE oauth2_tokens SET revoked = TRUE WHERE access_token = $1 OR refresh_token = $1', [hash]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
