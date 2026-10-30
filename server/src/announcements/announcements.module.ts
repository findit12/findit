import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ReferenceModule } from '../reference/reference.module';
import { SavedSearchesModule } from '../saved-searches/saved-searches.module';
import { Announcement } from './announcement.entity';
import { AnnouncementMatch } from './announcement-match.entity';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { PhotoStorageService } from './photo-storage.service';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
  Announcement,
  AnnouncementMatch,
  User,
  Discussion,
  Message,
]),
    AuthModule, // gives JwtService, used by JwtAuthGuard
    MailModule,
    ReferenceModule, // gives ReferenceService, used to check the ids of the form
    SavedSearchesModule, // gives SavedSearchesService, used to alert the saved searches
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, PhotoStorageService],
})
export class AnnouncementsModule {}
