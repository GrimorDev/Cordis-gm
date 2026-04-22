import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, getClient } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { msgLimiter } from '../middleware/messageLimiter';
import { AuthRequest } from '../types';
import { sendPushToUser } from '../services/push';
import { sendDmPush } from '../services/expoPush';
import { deleteFromR2 } from '../services/r2';
import { getDmListCache, setDmListCache, invalidateDmListCache } from '../redis/client';

const router = Router();

const FIND_CONVO_SQL = `
  SELECT dp1.conversation_id FROM dm_participants dp1
  INNER JOIN dm_participants dp2 ON dp2.conversation_id = dp1.conversation_id AND dp2.user_id = $2
  WHERE dp1.user_id = $1
    AND (SELECT COUNT(*) FROM dm_participants WHERE conversation_id = dp1.conversation_id) = 2
  ORDER BY (SELECT MAX(created_at) FROM dm_messages WHERE conversation_id=dp1.conversation_id) DESC NULLS LAST
  LIMIT 1`;

async function getOrCreateConversation(userId1: string, userId2: string): Promise<string> {
  const { rows } = await query(FIND_CONVO_SQL, [userId1, userId2]);
  if (rows[0]) return rows[0].conversation_id;

  const client = await getClient();
  try {
    // SERIALIZABLE prevents two concurrent requests creating duplicate conversations
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    // Re-check inside transaction to handle race condition
    const { rows: recheck } = await client.query(FIND_CONVO_SQL, [userId1, userId2]);
    if (recheck[0]) {
      await client.query('COMMIT');
      return recheck[0].conversation_id;
    }
    const { rows: [conv] } = await client.query('INSERT INTO dm_conversations DEFAULT VALUES RETURNING id');
    await client.query(
      'INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)',
      [conv.id, userId1, userId2]
    );
    await client.query('COMMIT');
    return conv.id;
  } catch (err: any) {
    await client.query('ROLLBACK');
    // On serialization failure (concurrent duplicate), retry once with a fresh read
    if (err?.code === '40001') {
      const { rows: retry } = await query(FIND_CONVO_SQL, [userId1, userId2]);
      if (retry[0]) return retry[0].conversation_id;
    }
    throw err;
  } finally { client.release(); }
}

// GET /api/dms/conversations
router.get('/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Two filter strategies tried in order:
  // 1) is_group column (requires migration) — cleanest
  // 2) participant count ≤ 2 (schema-agnostic) — safe fallback if column missing
  const buildSQL = (groupFilter: 'is_group_col' | 'participant_count') => `
    SELECT * FROM (
      SELECT DISTINCT ON (u.id)
             dc.id, dc.created_at,
             u.id as other_user_id, u.username as other_username,
             u.avatar_url as other_avatar, u.status as other_status,
             u.avatar_effect as other_avatar_effect, u.custom_status as other_custom_status,
             st.tag as other_tag, st.color as other_tag_color, st.icon as other_tag_icon, u.active_tag_server_id as other_tag_server_id,
             CASE WHEN u.privacy_read_receipts = FALSE THEN NULL ELSE dp2.last_read_at END as other_last_read_at,
             (SELECT content    FROM dm_messages WHERE conversation_id=dc.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM dm_messages WHERE conversation_id=dc.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM dm_conversations dc
      INNER JOIN dm_participants dp ON dp.conversation_id=dc.id AND dp.user_id=$1
      INNER JOIN LATERAL (
        SELECT dp2.user_id, dp2.last_read_at
        FROM dm_participants dp2
        WHERE dp2.conversation_id=dc.id AND dp2.user_id!=$1
        LIMIT 1
      ) dp2 ON true
      INNER JOIN users u ON u.id=dp2.user_id
      LEFT JOIN server_tags st ON st.server_id = u.active_tag_server_id
      WHERE ${groupFilter === 'is_group_col'
        ? '(dc.is_group IS NOT TRUE)'
        : '(SELECT COUNT(*) FROM dm_participants WHERE conversation_id=dc.id) <= 2'}
      ORDER BY u.id, (SELECT created_at FROM dm_messages WHERE conversation_id=dc.id ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
    ) sub
    ORDER BY last_message_at DESC NULLS LAST`;

  try {
    const cached = await getDmListCache<any[]>(userId);
    if (cached !== null) return res.json(cached);
    // Strategy 1: is_group column (requires migration)
    try {
      const { rows } = await query(buildSQL('is_group_col'), [userId]);
      await setDmListCache(userId, rows);
      return res.json(rows);
    } catch (err: any) {
      if (err?.code === '42703') {
        // 42703 = undefined_column — is_group column doesn't exist yet.
        // Strategy 2: filter by participant count (≤2 = 1-on-1 DM, safe without migration)
        const { rows } = await query(buildSQL('participant_count'), [userId]);
        await setDmListCache(userId, rows);
        return res.json(rows);
      }
      throw err;
    }
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/dms/:userId/messages
router.get('/:userId/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
  const before = req.query.before as string | undefined;
  try {
    // Find existing conversation WITHOUT creating one — prevents ghost empty conversations
    const { rows: existing } = await query(
      `SELECT dp1.conversation_id FROM dm_participants dp1
       INNER JOIN dm_participants dp2 ON dp2.conversation_id=dp1.conversation_id AND dp2.user_id=$2
       WHERE dp1.user_id=$1
         AND (SELECT COUNT(*) FROM dm_participants WHERE conversation_id = dp1.conversation_id) = 2
       ORDER BY (SELECT MAX(created_at) FROM dm_messages WHERE conversation_id=dp1.conversation_id) DESC NULLS LAST
       LIMIT 1`,
      [req.user!.id, req.params.userId]
    );
    if (!existing[0]) return res.json([]); // No conversation yet — return empty, don't create
    const conversationId = existing[0].conversation_id;
    let sql = `
      SELECT dm.id, dm.conversation_id, dm.content, dm.edited, dm.created_at,
             dm.attachment_url, dm.reply_to_id, dm.is_system,
             u.id as sender_id, u.username as sender_username, u.avatar_url as sender_avatar, u.avatar_effect as sender_avatar_effect,
             st.tag as sender_tag, st.color as sender_tag_color, st.icon as sender_tag_icon, u.active_tag_server_id as sender_tag_server_id,
             rm.content as reply_content, ru.username as reply_username
      FROM dm_messages dm
      INNER JOIN users u ON u.id=dm.sender_id
      LEFT JOIN server_tags st ON st.server_id = u.active_tag_server_id
      LEFT JOIN dm_messages rm ON rm.id=dm.reply_to_id
      LEFT JOIN users ru ON ru.id=rm.sender_id
      WHERE dm.conversation_id=$1
    `;
    const params: any[] = [conversationId];
    if (before) {
      params.push(before);
      sql += ` AND dm.created_at < (SELECT created_at FROM dm_messages WHERE id=$${params.length})`;
    }
    sql += ` ORDER BY dm.created_at DESC LIMIT ${limit}`;
    const { rows } = await query(sql, params);
    const result = rows.map((r: any) =>
      r.is_system ? { ...r, initiator_id: r.sender_id, sender_id: '__system__', sender_username: 'System', sender_avatar: null } : r
    );
    return res.json(result.reverse());
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/dms/:userId/messages
router.post('/:userId/messages', authMiddleware, msgLimiter,
  [body('content').trim().isLength({ min: 0, max: 4000 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { reply_to_id, attachment_url } = req.body;
    if (!req.body.content?.trim() && !attachment_url) {
      return res.status(400).json({ error: 'Message must have content or attachment' });
    }

    try {
      // Only friends can exchange DMs
      const { rows: [friendship] } = await query(
        `SELECT id FROM friends WHERE ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)) AND status='accepted'`,
        [req.user!.id, req.params.userId]
      );
      if (!friendship) return res.status(403).json({ error: 'Możesz pisać tylko do znajomych' });

      const conversationId = await getOrCreateConversation(req.user!.id, req.params.userId);
      const { rows: [msg] } = await query(
        'INSERT INTO dm_messages (conversation_id,sender_id,content,reply_to_id,attachment_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [conversationId, req.user!.id, req.body.content, reply_to_id || null, attachment_url || null]
      );
      const { rows: [full] } = await query(
        `SELECT dm.*,u.username as sender_username,u.avatar_url as sender_avatar,
                rm.content as reply_content, ru.username as reply_username
         FROM dm_messages dm INNER JOIN users u ON u.id=dm.sender_id
         LEFT JOIN dm_messages rm ON rm.id=dm.reply_to_id
         LEFT JOIN users ru ON ru.id=rm.sender_id
         WHERE dm.id=$1`,
        [msg.id]
      );
      // Invalidate DM list cache for both participants so "last message" updates immediately
      await Promise.all([
        invalidateDmListCache(req.user!.id),
        invalidateDmListCache(req.params.userId),
      ]);
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.params.userId}`).emit('new_dm', full);
        io.to(`user:${req.user!.id}`).emit('new_dm', full);
      }
      sendPushToUser(parseInt(req.params.userId), {
        title: `Nowa wiadomość od ${req.user!.username}`,
        body: (req.body.content || '').slice(0, 100) || '📎 Załącznik',
        icon: full.sender_avatar || '/cordyn_logo.png',
        url: `/dm/${req.user!.id}`,
        tag: `dm-${req.user!.id}`,
      }).catch((e: any) => console.warn(`[push] DM failed for ${req.params.userId}:`, e?.message));
      // Expo mobile push
      sendDmPush(
        req.params.userId,
        req.user!.username,
        (req.body.content || '').trim() || '📎 Załącznik',
      ).catch(() => {});
      return res.status(201).json(full);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// PUT /api/dms/:userId/read — mark conversation as read by current user
router.put('/:userId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = await getOrCreateConversation(req.user!.id, req.params.userId);
    // Always update last_read_at for unread count purposes
    await query(
      'UPDATE dm_participants SET last_read_at = NOW() WHERE conversation_id=$1 AND user_id=$2',
      [conversationId, req.user!.id]
    );
    // Only emit dm_read event if the reader allows read receipts
    const { rows: [reader] } = await query(
      'SELECT privacy_read_receipts FROM users WHERE id=$1',
      [req.user!.id]
    );
    const io = req.app.get('io');
    if (io && reader?.privacy_read_receipts === true) {
      io.to(`user:${req.params.userId}`).emit('dm_read', {
        conversation_id: conversationId,
        reader_id: req.user!.id,
        read_at: new Date().toISOString(),
      });
    }
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/dms/:userId/system-message  (call ended, etc.)
router.post('/:userId/system-message', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
    const conversationId = await getOrCreateConversation(req.user!.id, req.params.userId);
    const { rows: [msg] } = await query(
      'INSERT INTO dm_messages (conversation_id,sender_id,content,is_system) VALUES ($1,$2,$3,true) RETURNING *',
      [conversationId, req.user!.id, content.trim()]
    );
    const full = { ...msg, initiator_id: msg.sender_id, sender_id: '__system__', sender_username: 'System', sender_avatar: null };
    await Promise.all([
      invalidateDmListCache(req.user!.id),
      invalidateDmListCache(req.params.userId),
    ]);
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.params.userId}`).emit('new_dm', full);
      io.to(`user:${req.user!.id}`).emit('new_dm', full);
    }
    return res.status(201).json(full);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/dms/messages/:id
router.put('/messages/:id', authMiddleware,
  [body('content').trim().isLength({ min: 1, max: 4000 })],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { rows: [msg] } = await query('SELECT * FROM dm_messages WHERE id=$1', [req.params.id]);
      if (!msg) return res.status(404).json({ error: 'Not found' });
      if (msg.sender_id !== req.user!.id) return res.status(403).json({ error: 'Not your message' });
      // Zapisz starą wersję do historii
      await query('INSERT INTO dm_message_edits (message_id, old_content) VALUES ($1, $2)', [msg.id, msg.content]);
      const { rows: [updated] } = await query(
        'UPDATE dm_messages SET content=$1, edited=true, updated_at=NOW() WHERE id=$2 RETURNING *',
        [req.body.content, req.params.id]
      );
      const io = req.app.get('io');
      if (io) {
        // Notify both participants
        const { rows: participants } = await query(
          'SELECT user_id FROM dm_participants WHERE conversation_id=$1', [msg.conversation_id]
        );
        participants.forEach((p: any) => {
          io.to(`user:${p.user_id}`).emit('dm_message_updated', { id: updated.id, content: updated.content, edited: true });
        });
      }
      return res.json(updated);
    } catch { return res.status(500).json({ error: 'Internal server error' }); }
  }
);

// GET /api/dms/messages/:id/edits — historia edycji DM
router.get('/messages/:id/edits', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query('SELECT conversation_id FROM dm_messages WHERE id=$1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const { rows } = await query(
      'SELECT old_content, edited_at FROM dm_message_edits WHERE message_id=$1 ORDER BY edited_at ASC',
      [req.params.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/dms/messages/:id
router.delete('/messages/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query('SELECT * FROM dm_messages WHERE id=$1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    if (msg.sender_id !== req.user!.id) return res.status(403).json({ error: 'Not your message' });
    // Delete R2 attachment if present — szukaj po URL (dm_message_id może być NULL)
    if (msg.attachment_url) {
      try {
        const { rows: [att] } = await query(
          'SELECT id, r2_key, file_size, user_id FROM attachments WHERE url=$1 LIMIT 1',
          [msg.attachment_url]
        );
        if (att?.r2_key) {
          await deleteFromR2(att.r2_key);
          await query(
            'UPDATE users SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1) WHERE id=$2',
            [att.file_size, att.user_id]
          );
          await query('DELETE FROM attachments WHERE id=$1', [att.id]);
        }
      } catch { /* ignore */ }
    }
    await query('DELETE FROM dm_messages WHERE id=$1', [req.params.id]);
    // Notify both participants in real-time
    const io = req.app.get('io');
    if (io) {
      const { rows: participants } = await query(
        'SELECT user_id FROM dm_participants WHERE conversation_id=$1', [msg.conversation_id]
      );
      participants.forEach((p: any) => {
        io.to(`user:${p.user_id}`).emit('dm_message_deleted', { id: msg.id, conversation_id: msg.conversation_id });
      });
    }
    return res.json({ message: 'Deleted' });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/dms/messages/:id/pin  — toggle pin
router.put('/messages/:id/pin', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [msg] } = await query('SELECT * FROM dm_messages WHERE id=$1', [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    // Only participants can pin
    const { rows: [part] } = await query(
      'SELECT 1 FROM dm_participants WHERE conversation_id=$1 AND user_id=$2',
      [msg.conversation_id, req.user!.id]
    );
    if (!part) return res.status(403).json({ error: 'Not a participant' });
    const newPinned = !msg.pinned;
    await query('UPDATE dm_messages SET pinned=$1 WHERE id=$2', [newPinned, msg.id]);
    const io = req.app.get('io');
    if (io) {
      const { rows: participants } = await query(
        'SELECT user_id FROM dm_participants WHERE conversation_id=$1', [msg.conversation_id]
      );
      participants.forEach((p: any) => {
        io.to(`user:${p.user_id}`).emit('dm_message_pinned', { id: msg.id, conversation_id: msg.conversation_id, pinned: newPinned });
      });
    }
    return res.json({ pinned: newPinned });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/dms/:userId/pinned
router.get('/:userId/pinned', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const myId = req.user!.id;
    const { rows: [conv] } = await query(
      `SELECT c.id FROM dm_conversations c
       JOIN dm_participants p1 ON p1.conversation_id=c.id AND p1.user_id=$1
       JOIN dm_participants p2 ON p2.conversation_id=c.id AND p2.user_id=$2`,
      [myId, req.params.userId]
    );
    if (!conv) return res.json([]);
    const { rows } = await query(
      `SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
       FROM dm_messages m JOIN users u ON u.id=m.sender_id
       WHERE m.conversation_id=$1 AND m.pinned=true
       ORDER BY m.created_at DESC LIMIT 50`,
      [conv.id]
    );
    return res.json(rows);
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// ── Group DMs ───────────────────────────────────────────────────────────────
// GET /api/dms/groups — list all group conversations for current user
router.get('/groups', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const { rows } = await query(
      `SELECT dc.id, dc.name, dc.icon_url, dc.created_at, dc.creator_id,
              true AS is_group,
              (SELECT created_at FROM dm_messages WHERE conversation_id=dc.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
              COALESCE(
                json_agg(
                  json_build_object('user_id', u.id, 'username', u.username, 'avatar_url', u.avatar_url)
                  ORDER BY u.username
                ) FILTER (WHERE u.id IS NOT NULL),
                '[]'::json
              ) AS participants
       FROM dm_conversations dc
       INNER JOIN dm_participants dp_me ON dp_me.conversation_id = dc.id AND dp_me.user_id = $1
       INNER JOIN dm_participants dp_all ON dp_all.conversation_id = dc.id
       INNER JOIN users u ON u.id = dp_all.user_id
       WHERE dc.is_group = true
       GROUP BY dc.id
       ORDER BY last_message_at DESC NULLS LAST, dc.created_at DESC`,
      [userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[groups] list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dms/group/create
router.post('/group/create', authMiddleware, async (req: AuthRequest, res) => {
  const myId = req.user!.id;
  const { name, participantIds } = req.body;
  if (!Array.isArray(participantIds) || participantIds.length < 2)
    return res.status(400).json({ error: 'Need at least 2 participants' });

  try {
    // Step 1: Create base conversation row (works on any schema version)
    const convRes = await query('INSERT INTO dm_conversations DEFAULT VALUES RETURNING *');
    const conv = convRes.rows[0];

    // Step 2: Try to set group DM fields (columns added in migration — may not exist on older deployments)
    await query(
      `UPDATE dm_conversations SET name=$1, is_group=true, creator_id=$2 WHERE id=$3`,
      [name || null, myId, conv.id]
    ).catch(() => { /* columns not yet migrated — conv still usable */ });
    const allIds = [myId, ...participantIds.filter((id: string) => id !== myId)];
    for (const uid of allIds) {
      await query(
        `INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [conv.id, uid]
      ).catch(() => {
        // dm_participants may not exist; store in metadata instead
      });
    }

    // Get full info
    const participants = await query(
      `SELECT u.id AS user_id, u.username, u.avatar_url
       FROM users u WHERE u.id = ANY($1)`,
      [allIds]
    );

    // Re-query to get the updated row (with name/icon set by UPDATE above)
    const freshConv = await query('SELECT * FROM dm_conversations WHERE id=$1', [conv.id]);
    const result = { ...(freshConv.rows[0] || conv), is_group: true, participants: participants.rows };

    // Notify all participants via socket
    const io = req.app.get('io');
    if (io) {
      for (const uid of allIds) {
        io.to(`user:${uid}`).emit('group_dm_created', result);
      }
    }
    return res.status(201).json(result);
  } catch (err) {
    console.error('[group-dm] create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dms/group/:id — group info
router.get('/group/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const conv = await query(`SELECT * FROM dm_conversations WHERE id = $1 AND is_group = true`, [req.params.id]);
    if (!conv.rows.length) return res.status(404).json({ error: 'Not found' });
    return res.json({ ...conv.rows[0], participants: [] });
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/dms/group/:id/messages
router.get('/group/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
  const { before } = req.query;
  try {
    const { rows } = await query(
      `SELECT m.*, u.username AS sender_username, u.avatar_url AS sender_avatar
       FROM dm_messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1 ${before ? 'AND m.created_at < $2' : ''}
       ORDER BY m.created_at DESC LIMIT 50`,
      before ? [req.params.id, before] : [req.params.id]
    );
    return res.json(rows.reverse());
  } catch { return res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/dms/group/:id/messages
router.post('/group/:id/messages', authMiddleware, async (req: AuthRequest, res) => {
  const myId = req.user!.id;
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

  try {
    const conv = await query(`SELECT * FROM dm_conversations WHERE id = $1 AND is_group = true`, [req.params.id]);
    if (!conv.rows.length) return res.status(404).json({ error: 'Not found' });

    // Insert message and immediately join with sender info
    const { rows: [fullMsg] } = await query(
      `WITH ins AS (
         INSERT INTO dm_messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3) RETURNING *
       )
       SELECT ins.*, u.username AS sender_username, u.avatar_url AS sender_avatar,
              $1::text AS group_id
       FROM ins JOIN users u ON u.id = ins.sender_id`,
      [req.params.id, myId, content.trim()]
    );

    // Notify all group participants EXCEPT sender (sender adds locally)
    const io = req.app.get('io');
    if (io) {
      const parts = await query(
        `SELECT user_id FROM dm_participants WHERE conversation_id = $1`,
        [req.params.id]
      );
      for (const p of parts.rows) {
        if (p.user_id !== myId) {
          io.to(`user:${p.user_id}`).emit('new_group_dm', fullMsg);
        }
      }
    }

    return res.status(201).json(fullMsg);
  } catch (err) {
    console.error('[group-dm] message error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/dms/group/:id — leave (member) or delete (creator)
router.delete('/group/:id', authMiddleware, async (req: AuthRequest, res) => {
  const myId = req.user!.id;
  const groupId = req.params.id;
  try {
    const { rows: [conv] } = await query(
      `SELECT creator_id FROM dm_conversations WHERE id=$1 AND is_group=true`, [groupId]
    );
    if (!conv) return res.status(404).json({ error: 'Not found' });

    const io = req.app.get('io');
    const { rows: parts } = await query(
      `SELECT user_id FROM dm_participants WHERE conversation_id=$1`, [groupId]
    );

    if (conv.creator_id === myId) {
      // Creator: delete entire group
      await query(`DELETE FROM dm_conversations WHERE id=$1`, [groupId]);
      if (io) {
        for (const p of parts) {
          io.to(`user:${p.user_id}`).emit('group_dm_deleted', { id: groupId });
        }
      }
    } else {
      // Member: just leave
      await query(`DELETE FROM dm_participants WHERE conversation_id=$1 AND user_id=$2`, [groupId, myId]);
      if (io) {
        io.to(`user:${myId}`).emit('group_dm_left', { id: groupId });
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[group-dm] delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dms/group/:id/invite — add a new member (creator only)
router.post('/group/:id/invite', authMiddleware, async (req: AuthRequest, res) => {
  const myId = req.user!.id;
  const groupId = req.params.id;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const { rows: [conv] } = await query(
      `SELECT creator_id FROM dm_conversations WHERE id=$1 AND is_group=true`, [groupId]
    );
    if (!conv) return res.status(404).json({ error: 'Not found' });
    if (conv.creator_id !== myId) return res.status(403).json({ error: 'Only creator can invite' });

    await query(
      `INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [groupId, userId]
    );

    // Get fresh group + full participant list
    const [groupInfo, participants] = await Promise.all([
      query(`SELECT * FROM dm_conversations WHERE id=$1`, [groupId]),
      query(
        `SELECT u.id AS user_id, u.username, u.avatar_url
         FROM dm_participants dp JOIN users u ON u.id=dp.user_id
         WHERE dp.conversation_id=$1`, [groupId]
      )
    ]);
    const fullGroup = { ...groupInfo.rows[0], participants: participants.rows };

    const io = req.app.get('io');
    if (io) {
      // Tell new member — they'll add the group to their list
      io.to(`user:${userId}`).emit('group_dm_created', fullGroup);
      // Tell existing members the participant list changed
      for (const p of participants.rows) {
        if (p.user_id !== userId) {
          io.to(`user:${p.user_id}`).emit('group_dm_member_added', {
            group_id: groupId,
            user: participants.rows.find((u: any) => u.user_id === userId),
          });
        }
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[group-dm] invite error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
