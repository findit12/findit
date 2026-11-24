import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { AuthModule } from '../auth/auth.module';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';
import { AdminClaimsController } from './admin-claims.controller';
import { Claim } from './claim.entity';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

// FR-14, FR-16, FR-32: the objects that are at the reception desk.
@Module({
  imports: [TypeOrmModule.forFeature([Announcement, Discussion, Message, Claim, User]), AuthModule, MailModule],
  controllers: [ReceptionController, ClaimsController, AdminClaimsController],
  providers: [ReceptionService, ClaimsService],
})
export class ReceptionModule {}
