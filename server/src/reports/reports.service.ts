import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,

} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement, AnnouncementStatus } from '../announcements/announcement.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Report, ReportStatus } from './report.entity';
import { CreateReportDto } from './create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reports: Repository<Report>,
    @InjectRepository(Announcement)
    private readonly announcements: Repository<Announcement>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async createReport(announcementId: number, reporterId: number, dto: CreateReportDto) {
    const announcement = await this.announcements.findOne({

      where: { id: announcementId },
      select: { id: true, status: true },
    });

    if (
      !announcement ||
      announcement.status === AnnouncementStatus.Deleted ||
      announcement.status === AnnouncementStatus.Hidden
    ) {
      throw new NotFoundException('Announcement not found.');
    }

    const report = await this.reports.save(
      this.reports.create({
        announcementId,
        reporterId,
        reason: dto.reason,
        status: ReportStatus.Pending,
      }),
    );

    return {
      id: report.id,
      announcementId: report.announcementId,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  async getAdminQueue() {
    const reports = await this.reports
      .createQueryBuilder('report')
      .innerJoinAndSelect('report.announcement', 'announcement')
      .innerJoinAndSelect('report.reporter', 'reporter')
      .select([
        'report.id',
        'report.announcementId',
        'report.reporterId',
        'report.reason',
        'report.status',
        'report.createdAt',
        'announcement.id',
        'announcement.title',
        'announcement.type',
        'announcement.status',
        'announcement.authorId',
        'reporter.id',
        'reporter.email',
        'reporter.firstName',
        'reporter.lastName',
      ])
      .where('report.status = :status', { status: ReportStatus.Pending })
      .orderBy('report.createdAt', 'ASC')
      .getMany();

    return reports.map((report) => ({

      id: report.id,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      announcement: {
        id: report.announcement.id,
        title: report.announcement.title,
        type: report.announcement.type,
        status: report.announcement.status,
        authorId: report.announcement.authorId,
      },
      reporter: {
        id: report.reporter.id,
        email: report.reporter.email,
        firstName: report.reporter.firstName,
        lastName: report.reporter.lastName,
      },
    }));
  }

  async hideAnnouncement(announcementId: number) {
    const announcement = await this.announcements.findOne({
      where: { id: announcementId },
    });

    if (!announcement || announcement.status === AnnouncementStatus.Deleted) {
      throw new NotFoundException('Announcement not found.');
    }

    announcement.status = AnnouncementStatus.Hidden;
    await this.announcements.save(announcement);

    await this.reports.update(
      { announcementId, status: ReportStatus.Pending },
      { status: ReportStatus.Reviewed },
    );

    return {
      id: announcement.id,
      status: announcement.status,
    };
  }

  async deleteAnnouncement(announcementId: number) {
    const announcement = await this.announcements.findOne({
      where: { id: announcementId },
    });

    if (!announcement || announcement.status === AnnouncementStatus.Deleted) {
      throw new NotFoundException('Announcement not found.');
    }

    announcement.status = AnnouncementStatus.Deleted;
    await this.announcements.save(announcement);

    await this.reports.update(
      { announcementId, status: ReportStatus.Pending },
      { status: ReportStatus.Reviewed },
    );

    return {
      id: announcement.id,
      status: announcement.status,
    };
  }

  async blockUser(targetUserId: number, actingAdminId: number) {
    if (targetUserId === actingAdminId) {
      throw new BadRequestException('You cannot block your own account.');
    }

    const user = await this.users.findOne({ where: { id: targetUserId } });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === UserRole.Admin) {
      throw new ForbiddenException('Administrator accounts cannot be blocked.');
    }

    user.status = UserStatus.Suspended;
    await this.users.save(user);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
    };
  }

  async dismissReport(reportId: number) {
    const report = await this.reports.findOne({ where: { id: reportId } });

    if (!report) {
      throw new NotFoundException('Report not found.');
    }

    report.status = ReportStatus.Dismissed;
    await this.reports.save(report);

    return {
      id: report.id,
      status: report.status,
    };
  }
}
