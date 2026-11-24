import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Announcement, AnnouncementStatus } from '../announcements/announcement.entity';
import { MailService } from '../mail/mail.service';

// SCRUM-51 (FR-20, SDD "SchedulerService"): once a day, announcements that nobody claimed in
// 90 days (expiresAt, set when the announcement was created) are archived, and their author gets ONE
// reminder 7 days before.
export const REMINDER_DAYS_BEFORE = 7;

// Only public announcements are archived: a Returned, Closed, Hidden or Deleted one is already finished.
const ACTIVE_STATUSES = [AnnouncementStatus.Available, AnnouncementStatus.Open];

export interface SchedulerResult {
  archived: number;
  reminded: number;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    private readonly mail: MailService,
  ) {}

  // The single daily job (03:00). Errors are logged: a failing job must not stop the server.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyJob(): Promise<void> {
    try {
      const result = await this.run();
      this.logger.log(`Daily job: ${result.archived} archived, ${result.reminded} reminder(s) sent.`);
    } catch (err) {
      this.logger.error('Daily job failed', err instanceof Error ? err.stack : String(err));
    }
  }

  // Archives first, then sends the reminders: an announcement that is already past its date never
  // gets a reminder. Running it twice does nothing the second time (idempotent).
  async run(now: Date = new Date()): Promise<SchedulerResult> {
    const archived = await this.archiveExpired(now);
    const reminded = await this.sendReminders(now);
    return { archived, reminded };
  }

  private async archiveExpired(now: Date): Promise<number> {
    const result = await this.announcements.update(
      { status: In(ACTIVE_STATUSES), expiresAt: LessThanOrEqual(now) },
      { status: AnnouncementStatus.Archived },
    );
    return result.affected ?? 0;
  }

  // One reminder per announcement: reminderSentAt is written only when the email was sent, so a
  // failed email is tried again the next day.
  private async sendReminders(now: Date): Promise<number> {
    const limit = new Date(now);
    limit.setDate(limit.getDate() + REMINDER_DAYS_BEFORE);

    const due = await this.announcements.find({
      where: {
        status: In(ACTIVE_STATUSES),
        reminderSentAt: IsNull(),
        expiresAt: Between(now, limit),
      },
      relations: { author: true },
    });

    let sent = 0;
    for (const announcement of due) {
      try {
        await this.mail.archiveReminder(
          announcement.author.email,
          { id: announcement.id, title: announcement.title, type: announcement.type },
          announcement.expiresAt,
        );
        await this.announcements.update(announcement.id, { reminderSentAt: now });
        sent += 1;
      } catch (err) {
        this.logger.error(`Failed to send the archive reminder of announcement ${announcement.id}`, err);
      }
    }
    return sent;
  }
}
