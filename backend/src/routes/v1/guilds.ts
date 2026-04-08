import { Router, Request, Response } from 'express';
import { assertBotInGuild } from '../../middleware/botAuth';
import { query } from '../../db/pool';

const router = Router();

async function checkAccess(req: Request, res: Response, guildId: string): Promise<string | null> {
  const p = req.v1Principal!;
  const actorId = p.type === 'bot' ? p.botUserId : p.userId;
  const inGuild = await assertBotInGuild(actorId, guildId);
  if (!inGuild) {
    res.status(403).json({ error: 'Missing Access', code: 50001 });
    return null;
  }
  return actorId;
}

// GET /api/v1/guilds/:guildId
router.get('/:guildId', async (req: Request, res: Response) => {
  const actorId = await checkAccess(req, res, req.params.guildId);
  if (!actorId) return;
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.description, s.icon_url, s.banner_url, s.owner_id,
              (SELECT COUNT(*)::int FROM server_members WHERE server_id = s.id) AS member_count,
              (SELECT COUNT(*)::int FROM channels WHERE server_id = s.id) AS channel_count
       FROM servers s WHERE s.id = $1`,
      [req.params.guildId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Unknown Guild', code: 10004 });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/v1/guilds/:guildId/channels
router.get('/:guildId/channels', async (req: Request, res: Response) => {
  const actorId = await checkAccess(req, res, req.params.guildId);
  if (!actorId) return;
  try {
    const { rows } = await query(
      `SELECT id, name, type, description, position, is_private, category_id
       FROM channels WHERE server_id = $1 AND (is_private = FALSE)
       ORDER BY position ASC`,
      [req.params.guildId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/v1/guilds/:guildId/members — paginated
router.get('/:guildId/members', async (req: Request, res: Response) => {
  const actorId = await checkAccess(req, res, req.params.guildId);
  if (!actorId) return;
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  const after = req.query.after as string | undefined;
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.avatar_url, u.is_bot, sm.role_name, sm.joined_at
       FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = $1 ${after ? 'AND u.id > $3' : ''}
       ORDER BY u.id ASC LIMIT $2`,
      after ? [req.params.guildId, limit, after] : [req.params.guildId, limit]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/v1/guilds/:guildId/roles
router.get('/:guildId/roles', async (req: Request, res: Response) => {
  const actorId = await checkAccess(req, res, req.params.guildId);
  if (!actorId) return;
  try {
    const { rows } = await query(
      'SELECT id, name, color, permissions, position FROM server_roles WHERE server_id = $1 ORDER BY position DESC',
      [req.params.guildId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
