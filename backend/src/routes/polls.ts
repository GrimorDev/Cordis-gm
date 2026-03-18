import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Helper: fetch full poll in the format the frontend expects
async function fetchPollFull(pollId: string, userId: string) {
  const { rows: [poll] } = await query('SELECT * FROM polls WHERE id = $1', [pollId]);
  if (!poll) return null;

  const { rows: voteCounts } = await query(
    `SELECT option_id, COUNT(*) as count FROM poll_votes WHERE poll_id = $1 GROUP BY option_id`,
    [pollId]
  );
  const { rows: userVotes } = await query(
    'SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
    [pollId, userId]
  );

  const voteCountMap: Record<string, number> = {};
  let totalVotes = 0;
  for (const row of voteCounts) {
    const c = parseInt(row.count, 10);
    voteCountMap[row.option_id] = c;
    totalVotes += c;
  }
  const myVotes = userVotes.map((v: { option_id: string }) => v.option_id);

  const options = (poll.options as Array<{ id: string; text: string }>).map(opt => ({
    ...opt,
    vote_count: voteCountMap[opt.id] || 0,
    user_voted: myVotes.includes(opt.id),
  }));

  return {
    ...poll,
    options,
    votes: voteCountMap,        // Record<option_id, count>  — used by frontend
    my_votes: myVotes,           // option_ids this user voted for
    total_votes: totalVotes,
  };
}

// POST /polls - create poll
router.post(
  '/',
  authMiddleware,
  body('question').isString().notEmpty().withMessage('Question is required'),
  body('options').isArray({ min: 2 }).withMessage('At least 2 options required'),
  body('options.*.id').notEmpty().withMessage('Each option must have an id'),
  body('options.*.text').isString().notEmpty().withMessage('Each option must have text'),
  body('multi_vote').optional().isBoolean(),
  body('ends_at').optional().isISO8601(),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { message_id, dm_message_id, question, options, multi_vote = false, ends_at } = req.body as {
        message_id?: string;
        dm_message_id?: string;
        question: string;
        options: Array<{ id: string; text: string }>;
        multi_vote?: boolean;
        ends_at?: string;
      };

      const { rows } = await query(
        `INSERT INTO polls (message_id, dm_message_id, question, options, multi_vote, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [message_id || null, dm_message_id || null, question, JSON.stringify(options), multi_vote, ends_at || null]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('POST /polls error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /polls/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const poll = await fetchPollFull(req.params.id, req.user!.id);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    res.json(poll);
  } catch (err) {
    console.error('GET /polls/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /polls/:id/vote
router.post(
  '/:id/vote',
  authMiddleware,
  body('option_id').isString().notEmpty().withMessage('option_id is required'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { option_id } = req.body as { option_id: string };

      const { rows: pollRows } = await query('SELECT * FROM polls WHERE id = $1', [id]);
      if (pollRows.length === 0) return res.status(404).json({ error: 'Poll not found' });

      const poll = pollRows[0];
      if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
        return res.status(400).json({ error: 'Poll has ended' });
      }

      const validOption = (poll.options as Array<{ id: string }>).some(opt => opt.id === option_id);
      if (!validOption) return res.status(400).json({ error: 'Invalid option_id' });

      if (!poll.multi_vote) {
        await query('DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2', [id, userId]);
      } else {
        const { rows: existing } = await query(
          'SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = $3',
          [id, userId, option_id]
        );
        if (existing.length > 0) return res.status(400).json({ error: 'Already voted for this option' });
      }

      await query('INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)', [id, userId, option_id]);

      await emitPollUpdated(req, id);

      const updated = await fetchPollFull(id, userId);
      res.json(updated);
    } catch (err) {
      console.error('POST /polls/:id/vote error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /polls/:id/vote
router.delete(
  '/:id/vote',
  authMiddleware,
  body('option_id').isString().notEmpty().withMessage('option_id is required'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { option_id } = req.body as { option_id: string };

      const { rows: pollRows } = await query('SELECT * FROM polls WHERE id = $1', [id]);
      if (pollRows.length === 0) return res.status(404).json({ error: 'Poll not found' });

      const poll = pollRows[0];
      if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
        return res.status(400).json({ error: 'Poll has ended' });
      }

      await query(
        'DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = $3',
        [id, userId, option_id]
      );

      await emitPollUpdated(req, id);

      const updated = await fetchPollFull(id, userId);
      res.json(updated);
    } catch (err) {
      console.error('DELETE /polls/:id/vote error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Emit aggregated vote counts to channel room (no per-user data — each client merges)
async function emitPollUpdated(req: AuthRequest, pollId: string) {
  try {
    const io = req.app.get('io');
    if (!io) return;

    const { rows: [poll] } = await query('SELECT * FROM polls WHERE id = $1', [pollId]);
    if (!poll?.message_id) return;

    const { rows: msgRows } = await query('SELECT channel_id FROM messages WHERE id = $1', [poll.message_id]);
    if (msgRows.length === 0) return;

    const { rows: voteCounts } = await query(
      `SELECT option_id, COUNT(*) as count FROM poll_votes WHERE poll_id = $1 GROUP BY option_id`,
      [pollId]
    );
    const votes: Record<string, number> = {};
    let total = 0;
    for (const row of voteCounts) {
      const c = parseInt(row.count, 10);
      votes[row.option_id] = c;
      total += c;
    }

    io.to(`channel:${msgRows[0].channel_id}`).emit('poll_updated', {
      id: pollId,
      votes,
      total_votes: total,
    });
  } catch (err) {
    console.error('emitPollUpdated error:', err);
  }
}

export default router;
