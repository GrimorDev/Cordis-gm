import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/friends - list accepted friends
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.avatar_url, u.status, u.custom_status,
              f.id as friendship_id, f.created_at as friends_since
       FROM friends f
       INNER JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
       ORDER BY u.username`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/friends/requests - pending requests
router.get('/requests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT f.id, f.created_at,
              u.id as from_id, u.username as from_username, u.avatar_url as from_avatar,
              CASE WHEN f.requester_id = $1 THEN 'outgoing' ELSE 'incoming' END as direction
       FROM friends f
       INNER JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user!.id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friends/request - send friend request
router.post('/request', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  try {
    const { rows: [target] } = await query(
      `SELECT id FROM users WHERE username = $1`, [username]
    );
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user!.id) return res.status(400).json({ error: 'Cannot add yourself' });

    // Check existing relation
    const existing = await query(
      `SELECT * FROM friends
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [req.user!.id, target.id]
    );
    if (existing.rowCount) {
      const rel = existing.rows[0];
      if (rel.status === 'accepted') return res.status(409).json({ error: 'Already friends' });
      if (rel.status === 'pending') return res.status(409).json({ error: 'Request already exists' });
      if (rel.status === 'blocked') return res.status(403).json({ error: 'Blocked' });
    }

    const { rows: [friendship] } = await query(
      `INSERT INTO friends (requester_id, addressee_id) VALUES ($1, $2) RETURNING *`,
      [req.user!.id, target.id]
    );

    // Notify via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${target.id}`).emit('friend_request', {
        from: { id: req.user!.id, username: req.user!.username },
      });
    }

    return res.status(201).json(friendship);
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/friends/request/:id - accept or reject
router.put('/request/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { action } = req.body; // 'accept' | 'reject'
  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be accept or reject' });
  }

  try {
    const { rows: [req_] } = await query(
      `SELECT * FROM friends WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [req.params.id, req.user!.id]
    );
    if (!req_) return res.status(404).json({ error: 'Request not found' });

    if (action === 'accept') {
      await query(`UPDATE friends SET status = 'accepted' WHERE id = $1`, [req.params.id]);

      const { rows: [user] } = await query(
        `SELECT id, username, avatar_url, status FROM users WHERE id = $1`,
        [req_.requester_id]
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req_.requester_id}`).emit('friend_accepted', {
          user: { id: req.user!.id, username: req.user!.username },
        });
      }
      return res.json({ message: 'Friend request accepted', user });
    } else {
      await query(`DELETE FROM friends WHERE id = $1`, [req.params.id]);
      return res.json({ message: 'Friend request rejected' });
    }
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/friends/:id - remove friend
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `DELETE FROM friends
       WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)`,
      [req.params.id, req.user!.id]
    );
    return res.json({ message: 'Friend removed' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
