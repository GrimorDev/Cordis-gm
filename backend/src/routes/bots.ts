import { Router, Response } from 'express';
import { PassThrough } from 'stream';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { query } from '../db/pool';

const router = Router({ mergeParams: true });

// ── Helper: check if user is member of server ──────────────────────────────
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
  thumbnail?: string;
  duration?: number;
  channel_id: string;
  stream_url?: string;
  requested_by?: string;
  queue: { title: string; url: string; duration?: number }[];
  // For streaming
  _stream?: PassThrough;
  _ytUrl?: string;
}

// channelId → state
export const musicStates = new Map<string, MusicBotState>();

// GET /api/servers/:serverId/bots — list installed bots
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

// POST /api/servers/:serverId/bots — install bot
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

// DELETE /api/servers/:serverId/bots/:botId — remove bot
router.delete('/:botId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId, botId } = req.params;
    if (!(await canManage(serverId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await query(
      'DELETE FROM server_bots WHERE server_id=$1 AND bot_id=$2',
      [serverId, botId]
    );
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/servers/:serverId/bots/music/stream/:channelId — stream music audio
router.get('/music/stream/:channelId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId, channelId } = req.params;
    if (!(await isMember(serverId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const state = musicStates.get(channelId);
    if (!state || !state._stream) {
      return res.status(404).json({ error: 'No active stream for this channel' });
    }
    res.setHeader('Content-Type', 'audio/webm; codecs=opus');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const pt = state._stream;
    pt.pipe(res, { end: false });

    req.on('close', () => {
      try { pt.unpipe(res); } catch { /* ignore */ }
    });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
