import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Announcement } from '../announcements/announcement.entity';
import { User } from '../users/user.entity';
import { Report } from './report.entity';
import { AuditLog } from './audit-log.entity';
import { AnnouncementReportsController } from './announcement-reports.controller';
import { AdminReportsController } from './admin-reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Announcement, User, AuditLog]),
    AuthModule,
  ],
  controllers: [AnnouncementReportsController, AdminReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
