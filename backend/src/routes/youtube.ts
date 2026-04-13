import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { redis } from '../redis/client';

const router = Router();

const CLIENT_ID     = (process.env.YOUTUBE_CLIENT_ID     || '').trim();
const CLIENT_SECRET = (process.env.YOUTUBE_CLIENT_SECRET || '').trim();
const REDIRECT_URI  = (process.env.YOUTUBE_REDIRECT_URI  || 'http://localhost:4000/api/youtube/callback').trim();
const FRONTEND_URL  = (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0]).trim();

console.log('[YouTube] REDIRECT_URI =', JSON.stringify(REDIRECT_URI));

const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

// ── Token refresh helper ──────────────────────────────────────────────
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { rows } = await query(
    `SELECT youtube_access_token, youtube_refresh_token, youtube_token_expires
     FROM users WHERE id=$1`, [userId]
  );
  if (!rows[0]?.youtube_access_token) return null;

  const expiry = rows[0].youtube_token_expires ? new Date(rows[0].youtube_token_expires) : null;
  if (!expiry || expiry > new Date(Date.now() + 60_000)) {
    return rows[0].youtube_access_token;
  }

  // Refresh token
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
    const newExpiry = new Date(Date.now() + data.expires_in * 1000);
    await query(
      `UPDATE users SET youtube_access_token=$1, youtube_token_expires=$2 WHERE id=$3`,
      [data.access_token, newExpiry, userId]
    );
    return data.access_token;
  } catch {
    return null;
  }
}

// ── Fetch channel data from YouTube Data API v3 ───────────────────────
async function fetchChannelData(accessToken: string): Promise<{
  channel_id: string | null;
  display_name: string | null;
  channel_banner: string | null;
  subscriber_count: number;
  latest_video_id: string | null;
  latest_video_title: string | null;
  latest_video_thumb: string | null;
  is_live: boolean;
  live_title: string | null;
} | null> {
  try {
    const r = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&mine=true',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    const channel = data?.items?.[0];
    if (!channel) return null;

    const channelId    = channel.id || null;
    const displayName  = channel.snippet?.title || null;
    const banner       = channel.brandingSettings?.image?.bannerExternalUrl || null;
    const subCount     = parseInt(channel.statistics?.subscriberCount || '0', 10);
    const isLive       = channel.snippet?.liveBroadcastContent === 'live';

    // Fetch latest video
    let latestVideoId    = null;
    let latestVideoTitle = null;
    let latestVideoThumb = null;
    let liveTitle        = null;

    if (channelId) {
      try {
        const vidR = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        if (vidR.ok) {
          const vidData: any = await vidR.json();
          const firstVid = vidData?.items?.[0];
          if (firstVid) {
            latestVideoId    = firstVid.id?.videoId || null;
            latestVideoTitle = firstVid.snippet?.title || null;
            latestVideoThumb = firstVid.snippet?.thumbnails?.medium?.url || firstVid.snippet?.thumbnails?.default?.url || null;
          }
          // Check for live stream
          if (isLive) {
            const liveItem = vidData?.items?.find(
              (item: any) => item.snippet?.liveBroadcastContent === 'live'
            );
            if (liveItem) liveTitle = liveItem.snippet?.title || null;
          }
        }
      } catch {}
    }

    return {
      channel_id:          channelId,
      display_name:        displayName,
      channel_banner:      banner,
      subscriber_count:    subCount,
      latest_video_id:     latestVideoId,
      latest_video_title:  latestVideoTitle,
      latest_video_thumb:  latestVideoThumb,
      is_live:             isLive,
      live_title:          liveTitle,
    };
  } catch {
    return null;
  }
}

// GET /api/youtube/connect — returns Google OAuth URL (auth required)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'YouTube not configured' });
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = `${req.user!.id}:${nonce}`;
  await redis.setex(`oauth:state:youtube:${nonce}`, 600, req.user!.id);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
    state,
  });
  return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// GET /api/youtube/callback — OAuth callback (no auth middleware)
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
    if (!r.ok) return res.redirect(`${FRONTEND_URL}?youtube=error`);
    const data: any = await r.json();
    const expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    await query(
      `UPDATE users SET
         youtube_access_token=$1, youtube_refresh_token=$2, youtube_token_expires=$3,
         youtube_show_on_profile=TRUE
       WHERE id=$4`,
      [data.access_token, data.refresh_token || null, expiry, userId]
    );

    // Fetch channel info and store it
    const channelData = await fetchChannelData(data.access_token);
    if (channelData) {
      await query(
        `UPDATE users SET
           youtube_channel_id=$1, youtube_display_name=$2, youtube_channel_banner=$3,
           youtube_subscriber_count=$4, youtube_latest_video_id=$5, youtube_latest_video_title=$6,
           youtube_latest_video_thumb=$7, youtube_is_live=$8, youtube_live_title=$9
         WHERE id=$10`,
        [
          channelData.channel_id, channelData.display_name, channelData.channel_banner,
          channelData.subscriber_count, channelData.latest_video_id, channelData.latest_video_title,
          channelData.latest_video_thumb, channelData.is_live, channelData.live_title,
          userId,
        ]
      );
    }

    return res.redirect(`${FRONTEND_URL}?youtube=connected`);
  } catch {
    return res.redirect(`${FRONTEND_URL}?youtube=error`);
  }
});

// GET /api/youtube/status — own YouTube status (auth)
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT youtube_access_token, youtube_channel_id, youtube_display_name, youtube_channel_banner,
              youtube_subscriber_count, youtube_latest_video_id, youtube_latest_video_title,
              youtube_latest_video_thumb, youtube_is_live, youtube_live_title, youtube_live_viewers,
              youtube_show_on_profile
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    const connected = !!row?.youtube_access_token;
    return res.json({
      connected,
      show_on_profile:      row?.youtube_show_on_profile !== false,
      channel_id:           row?.youtube_channel_id         || null,
      display_name:         row?.youtube_display_name       || null,
      channel_banner:       row?.youtube_channel_banner     || null,
      subscriber_count:     row?.youtube_subscriber_count   ?? null,
      latest_video_id:      row?.youtube_latest_video_id    || null,
      latest_video_title:   row?.youtube_latest_video_title || null,
      latest_video_thumb:   row?.youtube_latest_video_thumb || null,
      is_live:              row?.youtube_is_live            ?? false,
      live_title:           row?.youtube_live_title         || null,
      live_viewers:         row?.youtube_live_viewers       ?? null,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/youtube/user/:userId — public YouTube data
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT youtube_access_token, youtube_channel_id, youtube_display_name, youtube_channel_banner,
              youtube_subscriber_count, youtube_latest_video_id, youtube_latest_video_title,
              youtube_latest_video_thumb, youtube_is_live, youtube_live_title, youtube_live_viewers,
              youtube_show_on_profile
       FROM users WHERE id=$1`, [req.params.userId]
    );
    const row = rows[0];
    if (!row?.youtube_access_token) {
      return res.json({ connected: false, show_on_profile: false });
    }
    if (!row.youtube_show_on_profile) {
      return res.json({ connected: true, show_on_profile: false });
    }
    return res.json({
      connected:            true,
      show_on_profile:      true,
      channel_id:           row.youtube_channel_id         || null,
      display_name:         row.youtube_display_name       || null,
      channel_banner:       row.youtube_channel_banner     || null,
      subscriber_count:     row.youtube_subscriber_count   ?? null,
      latest_video_id:      row.youtube_latest_video_id    || null,
      latest_video_title:   row.youtube_latest_video_title || null,
      latest_video_thumb:   row.youtube_latest_video_thumb || null,
      is_live:              row.youtube_is_live            ?? false,
      live_title:           row.youtube_live_title         || null,
      live_viewers:         row.youtube_live_viewers       ?? null,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/youtube/settings — toggle show_on_profile (auth)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET youtube_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/youtube/disconnect — remove YouTube connection (auth)
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET
         youtube_access_token=NULL, youtube_refresh_token=NULL, youtube_token_expires=NULL,
         youtube_channel_id=NULL, youtube_display_name=NULL, youtube_channel_banner=NULL,
         youtube_subscriber_count=0, youtube_latest_video_id=NULL, youtube_latest_video_title=NULL,
         youtube_latest_video_thumb=NULL, youtube_is_live=FALSE, youtube_live_title=NULL,
         youtube_live_viewers=0
       WHERE id=$1`,
      [req.user!.id]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
