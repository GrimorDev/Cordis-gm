import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { query } from '../db/pool';

const router = Router({ mergeParams: true });

async function isMember(serverId: string, userId: string): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM server_members WHERE server_id=$1 AND user_id=$2',
    [serverId, userId]
  );
  return rows.length > 0;
}

async function canManage(serverId: string, userId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM server_members WHERE server_id=$1 AND user_id=$2
     AND role_name IN ('Owner','Admin','Moderator')`,
    [serverId, userId]
  );
  return rows.length > 0;
}

// ── Music bot in-memory state ──────────────────────────────────────────────
export interface MusicBotState {
  playing: boolean;
  title?: string;
  url?: string;
  directUrl?: string;     // Direct CDN audio URL from yt-dlp (for server proxy streaming)
  videoId?: string;     // YouTube video ID for client-side iframe embed
  thumbnail?: string;
  duration?: number;
  channel_id: string;
  started_at?: number;  // Unix ms — used by clients to seek to current position
  requested_by?: string;
  queue: { title: string; url: string; duration?: number }[];
}

export const musicStates = new Map<string, MusicBotState>();

// GET /api/servers/:serverId/bots
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    if (!(await isMember(serverId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { rows } = await query(
      `SELECT bot_id, server_id, channel_id, installed_by, installed_at
       FROM server_bots WHERE server_id=$1`,
      [serverId]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/servers/:serverId/bots
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    const { bot_id, channel_id } = req.body;
    if (!bot_id) return res.status(400).json({ error: 'bot_id required' });
    if (!(await canManage(serverId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden — manage_server required' });
    }
    const { rows } = await query(
      `INSERT INTO server_bots (server_id, bot_id, channel_id, installed_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (server_id, bot_id) DO UPDATE SET channel_id=EXCLUDED.channel_id
       RETURNING *`,
      [serverId, bot_id, channel_id || null, req.user!.id]
    );
    return res.json(rows[0]);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/servers/:serverId/bots/:botId
router.delete('/:botId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId, botId } = req.params;
    if (!(await canManage(serverId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await query('DELETE FROM server_bots WHERE server_id=$1 AND bot_id=$2', [serverId, botId]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/servers/:serverId/bots/settings — returns bot settings (bot_channel_id)
router.get('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    if (!(await isMember(serverId, req.user!.id))) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await query('SELECT bot_channel_id FROM servers WHERE id=$1', [serverId]);
    return res.json({ bot_channel_id: rows[0]?.bot_channel_id ?? null });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/servers/:serverId/bots/settings — update bot_channel_id (admin/owner only)
router.put('/settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    if (!(await canManage(serverId, req.user!.id))) return res.status(403).json({ error: 'Forbidden' });
    const { bot_channel_id } = req.body;
    await query(
      'UPDATE servers SET bot_channel_id = $1 WHERE id = $2',
      [bot_channel_id || null, serverId]
    );
    return res.json({ bot_channel_id: bot_channel_id || null });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
