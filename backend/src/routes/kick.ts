import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { redis } from '../redis/client';

const router = Router();

const CLIENT_ID     = (process.env.KICK_CLIENT_ID     || '').trim();
const CLIENT_SECRET = (process.env.KICK_CLIENT_SECRET || '').trim();
const REDIRECT_URI  = (process.env.KICK_REDIRECT_URI  || 'http://localhost:4000/api/kick/callback').trim();
const FRONTEND_URL  = (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0]).trim();

console.log('[Kick] CLIENT_ID configured:', !!CLIENT_ID);
console.log('[Kick] REDIRECT_URI =', JSON.stringify(REDIRECT_URI));

// ── Fetch Kick channel info using access token ────────────────────────
async function fetchKickChannel(accessToken: string): Promise<{
  username: string;
  display_name: string;
  profile_pic: string | null;
  is_live: boolean;
  live_title: string | null;
  live_viewers: number;
  live_category: string | null;
} | null> {
  try {
    // Get authenticated user info
    const r = await fetch('https://kick.com/api/v2/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'Cordyn/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error('[Kick] user API error:', r.status);
      return null;
    }
    const data: any = await r.json();
    const username    = (data?.username || data?.slug || null) as string | null;
    const displayName = (data?.name || username || null) as string | null;
    const profilePic  = (data?.profile_pic || null) as string | null;
    if (!username) return null;

    // Fetch channel live status via public API
    let isLive = false, liveTitle: string | null = null, liveViewers = 0, liveCategory: string | null = null;
    try {
      const chR = await fetch(`https://kick.com/api/v2/channels/${username}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Cordyn/1.0' },
        signal: AbortSignal.timeout(6000),
      });
      if (chR.ok) {
        const ch: any = await chR.json();
        const ls = ch?.livestream;
        if (ls) {
          isLive       = true;
          liveTitle    = ls.session_title || null;
          liveViewers  = ls.viewers       || 0;
          liveCategory = ls.categories?.[0]?.name || ls.category?.name || null;
        }
      }
    } catch { /* non-fatal */ }

    return { username, display_name: displayName!, profile_pic: profilePic,
             is_live: isLive, live_title: liveTitle, live_viewers: liveViewers, live_category: liveCategory };
  } catch (e) {
    console.error('[Kick] fetchKickChannel error:', e);
    return null;
  }
}

// GET /api/kick/connect — returns Kick OAuth URL (auth required)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'Kick nie skonfigurowane' });
  const nonce = crypto.randomBytes(16).toString('hex');
  await redis.setex(`oauth:state:kick:${nonce}`, 600, req.user!.id);
  const state = `${req.user!.id}:${nonce}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         'user:read channel:read',
    state,
  });
  return res.json({ url: `https://id.kick.com/oauth2/authorize?${params}` });
});

// GET /api/kick/callback — OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) return res.redirect(`${FRONTEND_URL}?kick=error`);

  const [userId, nonce] = state.split(':');
  if (!userId || !nonce) return res.redirect(`${FRONTEND_URL}?kick=error`);
  const storedUid = await redis.get(`oauth:state:kick:${nonce}`);
  if (!storedUid || storedUid !== userId) return res.redirect(`${FRONTEND_URL}?kick=error`);
  await redis.del(`oauth:state:kick:${nonce}`);

  try {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
    });
    const r = await fetch('https://id.kick.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!r.ok) {
      console.error('[Kick] token exchange failed:', r.status, await r.text().catch(() => ''));
      return res.redirect(`${FRONTEND_URL}?kick=error`);
    }
    const tokens: any = await r.json();
    const ch = await fetchKickChannel(tokens.access_token);

    await query(
      `UPDATE users SET
         kick_username=$1, kick_display_name=$2, kick_profile_pic=$3,
         kick_is_live=$4, kick_live_title=$5, kick_live_viewers=$6,
         kick_live_category=$7, kick_show_on_profile=TRUE
       WHERE id=$8`,
      [
        ch?.username || null, ch?.display_name || null, ch?.profile_pic || null,
        ch?.is_live || false, ch?.live_title || null, ch?.live_viewers || 0,
        ch?.live_category || null, userId,
      ]
    );
    return res.redirect(`${FRONTEND_URL}?kick=connected`);
  } catch (e) {
    console.error('[Kick] callback error:', e);
    return res.redirect(`${FRONTEND_URL}?kick=error`);
  }
});

// GET /api/kick/status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT kick_username, kick_display_name, kick_profile_pic, kick_is_live,
              kick_live_title, kick_live_viewers, kick_live_category, kick_show_on_profile
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    return res.json({
      connected:     !!row?.kick_username,
      show_on_profile: row?.kick_show_on_profile !== false,
      username:      row?.kick_username      || null,
      display_name:  row?.kick_display_name  || null,
      profile_pic:   row?.kick_profile_pic   || null,
      is_live:       row?.kick_is_live       ?? false,
      live_title:    row?.kick_live_title    || null,
      live_viewers:  row?.kick_live_viewers  ?? 0,
      live_category: row?.kick_live_category || null,
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/kick/user/:userId
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT kick_username, kick_display_name, kick_profile_pic, kick_is_live,
              kick_live_title, kick_live_viewers, kick_live_category, kick_show_on_profile
       FROM users WHERE id=$1`, [req.params.userId]
    );
    const row = rows[0];
    if (!row?.kick_username) return res.json({ connected: false, show_on_profile: false });
    if (!row.kick_show_on_profile) return res.json({ connected: true, show_on_profile: false });
    return res.json({
      connected: true, show_on_profile: true,
      username:      row.kick_username      || null,
      display_name:  row.kick_display_name  || null,
      profile_pic:   row.kick_profile_pic   || null,
      is_live:       row.kick_is_live       ?? false,
      live_title:    row.kick_live_title    || null,
      live_viewers:  row.kick_live_viewers  ?? 0,
      live_category: row.kick_live_category || null,
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/kick/settings
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET kick_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/kick/disconnect
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET kick_username=NULL, kick_display_name=NULL, kick_profile_pic=NULL,
         kick_is_live=FALSE, kick_live_title=NULL, kick_live_viewers=0, kick_live_category=NULL
       WHERE id=$1`, [req.user!.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
