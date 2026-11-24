import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { Discussion } from '../discussions/discussion.entity';
import { User } from '../users/user.entity';
import { DailyLimitsService } from './daily-limits.service';

// SCRUM-50: the daily limits (FR-31), used by the announcements and the discussions.
@Module({
  imports: [TypeOrmModule.forFeature([Announcement, Discussion, User])],
  providers: [DailyLimitsService],
  exports: [DailyLimitsService],
})
export class LimitsModule {}
