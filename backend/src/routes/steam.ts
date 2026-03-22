import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const STEAM_API_KEY   = (process.env.STEAM_API_KEY   || '').trim();
const REDIRECT_URI    = (process.env.STEAM_REDIRECT_URI || 'http://localhost:4000/api/steam/callback').trim();
const FRONTEND_URL    = (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0]).trim();

const OPENID_NS       = 'http://specs.openid.net/auth/2.0';
const OPENID_IDENTITY = 'http://specs.openid.net/auth/2.0/identifier_select';
const STEAM_LOGIN_URL = 'https://steamcommunity.com/openid/login';

console.log('[Steam] REDIRECT_URI =', JSON.stringify(REDIRECT_URI));

// ── Fetch player summary from Steam Web API ───────────────────────────
async function fetchPlayerSummary(steamId: string): Promise<{ display_name: string | null; avatar_url: string | null; gameid: string | null; gameextrainfo: string | null } | null> {
  if (!STEAM_API_KEY) return null;
  try {
    const r = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    const p = data?.response?.players?.[0];
    if (!p) return null;
    return {
      display_name:  p.personaname || null,
      avatar_url:    p.avatarfull  || null,
      gameid:        p.gameid       || null,
      gameextrainfo: p.gameextrainfo || null,
    };
  } catch {
    return null;
  }
}

// GET /api/steam/connect — returns Steam OpenID redirect URL (auth required)
router.get('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!STEAM_API_KEY) return res.status(503).json({ error: 'Steam not configured' });
  const state = `${req.user!.id}:${Math.random().toString(36).slice(2)}`;
  // Embed state in return_to URL — Steam preserves query params
  const returnTo = `${REDIRECT_URI}?state=${encodeURIComponent(state)}`;
  const params = new URLSearchParams({
    'openid.ns':         OPENID_NS,
    'openid.mode':       'checkid_setup',
    'openid.identity':   OPENID_IDENTITY,
    'openid.claimed_id': OPENID_IDENTITY,
    'openid.return_to':  returnTo,
    'openid.realm':      FRONTEND_URL,
  });
  return res.json({ url: `${STEAM_LOGIN_URL}?${params}` });
});

// GET /api/steam/callback — OpenID callback (no auth middleware)
router.get('/callback', async (req: Request, res: Response) => {
  const { state, 'openid.claimed_id': claimedId, 'openid.mode': mode } = req.query as Record<string, string>;

  if (mode === 'cancel' || !claimedId || !state) {
    return res.redirect(`${FRONTEND_URL}?steam=error`);
  }

  const userId = state.split(':')[0];
  if (!userId) return res.redirect(`${FRONTEND_URL}?steam=error`);

  // Verify OpenID response with Steam
  try {
    const verifyParams = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query as Record<string, string>)) {
      if (k !== 'state') verifyParams.set(k, v);
    }
    verifyParams.set('openid.mode', 'check_authentication');

    const verifyRes = await fetch(STEAM_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });
    const verifyText = await verifyRes.text();
    if (!verifyText.includes('is_valid:true')) {
      return res.redirect(`${FRONTEND_URL}?steam=error`);
    }

    // Extract Steam64 ID from claimed_id: https://steamcommunity.com/openid/id/{steamId64}
    const steamId = claimedId.replace('https://steamcommunity.com/openid/id/', '').trim();
    if (!steamId || !/^\d+$/.test(steamId)) {
      return res.redirect(`${FRONTEND_URL}?steam=error`);
    }

    // Fetch player info
    const summary = await fetchPlayerSummary(steamId);

    await query(
      `UPDATE users SET
         steam_id=$1, steam_display_name=$2, steam_avatar_url=$3, steam_show_on_profile=TRUE
       WHERE id=$4`,
      [steamId, summary?.display_name || null, summary?.avatar_url || null, userId]
    );

    return res.redirect(`${FRONTEND_URL}?steam=connected`);
  } catch {
    return res.redirect(`${FRONTEND_URL}?steam=error`);
  }
});

// GET /api/steam/status — own Steam status (auth)
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT steam_id, steam_display_name, steam_avatar_url, steam_show_on_profile
       FROM users WHERE id=$1`, [req.user!.id]
    );
    return res.json({
      connected:       !!rows[0]?.steam_id,
      display_name:    rows[0]?.steam_display_name || null,
      avatar_url:      rows[0]?.steam_avatar_url   || null,
      show_on_profile: rows[0]?.steam_show_on_profile !== false,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/steam/now-playing — own current game (auth)
router.get('/now-playing', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT steam_id FROM users WHERE id=$1`, [req.user!.id]);
    const steamId = rows[0]?.steam_id;
    if (!steamId) return res.json({ game: null });

    const summary = await fetchPlayerSummary(steamId);
    if (!summary?.gameid) return res.json({ game: null });

    return res.json({
      game: {
        name:         summary.gameextrainfo || 'Unknown Game',
        gameid:       summary.gameid,
        header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${summary.gameid}/header.jpg`,
      },
    });
  } catch {
    return res.json({ game: null });
  }
});

// GET /api/steam/user/:userId — public profile data
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT steam_id, steam_display_name, steam_avatar_url, steam_show_on_profile
       FROM users WHERE id=$1`, [req.params.userId]
    );
    if (!rows[0]?.steam_id) {
      return res.json({ connected: false, show_on_profile: false });
    }
    if (!rows[0].steam_show_on_profile) {
      return res.json({ connected: true, show_on_profile: false });
    }

    const summary = await fetchPlayerSummary(rows[0].steam_id);
    const current_game = summary?.gameid
      ? {
          name:         summary.gameextrainfo || 'Unknown Game',
          gameid:       summary.gameid,
          header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${summary.gameid}/header.jpg`,
        }
      : null;

    return res.json({
      connected:       true,
      show_on_profile: true,
      display_name:    rows[0].steam_display_name  || null,
      avatar_url:      rows[0].steam_avatar_url    || null,
      current_game,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/steam/settings — toggle show_on_profile (auth)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET steam_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/steam/disconnect — remove Steam connection (auth)
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET steam_id=NULL, steam_display_name=NULL, steam_avatar_url=NULL WHERE id=$1`,
      [req.user!.id]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
