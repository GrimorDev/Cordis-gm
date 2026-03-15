import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

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

// GET /polls/:id - get poll with vote counts and user's own votes
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { rows: pollRows } = await query(
      'SELECT * FROM polls WHERE id = $1',
      [id]
    );

    if (pollRows.length === 0) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const poll = pollRows[0];

    // Get vote counts per option
    const { rows: voteCounts } = await query(
      `SELECT option_id, COUNT(*) as count
       FROM poll_votes
       WHERE poll_id = $1
       GROUP BY option_id`,
      [id]
    );

    // Get user's own votes
    const { rows: userVotes } = await query(
      'SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
      [id, userId]
    );

    const voteCountMap: Record<string, number> = {};
    for (const row of voteCounts) {
      voteCountMap[row.option_id] = parseInt(row.count, 10);
    }

    const userVoteSet = new Set(userVotes.map((v: { option_id: string }) => v.option_id));

    const optionsWithVotes = (poll.options as Array<{ id: string; text: string }>).map((opt) => ({
      ...opt,
      vote_count: voteCountMap[opt.id] || 0,
      user_voted: userVoteSet.has(opt.id),
    }));

    res.json({
      ...poll,
      options: optionsWithVotes,
    });
  } catch (err) {
    console.error('GET /polls/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /polls/:id/vote - vote
router.post(
  '/:id/vote',
  authMiddleware,
  body('option_id').isString().notEmpty().withMessage('option_id is required'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { option_id } = req.body as { option_id: string };

      // Check poll exists and is not expired
      const { rows: pollRows } = await query(
        'SELECT * FROM polls WHERE id = $1',
        [id]
      );

      if (pollRows.length === 0) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const poll = pollRows[0];

      if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
        return res.status(400).json({ error: 'Poll has ended' });
      }

      // Validate option_id is in poll options
      const validOption = (poll.options as Array<{ id: string }>).some((opt) => opt.id === option_id);
      if (!validOption) {
        return res.status(400).json({ error: 'Invalid option_id' });
      }

      // If not multi_vote, remove existing votes first
      if (!poll.multi_vote) {
        await query(
          'DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2',
          [id, userId]
        );
      } else {
        // Check if already voted for this option
        const { rows: existing } = await query(
          'SELECT 1 FROM poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = $3',
          [id, userId, option_id]
        );
        if (existing.length > 0) {
          return res.status(400).json({ error: 'Already voted for this option' });
        }
      }

      await query(
        'INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES ($1, $2, $3)',
        [id, userId, option_id]
      );

      // Emit poll_updated to channel room if linked to a channel message
      await emitPollUpdated(req, id, poll);

      res.json({ success: true });
    } catch (err) {
      console.error('POST /polls/:id/vote error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /polls/:id/vote - unvote
router.delete(
  '/:id/vote',
  authMiddleware,
  body('option_id').isString().notEmpty().withMessage('option_id is required'),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { option_id } = req.body as { option_id: string };

      const { rows: pollRows } = await query(
        'SELECT * FROM polls WHERE id = $1',
        [id]
      );

      if (pollRows.length === 0) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const poll = pollRows[0];

      if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
        return res.status(400).json({ error: 'Poll has ended' });
      }

      await query(
        'DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2 AND option_id = $3',
        [id, userId, option_id]
      );

      // Emit poll_updated to channel room if linked to a channel message
      await emitPollUpdated(req, id, poll);

      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /polls/:id/vote error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

async function emitPollUpdated(req: AuthRequest, pollId: string, poll: any) {
  try {
    const io = req.app.get('io');
    if (!io || !poll.message_id) return;

    const { rows: msgRows } = await query(
      'SELECT channel_id FROM messages WHERE id = $1',
      [poll.message_id]
    );

    if (msgRows.length === 0) return;

    const channelId = msgRows[0].channel_id;

    // Get updated vote counts
    const { rows: voteCounts } = await query(
      `SELECT option_id, COUNT(*) as count
       FROM poll_votes
       WHERE poll_id = $1
       GROUP BY option_id`,
      [pollId]
    );

    const voteCountMap: Record<string, number> = {};
    for (const row of voteCounts) {
      voteCountMap[row.option_id] = parseInt(row.count, 10);
    }

    io.to(`channel:${channelId}`).emit('poll_updated', {
      poll_id: pollId,
      message_id: poll.message_id,
      vote_counts: voteCountMap,
    });
  } catch (err) {
    console.error('emitPollUpdated error:', err);
  }
}

export default router;
