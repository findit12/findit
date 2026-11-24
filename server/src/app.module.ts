import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { User } from './users/user.entity';
import { AuthToken } from './auth/auth-token.entity';
import { Announcement } from './announcements/announcement.entity';
import { AnnouncementMatch } from './announcements/announcement-match.entity';
import { Category } from './reference/category.entity';
import { ObjectType } from './reference/object-type.entity';
import { Place } from './reference/place.entity';
import { ReferenceModule } from './reference/reference.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { SavedSearch } from './saved-searches/saved-search.entity';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { Discussion } from './discussions/discussion.entity';
import { Message } from './discussions/message.entity';
import { Report } from './reports/report.entity';
import { AuditLog } from './reports/audit-log.entity';
import { ReportsModule } from './reports/reports.module';
import { DiscussionsModule } from './discussions/discussions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
  User,
  AuthToken,
  Category,
  ObjectType,
  Message,
  Place,
  Announcement,
  SavedSearch,
  AnnouncementMatch,
  Discussion,
  Report,
  AuditLog,
],
      synchronize: false,
    }),
    UsersModule,
    MailModule,
    AuthModule,
    ReferenceModule,
    AnnouncementsModule,
    SavedSearchesModule,
    DiscussionsModule,
    ReportsModule,
  ],
})
export class AppModule {}
