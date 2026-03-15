import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  startSpotifyJam, endSpotifyJam, joinSpotifyJam, leaveSpotifyJam,
  getSpotifyJamMembers, getMyJamHostId,
  setVoiceDj, clearVoiceDj, getVoiceDj, getMyVoiceDjChannel,
} from '../redis/client';

const router = Router();

const CLIENT_ID     = (process.env.SPOTIFY_CLIENT_ID     || '').trim();
const CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
const REDIRECT_URI  = (process.env.SPOTIFY_REDIRECT_URI  || 'http://localhost:4000/api/spotify/callback').trim();
const FRONTEND_URL  = (process.env.CORS_ORIGIN           || 'http://localhost:3000').trim();

console.log('[Spotify] REDIRECT_URI =', JSON.stringify(REDIRECT_URI));

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-top-read',
  'user-modify-playback-state',
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
function fmtTrack(t: any, isPlaying?: boolean, progressMs?: number) {
  return {
    name:         t.name,
    artists:      t.artists?.map((a: any) => a.name).join(', ') || '',
    album_cover:  t.album?.images?.[0]?.url || null,
    preview_url:  t.preview_url || null,
    external_url: t.external_urls?.spotify || null,
    uri:          t.uri || null,
    is_playing:   isPlaying,
    progress_ms:  progressMs ?? null,
    duration_ms:  t.duration_ms ?? null,
  };
}

// GET /api/spotify/connect — authenticated endpoint that returns the Spotify OAuth URL as JSON
// (Called via Ajax with Authorization header, then frontend redirects to the URL)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'Spotify not configured' });
  const state = `${req.user!.id}:${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    scope:         SCOPES,
    redirect_uri:  REDIRECT_URI,
    state,
  });
  return res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
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
    if (!data?.item || !data.is_playing) return res.json({ track: null });
    return res.json({ track: fmtTrack(data.item, data.is_playing, data.progress_ms) });
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
      if (d?.item && d.is_playing) current_playing = fmtTrack(d.item, d.is_playing, d.progress_ms);
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

// ── Playback control (requires user-modify-playback-state + Premium) ──────────

// POST /api/spotify/playback/play — play a specific track at a position (auth)
router.post('/playback/play', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { uri, position_ms } = req.body as { uri: string; position_ms?: number };
  if (!uri) return res.status(400).json({ error: 'uri required' });
  const token = await getValidAccessToken(req.user!.id);
  if (!token) return res.status(401).json({ error: 'Spotify not connected' });
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri], position_ms: position_ms ?? 0 }),
    });
    if (r.status === 403) return res.status(403).json({ error: 'premium_required' });
    if (r.status === 404) return res.status(404).json({ error: 'no_active_device' });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/spotify/playback/volume — set volume (auth)
router.put('/playback/volume', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { volume_percent } = req.body as { volume_percent: number };
  if (typeof volume_percent !== 'number') return res.status(400).json({ error: 'volume_percent required' });
  const token = await getValidAccessToken(req.user!.id);
  if (!token) return res.status(401).json({ error: 'Spotify not connected' });
  try {
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(Math.max(0, Math.min(100, volume_percent)))}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Spotify JAM (shared listening session) ────────────────────────────────────

// POST /api/spotify/jam/start — start a JAM as host (auth)
router.post('/jam/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  const hostId = req.user!.id;
  // End any existing JAM first
  await endSpotifyJam(hostId);
  await startSpotifyJam(hostId);
  return res.json({ jam_id: hostId });
});

// POST /api/spotify/jam/join/:hostId — join someone's JAM (auth)
router.post('/jam/join/:hostId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { hostId } = req.params;
  const memberId = req.user!.id;
  if (hostId === memberId) return res.status(400).json({ error: 'Cannot join own JAM' });
  const ok = await joinSpotifyJam(hostId, memberId);
  if (!ok) return res.status(404).json({ error: 'JAM session not found' });
  return res.json({ ok: true, jam_id: hostId });
});

// DELETE /api/spotify/jam — leave or end own JAM (auth)
router.delete('/jam', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  // Check if user is a host first
  const members = await getSpotifyJamMembers(userId);
  if (members !== null) {
    await endSpotifyJam(userId);
    return res.json({ ok: true, was_host: true, notified_members: members });
  }
  // Otherwise leave as member
  const hostId = await leaveSpotifyJam(userId);
  return res.json({ ok: true, was_host: false, host_id: hostId });
});

// GET /api/spotify/jam/active — get own JAM status (auth)
router.get('/jam/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  // Am I a host?
  const myMembers = await getSpotifyJamMembers(userId);
  if (myMembers !== null) {
    return res.json({ role: 'host', jam_id: userId, members: myMembers });
  }
  // Am I a listener?
  const hostId = await getMyJamHostId(userId);
  if (hostId) {
    const members = await getSpotifyJamMembers(hostId) || [];
    // Get host info
    const { rows: [host] } = await query('SELECT id, username, avatar_url FROM users WHERE id=$1', [hostId]);
    return res.json({ role: 'listener', jam_id: hostId, host, members });
  }
  return res.json({ role: null });
});

// GET /api/spotify/jam/:hostId — get public JAM info (auth) — used to show invite details
router.get('/jam/:hostId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { hostId } = req.params;
  const members = await getSpotifyJamMembers(hostId);
  if (members === null) return res.status(404).json({ error: 'JAM not found' });
  const { rows: [host] } = await query('SELECT id, username, avatar_url FROM users WHERE id=$1', [hostId]);
  // Get member info
  const memberInfoRows = members.length > 0
    ? (await query('SELECT id, username, avatar_url FROM users WHERE id=ANY($1)', [members])).rows
    : [];
  return res.json({ jam_id: hostId, host, members: memberInfoRows });
});

// ── Voice Channel DJ ──────────────────────────────────────────────────────────

// POST /api/spotify/voice-dj/start — start DJ session in a voice channel (auth)
router.post('/voice-dj/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { channel_id } = req.body as { channel_id: string };
  if (!channel_id) return res.status(400).json({ error: 'channel_id required' });
  // Verify user is connected to Spotify
  const token = await getValidAccessToken(req.user!.id);
  if (!token) return res.status(401).json({ error: 'Spotify not connected' });
  await setVoiceDj(channel_id, req.user!.id);
  return res.json({ ok: true });
});

// DELETE /api/spotify/voice-dj — stop own DJ session (auth)
router.delete('/voice-dj', authMiddleware, async (req: AuthRequest, res: Response) => {
  const channelId = await getMyVoiceDjChannel(req.user!.id);
  if (channelId) await clearVoiceDj(channelId);
  return res.json({ ok: true, channel_id: channelId });
});

// GET /api/spotify/voice-dj/:channelId — get DJ for a channel (auth)
router.get('/voice-dj/:channelId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const djUserId = await getVoiceDj(req.params.channelId);
  if (!djUserId) return res.json({ dj: null });
  const { rows: [dj] } = await query('SELECT id, username, avatar_url FROM users WHERE id=$1', [djUserId]);
  return res.json({ dj: dj || null });
});

export default router;
