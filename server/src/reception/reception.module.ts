import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { AuthModule } from '../auth/auth.module';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';
import { MailModule } from '../mail/mail.module';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

// FR-14, FR-16, FR-32: the objects that are at the reception desk.
@Module({
  imports: [TypeOrmModule.forFeature([Announcement, Discussion, Message]), AuthModule, MailModule],
  controllers: [ReceptionController],
  providers: [ReceptionService],
})
export class ReceptionModule {}
