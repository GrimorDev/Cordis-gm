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

// ── PKCE helpers ──────────────────────────────────────────────────────
function generatePKCE() {
  const verifier  = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

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
    // Kick public API v1 — get authenticated user
    const r = await fetch('https://api.kick.com/public/v1/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      console.error('[Kick] users API error:', r.status, await r.text().catch(() => ''));
      return null;
    }
    const data: any = await r.json();
    // API may return { data: {...} } or { data: [{...}] } depending on version
    const u = Array.isArray(data?.data) ? data.data[0] : data?.data;
    console.log('[Kick] users API response data:', JSON.stringify(u)?.slice(0, 200));
    const username    = (u?.slug || u?.name || null) as string | null;
    const displayName = (u?.name || username  || null) as string | null;
    const profilePic  = (u?.profile_picture   || null) as string | null;
    if (!username) return null;

    // Fetch channel live status
    let isLive = false, liveTitle: string | null = null, liveViewers = 0, liveCategory: string | null = null;
    try {
      const chR = await fetch(`https://api.kick.com/public/v1/channels?broadcaster_user_id=${u?.user_id}`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (chR.ok) {
        const chData: any = await chR.json();
        const ch = chData?.data?.[0];
        if (ch?.livestream) {
          isLive       = true;
          liveTitle    = ch.livestream.session_title || null;
          liveViewers  = ch.livestream.viewers       || 0;
          liveCategory = ch.livestream.category?.name || null;
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

// GET /api/kick/connect — returns Kick OAuth URL with PKCE (auth required)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'Kick nie skonfigurowane' });

  const { verifier, challenge } = generatePKCE();
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = `${req.user!.id}:${nonce}`;

  // Store verifier + userId in Redis for callback verification
  await redis.setex(`oauth:state:kick:${nonce}`, 600, JSON.stringify({ userId: req.user!.id, verifier }));

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          REDIRECT_URI,
    scope:                 'user:read channel:read',
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });
  return res.json({ url: `https://id.kick.com/oauth/authorize?${params}` });
});

// GET /api/kick/callback — OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) return res.redirect(`${FRONTEND_URL}?kick=error`);

  // state = "<userId>:<nonce>" — userId is UUID (has dashes, no colons), nonce is hex
  const colonIdx = state.indexOf(':');
  if (colonIdx < 0) return res.redirect(`${FRONTEND_URL}?kick=error`);
  const userId = state.slice(0, colonIdx);
  const nonce  = state.slice(colonIdx + 1);
  if (!userId || !nonce) return res.redirect(`${FRONTEND_URL}?kick=error`);

  const stored = await redis.get(`oauth:state:kick:${nonce}`);
  if (!stored) return res.redirect(`${FRONTEND_URL}?kick=error`);
  const { userId: storedUid, verifier } = JSON.parse(stored);
  if (storedUid !== userId) return res.redirect(`${FRONTEND_URL}?kick=error`);
  await redis.del(`oauth:state:kick:${nonce}`);

  try {
    // Try JSON body first (Kick OAuth 2.1 / PKCE), fall back to form-encoded
    let tokens: any = null;
    for (const [ct, body] of [
      ['application/json', JSON.stringify({
        grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, code, code_verifier: verifier,
      })],
      ['application/x-www-form-urlencoded', new URLSearchParams({
        grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI, code, code_verifier: verifier,
      }).toString()],
    ] as [string, string][]) {
      const r = await fetch('https://id.kick.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': ct, Accept: 'application/json' }, body,
      });
      const txt = await r.text();
      console.log(`[Kick] token exchange (${ct}) status=${r.status} body=${txt.slice(0,300)}`);
      if (r.ok) { try { tokens = JSON.parse(txt); } catch { /* not JSON */ } break; }
    }
    if (!tokens?.access_token) {
      console.error('[Kick] token exchange: no access_token after both attempts');
      return res.redirect(`${FRONTEND_URL}?kick=error`);
    }

    // Save token first so user is "connected" even if channel fetch fails
    await query(
      `UPDATE users SET kick_access_token=$1, kick_show_on_profile=TRUE WHERE id=$2`,
      [tokens.access_token, userId]
    );

    const ch = await fetchKickChannel(tokens.access_token);
    if (ch) {
      await query(
        `UPDATE users SET
           kick_username=$1, kick_display_name=$2, kick_profile_pic=$3,
           kick_is_live=$4, kick_live_title=$5, kick_live_viewers=$6,
           kick_live_category=$7
         WHERE id=$8`,
        [ch.username, ch.display_name, ch.profile_pic,
         ch.is_live, ch.live_title, ch.live_viewers, ch.live_category, userId]
      );
    }
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
      `SELECT kick_access_token, kick_username, kick_display_name, kick_profile_pic, kick_is_live,
              kick_live_title, kick_live_viewers, kick_live_category, kick_show_on_profile
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    const hasToken = !!row?.kick_access_token;

    // Token exists but channel info missing — retry fetching from Kick API
    if (hasToken && !row?.kick_username) {
      const ch = await fetchKickChannel(row.kick_access_token);
      if (ch) {
        await query(
          `UPDATE users SET kick_username=$1, kick_display_name=$2, kick_profile_pic=$3,
             kick_is_live=$4, kick_live_title=$5, kick_live_viewers=$6, kick_live_category=$7
           WHERE id=$8`,
          [ch.username, ch.display_name, ch.profile_pic,
           ch.is_live, ch.live_title, ch.live_viewers, ch.live_category, req.user!.id]
        );
        return res.json({
          connected: true,
          show_on_profile: row?.kick_show_on_profile !== false,
          username: ch.username, display_name: ch.display_name,
          profile_pic: ch.profile_pic, is_live: ch.is_live,
          live_title: ch.live_title, live_viewers: ch.live_viewers, live_category: ch.live_category,
        });
      }
      // Token exists but Kick API failed — still show connected with no channel info
      return res.json({
        connected: true,
        show_on_profile: row?.kick_show_on_profile !== false,
        username: null, display_name: 'Kick (brak danych kanału)',
        profile_pic: null, is_live: false,
        live_title: null, live_viewers: 0, live_category: null,
      });
    }

    return res.json({
      connected:     hasToken,
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
      `UPDATE users SET kick_access_token=NULL, kick_username=NULL, kick_display_name=NULL,
         kick_profile_pic=NULL, kick_is_live=FALSE, kick_live_title=NULL,
         kick_live_viewers=0, kick_live_category=NULL
       WHERE id=$1`, [req.user!.id]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
