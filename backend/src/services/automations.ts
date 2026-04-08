import { query } from '../db/pool';
import { redis } from '../redis/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TriggerType =
  | 'member_join'
  | 'member_leave'
  | 'role_assigned'
  | 'role_removed'
  | 'message_contains'
  | 'message_sent'
  | 'reaction_added'
  | 'member_banned';

export type ActionType =
  | 'assign_role'
  | 'remove_role'
  | 'send_channel_message'
  | 'send_dm'
  | 'delete_message'
  | 'kick_member'
  | 'ban_member'
  | 'mute_member'
  | 'log_to_channel'
  | 'warn_user'
  | 'add_reaction'
  | 'send_webhook'
  | 'pin_message';

interface AutomationAction {
  type: ActionType;
  config: {
    role_id?: string;
    channel_id?: string;
    message?: string;
    reason?: string;
    duration_minutes?: number;
    delete_days?: number;
    url?: string;
    method?: string;
    body?: string;
    emoji?: string;
    include_details?: boolean;
  };
}

export interface AutomationCondition {
  type: 'user_has_role' | 'user_not_has_role' | 'in_channel' | 'account_age_less_than' | 'account_age_more_than' | 'member_count_above' | 'member_count_below';
  role_id?: string;
  channel_id?: string;
  days?: number;
  count?: number;
}

interface Automation {
  id: string;
  server_id: string;
  name: string;
  enabled: boolean;
  trigger_type: TriggerType;
  trigger_config: {
    role_id?: string;
    keyword?: string;
    match_type?: 'contains' | 'starts_with' | 'ends_with' | 'exact' | 'regex';
    channel_id?: string;
    emoji?: string;
    case_sensitive?: boolean;
  };
  actions: AutomationAction[];
  conditions: AutomationCondition[];
  cooldown_seconds: number;
}

export interface AutomationContext {
  userId?: string;
  messageId?: string;
  channelId?: string;
  roleId?: string;
  roleName?: string;
  messageContent?: string;
  emoji?: string;
  io?: any;
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runAutomations(
  serverId: string,
  trigger: TriggerType,
  context: AutomationContext
): Promise<void> {
  try {
    const { rows: automations } = await query(
      `SELECT * FROM server_automations WHERE server_id = $1 AND trigger_type = $2 AND enabled = true`,
      [serverId, trigger]
    );
    if (automations.length === 0) return;

    // Fetch user info once
    let username = 'Unknown';
    let userCreatedAt: Date | null = null;
    if (context.userId) {
      const { rows } = await query('SELECT username, created_at FROM users WHERE id = $1', [context.userId]);
      if (rows.length) { username = rows[0].username; userCreatedAt = new Date(rows[0].created_at); }
    }

    // Fetch server info once
    const { rows: [srv] } = await query(
      `SELECT s.name, s.icon_url, s.owner_id,
              (SELECT COUNT(*)::int FROM server_members WHERE server_id = s.id) AS member_count
       FROM servers s WHERE s.id = $1`,
      [serverId]
    );
    const serverName = srv?.name || 'Server';
    const memberCount: number = srv?.member_count ?? 0;

    // Fetch channel name if applicable
    let channelName = '';
    if (context.channelId) {
      const { rows: [ch] } = await query('SELECT name FROM channels WHERE id = $1', [context.channelId]);
      channelName = ch?.name || '';
    }

    for (const auto of automations as Automation[]) {
      if (!matchesTrigger(auto, trigger, context)) continue;
      if (!(await checkConditions(auto.conditions || [], serverId, context, userCreatedAt, memberCount))) continue;
      if (!(await checkCooldown(auto.id, context.userId, auto.cooldown_seconds || 0))) continue;

      for (const action of auto.actions) {
        try {
          await executeAction(
            action, serverId, context,
            username, serverName, srv?.owner_id, srv?.icon_url,
            memberCount, channelName, context.roleName || ''
          );
        } catch (err) {
          console.error(`[automations] action ${action.type} in ${auto.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[automations] runAutomations error:', err);
  }
}

// ── Trigger matching ──────────────────────────────────────────────────────────

function matchesTrigger(auto: Automation, trigger: string, ctx: AutomationContext): boolean {
  const cfg = auto.trigger_config;

  if (trigger === 'role_assigned' || trigger === 'role_removed') {
    if (cfg.role_id && cfg.role_id !== ctx.roleId) return false;
  }

  if (trigger === 'message_contains') {
    if (!cfg.keyword || !ctx.messageContent) return false;
    const content = cfg.case_sensitive ? ctx.messageContent : ctx.messageContent.toLowerCase();
    const kw = cfg.case_sensitive ? cfg.keyword : cfg.keyword.toLowerCase();
    const matchType = cfg.match_type || 'contains';
    switch (matchType) {
      case 'contains':    if (!content.includes(kw)) return false; break;
      case 'starts_with': if (!content.startsWith(kw)) return false; break;
      case 'ends_with':   if (!content.endsWith(kw)) return false; break;
      case 'exact':       if (content.trim() !== kw.trim()) return false; break;
      case 'regex': {
        try { if (!new RegExp(cfg.keyword, cfg.case_sensitive ? '' : 'i').test(ctx.messageContent)) return false; }
        catch { return false; }
        break;
      }
    }
    // optional channel filter
    if (cfg.channel_id && ctx.channelId !== cfg.channel_id) return false;
  }

  if (trigger === 'message_sent') {
    if (cfg.channel_id && ctx.channelId !== cfg.channel_id) return false;
  }

  if (trigger === 'reaction_added') {
    if (cfg.emoji && ctx.emoji !== cfg.emoji) return false;
    if (cfg.channel_id && ctx.channelId !== cfg.channel_id) return false;
  }

  return true;
}

// ── Conditions check ──────────────────────────────────────────────────────────

async function checkConditions(
  conditions: AutomationCondition[],
  serverId: string,
  ctx: AutomationContext,
  userCreatedAt: Date | null,
  memberCount: number
): Promise<boolean> {
  for (const cond of conditions) {
    switch (cond.type) {
      case 'user_has_role': {
        if (!ctx.userId || !cond.role_id) break;
        const { rows } = await query(
          'SELECT 1 FROM member_roles WHERE server_id=$1 AND user_id=$2 AND role_id=$3',
          [serverId, ctx.userId, cond.role_id]
        );
        if (rows.length === 0) return false;
        break;
      }
      case 'user_not_has_role': {
        if (!ctx.userId || !cond.role_id) break;
        const { rows } = await query(
          'SELECT 1 FROM member_roles WHERE server_id=$1 AND user_id=$2 AND role_id=$3',
          [serverId, ctx.userId, cond.role_id]
        );
        if (rows.length > 0) return false;
        break;
      }
      case 'in_channel': {
        if (cond.channel_id && ctx.channelId !== cond.channel_id) return false;
        break;
      }
      case 'account_age_less_than': {
        if (!userCreatedAt || !cond.days) break;
        const ageMs = Date.now() - userCreatedAt.getTime();
        const ageDays = ageMs / 86400000;
        if (ageDays >= cond.days) return false;
        break;
      }
      case 'account_age_more_than': {
        if (!userCreatedAt || !cond.days) break;
        const ageMs = Date.now() - userCreatedAt.getTime();
        const ageDays = ageMs / 86400000;
        if (ageDays < cond.days) return false;
        break;
      }
      case 'member_count_above': {
        if (cond.count !== undefined && memberCount <= cond.count) return false;
        break;
      }
      case 'member_count_below': {
        if (cond.count !== undefined && memberCount >= cond.count) return false;
        break;
      }
    }
  }
  return true;
}

// ── Cooldown ──────────────────────────────────────────────────────────────────

async function checkCooldown(autoId: string, userId: string | undefined, seconds: number): Promise<boolean> {
  if (seconds <= 0) return true;
  const key = `auto_cd:${autoId}:${userId || 'global'}`;
  try {
    const exists = await redis.get(key);
    if (exists) return false;
    await redis.setex(key, seconds, '1');
  } catch { /* ignore redis errors */ }
  return true;
}

// ── Template variables ────────────────────────────────────────────────────────

function applyTemplate(
  tpl: string,
  username: string,
  serverName: string,
  channelName: string,
  memberCount: number,
  roleName: string
): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
  return tpl
    .replace(/\{username\}/g, username)
    .replace(/\{mention\}/g, `@${username}`)
    .replace(/\{server\}/g, serverName)
    .replace(/\{channel\}/g, channelName ? `#${channelName}` : '')
    .replace(/\{count\}/g, String(memberCount))
    .replace(/\{time\}/g, time)
    .replace(/\{date\}/g, date)
    .replace(/\{role\}/g, roleName);
}

// ── Action executor ───────────────────────────────────────────────────────────

async function executeAction(
  action: AutomationAction,
  serverId: string,
  ctx: AutomationContext,
  username: string,
  serverName: string,
  ownerId: string,
  serverIcon: string,
  memberCount: number,
  channelName: string,
  roleName: string
): Promise<void> {
  const { type, config } = action;
  const userId = ctx.userId;

  const msg = (tpl: string) => applyTemplate(tpl, username, serverName, channelName, memberCount, roleName);

  switch (type) {

    // ── assign_role ──────────────────────────────────────────────────────────
    case 'assign_role': {
      if (!userId || !config.role_id) return;
      await query(
        `INSERT INTO member_roles (server_id, user_id, role_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [serverId, userId, config.role_id]
      );
      const { rows: [role] } = await query('SELECT id, name, color FROM server_roles WHERE id=$1', [config.role_id]);
      if (role) {
        await query(
          `UPDATE server_members SET role_name=$1 WHERE server_id=$2 AND user_id=$3 AND role_name NOT IN ('Owner','Admin')`,
          [role.name, serverId, userId]
        );
        ctx.io?.to(`server:${serverId}`).emit('member_role_updated', { server_id: serverId, user_id: userId, role_id: role.id, role_name: role.name, role_color: role.color });
      }
      break;
    }

    // ── remove_role ──────────────────────────────────────────────────────────
    case 'remove_role': {
      if (!userId || !config.role_id) return;
      await query('DELETE FROM member_roles WHERE server_id=$1 AND user_id=$2 AND role_id=$3', [serverId, userId, config.role_id]);
      ctx.io?.to(`server:${serverId}`).emit('member_role_updated', { server_id: serverId, user_id: userId, role_id: config.role_id, role_name: null });
      break;
    }

    // ── send_channel_message ─────────────────────────────────────────────────
    case 'send_channel_message': {
      if (!config.channel_id || !config.message) return;
      const content = msg(config.message);
      const { rows: [msgRow] } = await query(
        `INSERT INTO messages (channel_id, sender_id, content, is_automated, system_name, system_avatar)
         VALUES ($1,$2,$3,true,$4,$5) RETURNING *`,
        [config.channel_id, ownerId, content, serverName, serverIcon]
      );
      if (msgRow && ctx.io) {
        ctx.io.to(`channel:${config.channel_id}`).emit('new_message', {
          ...msgRow,
          sender: { id: ownerId, username: serverName, avatar_url: serverIcon, status: 'online', custom_status: null },
        });
      }
      break;
    }

    // ── send_dm ──────────────────────────────────────────────────────────────
    case 'send_dm': {
      if (!userId || !config.message) return;
      const content = msg(config.message);
      let convId: string | null = null;
      const { rows: existing } = await query(
        `SELECT dc.id FROM dm_conversations dc
         JOIN dm_participants dp1 ON dp1.conversation_id=dc.id AND dp1.user_id=$1
         JOIN dm_participants dp2 ON dp2.conversation_id=dc.id AND dp2.user_id=$2 LIMIT 1`,
        [ownerId, userId]
      );
      if (existing.length) {
        convId = existing[0].id;
      } else {
        const { rows: [newConv] } = await query('INSERT INTO dm_conversations DEFAULT VALUES RETURNING id', []);
        convId = newConv.id;
        await query('INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)', [convId, ownerId, userId]);
      }
      const { rows: [dmMsg] } = await query(
        `INSERT INTO dm_messages (conversation_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *`,
        [convId, ownerId, content]
      );
      if (dmMsg && ctx.io) {
        ctx.io.to(`user:${userId}`).emit('new_dm', { ...dmMsg, conversation_id: convId });
      }
      break;
    }

    // ── delete_message ───────────────────────────────────────────────────────
    case 'delete_message': {
      if (!ctx.messageId) return;
      const { rows: [m] } = await query('SELECT channel_id FROM messages WHERE id=$1', [ctx.messageId]);
      await query('DELETE FROM messages WHERE id=$1', [ctx.messageId]);
      if (m && ctx.io) {
        ctx.io.to(`channel:${m.channel_id}`).emit('message_deleted', { message_id: ctx.messageId, channel_id: m.channel_id });
      }
      break;
    }

    // ── kick_member ──────────────────────────────────────────────────────────
    case 'kick_member': {
      if (!userId) return;
      await query('DELETE FROM member_roles WHERE server_id=$1 AND user_id=$2', [serverId, userId]);
      await query('DELETE FROM server_members WHERE server_id=$1 AND user_id=$2', [serverId, userId]);
      ctx.io?.to(`server:${serverId}`).emit('member_left', { server_id: serverId, user_id: userId });
      ctx.io?.to(`user:${userId}`).emit('kicked_from_server', { server_id: serverId });
      break;
    }

    // ── ban_member ───────────────────────────────────────────────────────────
    case 'ban_member': {
      if (!userId) return;
      // Don't ban Owner/Admin
      const { rows: [member] } = await query('SELECT role_name FROM server_members WHERE server_id=$1 AND user_id=$2', [serverId, userId]);
      if (member?.role_name === 'Owner' || member?.role_name === 'Admin') return;
      await query(
        `INSERT INTO server_bans (server_id, user_id, banned_by, reason) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [serverId, userId, ownerId, config.reason || 'Automatyczna reguła serwera']
      );
      await query('DELETE FROM member_roles WHERE server_id=$1 AND user_id=$2', [serverId, userId]);
      await query('DELETE FROM server_members WHERE server_id=$1 AND user_id=$2', [serverId, userId]);
      ctx.io?.to(`server:${serverId}`).emit('member_left', { server_id: serverId, user_id: userId });
      ctx.io?.to(`user:${userId}`).emit('banned_from_server', { server_id: serverId, reason: config.reason });
      break;
    }

    // ── mute_member ──────────────────────────────────────────────────────────
    case 'mute_member': {
      if (!userId) return;
      const { rows: [member] } = await query('SELECT role_name FROM server_members WHERE server_id=$1 AND user_id=$2', [serverId, userId]);
      if (member?.role_name === 'Owner' || member?.role_name === 'Admin') return;
      const dur = config.duration_minutes || 10;
      const expiresAt = new Date(Date.now() + dur * 60000);
      await query(
        `INSERT INTO server_mutes (server_id, user_id, muted_by, reason, expires_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (server_id, user_id) DO UPDATE SET reason=$4, expires_at=$5, muted_by=$3`,
        [serverId, userId, ownerId, config.reason || 'Automatyczna reguła', expiresAt]
      );
      ctx.io?.to(`user:${userId}`).emit('muted_in_server', { server_id: serverId, expires_at: expiresAt, reason: config.reason });
      break;
    }

    // ── log_to_channel ───────────────────────────────────────────────────────
    case 'log_to_channel': {
      if (!config.channel_id) return;
      const triggerLabels: Record<string, string> = {
        member_join: 'dołączył do serwera',
        member_leave: 'opuścił serwer',
        role_assigned: 'otrzymał rolę',
        role_removed: 'utracił rolę',
        message_contains: 'wysłał wiadomość z zabronionym słowem',
        message_sent: 'wysłał wiadomość',
        reaction_added: 'dodał reakcję',
        member_banned: 'został zbanowany',
      };
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      let logContent = `📋 **Log** | ${username} ${triggerLabels['member_join'] || 'wykonał akcję'} — ${timeStr}`;
      if (config.include_details && ctx.messageContent) {
        logContent += `\n> ${ctx.messageContent.slice(0, 200)}`;
      }
      const { rows: [logMsg] } = await query(
        `INSERT INTO messages (channel_id, sender_id, content, is_automated, system_name, system_avatar)
         VALUES ($1,$2,$3,true,$4,$5) RETURNING *`,
        [config.channel_id, ownerId, logContent, '📋 Log Serwera', serverIcon]
      );
      if (logMsg && ctx.io) {
        ctx.io.to(`channel:${config.channel_id}`).emit('new_message', {
          ...logMsg,
          sender: { id: ownerId, username: '📋 Log Serwera', avatar_url: serverIcon, status: 'online', custom_status: null },
        });
      }
      break;
    }

    // ── warn_user ────────────────────────────────────────────────────────────
    case 'warn_user': {
      if (!userId) return;
      const reason = config.message ? msg(config.message) : 'Naruszenie regulaminu serwera';
      await query(
        `INSERT INTO member_warnings (server_id, user_id, warned_by, reason) VALUES ($1,$2,$3,$4)`,
        [serverId, userId, ownerId, reason]
      );
      // Count total warnings
      const { rows: [warnCount] } = await query(
        'SELECT COUNT(*)::int AS cnt FROM member_warnings WHERE server_id=$1 AND user_id=$2',
        [serverId, userId]
      );
      const total = warnCount?.cnt ?? 1;
      // Send DM notification
      let convId: string | null = null;
      const { rows: existing } = await query(
        `SELECT dc.id FROM dm_conversations dc
         JOIN dm_participants dp1 ON dp1.conversation_id=dc.id AND dp1.user_id=$1
         JOIN dm_participants dp2 ON dp2.conversation_id=dc.id AND dp2.user_id=$2 LIMIT 1`,
        [ownerId, userId]
      );
      if (existing.length) {
        convId = existing[0].id;
      } else {
        const { rows: [c] } = await query('INSERT INTO dm_conversations DEFAULT VALUES RETURNING id', []);
        convId = c.id;
        await query('INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)', [convId, ownerId, userId]);
      }
      const warnMsg = `⚠️ Otrzymałeś ostrzeżenie na serwerze **${serverName}** (${total}. ostrzeżenie).\nPowód: ${reason}`;
      const { rows: [dm] } = await query(
        `INSERT INTO dm_messages (conversation_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *`,
        [convId, ownerId, warnMsg]
      );
      if (dm && ctx.io) {
        ctx.io.to(`user:${userId}`).emit('new_dm', { ...dm, conversation_id: convId });
      }
      // Notify channel if configured
      if (config.channel_id) {
        const notif = `⚠️ **${username}** otrzymał ostrzeżenie #${total}. Powód: ${reason}`;
        const { rows: [notifMsg] } = await query(
          `INSERT INTO messages (channel_id, sender_id, content, is_automated, system_name, system_avatar)
           VALUES ($1,$2,$3,true,$4,$5) RETURNING *`,
          [config.channel_id, ownerId, notif, '⚠️ Moderacja', serverIcon]
        );
        if (notifMsg && ctx.io) {
          ctx.io.to(`channel:${config.channel_id}`).emit('new_message', {
            ...notifMsg,
            sender: { id: ownerId, username: '⚠️ Moderacja', avatar_url: serverIcon, status: 'online', custom_status: null },
          });
        }
      }
      break;
    }

    // ── add_reaction ─────────────────────────────────────────────────────────
    case 'add_reaction': {
      if (!ctx.messageId || !config.emoji) return;
      await query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [ctx.messageId, ownerId, config.emoji]
      );
      const { rows: [msgRow] } = await query('SELECT channel_id FROM messages WHERE id=$1', [ctx.messageId]);
      if (msgRow && ctx.io) {
        const { rows: [cnt] } = await query(
          `SELECT COUNT(*)::int AS count FROM message_reactions WHERE message_id=$1 AND emoji=$2`,
          [ctx.messageId, config.emoji]
        );
        ctx.io.to(`channel:${msgRow.channel_id}`).emit('reaction_update', {
          message_id: ctx.messageId, emoji: config.emoji, count: cnt?.count ?? 1, mine: false,
        });
      }
      break;
    }

    // ── send_webhook ─────────────────────────────────────────────────────────
    case 'send_webhook': {
      if (!config.url) return;
      try {
        const method = (config.method || 'POST').toUpperCase();
        const body = config.body ? msg(config.body) : JSON.stringify({ username, server: serverName, event: 'automation' });
        await fetch(config.url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method !== 'GET' ? body : undefined,
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        console.error('[automations] webhook error:', err);
      }
      break;
    }

    // ── pin_message ───────────────────────────────────────────────────────────
    case 'pin_message': {
      if (!ctx.messageId) return;
      const { rows: [pinned] } = await query(
        `UPDATE messages SET pinned=true WHERE id=$1 RETURNING channel_id`,
        [ctx.messageId]
      );
      if (pinned && ctx.io) {
        ctx.io.to(`channel:${pinned.channel_id}`).emit('message_pinned', { message_id: ctx.messageId, channel_id: pinned.channel_id });
      }
      break;
    }

    default:
      console.warn(`[automations] Unknown action type: ${type}`);
  }
}
