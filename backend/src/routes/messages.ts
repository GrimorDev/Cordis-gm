import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { checkSlowmode, setSlowmode } from '../redis/client';

const router = Router();

interface ChannelAccess { serverId: string; channelType: string; roleInServer: string; slowmodeSeconds: number; }

/** Check if a member has a specific permission through their server roles.
 *  Owner/Admin bypass all checks.
 *  No custom roles assigned → allow (default member, unrestricted).
 *  Has assigned roles → any role with this permission grants access; otherwise deny.
 *  Empty permissions array on a role means "no permissions granted by this role". */
async function hasPermission(serverId: string, userId: string, permission: string, roleName: string): Promise<boolean> {
  if (['Owner', 'Admin'].includes(roleName)) return true;
  const { rows } = await query(
    `SELECT sr.permissions FROM member_roles mr
     INNER JOIN server_roles sr ON sr.id = mr.role_id
     WHERE mr.server_id = $1 AND mr.user_id = $2`,
    [serverId, userId]
  );
  // No custom roles assigned → default allow (unrestricted member)
  if (rows.length === 0) return true;
  // Has assigned roles: check if any role grants 'administrator' (full bypass) or specific permission
  return rows.some((r: any) =>
    Array.isArray(r.permissions) &&
    (r.permissions.includes('administrator') || r.permissions.includes(permission))
  );
}

// Returns channel access info if user can access the channel, null otherwise
async function resolveChannelAccess(channelId: string, userId: string): Promise<ChannelAccess | null> {
  const { rows: [ch] } = await query(
    `SELECT c.server_id, c.is_private, c.type, c.slowmode_seconds, sm.role_name
     FROM channels c
     LEFT JOIN server_members sm ON sm.server_id = c.server_id AND sm.user_id = $2
     WHERE c.id = $1`,
    [channelId, userId]
  );
  if (!ch || !ch.role_name) return null; // not a member
  const result: ChannelAccess = {
    serverId: ch.server_id,
    channelType: ch.type,
    roleInServer: ch.role_name,
    slowmodeSeconds: ch.slowmode_seconds ?? 0,
  };
  if (!ch.is_private) return result;
  if (['Owner', 'Admin'].includes(ch.role_name)) return result;
  const { rowCount } = await query(
    `SELECT 1 FROM channel_role_access cra
     INNER JOIN member_roles mr ON mr.role_id = cra.role_id
     WHERE cra.channel_id = $1 AND mr.user_id = $2 AND mr.server_id = $3
     LIMIT 1`,
    [channelId, userId, ch.server_id]
  );
  return rowCount ? result : null;
}

const MSG_JOIN = (serverIdParam: string, channelIdParam: string) => `
  SELECT m.id, m.channel_id, m.content, m.edited, m.created_at, m.updated_at,
         m.attachment_url, m.reply_to_id,
         u.id as sender_id, u.username as sender_username,
         u.avatar_url as sender_avatar, u.status as sender_status,
         sm.role_name as sender_role,
         COALESCE(
           (SELECT sr.color FROM member_roles mr
            JOIN server_roles sr ON sr.id = mr.role_id
            WHERE mr.server_id = ${serverIdParam} AND mr.user_id = m.sender_id
            ORDER BY sr.position DESC LIMIT 1),
           (SELECT sr.color FROM server_roles sr
            WHERE sr.server_id = ${serverIdParam} AND sr.name = sm.role_name
            LIMIT 1)
         ) as sender_role_color,
         rm.content as reply_content,
         ru.username as reply_username, ru.id as reply_sender_id
  FROM messages m
  INNER JOIN users u ON u.id = m.sender_id
  LEFT JOIN server_members sm ON sm.server_id = ${serverIdParam} AND sm.user_id = m.sender_id
  LEFT JOIN messages rm ON rm.id = m.reply_to_id
  LEFT JOIN users ru ON ru.id = rm.sender_id
  WHERE m.channel_id = ${channelIdParam}
`;

// GET /api/messages/channel/:channelId
router.get('/channel/:channelId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
  const before = req.query.before as string | undefined;
  try {
    const access = await resolveChannelAccess(req.params.channelId, req.user!.id);
    if (!access) return res.status(403).json({ error: 'No access' });
    const ch = { server_id: access.serverId };

    let sql = MSG_JOIN('$1', '$2');
    const params: any[] = [ch.server_id, req.params.channelId];
    if (before) {
      params.push(before);
      sql += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length})`;
    }
    sql += ` ORDER BY m.created_at DESC LIMIT ${limit}`;
    const { rows } = await query(sql, params);
    return res.json(rows.reverse());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/channel/:channelId
router.post('/channel/:channelId', authMiddleware,
  [body('content').trim().isLength({ min: 0, max: 4000 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reply_to_id, attachment_url } = req.body;
    if (!req.body.content?.trim() && !attachment_url) {
      return res.status(400).json({ error: 'Message must have content or attachment' });
    }

    try {
      const access = await resolveChannelAccess(req.params.channelId, req.user!.id);
      if (!access) return res.status(403).json({ error: 'No access' });
      const isPrivileged = ['Owner', 'Admin'].includes(access.roleInServer);

      // Announcement channels: require manage_messages (Owner/Admin bypass)
      if (access.channelType === 'announcement' && !await hasPermission(access.serverId, req.user!.id, 'manage_messages', access.roleInServer)) {
        return res.status(403).json({ error: 'Tylko administratorzy mogą pisać na kanałach ogłoszeń' });
      }
      // send_messages permission (Owner/Admin always bypass)
      if (!await hasPermission(access.serverId, req.user!.id, 'send_messages', access.roleInServer)) {
        return res.status(403).json({ error: 'Nie masz uprawnienia do wysyłania wiadomości na tym kanale' });
      }
      // attach_files: only when an attachment is included
      if (attachment_url && !await hasPermission(access.serverId, req.user!.id, 'attach_files', access.roleInServer)) {
        return res.status(403).json({ error: 'Nie masz uprawnień do wysyłania plików' });
      }
      // mention_everyone: @everyone or @here
      const content = req.body.content || '';
      if ((content.includes('@everyone') || content.includes('@here')) &&
          !await hasPermission(access.serverId, req.user!.id, 'mention_everyone', access.roleInServer)) {
        return res.status(403).json({ error: 'Nie masz uprawnień do użycia @everyone/@here' });
      }
      // Slowmode check (Owner/Admin bypass)
      if (!isPrivileged && access.slowmodeSeconds > 0) {
        const remaining = await checkSlowmode(req.params.channelId, req.user!.id, access.slowmodeSeconds);
        if (remaining > 0) {
          return res.status(429).json({ error: `Poczekaj ${remaining}s przed wysłaniem kolejnej wiadomości`, remaining });
        }
      }
      const ch = { server_id: access.serverId };
      const { rows: [msg] } = await query(
        'INSERT INTO messages (channel_id, sender_id, content, reply_to_id, attachment_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [req.params.channelId, req.user!.id, content, reply_to_id || null, attachment_url || null]
      );
      // Set slowmode after successful message
      if (!isPrivileged && access.slowmodeSeconds > 0) {
        await setSlowmode(req.params.channelId, req.user!.id, access.slowmodeSeconds);
      }
      const { rows: [full] } = await query(
        MSG_JOIN('$1', '$2') + ' AND m.id = $3',
        [ch.server_id, req.params.channelId, msg.id]
      );
      const io = req.app.get('io');
      if (io) io.to(`channel:${req.params.channelId}`).emit('new_message', full);

      // ── @everyone / @here: ping all server members ────────────────────
      if (content.includes('@everyone') || content.includes('@here')) {
        const { rows: allMembers } = await query(
          `SELECT user_id FROM server_members WHERE server_id=$1 AND user_id!=$2`,
          [ch.server_id, req.user!.id]
        );
        if (io) {
          for (const m of allMembers) {
            io.to(`user:${m.user_id}`).emit('ping_received' as any, {
              message_id: msg.id,
              channel_id: req.params.channelId,
              server_id: ch.server_id,
              from_user_id: req.user!.id,
              from_username: req.user!.username,
              content,
              type: 'everyone',
            });
          }
        }
      }

      // ── Parse !username mentions and notify mentioned users ──────────
      if (content) {
        const mentionedNames: string[] = [...content.matchAll(/!([a-zA-Z0-9_]+)/g)].map((m: any) => m[1]);
        if (mentionedNames.length > 0) {
          const { rows: mentionedUsers } = await query(
            `SELECT u.id, u.username FROM users u
             INNER JOIN server_members sm ON sm.server_id = $1 AND sm.user_id = u.id
             WHERE u.username ILIKE ANY($2::text[]) AND u.id != $3`,
            [ch.server_id, mentionedNames, req.user!.id]
          );
          for (const mentioned of mentionedUsers) {
            await query(
              `INSERT INTO message_mentions (message_id, channel_id, server_id, user_id)
               VALUES ($1,$2,$3,$4) ON CONFLICT (message_id, user_id) DO NOTHING`,
              [msg.id, req.params.channelId, ch.server_id, mentioned.id]
            );
            if (io) {
              io.to(`user:${mentioned.id}`).emit('ping_received' as any, {
                message_id: msg.id,
                channel_id: req.params.channelId,
                server_id: ch.server_id,
                from_user_id: req.user!.id,
                from_username: req.user!.username,
                content,
              });
            }
          }
        }
      }

      return res.status(201).json(full);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/messages/:id
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    const { rows: [msg] } = await query('SELECT * FROM messages WHERE id = $1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    if (msg.sender_id !== req.user!.id) return res.status(403).json({ error: 'Not your message' });
    const { rows: [updated] } = await query(
      'UPDATE messages SET content=$1,edited=true,updated_at=NOW() WHERE id=$2 RETURNING *',
      [content.trim(), req.params.id]
    );
    const io = req.app.get('io');
    if (io) io.to(`channel:${msg.channel_id}`).emit('message_updated', { id: updated.id, content: updated.content, edited: updated.edited });
    return res.json(updated);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/messages/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query('SELECT * FROM messages WHERE id=$1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    if (msg.sender_id !== req.user!.id) {
      const { rows: [ch] } = await query('SELECT server_id FROM channels WHERE id=$1', [msg.channel_id]);
      const { rows: [member] } = await query(
        'SELECT role_name FROM server_members WHERE server_id=$1 AND user_id=$2',
        [ch.server_id, req.user!.id]
      );
      if (!member || !await hasPermission(ch.server_id, req.user!.id, 'manage_messages', member.role_name))
        return res.status(403).json({ error: 'Not authorized' });
    }
    await query('DELETE FROM messages WHERE id=$1', [req.params.id]);
    const io = req.app.get('io');
    if (io) io.to(`channel:${msg.channel_id}`).emit('message_deleted', { id: msg.id, channel_id: msg.channel_id });
    return res.json({ message: 'Deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/messages/:id/reactions
router.post('/:id/reactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });
  try {
    await query('INSERT INTO message_reactions (message_id,user_id,emoji) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [req.params.id, req.user!.id, emoji]);
    return res.json({ message: 'Reaction added' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/messages/:id/reactions/:emoji
router.delete('/:id/reactions/:emoji', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3',
      [req.params.id, req.user!.id, req.params.emoji]);
    return res.json({ message: 'Reaction removed' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/messages/:id/pin  — toggle pin on a text channel message
router.put('/:id/pin', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query('SELECT * FROM messages WHERE id=$1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const access = await resolveChannelAccess(msg.channel_id, req.user!.id);
    if (!access) return res.status(403).json({ error: 'No access' });
    if (!await hasPermission(access.serverId, req.user!.id, 'pin_messages', access.roleInServer)) {
      return res.status(403).json({ error: 'Nie masz uprawnień do przypinania wiadomości' });
    }
    const pinned = req.body.pinned !== false; // default true; send false to unpin
    await query('UPDATE messages SET pinned=$1 WHERE id=$2', [pinned, req.params.id]);
    const io = req.app.get('io');
    if (io) io.to(`channel:${msg.channel_id}`).emit('message_pinned' as any, { message_id: msg.id, channel_id: msg.channel_id, pinned });
    return res.json({ message: pinned ? 'Message pinned' : 'Message unpinned' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/messages/channel/:channelId/pinned  — list pinned messages
router.get('/channel/:channelId/pinned', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const access = await resolveChannelAccess(req.params.channelId, req.user!.id);
    if (!access) return res.status(403).json({ error: 'No access' });
    const { rows } = await query(
      MSG_JOIN('$1', '$2') + ' AND m.pinned = TRUE ORDER BY m.created_at DESC LIMIT 50',
      [access.serverId, req.params.channelId]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
