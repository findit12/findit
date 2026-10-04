import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Accept a plain SMTP URL. The replacement also prevents an accidental
// `SMTP_URL=` prefix in the value from crashing Nodemailer at startup.
const smtpUrl = process.env.USE_SMTP === 'true'
  ? process.env.SMTP_URL?.trim().replace(/^SMTP_URL=/i, '')
  : undefined;
const transport = smtpUrl
  ? nodemailer.createTransport({ url: smtpUrl })
  : nodemailer.createTransport({ jsonTransport: true });

const from = process.env.MAIL_FROM ?? 'FindIt <no-reply@findit.local>';
export const localMailDirectory = path.resolve(process.cwd(), 'dev-emails');

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!));
}

export async function initialiseLocalMailInbox() {
  await mkdir(localMailDirectory, { recursive: true });
  await writeFile(path.join(localMailDirectory, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>FindIt emails</title><style>body{font:16px system-ui;margin:40px;max-width:700px;color:#222}p{color:#666}</style></head><body><h1>FindIt emails</h1><p>No local emails yet. Request a verification or password-reset email, then refresh this page.</p></body></html>`);
}

async function saveLocalEmail(to: string, subject: string, html: string) {
  await mkdir(localMailDirectory, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.html`;
  const document = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title><style>body{font:16px system-ui;margin:40px;max-width:700px;color:#222}.meta{color:#666;border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:24px}a{color:#145c42}</style></head><body><div class="meta"><strong>To:</strong> ${escapeHtml(to)}<br><strong>Subject:</strong> ${escapeHtml(subject)}</div>${html}</body></html>`;
  await writeFile(path.join(localMailDirectory, filename), document);
  await writeFile(path.join(localMailDirectory, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>FindIt development emails</title><style>body{font:16px system-ui;margin:40px;max-width:700px}a{display:block;padding:12px 0;color:#145c42;border-bottom:1px solid #ddd}</style></head><body><h1>Development emails</h1><a href="${filename}">${escapeHtml(subject)} — ${escapeHtml(to)}</a></body></html>`);
}

async function send(to: string, subject: string, html: string) {
  if (!smtpUrl) return saveLocalEmail(to, subject, html);
  const result = await transport.sendMail({ from, to, subject, html });
  return result;
}

export function sendVerificationEmail(email: string, token: string) {
  const url = `${process.env.CLIENT_URL}/verify?token=${encodeURIComponent(token)}`;
  return send(email, 'Verify your FindIt account', `<p>Verify your account: <a href="${url}">${url}</a></p>`);
}

export function sendFoundAnnouncementConfirmation(email: string, announcementId: number) {
  const url = `${process.env.CLIENT_URL}/announcements/${announcementId}`;
  return send(email, 'Your FindIt announcement was created', `<p>Your found-object announcement is live: <a href="${url}">${url}</a></p>`);
}

export function sendPasswordResetEmail(email: string, token: string) {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return send(email, 'Reset your FindIt password', `<p>We received a request to reset your password.</p><p><a href="${url}">Choose a new password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`);
}
