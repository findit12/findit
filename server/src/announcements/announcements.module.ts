import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { ReferenceModule } from '../reference/reference.module';
import { Announcement } from './announcement.entity';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { PhotoStorageService } from './photo-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, User]),
    AuthModule, // gives JwtService, used by JwtAuthGuard
    MailModule,
    ReferenceModule, // gives ReferenceService, used to check the ids of the form
  ],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, PhotoStorageService],
})
export class AnnouncementsModule {}
