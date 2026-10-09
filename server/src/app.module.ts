import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { User } from './users/user.entity';
import { AuthToken } from './auth/auth-token.entity';
import { FoundAnnouncement } from './announcements/found-announcement.entity';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, AuthToken, FoundAnnouncement],
      synchronize: false,
    }),
    UsersModule,
    MailModule,
    AuthModule,
    AnnouncementsModule,
  ],
})
export class AppModule {}
