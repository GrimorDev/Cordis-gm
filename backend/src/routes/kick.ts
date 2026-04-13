import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// ── Fetch Kick channel data ───────────────────────────────────────────
async function fetchKickChannel(username: string): Promise<{
  display_name: string | null;
  profile_pic: string | null;
  is_live: boolean;
  live_title: string | null;
  live_viewers: number;
  live_category: string | null;
} | null> {
  try {
    const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://kick.com/',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data: any = await r.json();

    const displayName   = data?.user?.username || data?.slug || username;
    const profilePic    = data?.user?.profile_pic || null;
    const livestream    = data?.livestream;
    const isLive        = !!livestream;
    const liveTitle     = livestream?.session_title || null;
    const liveViewers   = livestream?.viewers || 0;
    const liveCategory  = livestream?.categories?.[0]?.name || null;

    return { display_name: displayName, profile_pic: profilePic, is_live: isLive, live_title: liveTitle, live_viewers: liveViewers, live_category: liveCategory };
  } catch {
    return null;
  }
}

// POST /api/kick/connect — link Kick username (auth required)
router.post('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'username is required' });
  }
  const cleanUsername = username.trim();

  try {
    const channelData = await fetchKickChannel(cleanUsername);

    await query(
      `UPDATE users SET
         kick_username=$1, kick_display_name=$2, kick_profile_pic=$3,
         kick_is_live=$4, kick_live_title=$5, kick_live_viewers=$6, kick_live_category=$7,
         kick_show_on_profile=TRUE
       WHERE id=$8`,
      [
        cleanUsername,
        channelData?.display_name || cleanUsername,
        channelData?.profile_pic  || null,
        channelData?.is_live      ?? false,
        channelData?.live_title   || null,
        channelData?.live_viewers ?? 0,
        channelData?.live_category || null,
        req.user!.id,
      ]
    );

    const { rows } = await query(
      `SELECT kick_username, kick_display_name, kick_profile_pic, kick_show_on_profile,
              kick_is_live, kick_live_title, kick_live_viewers, kick_live_category
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    return res.json({
      connected:      true,
      show_on_profile: row?.kick_show_on_profile !== false,
      username:        row?.kick_username        || null,
      display_name:    row?.kick_display_name    || null,
      profile_pic:     row?.kick_profile_pic     || null,
      is_live:         row?.kick_is_live         ?? false,
      live_title:      row?.kick_live_title      || null,
      live_viewers:    row?.kick_live_viewers    ?? 0,
      live_category:   row?.kick_live_category   || null,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/kick/status — own Kick status (auth)
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT kick_username, kick_display_name, kick_profile_pic, kick_show_on_profile,
              kick_is_live, kick_live_title, kick_live_viewers, kick_live_category
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    return res.json({
      connected:       !!row?.kick_username,
      show_on_profile: row?.kick_show_on_profile !== false,
      username:        row?.kick_username        || null,
      display_name:    row?.kick_display_name    || null,
      profile_pic:     row?.kick_profile_pic     || null,
      is_live:         row?.kick_is_live         ?? false,
      live_title:      row?.kick_live_title      || null,
      live_viewers:    row?.kick_live_viewers    ?? 0,
      live_category:   row?.kick_live_category   || null,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/kick/user/:userId — public Kick data
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT kick_username, kick_display_name, kick_profile_pic, kick_show_on_profile,
              kick_is_live, kick_live_title, kick_live_viewers, kick_live_category
       FROM users WHERE id=$1`, [req.params.userId]
    );
    const row = rows[0];
    if (!row?.kick_username) {
      return res.json({ connected: false, show_on_profile: false });
    }
    if (!row.kick_show_on_profile) {
      return res.json({ connected: true, show_on_profile: false });
    }
    return res.json({
      connected:       true,
      show_on_profile: true,
      username:        row.kick_username        || null,
      display_name:    row.kick_display_name    || null,
      profile_pic:     row.kick_profile_pic     || null,
      is_live:         row.kick_is_live         ?? false,
      live_title:      row.kick_live_title      || null,
      live_viewers:    row.kick_live_viewers    ?? 0,
      live_category:   row.kick_live_category   || null,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/kick/settings — toggle show_on_profile (auth)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET kick_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/kick/disconnect — remove Kick connection (auth)
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET
         kick_username=NULL, kick_display_name=NULL, kick_profile_pic=NULL,
         kick_is_live=FALSE, kick_live_title=NULL, kick_live_viewers=0, kick_live_category=NULL
       WHERE id=$1`,
      [req.user!.id]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
