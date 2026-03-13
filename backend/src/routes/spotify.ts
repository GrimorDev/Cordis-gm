import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.SPOTIFY_REDIRECT_URI  || 'http://localhost:4000/api/spotify/callback';
const FRONTEND_URL  = process.env.CORS_ORIGIN           || 'http://localhost:3000';

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-top-read',
].join(' ');

// ── Token refresh helper ──────────────────────────────────────────────
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT spotify_access_token, spotify_refresh_token, spotify_token_expires
     FROM users WHERE id=$1`, [userId]
  );
  if (!rows[0]?.spotify_access_token) return null;

  const expiry = rows[0].spotify_token_expires ? new Date(rows[0].spotify_token_expires) : null;
  if (!expiry || expiry > new Date(Date.now() + 60_000)) {
    // Token still valid (>1 min remaining)
    return rows[0].spotify_access_token;
  }

  // Refresh token
  if (!rows[0].spotify_refresh_token) return null;
  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: rows[0].spotify_refresh_token,
    });
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) return null;
    const data: any = await r.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);
    await query(
      `UPDATE users SET spotify_access_token=$1, spotify_token_expires=$2 ${data.refresh_token ? ', spotify_refresh_token=$4' : ''} WHERE id=${data.refresh_token ? '$5' : '$3'}`,
      data.refresh_token
        ? [data.access_token, newExpiry, data.refresh_token, userId]
        : [data.access_token, newExpiry, userId]
    );
    return data.access_token;
  } catch {
    return null;
  }
}

// ── Helper: format a Spotify track ───────────────────────────────────
function fmtTrack(t: any, isPlaying?: boolean) {
  return {
    name:         t.name,
    artists:      t.artists?.map((a: any) => a.name).join(', ') || '',
    album_cover:  t.album?.images?.[0]?.url || null,
    preview_url:  t.preview_url || null,
    external_url: t.external_urls?.spotify || null,
    is_playing:   isPlaying,
  };
}

// GET /api/spotify/auth — start OAuth (auth required so we know who to save token for)
router.get('/auth', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'Spotify not configured' });
  const state = `${req.user!.id}:${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  REDIRECT_URI,
    state,
  });
  return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// GET /api/spotify/callback — OAuth callback (no auth middleware, uses state param for user ID)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_URL}?spotify=error`);
  }
  const userId = state.split(':')[0];
  if (!userId) return res.redirect(`${FRONTEND_URL}?spotify=error`);

  try {
    const body = new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    });
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) return res.redirect(`${FRONTEND_URL}?spotify=error`);
    const data: any = await r.json();
    const expiry = new Date(Date.now() + data.expires_in * 1000);

    // Get Spotify user info
    let spotifyUserId = null, displayName = null;
    try {
      const me = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` },
      });
      if (me.ok) {
        const meData: any = await me.json();
        spotifyUserId = meData.id;
        displayName   = meData.display_name;
      }
    } catch {}

    await query(
      `UPDATE users SET
         spotify_access_token=$1, spotify_refresh_token=$2, spotify_token_expires=$3,
         spotify_user_id=$4, spotify_display_name=$5, spotify_show_on_profile=TRUE
       WHERE id=$6`,
      [data.access_token, data.refresh_token, expiry, spotifyUserId, displayName, userId]
    );

    return res.redirect(`${FRONTEND_URL}?spotify=connected`);
  } catch {
    return res.redirect(`${FRONTEND_URL}?spotify=error`);
  }
});

// GET /api/spotify/status — own Spotify status (auth)
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT spotify_access_token, spotify_display_name, spotify_show_on_profile
       FROM users WHERE id=$1`, [req.user!.id]
    );
    return res.json({
      connected:       !!rows[0]?.spotify_access_token,
      display_name:    rows[0]?.spotify_display_name || null,
      show_on_profile: rows[0]?.spotify_show_on_profile !== false,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/spotify/now-playing — own currently playing track (auth)
router.get('/now-playing', authMiddleware, async (req: AuthRequest, res: Response) => {
  const token = await getValidAccessToken(req.user!.id);
  if (!token) return res.json({ track: null });
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (r.status === 204 || !r.ok) return res.json({ track: null });
    const data: any = await r.json();
    if (!data?.item) return res.json({ track: null });
    return res.json({ track: fmtTrack(data.item, data.is_playing) });
  } catch {
    return res.json({ track: null });
  }
});

// GET /api/spotify/top-tracks — own top tracks (auth)
router.get('/top-tracks', authMiddleware, async (req: AuthRequest, res: Response) => {
  const token = await getValidAccessToken(req.user!.id);
  if (!token) return res.json([]);
  try {
    const r = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=short_term', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!r.ok) return res.json([]);
    const data: any = await r.json();
    return res.json((data.items || []).map((t: any) => fmtTrack(t)));
  } catch {
    return res.json([]);
  }
});

// GET /api/spotify/user/:userId — public profile data (if show_on_profile=true)
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT spotify_access_token, spotify_display_name, spotify_show_on_profile
       FROM users WHERE id=$1`, [req.params.userId]
    );
    if (!rows[0]?.spotify_access_token || !rows[0]?.spotify_show_on_profile) {
      return res.json({ connected: false, show_on_profile: false, current_playing: null, top_tracks: [] });
    }

    const token = await getValidAccessToken(req.params.userId);
    if (!token) return res.json({ connected: false, show_on_profile: false, current_playing: null, top_tracks: [] });

    const [nowRes, topRes] = await Promise.allSettled([
      fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
      fetch('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=short_term', {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
    ]);

    let current_playing = null;
    if (nowRes.status === 'fulfilled' && nowRes.value.status !== 204 && nowRes.value.ok) {
      const d: any = await nowRes.value.json();
      if (d?.item) current_playing = fmtTrack(d.item, d.is_playing);
    }

    let top_tracks: any[] = [];
    if (topRes.status === 'fulfilled' && topRes.value.ok) {
      const d: any = await topRes.value.json();
      top_tracks = (d.items || []).map((t: any) => fmtTrack(t));
    }

    return res.json({
      connected:       true,
      show_on_profile: true,
      display_name:    rows[0].spotify_display_name,
      current_playing,
      top_tracks,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/spotify/settings — toggle show_on_profile (auth)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET spotify_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/spotify/disconnect — remove Spotify (auth)
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET spotify_access_token=NULL, spotify_refresh_token=NULL,
       spotify_token_expires=NULL, spotify_user_id=NULL, spotify_display_name=NULL
       WHERE id=$1`,
      [req.user!.id]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
