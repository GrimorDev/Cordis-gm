import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// ── Folders ──────────────────────────────────────────────────────────────────

// GET /api/bookmarks/folders
router.get('/folders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, name, color, icon, position, created_at
       FROM bookmark_folders
       WHERE user_id = $1
       ORDER BY position, created_at`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('bookmark_folders GET error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bookmarks/folders
router.post('/folders', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, icon = '📁', color = 'indigo' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Podaj nazwę folderu' });
  try {
    const { rows: [{ max_pos }] } = await query(
      `SELECT COALESCE(MAX(position), -1) AS max_pos FROM bookmark_folders WHERE user_id = $1`,
      [req.user!.id]
    );
    const { rows } = await query(
      `INSERT INTO bookmark_folders (user_id, name, icon, color, position)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.id, name.trim().slice(0, 50), String(icon).slice(0, 10), String(color).slice(0, 20), (max_pos as number) + 1]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('bookmark_folders POST error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bookmarks/folders/:id
router.put('/folders/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, icon, color } = req.body;
  try {
    const sets: string[] = [];
    const vals: unknown[] = [req.params.id, req.user!.id];
    if (name !== undefined) sets.push(`name = $${vals.push(String(name).trim().slice(0, 50))}`);
    if (icon !== undefined) sets.push(`icon = $${vals.push(String(icon).slice(0, 10))}`);
    if (color !== undefined) sets.push(`color = $${vals.push(String(color).slice(0, 20))}`);
    if (!sets.length) return res.status(400).json({ error: 'Brak zmian' });
    const { rows } = await query(
      `UPDATE bookmark_folders SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Folder nie znaleziony' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('bookmark_folders PUT error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bookmarks/folders/:id
router.delete('/folders/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // bookmarks in this folder get folder_id = NULL (ON DELETE SET NULL in schema)
    await query(
      `DELETE FROM bookmark_folders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('bookmark_folders DELETE error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Bookmarks ─────────────────────────────────────────────────────────────────

// GET /api/bookmarks?folder_id=<uuid|none>
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { folder_id } = req.query as Record<string, string>;
  try {
    const params: unknown[] = [req.user!.id];
    let folderFilter = '';
    if (folder_id === 'none') {
      folderFilter = 'AND b.folder_id IS NULL';
    } else if (folder_id) {
      folderFilter = `AND b.folder_id = $${params.push(folder_id)}`;
    }

    const { rows } = await query(
      `SELECT
         b.id, b.message_id, b.dm_message_id, b.folder_id, b.note, b.created_at,
         CASE
           WHEN b.message_id IS NOT NULL THEN json_build_object(
             'id', m.id, 'content', m.content, 'created_at', m.created_at,
             'attachment_url', m.attachment_url,
             'author', json_build_object('id', mu.id, 'username', mu.username, 'avatar_url', mu.avatar_url),
             'channel_id', m.channel_id
           )
           ELSE json_build_object(
             'id', dm.id, 'content', dm.content, 'created_at', dm.created_at,
             'attachment_url', dm.attachment_url,
             'author', json_build_object('id', dmu.id, 'username', dmu.username, 'avatar_url', dmu.avatar_url),
             'dm_id', dm.conversation_id
           )
         END as message
       FROM message_bookmarks b
       LEFT JOIN messages m ON m.id = b.message_id
       LEFT JOIN users mu ON mu.id = m.sender_id
       LEFT JOIN dm_messages dm ON dm.id = b.dm_message_id
       LEFT JOIN users dmu ON dmu.id = dm.sender_id
       WHERE b.user_id = $1 ${folderFilter}
       ORDER BY b.created_at DESC
       LIMIT 200`,
      params
    );
    return res.json(rows);
  } catch (err) {
    console.error('bookmarks GET error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bookmarks
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { message_id, dm_message_id, folder_id } = req.body;
  if (!message_id && !dm_message_id)
    return res.status(400).json({ error: 'Podaj message_id lub dm_message_id' });
  try {
    const { rows } = await query(
      `INSERT INTO message_bookmarks (user_id, message_id, dm_message_id, folder_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id, folder_id`,
      [req.user!.id, message_id || null, dm_message_id || null, folder_id || null]
    );
    return res.status(201).json(rows[0] || { ok: true });
  } catch (err) {
    console.error('bookmarks POST error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bookmarks/:id/folder  — move bookmark to folder (folder_id: null removes)
router.put('/:id/folder', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { folder_id } = req.body;
  try {
    const { rows } = await query(
      `UPDATE message_bookmarks SET folder_id = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, folder_id`,
      [folder_id || null, req.params.id, req.user!.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Zakładka nie znaleziona' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('bookmarks PUT folder error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bookmarks  — by message_id or dm_message_id
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { message_id, dm_message_id } = req.body;
  if (!message_id && !dm_message_id)
    return res.status(400).json({ error: 'Podaj message_id lub dm_message_id' });
  try {
    if (message_id) {
      await query('DELETE FROM message_bookmarks WHERE user_id=$1 AND message_id=$2', [req.user!.id, message_id]);
    } else {
      await query('DELETE FROM message_bookmarks WHERE user_id=$1 AND dm_message_id=$2', [req.user!.id, dm_message_id]);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('bookmarks DELETE error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bookmarks/:id  — by bookmark id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM message_bookmarks WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('bookmarks DELETE by id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
