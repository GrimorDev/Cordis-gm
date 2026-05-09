import { Router, Request, Response } from 'express';
import { query, getClient } from '../../db/pool';

const router = Router();

/**
 * PUT /api/v1/bot/commands
 * Bot registers (or replaces) its slash commands.
 *
 * Body: Array of { name, description, usage? }
 * Example:
 *   [
 *     { "name": "kukuryku", "description": "Bot pieje jak kogut 🐓", "usage": "/kukuryku" },
 *     { "name": "ping",     "description": "Sprawdź czy bot żyje",   "usage": "/ping" }
 *   ]
 */
router.put('/', async (req: Request, res: Response) => {
  const p = req.v1Principal!;
  if (p.type !== 'bot') {
    return res.status(403).json({ error: 'Only bots can register commands', code: 50013 });
  }

  const commands: { name: string; description: string; usage?: string }[] = req.body;
  if (!Array.isArray(commands)) {
    return res.status(400).json({ error: 'Body must be an array of commands', code: 50035 });
  }
  if (commands.length > 100) {
    return res.status(400).json({ error: 'Max 100 commands per bot', code: 50035 });
  }

  // Validate each command
  for (const cmd of commands) {
    if (!cmd.name || typeof cmd.name !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(cmd.name)) {
      return res.status(400).json({
        error: `Invalid command name "${cmd.name}". Use lowercase letters, numbers, _ or - (max 32 chars).`,
        code: 50035,
      });
    }
    if (!cmd.description || cmd.description.length > 100) {
      return res.status(400).json({ error: 'description required, max 100 chars', code: 50035 });
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM bot_commands WHERE application_id = $1',
      [p.applicationId]
    );
    if (commands.length > 0) {
      const vals4 = commands.map((_, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`);
      const params: any[] = [];
      commands.forEach(cmd => {
        params.push(p.applicationId, cmd.name, cmd.description, cmd.usage || `/${cmd.name}`);
      });
      await client.query(
        `INSERT INTO bot_commands (application_id, name, description, usage) VALUES ${vals4.join(',')}`,
        params
      );
    }
    await client.query('COMMIT');
    res.json({ registered: commands.length });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('PUT /api/v1/bot/commands error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/bot/commands
 * Returns the commands registered by this bot.
 */
router.get('/', async (req: Request, res: Response) => {
  const p = req.v1Principal!;
  if (p.type !== 'bot') {
    return res.status(403).json({ error: 'Only bots can access this', code: 50013 });
  }
  const { rows } = await query(
    'SELECT name, description, usage FROM bot_commands WHERE application_id = $1 ORDER BY name',
    [p.applicationId]
  );
  res.json(rows);
});

export default router;
