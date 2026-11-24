import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

// SCRUM-51 (FR-20): the daily job that archives old announcements and sends the reminders.
@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, User]), // User: used by AdminGuard
    AuthModule, // gives JwtService, used by JwtAuthGuard
    MailModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
