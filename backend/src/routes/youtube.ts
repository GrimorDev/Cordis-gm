import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { redis } from '../redis/client';

const router = Router();

const CLIENT_ID     = (process.env.YOUTUBE_CLIENT_ID     || '').trim();
const CLIENT_SECRET = (process.env.YOUTUBE_CLIENT_SECRET || '').trim();
const REDIRECT_URI  = (process.env.YOUTUBE_REDIRECT_URI  || 'http://localhost:4000/api/auth/youtube/callback').trim();
const FRONTEND_URL  = (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0]).trim();

console.log('[YouTube] CLIENT_ID configured:', !!CLIENT_ID);
console.log('[YouTube] REDIRECT_URI =', JSON.stringify(REDIRECT_URI));

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

// ── Fetch channel info using user's access token ──────────────────────
async function fetchChannelInfo(accessToken: string): Promise<{
  channel_id: string;
  display_name: string;
  channel_banner: string | null;
  subscriber_count: number;
  latest_video_id: string | null;
  latest_video_title: string | null;
  latest_video_thumb: string | null;
  is_live: boolean;
  live_title: string | null;
  live_viewers: number;
} | null> {
  try {
    const r = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!r.ok) {
      console.error('[YouTube] channels API error:', r.status, await r.text().catch(() => ''));
      return null;
    }
    const data: any = await r.json();
    const ch = data?.items?.[0];
    if (!ch) return null;

    const channelId   = ch.id as string;
    const displayName = (ch.snippet?.title || '') as string;
    const banner      = (ch.brandingSettings?.image?.bannerExternalUrl || null) as string | null;
    const subs        = parseInt(ch.statistics?.subscriberCount || '0', 10);

    let latestVideoId: string | null = null;
    let latestVideoTitle: string | null = null;
    let latestVideoThumb: string | null = null;
    let isLive = false;
    let liveTitle: string | null = null;

    // Check live status
    try {
      const liveR = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&maxResults=1`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) }
      );
      if (liveR.ok) {
        const liveData: any = await liveR.json();
        if (liveData?.items?.[0]) {
          isLive = true;
          liveTitle = liveData.items[0].snippet?.title || null;
        }
      }
    } catch { /* non-fatal */ }

    // Latest video
    try {
      const vidR = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) }
      );
      if (vidR.ok) {
        const vidData: any = await vidR.json();
        const vid = vidData?.items?.[0];
        if (vid) {
          latestVideoId    = vid.id?.videoId || null;
          latestVideoTitle = vid.snippet?.title || null;
          latestVideoThumb = vid.snippet?.thumbnails?.medium?.url
                          || vid.snippet?.thumbnails?.default?.url || null;
        }
      }
    } catch { /* non-fatal */ }

    return { channel_id: channelId, display_name: displayName, channel_banner: banner,
             subscriber_count: subs, latest_video_id: latestVideoId,
             latest_video_title: latestVideoTitle, latest_video_thumb: latestVideoThumb,
             is_live: isLive, live_title: liveTitle, live_viewers: 0 };
  } catch (e) {
    console.error('[YouTube] fetchChannelInfo error:', e);
    return null;
  }
}

// ── Token refresh ─────────────────────────────────────────────────────
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT youtube_access_token, youtube_refresh_token, youtube_token_expires FROM users WHERE id=$1`, [userId]
  );
  if (!rows[0]?.youtube_access_token) return null;
  const expiry = rows[0].youtube_token_expires ? new Date(rows[0].youtube_token_expires) : null;
  if (!expiry || expiry > new Date(Date.now() + 60_000)) return rows[0].youtube_access_token;

  if (!rows[0].youtube_refresh_token) return null;
  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: rows[0].youtube_refresh_token,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) return null;
    const data: any = await r.json();
    const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    await query(
      `UPDATE users SET youtube_access_token=$1, youtube_token_expires=$2 WHERE id=$3`,
      [data.access_token, newExpiry, userId]
    );
    return data.access_token;
  } catch { return null; }
}

// GET /api/youtube/connect — returns Google OAuth URL (auth required)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'YouTube nie skonfigurowane' });
  const nonce = crypto.randomBytes(16).toString('hex');
  await redis.setex(`oauth:state:youtube:${nonce}`, 600, req.user!.id);
  const state = `${req.user!.id}:${nonce}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         SCOPES,
    state,
    access_type:   'offline',
    prompt:        'consent',
  });
  return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// GET /api/youtube/callback — OAuth callback (no auth)
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) return res.redirect(`${FRONTEND_URL}?youtube=error`);

  const [userId, nonce] = state.split(':');
  if (!userId || !nonce) return res.redirect(`${FRONTEND_URL}?youtube=error`);
  const storedUid = await redis.get(`oauth:state:youtube:${nonce}`);
  if (!storedUid || storedUid !== userId) return res.redirect(`${FRONTEND_URL}?youtube=error`);
  await redis.del(`oauth:state:youtube:${nonce}`);

  try {
    const body = new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[YouTube] token exchange failed:', r.status, errText.slice(0, 400));
      return res.redirect(`${FRONTEND_URL}?youtube=error`);
    }
    const tokens: any = await r.json();
    const expiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    // Fetch YouTube channel
    const ch = await fetchChannelInfo(tokens.access_token);

    await query(
      `UPDATE users SET
         youtube_access_token=$1, youtube_refresh_token=$2, youtube_token_expires=$3,
         youtube_channel_id=$4, youtube_display_name=$5, youtube_channel_banner=$6,
         youtube_subscriber_count=$7, youtube_latest_video_id=$8, youtube_latest_video_title=$9,
         youtube_latest_video_thumb=$10, youtube_is_live=$11, youtube_live_title=$12,
         youtube_live_viewers=$13, youtube_show_on_profile=TRUE
       WHERE id=$14`,
      [
        tokens.access_token, tokens.refresh_token || null, expiry,
        ch?.channel_id || null, ch?.display_name || null, ch?.channel_banner || null,
        ch?.subscriber_count || 0, ch?.latest_video_id || null, ch?.latest_video_title || null,
        ch?.latest_video_thumb || null, ch?.is_live || false, ch?.live_title || null,
        ch?.live_viewers || 0, userId,
      ]
    );
    return res.redirect(`${FRONTEND_URL}?youtube=connected`);
  } catch (e) {
    console.error('[YouTube] callback error:', e);
    return res.redirect(`${FRONTEND_URL}?youtube=error`);
  }
});

// GET /api/youtube/status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT youtube_channel_id, youtube_display_name, youtube_channel_banner,
              youtube_subscriber_count, youtube_latest_video_id, youtube_latest_video_title,
              youtube_latest_video_thumb, youtube_is_live, youtube_live_title,
              youtube_live_viewers, youtube_show_on_profile
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    return res.json({
      connected:          !!row?.youtube_channel_id,
      show_on_profile:    row?.youtube_show_on_profile !== false,
      channel_id:         row?.youtube_channel_id    || null,
      display_name:       row?.youtube_display_name  || null,
      channel_banner:     row?.youtube_channel_banner || null,
      subscriber_count:   row?.youtube_subscriber_count ?? 0,
      latest_video_id:    row?.youtube_latest_video_id || null,
      latest_video_title: row?.youtube_latest_video_title || null,
      latest_video_thumb: row?.youtube_latest_video_thumb || null,
      is_live:            row?.youtube_is_live ?? false,
      live_title:         row?.youtube_live_title || null,
      live_viewers:       row?.youtube_live_viewers ?? 0,
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/youtube/user/:userId
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT youtube_channel_id, youtube_display_name, youtube_channel_banner,
              youtube_subscriber_count, youtube_latest_video_id, youtube_latest_video_title,
              youtube_latest_video_thumb, youtube_is_live, youtube_live_title,
              youtube_live_viewers, youtube_show_on_profile
       FROM users WHERE id=$1`, [req.params.userId]
    );
    const row = rows[0];
    if (!row?.youtube_channel_id) return res.json({ connected: false, show_on_profile: false });
    if (!row.youtube_show_on_profile) return res.json({ connected: true, show_on_profile: false });
    return res.json({
      connected: true, show_on_profile: true,
      channel_id:         row.youtube_channel_id    || null,
      display_name:       row.youtube_display_name  || null,
      channel_banner:     row.youtube_channel_banner || null,
      subscriber_count:   row.youtube_subscriber_count ?? 0,
      latest_video_id:    row.youtube_latest_video_id || null,
      latest_video_title: row.youtube_latest_video_title || null,
      latest_video_thumb: row.youtube_latest_video_thumb || null,
      is_live:            row.youtube_is_live ?? false,
      live_title:         row.youtube_live_title || null,
      live_viewers:       row.youtube_live_viewers ?? 0,
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/youtube/settings
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET youtube_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/youtube/disconnect
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET youtube_access_token=NULL, youtube_refresh_token=NULL, youtube_token_expires=NULL,
         youtube_channel_id=NULL, youtube_display_name=NULL, youtube_channel_banner=NULL,
         youtube_subscriber_count=0, youtube_latest_video_id=NULL, youtube_latest_video_title=NULL,
         youtube_latest_video_thumb=NULL, youtube_is_live=FALSE, youtube_live_title=NULL, youtube_live_viewers=0
       WHERE id=$1`, [req.user!.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
