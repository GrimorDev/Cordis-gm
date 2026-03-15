import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /notes/:userId - get my note about userId
router.get('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const noterId = req.user!.id;

    const { rows } = await query(
      'SELECT content FROM user_notes WHERE noter_id = $1 AND noted_id = $2',
      [noterId, userId]
    );

    if (rows.length === 0) {
      return res.json({ content: '' });
    }

    res.json({ content: rows[0].content });
  } catch (err) {
    console.error('GET /notes/:userId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /notes/:userId - upsert note
router.put(
  '/:userId',
  authMiddleware,
  body('content').isString().isLength({ max: 1000 }).withMessage('Content must be a string, max 1000 chars'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { userId } = req.params;
      const noterId = req.user!.id;
      const { content } = req.body as { content: string };

      const { rows } = await query(
        `INSERT INTO user_notes (noter_id, noted_id, content, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (noter_id, noted_id)
         DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
         RETURNING *`,
        [noterId, userId, content]
      );

      res.json({ content: rows[0].content });
    } catch (err) {
      console.error('PUT /notes/:userId error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /notes/:userId - delete note
router.delete('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const noterId = req.user!.id;

    await query(
      'DELETE FROM user_notes WHERE noter_id = $1 AND noted_id = $2',
      [noterId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /notes/:userId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
