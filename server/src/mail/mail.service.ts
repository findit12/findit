import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// What the confirmation email needs to know about the new announcement.
export interface ConfirmedAnnouncement {
  id: number;
  title: string;
  type: 'found' | 'lost';
}

// Replaces the characters that have a meaning in HTML, so a title like "<b>" is shown as text.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly dir = path.resolve(process.cwd(), 'dev-emails');

  private getClientBaseUrl(): string {
    const raw = process.env.CLIENT_URL || 'http://localhost:5173';
    return raw.split(',')[0].trim();
  }

  // Writes the email as an HTML file in server/dev-emails. "intro" is an optional sentence
  // shown before the link; it is escaped because it can contain text typed by a user.
  private async send(to: string, subject: string, url: string, intro?: string): Promise<void> {
    try {
      await mkdir(this.dir, { recursive: true });
      const name = `${Date.now()}-${Math.random().toString(16).slice(2)}.html`;
      const introHtml = intro ? `<p>${escapeHtml(intro)}</p>` : '';
      await writeFile(
        path.join(this.dir, name),
        `<h1>${subject}</h1><p>To: ${to}</p>${introHtml}<p><a href="${url}">${url}</a></p>`,
      );
      this.logger.log(`Local email saved: ${path.join(this.dir, name)}`);
    } catch (error) {
      this.logger.error('Email could not be saved', error);
    }
  }

  async verification(to: string, token: string): Promise<void> {
    const base = this.getClientBaseUrl();
    await this.send(to, 'Verify your FindIt account', `${base}/verify?token=${token}`);
  }

  async reset(to: string, token: string): Promise<void> {
    const base = this.getClientBaseUrl();
    await this.send(to, 'Reset your FindIt password', `${base}/reset-password?token=${token}`);
  }

  // SCRUM-17 (FR-07): confirmation after a found or lost declaration, with a link to its page.
  async confirmation(to: string, announcement: ConfirmedAnnouncement): Promise<void> {
    const base = this.getClientBaseUrl();
    const subject =
      announcement.type === 'found'
        ? 'Your found object is published on FindIt'
        : 'Your lost object is published on FindIt';
    const intro = `Your announcement "${announcement.title}" is online. You can see it, edit it or delete it from its page.`;
    await this.send(to, subject, `${base}/announcements/${announcement.id}`, intro);
  }

  // SCRUM-27: sent to the owner of a saved search when a new announcement matches it.
  async savedSearchAlert(to: string, announcement: ConfirmedAnnouncement): Promise<void> {
    const base = this.getClientBaseUrl();
    const kind = announcement.type === 'found' ? 'found object' : 'lost object';
    const intro = `A new ${kind} matches your saved search: "${announcement.title}".`;
    await this.send(
      to,
      'A new announcement matches your saved search',
      `${base}/announcements/${announcement.id}`,
      intro,
    );
  }
}
