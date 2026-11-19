import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Announcement, AnnouncementStatus } from '../announcements/announcement.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Report, ReportStatus } from './report.entity';
import { ReportsService } from './reports.service';

describe('ReportsService - admin moderation', () => {
  const reports = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const announcements = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const users = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const service = new ReportsService(
    reports as unknown as Repository<Report>,
    announcements as unknown as Repository<Announcement>,
    users as unknown as Repository<User>,
  );

  afterEach(() => jest.resetAllMocks());

  it('hides an announcement and marks pending reports as reviewed', async () => {
    const ann = { id: 5, status: AnnouncementStatus.Available };
    announcements.findOne.mockResolvedValue(ann);
    announcements.save.mockResolvedValue({ ...ann, status: AnnouncementStatus.Hidden });
    reports.update.mockResolvedValue({ affected: 1 });

    const result = await service.hideAnnouncement(5);

    expect(result).toEqual({ id: 5, status: AnnouncementStatus.Hidden });
    expect(reports.update).toHaveBeenCalledWith(
      { announcementId: 5, status: ReportStatus.Pending },
      { status: ReportStatus.Reviewed },
    );
  });

  it('deletes an announcement logically and marks pending reports as reviewed', async () => {
    const ann = { id: 6, status: AnnouncementStatus.Available };
    announcements.findOne.mockResolvedValue(ann);
    announcements.save.mockResolvedValue({ ...ann, status: AnnouncementStatus.Deleted });
    reports.update.mockResolvedValue({ affected: 1 });

    const result = await service.deleteAnnouncement(6);

    expect(result).toEqual({ id: 6, status: AnnouncementStatus.Deleted });
  });

  it('throws NotFoundException when hiding a missing or deleted announcement', async () => {
    announcements.findOne.mockResolvedValue(null);
    await expect(service.hideAnnouncement(99)).rejects.toThrow(NotFoundException);
  });

  it('blocks a regular user account by setting status to Suspended', async () => {
    const user = { id: 20, email: 'abuser@example.com', role: UserRole.Student, status: UserStatus.Active };
    users.findOne.mockResolvedValue(user);
    users.save.mockResolvedValue({ ...user, status: UserStatus.Suspended });

    const result = await service.blockUser(20, 1);

    expect(result).toEqual({
      id: 20,
      email: 'abuser@example.com',
      status: UserStatus.Suspended,
    });
  });

  it('refuses to block the admin themselves or another admin', async () => {
    await expect(service.blockUser(1, 1)).rejects.toThrow(BadRequestException);

    users.findOne.mockResolvedValue({ id: 2, role: UserRole.Admin, status: UserStatus.Active });
    await expect(service.blockUser(2, 1)).rejects.toThrow(ForbiddenException);
  });
});
