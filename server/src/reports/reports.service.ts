import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement, AnnouncementStatus, AnnouncementType } from '../announcements/announcement.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { AuditAction, AuditLog, AuditTarget } from './audit-log.entity';
import { CreateReportDto } from './create-report.dto';
import { Report, ReportStatus } from './report.entity';

// SDD section 4 "Transitions": an administrator can hide an active announcement, restore it, and
// delete it while it is active or hidden. Returned, Closed, Deleted and Archived are final: 409.
const ACTIVE_STATUSES = [AnnouncementStatus.Available, AnnouncementStatus.Open];

// What the reporter can see of a report.
function toReportView(report: Report) {
  return {
    id: report.id,
    announcementId: report.announcementId,
    reason: report.reason,
    status: report.status,
    createdAt: report.createdAt,
  };
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
  ) {}

  // FR-18: report an announcement with a reason.
  async createReport(announcementId: number, reporterId: number, dto: CreateReportDto) {
    const announcement = await this.announcements.findOne({
      where: { id: announcementId },
      select: { id: true, status: true, authorId: true },
    });
    if (
      !announcement ||
      announcement.status === AnnouncementStatus.Deleted ||
      announcement.status === AnnouncementStatus.Hidden
    ) {
      throw new NotFoundException('Announcement not found.');
    }
    if (announcement.authorId === reporterId) {
      throw new ForbiddenException('You cannot report your own announcement.');
    }
    // One pending report per user and announcement: the queue is not flooded by the same person.
    const pending = await this.reports.findOneBy({ announcementId, reporterId, status: ReportStatus.Pending });
    if (pending) {
      throw new ConflictException('You already reported this announcement.');
    }

    const report = await this.reports.save(
      this.reports.create({ announcementId, reporterId, reason: dto.reason, status: ReportStatus.Pending }),
    );
    return { id: report.id, announcementId: report.announcementId, status: report.status, createdAt: report.createdAt };
  }

  // Lab 6: the reports written by the signed-in user, newest first.
  async listMine(reporterId: number) {
    const reports = await this.reports.find({ where: { reporterId }, order: { createdAt: 'DESC', id: 'DESC' } });
    return { reports: reports.map(toReportView) };
  }

  async getMine(reportId: number, reporterId: number) {
    return { report: toReportView(await this.findOwnReport(reportId, reporterId)) };
  }

  // The reporter can still change the reason while no administrator has looked at the report.
  async updateMine(reportId: number, reporterId: number, dto: CreateReportDto) {
    const report = await this.findOwnReport(reportId, reporterId);
    this.checkPending(report);
    report.reason = dto.reason;
    return { report: toReportView(await this.reports.save(report)) };
  }

  // The reporter can withdraw a report that is still pending.
  async removeMine(reportId: number, reporterId: number): Promise<void> {
    const report = await this.findOwnReport(reportId, reporterId);
    this.checkPending(report);
    await this.reports.delete(report.id);
  }

  private async findOwnReport(reportId: number, reporterId: number): Promise<Report> {
    const report = await this.reports.findOneBy({ id: reportId });
    if (!report) {
      throw new NotFoundException('Report not found.');
    }
    if (report.reporterId !== reporterId) {
      throw new ForbiddenException('You can only use your own reports.');
    }
    return report;
  }

  private checkPending(report: Report): void {
    if (report.status !== ReportStatus.Pending) {
      throw new ConflictException('This report has already been handled.');
    }
  }

  // UC-4: the moderation queue, oldest report first.
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

  // FR-19: hide an active announcement. It can be restored later.
  async hideAnnouncement(announcementId: number, adminId: number) {
    const announcement = await this.findAnnouncement(announcementId);
    if (!ACTIVE_STATUSES.includes(announcement.status)) {
      throw new ConflictException(`This announcement is ${announcement.status}: only an active announcement can be hidden.`);
    }
    return this.moderate(announcement, AnnouncementStatus.Hidden, AuditAction.Hide, adminId);
  }

  // FR-19: a hidden announcement goes back to its previous status. Only active announcements can
  // be hidden, so the previous status is Available for a found object and Open for a lost one.
  async restoreAnnouncement(announcementId: number, adminId: number) {
    const announcement = await this.findAnnouncement(announcementId);
    if (announcement.status !== AnnouncementStatus.Hidden) {
      throw new ConflictException('Only a hidden announcement can be restored.');
    }
    const previous = announcement.type === AnnouncementType.Found ? AnnouncementStatus.Available : AnnouncementStatus.Open;
    return this.moderate(announcement, previous, AuditAction.Restore, adminId);
  }

  // FR-19: logical deletion by an administrator, while the announcement is active or hidden.
  async deleteAnnouncement(announcementId: number, adminId: number) {
    const announcement = await this.findAnnouncement(announcementId);
    if (![...ACTIVE_STATUSES, AnnouncementStatus.Hidden].includes(announcement.status)) {
      throw new ConflictException(`This announcement is ${announcement.status} and can no longer be changed.`);
    }
    return this.moderate(announcement, AnnouncementStatus.Deleted, AuditAction.Delete, adminId);
  }

  // FR-19: a blocked user is refused at once (JwtAuthGuard reads the status on every request).
  async blockUser(targetUserId: number, actingAdminId: number) {
    if (targetUserId === actingAdminId) {
      throw new BadRequestException('You cannot block your own account.');
    }
    const user = await this.findUser(targetUserId);
    if (user.role === UserRole.Admin) {
      throw new ForbiddenException('Administrator accounts cannot be blocked.');
    }
    user.status = UserStatus.Suspended;
    await this.users.save(user);
    await this.audit(actingAdminId, AuditAction.Block, AuditTarget.User, user.id);
    return { id: user.id, email: user.email, status: user.status };
  }

  // FR-19: unblock a user.
  async unblockUser(targetUserId: number, actingAdminId: number) {
    const user = await this.findUser(targetUserId);
    if (user.status !== UserStatus.Suspended) {
      throw new ConflictException('This account is not blocked.');
    }
    user.status = UserStatus.Active;
    await this.users.save(user);
    await this.audit(actingAdminId, AuditAction.Unblock, AuditTarget.User, user.id);
    return { id: user.id, email: user.email, status: user.status };
  }

  // The report is closed without action.
  async dismissReport(reportId: number) {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found.');
    }
    report.status = ReportStatus.Dismissed;
    await this.reports.save(report);
    return { id: report.id, status: report.status };
  }

  // FR-19, AG Grid "users" table: every account (an administrator may see the emails).
  async listUsers() {
    const users = await this.users.find({ order: { createdAt: 'DESC', id: 'DESC' } });
    return users.map((user) => ({
      id: user.id,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    }));
  }

  // The hidden announcements, to restore or delete them.
  async listHiddenAnnouncements() {
    const announcements = await this.announcements.find({
      where: { status: AnnouncementStatus.Hidden },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return announcements.map((a) => ({ id: a.id, title: a.title, type: a.type, authorId: a.authorId, createdAt: a.createdAt }));
  }

  // FR-19: the audit trail, newest first.
  async getAuditLog() {
    const entries = await this.auditLogs.find({ order: { createdAt: 'DESC', id: 'DESC' }, take: 200 });
    return entries.map((entry) => ({
      id: entry.id,
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      createdAt: entry.createdAt,
    }));
  }

  private async findAnnouncement(id: number): Promise<Announcement> {
    const announcement = await this.announcements.findOne({ where: { id } });
    if (!announcement || announcement.status === AnnouncementStatus.Deleted) {
      throw new NotFoundException('Announcement not found.');
    }
    return announcement;
  }

  private async findUser(id: number): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  // Changes the status, closes the pending reports of the announcement and writes the audit trail.
  private async moderate(announcement: Announcement, status: AnnouncementStatus, action: AuditAction, adminId: number) {
    await this.announcements.update(announcement.id, { status });
    await this.reports.update(
      { announcementId: announcement.id, status: ReportStatus.Pending },
      { status: ReportStatus.Reviewed },
    );
    await this.audit(adminId, action, AuditTarget.Announcement, announcement.id);
    return { id: announcement.id, status };
  }

  private async audit(adminId: number, action: AuditAction, targetType: AuditTarget, targetId: number) {
    await this.auditLogs.save(this.auditLogs.create({ adminId, action, targetType, targetId }));
  }
}
