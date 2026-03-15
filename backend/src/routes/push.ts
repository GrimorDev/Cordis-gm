import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// POST /push/subscribe - save push subscription
router.post(
  '/subscribe',
  authMiddleware,
  body('endpoint').isURL().withMessage('endpoint must be a valid URL'),
  body('p256dh').isString().notEmpty().withMessage('p256dh is required'),
  body('auth').isString().notEmpty().withMessage('auth is required'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user!.id;
      const { endpoint, p256dh, auth } = req.body as {
        endpoint: string;
        p256dh: string;
        auth: string;
      };

      const { rows } = await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (endpoint)
         DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_id = EXCLUDED.user_id
         RETURNING *`,
        [userId, endpoint, p256dh, auth]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('POST /push/subscribe error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /push/subscribe - remove subscription by user
router.delete('/subscribe', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await query(
      'DELETE FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /push/subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
