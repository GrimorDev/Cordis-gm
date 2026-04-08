import { Router, Response } from 'express';
import { query } from '../../db/pool';
import { authMiddleware } from '../../middleware/auth';
import { AuthRequest } from '../../types';

const router = Router();

// GET /api/oauth2/bot-invite — get app+bot info for invite page
router.get('/', async (req: any, res: Response) => {
  const { client_id } = req.query;
  if (!client_id) return res.status(400).json({ error: 'client_id required' });

  const { rows } = await query(
    `SELECT da.id, da.name, da.description, da.icon_url, da.is_public, da.is_verified,
            u.id AS bot_user_id, u.username AS bot_username, u.avatar_url AS bot_avatar
     FROM developer_applications da
     LEFT JOIN users u ON u.id = da.bot_user_id
     WHERE da.client_id = $1 AND da.bot_user_id IS NOT NULL`,
    [client_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Application not found or has no bot' });

  res.json(rows[0]);
});

// POST /api/oauth2/bot-invite/confirm — add bot to server (owner only)
router.post('/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { client_id, server_id } = req.body;
    if (!client_id || !server_id) return res.status(400).json({ error: 'client_id and server_id required' });

    // Check app
    const { rows: appRows } = await query(
      `SELECT da.id, da.bot_user_id, da.is_public, da.owner_id
       FROM developer_applications da
       WHERE da.client_id = $1 AND da.bot_user_id IS NOT NULL`,
      [client_id]
    );
    if (!appRows.length) return res.status(404).json({ error: 'Application not found or has no bot' });
    const app = appRows[0];

    // Check if app is public OR requester is the app owner
    if (!app.is_public && app.owner_id !== req.user!.id) {
      return res.status(403).json({ error: 'This application is not public' });
    }

    // Check requester is Owner or Admin of the target server
    const { rows: memberRows } = await query(
      `SELECT sm.role_name FROM server_members sm WHERE sm.server_id = $1 AND sm.user_id = $2`,
      [server_id, req.user!.id]
    );
    if (!memberRows.length) return res.status(403).json({ error: 'You are not a member of this server' });
    if (!['Owner', 'Admin'].includes(memberRows[0].role_name)) {
      return res.status(403).json({ error: 'Only server owners and admins can add bots' });
    }

    // Check bot not already in server
    const { rowCount: alreadyIn } = await query(
      'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
      [server_id, app.bot_user_id]
    );
    if (alreadyIn) return res.status(409).json({ error: 'Bot is already in this server' });

    // Add bot as server member
    await query(
      `INSERT INTO server_members (server_id, user_id, role_name) VALUES ($1, $2, 'Bot')`,
      [server_id, app.bot_user_id]
    );

    // Record installation
    await query(
      `INSERT INTO bot_server_installations (server_id, application_id, bot_user_id, installed_by, granted_scopes)
       VALUES ($1, $2, $3, $4, ARRAY['bot','messages.read','messages.send','reactions'])
       ON CONFLICT (server_id, application_id) DO NOTHING`,
      [server_id, app.id, app.bot_user_id, req.user!.id]
    );

    // Emit socket event so server member list updates
    const io = req.app.get('io');
    const { rows: [botUser] } = await query(
      'SELECT id, username, avatar_url, is_bot FROM users WHERE id = $1',
      [app.bot_user_id]
    );
    if (io && botUser) {
      io.to(`server:${server_id}`).emit('member_joined', {
        server_id,
        user: { ...botUser, role_name: 'Bot', roles: [] },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /oauth2/bot-invite/confirm error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/oauth2/bot-invite/my-servers — list user's servers for bot invite selector
router.get('/my-servers', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.icon_url, sm.role_name,
              (SELECT COUNT(*)::int FROM server_members WHERE server_id = s.id) AS member_count
       FROM server_members sm
       JOIN servers s ON s.id = sm.server_id
       WHERE sm.user_id = $1 AND sm.role_name IN ('Owner', 'Admin')
       ORDER BY s.name`,
      [req.user!.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
