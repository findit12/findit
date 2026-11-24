
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

  // SCRUM-32 (FR-13): sent for the first unread message of a discussion only.
  async newMessage(to: string, details: { discussionId: number; announcementTitle: string }): Promise<void> {
    const base = this.getClientBaseUrl();
    await this.send(
      to,
      'You have a new FindIt message',
      `${base}/messages?discussionId=${details.discussionId}`,
      `You have received a new message in the discussion about "${details.announcementTitle}". Sign in to FindIt to reply.`,
    );
  }

  // Writes the email as an HTML file in server/dev-emails.
  // Retries up to 3 times if saving the email fails.
  private async send(to: string, subject: string, url: string, intro?: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await mkdir(this.dir, { recursive: true });

        const name = `${Date.now()}-${Math.random().toString(16).slice(2)}.html`;
        const introHtml = intro ? `<p>${escapeHtml(intro)}</p>` : '';

        await this.writePreview(
          path.join(this.dir, name),
          `<h1>${subject}</h1><p>To: ${to}</p>${introHtml}<p><a href="${url}">${url}</a></p>`,
        );

        this.logger.log(`Local email saved: ${path.join(this.dir, name)}`);
        return;
      } catch (error) {
        if (attempt < 3) {
          this.logger.warn(`Email save failed. Retrying (${attempt}/3)...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 100));
        } else {
          this.logger.error('Email could not be saved after 3 attempts', error);
        }
      }
    }
  }

  private async writePreview(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content);
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

  // SCRUM-28 (FR-13 "match alert"): sent to both authors when a found and a lost announcement
  // look alike. "announcement" is the OTHER announcement, the one the user should look at.
  async matchAlert(to: string, announcement: ConfirmedAnnouncement): Promise<void> {
    const base = this.getClientBaseUrl();
    const intro =
      announcement.type === 'found'
        ? `A found object may be yours: "${announcement.title}". Open it to check, and start a discussion if it is yours.`
        : `Someone may have lost the object you found: "${announcement.title}". Open the announcement to check.`;
    await this.send(to, 'FindIt found a possible match', `${base}/announcements/${announcement.id}`, intro);
  }

  // SCRUM-30 (FR-13 "new discussion"): sent to the author of the announcement.
  async discussionStarted(to: string, announcement: ConfirmedAnnouncement, discussionId: number): Promise<void> {
    const base = this.getClientBaseUrl();
    const intro =
      announcement.type === 'found'
        ? `Someone thinks your found object "${announcement.title}" is theirs and sent a proof. Sign in to FindIt to check it.`
        : `Someone may have found your lost object "${announcement.title}". Sign in to FindIt to read their message.`;
    await this.send(to, 'New discussion about your announcement', `${base}/messages?discussionId=${discussionId}`, intro);
  }

  // SCRUM-51 (FR-13 "archive reminder"): sent once, 7 days before the announcement is archived.
  async archiveReminder(to: string, announcement: ConfirmedAnnouncement, archiveDate: Date): Promise<void> {
    const base = this.getClientBaseUrl();
    const day = archiveDate.toISOString().slice(0, 10);
    const intro = `Your announcement "${announcement.title}" will be archived on ${day} if the object has not been claimed by then. An archived announcement is no longer shown in the search results.`;
    await this.send(to, 'Your FindIt announcement will be archived soon', `${base}/announcements/${announcement.id}`, intro);
  }

  // SCRUM-32 (FR-13 "item returned"): sent to the other person when one of them confirms the handover.
  async handover(
    to: string,
    announcement: { id: number; title: string },
    confirmedBy: 'finder' | 'owner' = 'finder',
  ): Promise<void> {
    const base = this.getClientBaseUrl();

    const confirmer = confirmedBy === 'finder' ? 'finder' : 'owner';

    const intro = `The ${confirmer} has confirmed the handover of "${announcement.title}". The item has been marked as returned.`;

    await this.send(
      to,
      'Your FindIt item handover is confirmed',
      `${base}/announcements/${announcement.id}`,
      intro,
    );
  }
}
