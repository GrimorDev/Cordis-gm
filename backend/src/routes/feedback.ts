import { Router, Response } from 'express';
import multer from 'multer';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';
import { saveUploadedFile } from '../services/storage';

const router = Router();

const screenshotFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) cb(new Error('Plik musi być obrazem'));
  else cb(null, true);
};

const uploadScreenshot = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: screenshotFilter,
});

// ── POST /api/feedback/qa-report ────────────────────────────────────────────
// Wewnętrzny "zgłoś błąd" dla QA/developer/admin (Ctrl+Shift+Z w aplikacji) —
// publikuje sformatowane zgłoszenie na #log-qa (kategoria FEEDBACK) na
// serwerze Cordyn Develop jako automatyczną wiadomość ("🐞 QA Log").
router.post('/qa-report', authMiddleware, (req: AuthRequest, res: Response) => {
  uploadScreenshot.single('screenshot')(req, res, async (err) => {
    if (err) {
      const code = (err as any).code;
      if (code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Screenshot za duży — maksymalny rozmiar to 8 MB' });
      }
      return res.status(400).json({ error: err.message });
    }

    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    if (!title || title.length > 150) {
      return res.status(400).json({ error: 'Tytuł jest wymagany (maks. 150 znaków)' });
    }
    if (!description || description.length > 3000) {
      return res.status(400).json({ error: 'Opis jest wymagany (maks. 3000 znaków)' });
    }

    const userId = req.user!.id;

    // ── Permission: globalna odznaka QA / developer / admin, lub is_admin ──
    const { rows: [perm] } = await query(
      `SELECT 1 FROM users u
       LEFT JOIN user_badges ub ON ub.user_id = u.id
       LEFT JOIN global_badges gb ON gb.id = ub.badge_id
       WHERE u.id = $1 AND (u.is_admin OR gb.name IN ('qa','developer','admin'))
       LIMIT 1`,
      [userId]
    );
    if (!perm) return res.status(403).json({ error: 'Brak uprawnień do zgłaszania błędów QA' });

    // ── Resolve #log-qa w kategorii FEEDBACK na serwerze Cordyn Develop ─────
    const { rows: [target] } = await query(
      `SELECT c.id AS channel_id, c.server_id
       FROM channels c
       JOIN channel_categories cc ON cc.id = c.category_id
       JOIN servers s ON s.id = c.server_id
       WHERE s.name ILIKE '%cordyn%develop%'
         AND cc.name ILIKE 'feedback'
         AND c.name ILIKE 'log-qa'
       LIMIT 1`
    );
    if (!target) {
      return res.status(500).json({
        error: 'Nie znaleziono kanału #log-qa w kategorii FEEDBACK na serwerze Cordyn Develop',
      });
    }

    // ── Opcjonalny screenshot ────────────────────────────────────────────────
    let attachmentUrl: string | null = null;
    if (req.file) {
      const { url } = await saveUploadedFile(req.file.buffer, req.file.mimetype, req.file.originalname, 'qa-reports');
      attachmentUrl = url;
    }

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const content = `🐞 **Nowe zgłoszenie QA**\n👤 Zgłaszający: **${req.user!.username}**\n🕒 Data: ${dateStr}\n\n📌 **${title}**\n\n${description}`;

    const { rows: [msgRow] } = await query(
      `INSERT INTO messages (channel_id, sender_id, content, attachment_url, is_automated, system_name)
       VALUES ($1,$2,$3,$4,true,'🐞 QA Log') RETURNING *`,
      [target.channel_id, userId, content, attachmentUrl]
    );

    const io = req.app.get('io');
    if (io && msgRow) {
      const payload = {
        ...msgRow,
        sender: { id: userId, username: req.user!.username, avatar_url: null, status: 'online', custom_status: null },
      };
      io.to(`channel:${target.channel_id}`).emit('new_message', payload);
      io.to(`server:${target.server_id}`).emit('new_message', payload);
    }

    return res.json({ ok: true });
  });
});

export default router;
