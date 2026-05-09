import { Router, Request, Response } from 'express';
import { query, getClient } from '../../db/pool';

const router = Router();

const botOnly = (req: Request, res: Response): boolean => {
  if (req.v1Principal!.type !== 'bot') {
    res.status(403).json({ error: 'Only bots can manage commands', code: 50013 });
    return false;
  }
  return true;
};

const validateCmd = (cmd: any): string | null => {
  if (!cmd.name || typeof cmd.name !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(cmd.name))
    return `Invalid command name "${cmd.name}". Use lowercase letters, numbers, _ or - (max 32 chars).`;
  if (!cmd.description || typeof cmd.description !== 'string' || cmd.description.length > 100)
    return 'description required, max 100 chars';
  if (cmd.usage && (typeof cmd.usage !== 'string' || cmd.usage.length > 100))
    return 'usage max 100 chars';
  return null;
};

/**
 * PUT /api/v1/bot/commands
 * Replace ALL commands for this bot atomically.
 * Body: Array of { name, description, usage? }
 */
router.put('/', async (req: Request, res: Response) => {
  if (!botOnly(req, res)) return;
  const p = req.v1Principal!;

  const commands: { name: string; description: string; usage?: string }[] = req.body;
  if (!Array.isArray(commands))
    return res.status(400).json({ error: 'Body must be an array of commands', code: 50035 });
  if (commands.length > 100)
    return res.status(400).json({ error: 'Max 100 commands per bot', code: 50035 });

  for (const cmd of commands) {
    const err = validateCmd(cmd);
    if (err) return res.status(400).json({ error: err, code: 50035 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM bot_commands WHERE application_id = $1', [p.applicationId]);
    if (commands.length > 0) {
      const vals = commands.map((_, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`);
      const params: any[] = [];
      commands.forEach(cmd => params.push(p.applicationId, cmd.name, cmd.description, cmd.usage || `/${cmd.name}`));
      await client.query(
        `INSERT INTO bot_commands (application_id, name, description, usage) VALUES ${vals.join(',')}`,
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
 * List all registered commands.
 */
router.get('/', async (req: Request, res: Response) => {
  if (!botOnly(req, res)) return;
  const p = req.v1Principal!;
  try {
    const { rows } = await query(
      'SELECT name, description, usage, created_at FROM bot_commands WHERE application_id = $1 ORDER BY name',
      [p.applicationId]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * POST /api/v1/bot/commands
 * Add a single command (non-destructive). Upserts on name conflict.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!botOnly(req, res)) return;
  const p = req.v1Principal!;

  const cmd = req.body;
  const err = validateCmd(cmd);
  if (err) return res.status(400).json({ error: err, code: 50035 });

  // Check total count
  const { rows: [{ count }] } = await query(
    'SELECT COUNT(*)::int AS count FROM bot_commands WHERE application_id = $1',
    [p.applicationId]
  );
  if (count >= 100)
    return res.status(400).json({ error: 'Max 100 commands per bot', code: 50035 });

  try {
    const { rows: [inserted] } = await query(
      `INSERT INTO bot_commands (application_id, name, description, usage)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (application_id, name) DO UPDATE
         SET description = EXCLUDED.description,
             usage = EXCLUDED.usage
       RETURNING name, description, usage, created_at`,
      [p.applicationId, cmd.name, cmd.description, cmd.usage || `/${cmd.name}`]
    );
    res.status(201).json(inserted);
  } catch (err) {
    console.error('POST /api/v1/bot/commands error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/bot/commands/:name
 * Update description or usage of an existing command.
 */
router.patch('/:name', async (req: Request, res: Response) => {
  if (!botOnly(req, res)) return;
  const p = req.v1Principal!;
  const { name } = req.params;

  const { description, usage } = req.body;
  if (!description && !usage)
    return res.status(400).json({ error: 'description or usage required', code: 50035 });
  if (description && description.length > 100)
    return res.status(400).json({ error: 'description max 100 chars', code: 50035 });
  if (usage && usage.length > 100)
    return res.status(400).json({ error: 'usage max 100 chars', code: 50035 });

  try {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (description) { updates.push(`description = $${idx++}`); params.push(description); }
    if (usage)        { updates.push(`usage = $${idx++}`);       params.push(usage); }
    params.push(p.applicationId, name);

    const { rows: [updated] } = await query(
      `UPDATE bot_commands SET ${updates.join(', ')}
       WHERE application_id = $${idx++} AND name = $${idx}
       RETURNING name, description, usage, created_at`,
      params
    );
    if (!updated) return res.status(404).json({ error: 'Command not found', code: 10063 });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * DELETE /api/v1/bot/commands/:name
 * Delete a single command by name.
 */
router.delete('/:name', async (req: Request, res: Response) => {
  if (!botOnly(req, res)) return;
  const p = req.v1Principal!;

  try {
    const { rowCount } = await query(
      'DELETE FROM bot_commands WHERE application_id = $1 AND name = $2',
      [p.applicationId, req.params.name]
    );
    if (!rowCount) return res.status(404).json({ error: 'Command not found', code: 10063 });
    res.status(204).end();
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
