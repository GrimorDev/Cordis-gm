import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router({ mergeParams: true });

const TRIGGER_TYPES = [
  'member_join', 'member_leave',
  'role_assigned', 'role_removed',
  'message_contains', 'message_sent',
  'reaction_added', 'member_banned',
] as const;

const ACTION_TYPES = [
  'assign_role', 'remove_role',
  'send_channel_message', 'send_dm',
  'delete_message', 'kick_member', 'ban_member',
  'mute_member', 'log_to_channel', 'warn_user',
  'add_reaction', 'send_webhook', 'pin_message',
] as const;

async function checkManageServerPermission(serverId: string, userId: string): Promise<boolean> {
  const { rows: memberRows } = await query(
    `SELECT sm.role_name FROM server_members sm WHERE sm.server_id = $1 AND sm.user_id = $2`,
    [serverId, userId]
  );
  if (!memberRows.length) return false;
  const roleName = memberRows[0].role_name;
  if (roleName === 'Owner' || roleName === 'Admin') return true;
  const { rows: roleRows } = await query(
    `SELECT 1 FROM member_roles mr
     JOIN server_roles sr ON sr.id = mr.role_id
     WHERE mr.server_id=$1 AND mr.user_id=$2 AND sr.permissions @> '["manage_server"]'`,
    [serverId, userId]
  );
  return roleRows.length > 0;
}

const automationValidation = [
  body('name').isString().notEmpty().trim().isLength({ max: 100 }),
  body('trigger_type').isIn(TRIGGER_TYPES),
  body('trigger_config').isObject(),
  body('actions').isArray({ min: 1 }),
  body('actions.*.type').isIn(ACTION_TYPES),
  body('actions.*.config').isObject(),
  body('conditions').optional().isArray(),
  body('cooldown_seconds').optional().isInt({ min: 0, max: 86400 }),
];

// GET /servers/:serverId/automations
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    if (!await checkManageServerPermission(serverId, req.user!.id)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const { rows } = await query(
      'SELECT * FROM server_automations WHERE server_id=$1 ORDER BY created_at ASC',
      [serverId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET automations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /servers/:serverId/automations
router.post('/', authMiddleware, ...automationValidation, async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { serverId } = req.params;
    if (!await checkManageServerPermission(serverId, req.user!.id)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const { name, trigger_type, trigger_config, actions, conditions, cooldown_seconds } = req.body;
    const { rows } = await query(
      `INSERT INTO server_automations
         (server_id, name, enabled, trigger_type, trigger_config, actions, conditions, cooldown_seconds, created_by)
       VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        serverId, name, trigger_type,
        JSON.stringify(trigger_config || {}),
        JSON.stringify(actions || []),
        JSON.stringify(conditions || []),
        cooldown_seconds || 0,
        req.user!.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST automations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /servers/:serverId/automations/:id
router.put('/:id', authMiddleware, ...automationValidation, async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { serverId, id } = req.params;
    if (!await checkManageServerPermission(serverId, req.user!.id)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const { name, trigger_type, trigger_config, actions, conditions, cooldown_seconds } = req.body;
    const { rows } = await query(
      `UPDATE server_automations
       SET name=$1, trigger_type=$2, trigger_config=$3, actions=$4, conditions=$5, cooldown_seconds=$6
       WHERE id=$7 AND server_id=$8 RETURNING *`,
      [
        name, trigger_type,
        JSON.stringify(trigger_config || {}),
        JSON.stringify(actions || []),
        JSON.stringify(conditions || []),
        cooldown_seconds || 0,
        id, serverId,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT automations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /servers/:serverId/automations/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId, id } = req.params;
    if (!await checkManageServerPermission(serverId, req.user!.id)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const { rows } = await query(
      'DELETE FROM server_automations WHERE id=$1 AND server_id=$2 RETURNING id',
      [id, serverId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE automations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /servers/:serverId/automations/:id/toggle
router.patch('/:id/toggle', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId, id } = req.params;
    if (!await checkManageServerPermission(serverId, req.user!.id)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    const { rows } = await query(
      `UPDATE server_automations SET enabled = NOT enabled WHERE id=$1 AND server_id=$2 RETURNING *`,
      [id, serverId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PATCH automations toggle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
