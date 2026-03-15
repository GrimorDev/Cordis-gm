import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router({ mergeParams: true });

type TriggerType = 'member_join' | 'member_leave' | 'role_assigned' | 'message_contains';
type ActionType = 'assign_role' | 'remove_role' | 'send_channel_message' | 'send_dm' | 'delete_message' | 'kick_member';

interface AutomationAction {
  type: ActionType;
  config: {
    role_id?: string;
    channel_id?: string;
    message?: string;
  };
}

interface AutomationBody {
  name: string;
  trigger_type: TriggerType;
  trigger_config: {
    role_id?: string;
    keyword?: string;
  };
  actions: AutomationAction[];
}

async function checkManageServerPermission(serverId: string, userId: string): Promise<boolean> {
  // Check if member exists in server
  const { rows: memberRows } = await query(
    `SELECT sm.role_name FROM server_members sm
     WHERE sm.server_id = $1 AND sm.user_id = $2`,
    [serverId, userId]
  );

  if (memberRows.length === 0) return false;

  const roleName = memberRows[0].role_name;

  // Owner or Admin always have permission
  if (roleName === 'Owner' || roleName === 'Admin') return true;

  // Check member_roles for manage_server permission
  const { rows: roleRows } = await query(
    `SELECT mr.role_id FROM member_roles mr
     JOIN server_roles sr ON sr.id = mr.role_id
     WHERE mr.server_id = $1 AND mr.user_id = $2 AND sr.permissions @> '["manage_server"]'`,
    [serverId, userId]
  );

  return roleRows.length > 0;
}

const automationValidation = [
  body('name').isString().notEmpty().withMessage('name is required'),
  body('trigger_type')
    .isIn(['member_join', 'member_leave', 'role_assigned', 'message_contains'])
    .withMessage('Invalid trigger_type'),
  body('trigger_config').isObject().withMessage('trigger_config must be an object'),
  body('actions').isArray({ min: 1 }).withMessage('At least one action is required'),
  body('actions.*.type')
    .isIn(['assign_role', 'remove_role', 'send_channel_message', 'send_dm', 'delete_message', 'kick_member'])
    .withMessage('Invalid action type'),
  body('actions.*.config').isObject().withMessage('Each action must have a config object'),
];

// GET /servers/:serverId/automations - list automations
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.id;

    const hasPermission = await checkManageServerPermission(serverId, userId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to manage this server' });
    }

    const { rows } = await query(
      'SELECT * FROM server_automations WHERE server_id = $1 ORDER BY created_at ASC',
      [serverId]
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /servers/:serverId/automations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /servers/:serverId/automations - create automation
router.post(
  '/',
  authMiddleware,
  ...automationValidation,
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { serverId } = req.params;
      const userId = req.user!.id;

      const hasPermission = await checkManageServerPermission(serverId, userId);
      if (!hasPermission) {
        return res.status(403).json({ error: 'You do not have permission to manage this server' });
      }

      const { name, trigger_type, trigger_config, actions } = req.body as AutomationBody;

      const { rows } = await query(
        `INSERT INTO server_automations (server_id, name, enabled, trigger_type, trigger_config, actions, created_by)
         VALUES ($1, $2, true, $3, $4, $5, $6)
         RETURNING *`,
        [serverId, name, trigger_type, JSON.stringify(trigger_config), JSON.stringify(actions), userId]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('POST /servers/:serverId/automations error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /servers/:serverId/automations/:id - update automation
router.put(
  '/:id',
  authMiddleware,
  ...automationValidation,
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { serverId, id } = req.params;
      const userId = req.user!.id;

      const hasPermission = await checkManageServerPermission(serverId, userId);
      if (!hasPermission) {
        return res.status(403).json({ error: 'You do not have permission to manage this server' });
      }

      const { name, trigger_type, trigger_config, actions } = req.body as AutomationBody;

      const { rows } = await query(
        `UPDATE server_automations
         SET name = $1, trigger_type = $2, trigger_config = $3, actions = $4
         WHERE id = $5 AND server_id = $6
         RETURNING *`,
        [name, trigger_type, JSON.stringify(trigger_config), JSON.stringify(actions), id, serverId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error('PUT /servers/:serverId/automations/:id error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /servers/:serverId/automations/:id - delete automation
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId, id } = req.params;
    const userId = req.user!.id;

    const hasPermission = await checkManageServerPermission(serverId, userId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to manage this server' });
    }

    const { rows } = await query(
      'DELETE FROM server_automations WHERE id = $1 AND server_id = $2 RETURNING id',
      [id, serverId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /servers/:serverId/automations/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /servers/:serverId/automations/:id/toggle - toggle enabled
router.patch('/:id/toggle', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { serverId, id } = req.params;
    const userId = req.user!.id;

    const hasPermission = await checkManageServerPermission(serverId, userId);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to manage this server' });
    }

    const { rows } = await query(
      `UPDATE server_automations
       SET enabled = NOT enabled
       WHERE id = $1 AND server_id = $2
       RETURNING *`,
      [id, serverId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /servers/:serverId/automations/:id/toggle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
