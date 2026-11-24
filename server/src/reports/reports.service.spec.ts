import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Announcement, AnnouncementStatus, AnnouncementType } from '../announcements/announcement.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { AuditAction, AuditLog, AuditTarget } from './audit-log.entity';
import { Report, ReportStatus } from './report.entity';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const reports = { findOne: jest.fn(), findOneBy: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() };
  const announcements = { findOne: jest.fn(), find: jest.fn(), update: jest.fn() };
  const users = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
  const auditLogs = { create: jest.fn(), save: jest.fn(), find: jest.fn() };

  const service = new ReportsService(
    reports as unknown as Repository<Report>,
    announcements as unknown as Repository<Announcement>,
    users as unknown as Repository<User>,
    auditLogs as unknown as Repository<AuditLog>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    reports.create.mockImplementation((data) => data);
    reports.save.mockImplementation((data) => Promise.resolve({ id: 1, createdAt: new Date('2026-11-01'), ...data }));
    auditLogs.create.mockImplementation((data) => data);
  });

  // The audit entries written during the test.
  const audited = () => auditLogs.save.mock.calls.map((call) => call[0]);

  describe('createReport (FR-18)', () => {
    it('saves a pending report', async () => {
      announcements.findOne.mockResolvedValue({ id: 5, status: AnnouncementStatus.Available, authorId: 1 });
      reports.findOneBy.mockResolvedValue(null);

      const result = await service.createReport(5, 2, { reason: 'Spam' });

      expect(result).toMatchObject({ id: 1, announcementId: 5, status: ReportStatus.Pending });
    });

    it('refuses my own announcement, a second pending report, and a hidden announcement', async () => {
      announcements.findOne.mockResolvedValue({ id: 5, status: AnnouncementStatus.Available, authorId: 2 });
      await expect(service.createReport(5, 2, { reason: 'x' })).rejects.toThrow(ForbiddenException);

      announcements.findOne.mockResolvedValue({ id: 5, status: AnnouncementStatus.Available, authorId: 1 });
      reports.findOneBy.mockResolvedValue({ id: 9 });
      await expect(service.createReport(5, 2, { reason: 'x' })).rejects.toThrow('You already reported this announcement.');
      expect(reports.findOneBy).toHaveBeenCalledWith({ announcementId: 5, reporterId: 2, status: ReportStatus.Pending });

      announcements.findOne.mockResolvedValue({ id: 5, status: AnnouncementStatus.Hidden, authorId: 1 });
      await expect(service.createReport(5, 2, { reason: 'x' })).rejects.toThrow(NotFoundException);
      expect(reports.save).not.toHaveBeenCalled();
    });
  });

  describe('hide, restore and delete (FR-19, SDD transitions)', () => {
    it('hides an active announcement, closes its reports and writes the audit trail', async () => {
      announcements.findOne.mockResolvedValue({ id: 5, type: AnnouncementType.Found, status: AnnouncementStatus.Available });

      const result = await service.hideAnnouncement(5, 1);

      expect(result).toEqual({ id: 5, status: AnnouncementStatus.Hidden });
      expect(announcements.update).toHaveBeenCalledWith(5, { status: AnnouncementStatus.Hidden });
      expect(reports.update).toHaveBeenCalledWith(
        { announcementId: 5, status: ReportStatus.Pending },
        { status: ReportStatus.Reviewed },
      );
      expect(audited()).toEqual([
        { adminId: 1, action: AuditAction.Hide, targetType: AuditTarget.Announcement, targetId: 5 },
      ]);
    });

    it('refuses to hide or delete a final status (409)', async () => {
      announcements.findOne.mockResolvedValue({ id: 5, type: AnnouncementType.Found, status: AnnouncementStatus.Returned });
      await expect(service.hideAnnouncement(5, 1)).rejects.toThrow(ConflictException);
      await expect(service.deleteAnnouncement(5, 1)).rejects.toThrow(ConflictException);
      expect(announcements.update).not.toHaveBeenCalled();
      expect(auditLogs.save).not.toHaveBeenCalled();
    });

    it('restores a hidden found announcement to Available and a lost one to Open', async () => {
      announcements.findOne.mockResolvedValue({ id: 5, type: AnnouncementType.Found, status: AnnouncementStatus.Hidden });
      expect(await service.restoreAnnouncement(5, 1)).toEqual({ id: 5, status: AnnouncementStatus.Available });

      announcements.findOne.mockResolvedValue({ id: 6, type: AnnouncementType.Lost, status: AnnouncementStatus.Hidden });
      expect(await service.restoreAnnouncement(6, 1)).toEqual({ id: 6, status: AnnouncementStatus.Open });
      expect(audited().map((entry) => entry.action)).toEqual([AuditAction.Restore, AuditAction.Restore]);
    });

    it('refuses to restore an announcement that is not hidden', async () => {
      announcements.findOne.mockResolvedValue({ id: 5, type: AnnouncementType.Found, status: AnnouncementStatus.Available });
      await expect(service.restoreAnnouncement(5, 1)).rejects.toThrow('Only a hidden announcement can be restored.');
    });

    it('deletes an active or hidden announcement logically', async () => {
      announcements.findOne.mockResolvedValue({ id: 5, type: AnnouncementType.Found, status: AnnouncementStatus.Hidden });
      expect(await service.deleteAnnouncement(5, 1)).toEqual({ id: 5, status: AnnouncementStatus.Deleted });
      expect(audited()[0]).toMatchObject({ action: AuditAction.Delete, targetId: 5 });
    });

    it('answers 404 for a missing or deleted announcement', async () => {
      announcements.findOne.mockResolvedValue(null);
      await expect(service.hideAnnouncement(99, 1)).rejects.toThrow(NotFoundException);
      announcements.findOne.mockResolvedValue({ id: 5, status: AnnouncementStatus.Deleted });
      await expect(service.deleteAnnouncement(5, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('block and unblock (FR-19)', () => {
    it('blocks a student and writes the audit trail', async () => {
      users.findOne.mockResolvedValue({ id: 20, email: 'abuser@school.test', role: UserRole.Student, status: UserStatus.Active });

      const result = await service.blockUser(20, 1);

      expect(result).toEqual({ id: 20, email: 'abuser@school.test', status: UserStatus.Suspended });
      expect(audited()).toEqual([{ adminId: 1, action: AuditAction.Block, targetType: AuditTarget.User, targetId: 20 }]);
    });

    it('refuses to block myself or another administrator', async () => {
      await expect(service.blockUser(1, 1)).rejects.toThrow(BadRequestException);
      users.findOne.mockResolvedValue({ id: 2, role: UserRole.Admin, status: UserStatus.Active });
      await expect(service.blockUser(2, 1)).rejects.toThrow(ForbiddenException);
    });

    it('unblocks a blocked user, and refuses an account that is not blocked', async () => {
      users.findOne.mockResolvedValue({ id: 20, email: 'abuser@school.test', role: UserRole.Student, status: UserStatus.Suspended });
      expect(await service.unblockUser(20, 1)).toEqual({ id: 20, email: 'abuser@school.test', status: UserStatus.Active });
      expect(audited()[0]).toMatchObject({ action: AuditAction.Unblock, targetId: 20 });

      users.findOne.mockResolvedValue({ id: 21, role: UserRole.Student, status: UserStatus.Active });
      await expect(service.unblockUser(21, 1)).rejects.toThrow(ConflictException);

      users.findOne.mockResolvedValue(null);
      await expect(service.unblockUser(99, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('lists for the admin tables', () => {
    it('lists the users without their password', async () => {
      users.find.mockResolvedValue([
        { id: 1, firstName: 'Ad', lastName: 'Min', email: 'admin@school.test', passwordHash: 'secret', role: 'admin', status: 'active', isVerified: true, createdAt: new Date('2026-11-01') },
      ]);
      const list = await service.listUsers();
      expect(list[0]).toEqual({
        id: 1,
        firstName: 'Ad',
        lastName: 'Min',
        email: 'admin@school.test',
        role: 'admin',
        status: 'active',
        isVerified: true,
        createdAt: new Date('2026-11-01'),
      });
    });

    it('lists the hidden announcements and the audit trail, newest first', async () => {
      announcements.find.mockResolvedValue([{ id: 5, title: 'Phone', type: 'found', authorId: 2, createdAt: new Date('2026-11-01'), hiddenDetail: 'x' }]);
      expect(await service.listHiddenAnnouncements()).toEqual([{ id: 5, title: 'Phone', type: 'found', authorId: 2, createdAt: new Date('2026-11-01') }]);
      expect(announcements.find).toHaveBeenCalledWith({ where: { status: AnnouncementStatus.Hidden }, order: { createdAt: 'DESC', id: 'DESC' } });

      auditLogs.find.mockResolvedValue([{ id: 3, adminId: 1, action: 'hide', targetType: 'announcement', targetId: 5, createdAt: new Date('2026-11-02') }]);
      expect(await service.getAuditLog()).toHaveLength(1);
    });

    it('dismisses a report', async () => {
      reports.findOne.mockResolvedValue({ id: 4, status: ReportStatus.Pending });
      expect(await service.dismissReport(4)).toEqual({ id: 4, status: ReportStatus.Dismissed });
      reports.findOne.mockResolvedValue(null);
      await expect(service.dismissReport(9)).rejects.toThrow(NotFoundException);
    });
  });
});
