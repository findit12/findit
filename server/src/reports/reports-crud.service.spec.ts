import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { User } from '../users/user.entity';
import { AuditLog } from './audit-log.entity';
import { Report, ReportStatus } from './report.entity';
import { ReportsService } from './reports.service';

// Lab 6: the routes of the person who wrote a report (list, read, change, withdraw).
describe('ReportsService (my reports)', () => {
  const reports = { find: jest.fn(), findOneBy: jest.fn(), save: jest.fn(), delete: jest.fn() };
  const service = new ReportsService(
    reports as unknown as Repository<Report>,
    {} as Repository<Announcement>,
    {} as Repository<User>,
    {} as Repository<AuditLog>,
  );

  const report = (overrides: Partial<Report> = {}) =>
    ({
      id: 4,
      announcementId: 7,
      reporterId: 2,
      reason: 'Spam',
      status: ReportStatus.Pending,
      createdAt: new Date('2026-11-01T10:00:00Z'),
      ...overrides,
    }) as Report;

  beforeEach(() => {
    jest.resetAllMocks();
    reports.findOneBy.mockResolvedValue(report());
    reports.save.mockImplementation((data) => Promise.resolve(data));
  });

  it('lists only my reports, newest first', async () => {
    reports.find.mockResolvedValue([report({ id: 5 }), report()]);
    const { reports: list } = await service.listMine(2);
    expect(list.map((row) => row.id)).toEqual([5, 4]);
    expect(reports.find).toHaveBeenCalledWith({ where: { reporterId: 2 }, order: { createdAt: 'DESC', id: 'DESC' } });
    expect(list[0]).not.toHaveProperty('reporterId');
  });

  it('reads one of my reports', async () => {
    const { report: view } = await service.getMine(4, 2);
    expect(view).toMatchObject({ id: 4, announcementId: 7, reason: 'Spam', status: ReportStatus.Pending });
  });

  it('refuses the report of someone else and an unknown report', async () => {
    await expect(service.getMine(4, 3)).rejects.toBeInstanceOf(ForbiddenException);
    reports.findOneBy.mockResolvedValue(null);
    await expect(service.getMine(99, 2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changes the reason of a pending report', async () => {
    const { report: view } = await service.updateMine(4, 2, { reason: 'Misleading' });
    expect(view.reason).toBe('Misleading');
  });

  it('withdraws a pending report', async () => {
    await service.removeMine(4, 2);
    expect(reports.delete).toHaveBeenCalledWith(4);
  });

  it('refuses to change or withdraw a report that an administrator already handled', async () => {
    reports.findOneBy.mockResolvedValue(report({ status: ReportStatus.Reviewed }));
    await expect(service.updateMine(4, 2, { reason: 'x' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeMine(4, 2)).rejects.toBeInstanceOf(ConflictException);
    expect(reports.save).not.toHaveBeenCalled();
    expect(reports.delete).not.toHaveBeenCalled();
  });
});
