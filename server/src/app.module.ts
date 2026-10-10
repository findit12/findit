import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { User } from './users/user.entity';
import { AuthToken } from './auth/auth-token.entity';
import { Announcement } from './announcements/announcement.entity';
import { Category } from './reference/category.entity';
import { ObjectType } from './reference/object-type.entity';
import { Place } from './reference/place.entity';
import { ReferenceModule } from './reference/reference.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, AuthToken, Category, ObjectType, Place, Announcement],
      synchronize: false,
    }),
    UsersModule,
    MailModule,
    AuthModule,
    ReferenceModule,
    AnnouncementsModule,
  ],
})
export class AppModule {}
