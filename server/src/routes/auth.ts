import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email.js';

const router = Router();
const authError = { error: 'Invalid email or password.' };
const verificationExpiry = '24h';

function verificationToken(userId: number) {
  return jwt.sign({ purpose: 'verify' }, process.env.JWT_SECRET as string, { subject: String(userId), expiresIn: verificationExpiry });
}

function passwordIsValid(password: string) {
  return password.length >= 8 && /\d/.test(password);
}

router.post('/register', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const schoolDomain = process.env.SCHOOL_EMAIL_DOMAIN?.toLowerCase();
    if (!schoolDomain || !email.endsWith(`@${schoolDomain}`)) return res.status(400).json({ error: 'Use your school email address.' });
    if (!passwordIsValid(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and include a number.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, false) RETURNING id, email, is_verified', [email, passwordHash]);
    const user = result.rows[0];
    await sendVerificationEmail(user.email, verificationToken(user.id));
    res.status(201).json({ user });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
    next(error);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const decoded = jwt.verify(String(req.query.token ?? ''), process.env.JWT_SECRET as string) as jwt.JwtPayload;
    if (decoded.purpose !== 'verify' || !decoded.sub) throw new Error('invalid');
    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [decoded.sub]);
    res.json({ message: 'Your account has been verified.' });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') return res.status(400).json({ error: 'This verification link has expired. Request a new link below.', expired: true });
    res.status(400).json({ error: 'This verification link is invalid.' });
  }
});

router.post('/resend-verification', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const result = await pool.query('SELECT id, email, is_verified FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user && !user.is_verified) await sendVerificationEmail(user.email, verificationToken(user.id));
    res.json({ message: 'If an unverified account exists, a verification email has been sent.' });
  } catch (error) { next(error); }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      await pool.query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                        VALUES ($1, $2, NOW() + INTERVAL '1 hour')`, [user.id, tokenHash]);
      await sendPasswordResetEmail(user.email, token);
    }
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (error) { next(error); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!passwordIsValid(password)) return res.status(400).json({ error: 'Password must be at least 8 characters and include a number.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const reset = await pool.query(`SELECT id, user_id FROM password_reset_tokens
                                    WHERE token_hash = $1 AND expires_at > NOW()`, [tokenHash]);
    if (!reset.rows[0]) throw new Error('invalid');
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, reset.rows[0].user_id]);
    if (!result.rowCount) throw new Error('invalid');
    await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [reset.rows[0].id]);
    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (error: any) {
    res.status(400).json({ error: 'This password reset link is invalid. Request a new one.' });
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const result = await pool.query('SELECT id, email, password_hash, is_verified FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json(authError);
    const token = jwt.sign({}, process.env.JWT_SECRET as string, { subject: String(user.id), expiresIn: '8h' });
    res.json({ token, user: { id: user.id, email: user.email, isVerified: user.is_verified } });
  } catch (error) { next(error); }
});

router.post('/logout', (_req, res) => res.status(204).send());

export default router;
