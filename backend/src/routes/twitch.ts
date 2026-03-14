import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const CLIENT_ID     = (process.env.TWITCH_CLIENT_ID     || '').trim();
const CLIENT_SECRET = (process.env.TWITCH_CLIENT_SECRET || '').trim();
const REDIRECT_URI  = (process.env.TWITCH_REDIRECT_URI  || 'http://localhost:4000/api/twitch/callback').trim();
const FRONTEND_URL  = (process.env.CORS_ORIGIN          || 'http://localhost:3000').trim();

console.log('[Twitch] REDIRECT_URI =', JSON.stringify(REDIRECT_URI));

const SCOPES = 'user:read:email';

// ── Token refresh helper ──────────────────────────────────────────────
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT twitch_access_token, twitch_refresh_token, twitch_token_expires
     FROM users WHERE id=$1`, [userId]
  );
  if (!rows[0]?.twitch_access_token) return null;

  const expiry = rows[0].twitch_token_expires ? new Date(rows[0].twitch_token_expires) : null;
  if (!expiry || expiry > new Date(Date.now() + 60_000)) {
    return rows[0].twitch_access_token;
  }

  // Refresh token
  if (!rows[0].twitch_refresh_token) return null;
  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: rows[0].twitch_refresh_token,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    const r = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) return null;
    const data: any = await r.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);
    await query(
      `UPDATE users SET twitch_access_token=$1, twitch_token_expires=$2 WHERE id=$3`,
      [data.access_token, newExpiry, userId]
    );
    return data.access_token;
  } catch {
    return null;
  }
}

// ── Fetch Twitch stream data ──────────────────────────────────────────
async function fetchStream(twitchUserId: string, accessToken: string): Promise<{
  title: string; game_name: string; viewer_count: number; thumbnail_url: string; login: string;
} | null> {
  try {
    const r = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${twitchUserId}`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': CLIENT_ID } }
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    const stream = data?.data?.[0];
    if (!stream) return null;
    return {
      title:         stream.title || '',
      game_name:     stream.game_name || '',
      viewer_count:  stream.viewer_count || 0,
      thumbnail_url: (stream.thumbnail_url || '').replace('{width}', '320').replace('{height}', '180'),
      login:         stream.user_login || '',
    };
  } catch {
    return null;
  }
}

// GET /api/twitch/connect — returns Twitch OAuth URL (auth required)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'Twitch not configured' });
  const state = `${req.user!.id}:${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         SCOPES,
    state,
  });
  return res.json({ url: `https://id.twitch.tv/oauth2/authorize?${params}` });
});

// GET /api/twitch/callback — OAuth callback (no auth middleware)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) return res.redirect(`${FRONTEND_URL}?twitch=error`);

  const userId = state.split(':')[0];
  if (!userId) return res.redirect(`${FRONTEND_URL}?twitch=error`);

  try {
    const body = new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  REDIRECT_URI,
    });
    const r = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) return res.redirect(`${FRONTEND_URL}?twitch=error`);
    const data: any = await r.json();
    const expiry = new Date(Date.now() + data.expires_in * 1000);

    // Get Twitch user info
    let twitchUserId = null, login = null, displayName = null;
    try {
      const me = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'Client-Id': CLIENT_ID,
        },
      });
      if (me.ok) {
        const meData: any = await me.json();
        const u = meData?.data?.[0];
        if (u) {
          twitchUserId = u.id;
          login        = u.login;
          displayName  = u.display_name;
        }
      }
    } catch {}

    await query(
      `UPDATE users SET
         twitch_user_id=$1, twitch_login=$2, twitch_display_name=$3,
         twitch_access_token=$4, twitch_refresh_token=$5, twitch_token_expires=$6,
         twitch_show_on_profile=TRUE
       WHERE id=$7`,
      [twitchUserId, login, displayName, data.access_token, data.refresh_token, expiry, userId]
    );

    return res.redirect(`${FRONTEND_URL}?twitch=connected`);
  } catch {
    return res.redirect(`${FRONTEND_URL}?twitch=error`);
  }
});

// GET /api/twitch/status — own Twitch status (auth)
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT twitch_user_id, twitch_login, twitch_display_name, twitch_show_on_profile,
              twitch_access_token, twitch_token_expires
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    const connected = !!row?.twitch_access_token;

    let is_live = false;
    let stream = null;
    if (connected && row.twitch_user_id) {
      const token = await getValidAccessToken(req.user!.id);
      if (token) {
        stream = await fetchStream(row.twitch_user_id, token);
        is_live = !!stream;
      }
    }

    return res.json({
      connected,
      login:           row?.twitch_login        || null,
      display_name:    row?.twitch_display_name || null,
      show_on_profile: row?.twitch_show_on_profile !== false,
      is_live,
      stream,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/twitch/stream — own current stream (auth)
router.get('/stream', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT twitch_user_id FROM users WHERE id=$1`, [req.user!.id]);
    const twitchUserId = rows[0]?.twitch_user_id;
    if (!twitchUserId) return res.json({ stream: null });

    const token = await getValidAccessToken(req.user!.id);
    if (!token) return res.json({ stream: null });

    const stream = await fetchStream(twitchUserId, token);
    return res.json({ stream });
  } catch {
    return res.json({ stream: null });
  }
});

// GET /api/twitch/user/:userId — public profile data
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT twitch_user_id, twitch_login, twitch_display_name, twitch_show_on_profile, twitch_access_token
       FROM users WHERE id=$1`, [req.params.userId]
    );
    const row = rows[0];
    if (!row?.twitch_access_token) {
      return res.json({ connected: false, show_on_profile: false, is_live: false });
    }
    if (!row.twitch_show_on_profile) {
      return res.json({ connected: true, show_on_profile: false, is_live: false });
    }

    const token = await getValidAccessToken(req.params.userId);
    let is_live = false;
    let stream = null;
    if (token && row.twitch_user_id) {
      stream = await fetchStream(row.twitch_user_id, token);
      is_live = !!stream;
    }

    return res.json({
      connected:       true,
      show_on_profile: true,
      login:           row.twitch_login        || null,
      display_name:    row.twitch_display_name || null,
      is_live,
      stream,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/twitch/settings — toggle show_on_profile (auth)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET twitch_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/twitch/disconnect — remove Twitch connection (auth)
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET twitch_user_id=NULL, twitch_login=NULL, twitch_display_name=NULL,
       twitch_access_token=NULL, twitch_refresh_token=NULL, twitch_token_expires=NULL
       WHERE id=$1`,
      [req.user!.id]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
