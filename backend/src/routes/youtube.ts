import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const API_KEY      = (process.env.YOUTUBE_API_KEY || '').trim();

console.log('[YouTube] API_KEY configured:', !!API_KEY);

// ── Fetch channel data by @handle / URL / channel ID ─────────────────
async function fetchChannelByInput(input: string): Promise<{
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
  if (!API_KEY) return null;

  // Normalize: strip full URL, extract handle/id
  let handle = input.trim()
    .replace(/^https?:\/\/(www\.)?youtube\.com\//i, '')
    .replace(/\/.*$/, '');
  // forHandle needs the @ prefix
  const isId = handle.startsWith('UC') && handle.length > 10;
  const paramKey = isId ? 'id' : 'forHandle';
  const paramVal = isId ? handle : (handle.startsWith('@') ? handle : `@${handle}`);

  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&${paramKey}=${encodeURIComponent(paramVal)}&key=${API_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[YouTube] channels API error:', r.status, errText.slice(0, 300));
      return null;
    }
    const data: any = await r.json();
    const ch = data?.items?.[0];
    if (!ch) return null;

    const channelId   = ch.id as string;
    const displayName = (ch.snippet?.title || handle.replace(/^@/, '')) as string;
    const banner      = (ch.brandingSettings?.image?.bannerExternalUrl || null) as string | null;
    const subs        = parseInt(ch.statistics?.subscriberCount || '0', 10);

    let latestVideoId: string | null = null;
    let latestVideoTitle: string | null = null;
    let latestVideoThumb: string | null = null;
    let isLive = false;
    let liveTitle: string | null = null;

    // Check if currently live
    try {
      const liveR = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&maxResults=1&key=${API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (liveR.ok) {
        const liveData: any = await liveR.json();
        if (liveData?.items?.[0]) {
          isLive = true;
          liveTitle = liveData.items[0].snippet?.title || null;
        }
      }
    } catch { /* non-fatal */ }

    // Latest uploaded video
    try {
      const vidR = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
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
             subscriber_count: subs, latest_video_id: latestVideoId, latest_video_title: latestVideoTitle,
             latest_video_thumb: latestVideoThumb, is_live: isLive, live_title: liveTitle, live_viewers: 0 };
  } catch (e) {
    console.error('[YouTube] fetchChannel error:', e);
    return null;
  }
}

// POST /api/youtube/connect — link channel by @handle / URL (auth required, no OAuth needed)
router.post('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { channel_input } = req.body;
  if (!channel_input || typeof channel_input !== 'string' || !channel_input.trim()) {
    return res.status(400).json({ error: 'channel_input is required (np. @TwojeKanaly lub URL)' });
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'YouTube nie skonfigurowane (brak YOUTUBE_API_KEY)' });
  }

  const ch = await fetchChannelByInput(channel_input.trim());
  if (!ch) {
    return res.status(404).json({ error: 'Nie znaleziono kanału. Użyj @handle lub URL youtube.com/@NazwaKanalu' });
  }

  try {
    await query(
      `UPDATE users SET
         youtube_channel_id=$1, youtube_display_name=$2, youtube_channel_banner=$3,
         youtube_subscriber_count=$4, youtube_latest_video_id=$5, youtube_latest_video_title=$6,
         youtube_latest_video_thumb=$7, youtube_is_live=$8, youtube_live_title=$9,
         youtube_live_viewers=$10, youtube_show_on_profile=TRUE
       WHERE id=$11`,
      [ ch.channel_id, ch.display_name, ch.channel_banner, ch.subscriber_count,
        ch.latest_video_id, ch.latest_video_title, ch.latest_video_thumb,
        ch.is_live, ch.live_title, ch.live_viewers, req.user!.id ]
    );
    return res.json({ connected: true, show_on_profile: true, ...ch });
  } catch (e) {
    console.error('[YouTube] connect DB error:', e);
    return res.status(500).json({ error: 'Internal server error' });
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
      `UPDATE users SET youtube_channel_id=NULL, youtube_display_name=NULL, youtube_channel_banner=NULL,
         youtube_subscriber_count=0, youtube_latest_video_id=NULL, youtube_latest_video_title=NULL,
         youtube_latest_video_thumb=NULL, youtube_is_live=FALSE, youtube_live_title=NULL, youtube_live_viewers=0
       WHERE id=$1`, [req.user!.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
