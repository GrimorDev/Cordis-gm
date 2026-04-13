import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// ── Fetch Fortnite stats from fortnite-api.com ───────────────────────
async function fetchFortniteStats(displayName: string): Promise<{
  wins: number;
  kd: number;
  matches: number;
} | null> {
  try {
    const r = await fetch(
      `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(displayName)}&accountType=epic`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    if (data?.status !== 200) return null;
    const overall = data?.data?.stats?.all?.overall;
    if (!overall) return null;
    return {
      wins:    overall.wins    || 0,
      kd:      overall.kd     || 0,
      matches: overall.matches || 0,
    };
  } catch {
    return null;
  }
}

// POST /api/epicgames/connect — link Epic display name (auth required)
router.post('/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { display_name } = req.body;
  if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
    return res.status(400).json({ error: 'display_name is required' });
  }
  const cleanName = display_name.trim();

  try {
    // Try to fetch Fortnite stats; if not found, still save the name
    const stats = await fetchFortniteStats(cleanName);

    await query(
      `UPDATE users SET
         epic_display_name=$1, epic_show_on_profile=TRUE,
         epic_fortnite_wins=$2, epic_fortnite_kd=$3, epic_fortnite_matches=$4
       WHERE id=$5`,
      [
        cleanName,
        stats?.wins    ?? 0,
        stats?.kd      ?? 0,
        stats?.matches ?? 0,
        req.user!.id,
      ]
    );

    const { rows } = await query(
      `SELECT epic_display_name, epic_show_on_profile,
              epic_fortnite_wins, epic_fortnite_kd, epic_fortnite_matches
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    return res.json({
      connected:        true,
      show_on_profile:  row?.epic_show_on_profile !== false,
      display_name:     row?.epic_display_name    || null,
      fortnite_wins:    row?.epic_fortnite_wins   ?? 0,
      fortnite_kd:      row?.epic_fortnite_kd     ?? 0,
      fortnite_matches: row?.epic_fortnite_matches ?? 0,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/epicgames/status — own Epic status (auth)
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT epic_display_name, epic_show_on_profile,
              epic_fortnite_wins, epic_fortnite_kd, epic_fortnite_matches
       FROM users WHERE id=$1`, [req.user!.id]
    );
    const row = rows[0];
    return res.json({
      connected:        !!row?.epic_display_name,
      show_on_profile:  row?.epic_show_on_profile !== false,
      display_name:     row?.epic_display_name    || null,
      fortnite_wins:    row?.epic_fortnite_wins   ?? 0,
      fortnite_kd:      row?.epic_fortnite_kd     ?? 0,
      fortnite_matches: row?.epic_fortnite_matches ?? 0,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/epicgames/user/:userId — public Epic data
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT epic_display_name, epic_show_on_profile,
              epic_fortnite_wins, epic_fortnite_kd, epic_fortnite_matches
       FROM users WHERE id=$1`, [req.params.userId]
    );
    const row = rows[0];
    if (!row?.epic_display_name) {
      return res.json({ connected: false, show_on_profile: false });
    }
    if (!row.epic_show_on_profile) {
      return res.json({ connected: true, show_on_profile: false });
    }
    return res.json({
      connected:        true,
      show_on_profile:  true,
      display_name:     row.epic_display_name    || null,
      fortnite_wins:    row.epic_fortnite_wins   ?? 0,
      fortnite_kd:      row.epic_fortnite_kd     ?? 0,
      fortnite_matches: row.epic_fortnite_matches ?? 0,
    });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/epicgames/settings — toggle show_on_profile (auth)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { show_on_profile } = req.body;
  if (typeof show_on_profile !== 'boolean') return res.status(400).json({ error: 'show_on_profile must be boolean' });
  try {
    await query(`UPDATE users SET epic_show_on_profile=$1 WHERE id=$2`, [show_on_profile, req.user!.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/epicgames/disconnect — remove Epic connection (auth)
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `UPDATE users SET
         epic_display_name=NULL, epic_fortnite_wins=0, epic_fortnite_kd=0, epic_fortnite_matches=0
       WHERE id=$1`,
      [req.user!.id]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
