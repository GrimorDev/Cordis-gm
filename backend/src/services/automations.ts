import { query } from '../db/pool';

type ActionType =
  | 'assign_role'
  | 'remove_role'
  | 'send_channel_message'
  | 'send_dm'
  | 'delete_message'
  | 'kick_member';

interface AutomationAction {
  type: ActionType;
  config: {
    role_id?: string;
    channel_id?: string;
    message?: string;
  };
}

interface Automation {
  id: string;
  server_id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: {
    role_id?: string;
    keyword?: string;
  };
  actions: AutomationAction[];
}

interface AutomationContext {
  userId?: string;
  messageId?: string;
  roleId?: string;
  messageContent?: string;
  io?: any;
}

export async function runAutomations(
  serverId: string,
  trigger: string,
  context: AutomationContext
): Promise<void> {
  try {
    // 1. Query enabled automations for serverId + trigger_type
    const { rows: automations } = await query(
      `SELECT * FROM server_automations
       WHERE server_id = $1 AND trigger_type = $2 AND enabled = true`,
      [serverId, trigger]
    );

    if (automations.length === 0) return;

    // Get username if userId is provided
    let username = 'Unknown';
    if (context.userId) {
      const { rows: userRows } = await query(
        'SELECT username FROM users WHERE id = $1',
        [context.userId]
      );
      if (userRows.length > 0) {
        username = userRows[0].username;
      }
    }

    for (const automation of automations as Automation[]) {
      // Filter by trigger-specific conditions before running actions
      if (!shouldRunAutomation(automation, trigger, context)) {
        continue;
      }

      // 2. Execute each action
      for (const action of automation.actions) {
        try {
          await executeAction(action, serverId, context, username);
        } catch (actionErr) {
          console.error(
            `[automations] Error executing action ${action.type} for automation ${automation.id}:`,
            actionErr
          );
        }
      }
    }
  } catch (err) {
    console.error('[automations] runAutomations error:', err);
  }
}

function shouldRunAutomation(
  automation: Automation,
  trigger: string,
  context: AutomationContext
): boolean {
  const config = automation.trigger_config;

  // 3. For role_assigned trigger: only run if trigger_config.role_id matches context.roleId
  //    (or trigger_config.role_id is null = any role)
  if (trigger === 'role_assigned') {
    if (config.role_id && config.role_id !== context.roleId) {
      return false;
    }
  }

  // 4. For message_contains trigger: only run if message content contains keyword (case-insensitive)
  if (trigger === 'message_contains') {
    if (!config.keyword || !context.messageContent) return false;
    if (!context.messageContent.toLowerCase().includes(config.keyword.toLowerCase())) {
      return false;
    }
  }

  return true;
}

async function executeAction(
  action: AutomationAction,
  serverId: string,
  context: AutomationContext,
  username: string
): Promise<void> {
  const { type, config } = action;
  const userId = context.userId;

  switch (type) {
    case 'assign_role': {
      if (!userId || !config.role_id) return;

      // Insert into member_roles (ignore if already exists)
      await query(
        `INSERT INTO member_roles (server_id, user_id, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (server_id, user_id, role_id) DO NOTHING`,
        [serverId, userId, config.role_id]
      );

      // Get role info
      const { rows: roleRows } = await query(
        'SELECT id, name, color, position FROM server_roles WHERE id = $1',
        [config.role_id]
      );

      if (roleRows.length > 0) {
        const role = roleRows[0];
        // Update server_members display role (don't demote Owner/Admin)
        await query(
          `UPDATE server_members
           SET role_name = $1
           WHERE server_id = $2 AND user_id = $3 AND role_name NOT IN ('Owner', 'Admin')`,
          [role.name, serverId, userId]
        );

        // Emit socket event so all clients update the member list in real-time
        if (context.io) {
          context.io.to(`server:${serverId}`).emit('member_role_updated', {
            server_id: serverId,
            user_id: userId,
            role_id: role.id,
            role_name: role.name,
            role_color: role.color,
          });
        }
      }
      break;
    }

    case 'remove_role': {
      if (!userId || !config.role_id) return;

      await query(
        'DELETE FROM member_roles WHERE server_id = $1 AND user_id = $2 AND role_id = $3',
        [serverId, userId, config.role_id]
      );
      break;
    }

    case 'send_channel_message': {
      if (!config.channel_id || !config.message) return;

      const content = config.message.replace(/\{username\}/g, username);

      const { rows: serverRows } = await query(
        'SELECT owner_id, name, icon_url FROM servers WHERE id = $1',
        [serverId]
      );
      if (serverRows.length === 0) return;

      const { owner_id: senderId, name: serverName, icon_url: serverIcon } = serverRows[0];

      const { rows: msgRows } = await query(
        `INSERT INTO messages (channel_id, sender_id, content, is_automated, system_name, system_avatar)
         VALUES ($1, $2, $3, true, $4, $5)
         RETURNING *`,
        [config.channel_id, senderId, content, serverName, serverIcon]
      );

      if (msgRows.length > 0 && context.io) {
        context.io.to(`channel:${config.channel_id}`).emit('new_message', {
          ...msgRows[0],
          sender: {
            id: senderId,
            username: serverName,
            avatar_url: serverIcon,
            status: 'online',
            custom_status: null,
          },
        });
      }
      break;
    }

    case 'send_dm': {
      if (!userId || !config.message) return;

      const content = config.message.replace(/\{username\}/g, username);

      // Get or create dm_conversation between server owner and the user
      const { rows: serverRows } = await query(
        'SELECT owner_id FROM servers WHERE id = $1',
        [serverId]
      );
      if (serverRows.length === 0) return;

      const ownerId = serverRows[0].owner_id;

      // Find existing conversation
      let conversationId: string | null = null;
      const { rows: convRows } = await query(
        `SELECT dc.id FROM dm_conversations dc
         JOIN dm_participants dp1 ON dp1.conversation_id = dc.id AND dp1.user_id = $1
         JOIN dm_participants dp2 ON dp2.conversation_id = dc.id AND dp2.user_id = $2
         LIMIT 1`,
        [ownerId, userId]
      );

      if (convRows.length > 0) {
        conversationId = convRows[0].id;
      } else {
        // Create new conversation
        const { rows: newConvRows } = await query(
          'INSERT INTO dm_conversations DEFAULT VALUES RETURNING id',
          []
        );
        conversationId = newConvRows[0].id;

        // Add participants
        await query(
          'INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
          [conversationId, ownerId, userId]
        );
      }

      // Insert dm message
      await query(
        `INSERT INTO dm_messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)`,
        [conversationId, ownerId, content]
      );
      break;
    }

    case 'delete_message': {
      if (!context.messageId) return;

      await query(
        'DELETE FROM messages WHERE id = $1',
        [context.messageId]
      );
      break;
    }

    case 'kick_member': {
      if (!userId) return;

      // Delete from member_roles first (FK constraint)
      await query(
        'DELETE FROM member_roles WHERE server_id = $1 AND user_id = $2',
        [serverId, userId]
      );

      // Delete from server_members
      await query(
        'DELETE FROM server_members WHERE server_id = $1 AND user_id = $2',
        [serverId, userId]
      );
      break;
    }

    default:
      console.warn(`[automations] Unknown action type: ${type}`);
  }
}
