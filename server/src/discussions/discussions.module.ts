import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import { Discussion } from './discussion.entity';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';
import { Message } from './message.entity';

// SCRUM-30 to SCRUM-32: private discussions between the author of an announcement and another user.
@Module({
  imports: [
    TypeOrmModule.forFeature([Discussion, Message, Announcement, User]),
    AuthModule, // gives JwtService, used by JwtAuthGuard
    MailModule,
  ],
  controllers: [DiscussionsController],
  providers: [DiscussionsService],
})
export class DiscussionsModule {}
