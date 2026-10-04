import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { sendFoundAnnouncementConfirmation } from '../services/email.js';

const router = Router();

router.post('/found', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required.' });
    const result = await pool.query(
      `INSERT INTO found_announcements (user_id, title, description) VALUES ($1, $2, $3)
       RETURNING id, title, description, created_at`,
      [req.userId, title, description],
    );
    const announcement = result.rows[0];
    const owner = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
    await sendFoundAnnouncementConfirmation(owner.rows[0].email, announcement.id);
    res.status(201).json({ announcement });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, title, description, created_at FROM found_announcements WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Announcement not found.' });
    res.json({ announcement: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
