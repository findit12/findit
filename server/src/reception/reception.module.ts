import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { ReferenceModule } from '../reference/reference.module';
import { AuthModule } from '../auth/auth.module';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';
import { AdminReceptionController } from './admin-reception.controller';
import { AdminClaimsController } from './admin-claims.controller';
import { Claim } from './claim.entity';
import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { ReceptionDeclarationService } from './reception-declaration.service';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

// FR-14, FR-16, FR-32: the objects that are at the reception desk.
@Module({
  imports: [TypeOrmModule.forFeature([Announcement, Discussion, Message, Claim, User]), AuthModule, MailModule, AnnouncementsModule, ReferenceModule],
  controllers: [ReceptionController, ClaimsController, AdminClaimsController, AdminReceptionController],
  providers: [ReceptionService, ClaimsService, ReceptionDeclarationService],
})
export class ReceptionModule {}
