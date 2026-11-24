import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { Discussion } from '../discussions/discussion.entity';
import { User, UserRole } from '../users/user.entity';

// SCRUM-50 (FR-31, SDD section 7 "Rate limiting"): a student can declare 10 announcements and start
// 20 discussions per day. Beyond that the request is refused with 429.
export const MAX_ANNOUNCEMENTS_PER_DAY = 10;
export const MAX_DISCUSSIONS_PER_DAY = 20;

// Midnight of the current day, in the time zone of the server.
export function startOfToday(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

@Injectable()
export class DailyLimitsService {
  constructor(
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    @InjectRepository(Discussion) private readonly discussions: Repository<Discussion>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Called before an announcement is created. Administrators (reception staff, FR-32) are not limited.
  async assertCanDeclare(userId: number): Promise<void> {
    if (await this.isAdmin(userId)) return;
    const today = await this.announcements.count({
      where: { authorId: userId, createdAt: MoreThanOrEqual(startOfToday()) },
    });
    if (today >= MAX_ANNOUNCEMENTS_PER_DAY) {
      throw new HttpException(
        `You have reached the limit of ${MAX_ANNOUNCEMENTS_PER_DAY} announcements per day. Try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // Called before a discussion is created.
  async assertCanStartDiscussion(userId: number): Promise<void> {
    if (await this.isAdmin(userId)) return;
    const today = await this.discussions.count({
      where: { ownerId: userId, createdAt: MoreThanOrEqual(startOfToday()) },
    });
    if (today >= MAX_DISCUSSIONS_PER_DAY) {
      throw new HttpException(
        `You have reached the limit of ${MAX_DISCUSSIONS_PER_DAY} new discussions per day. Try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async isAdmin(userId: number): Promise<boolean> {
    const user = await this.users.findOneBy({ id: userId });
    return user?.role === (UserRole.Admin as string);
  }
}
