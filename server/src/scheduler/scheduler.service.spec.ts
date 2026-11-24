import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThanOrEqual } from 'typeorm';
import { Announcement, AnnouncementStatus } from '../announcements/announcement.entity';
import { MailService } from '../mail/mail.service';
import { SchedulerService } from './scheduler.service';

describe('SchedulerService (SCRUM-51, FR-20)', () => {
  const now = new Date('2026-12-01T03:00:00Z');
  let service: SchedulerService;
  let announcements: { update: jest.Mock; find: jest.Mock };
  let mail: { archiveReminder: jest.Mock };

  const due = (id: number) => ({
    id,
    title: `Object ${id}`,
    type: 'found',
    author: { email: `author${id}@school.test` },
    expiresAt: new Date('2026-12-05T10:00:00Z'),
  });

  beforeEach(async () => {
    announcements = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      find: jest.fn().mockResolvedValue([]),
    };
    mail = { archiveReminder: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = module.get(SchedulerService);
  });

  it('archives the Available and Open announcements whose date is reached, and counts them', async () => {
    announcements.update.mockResolvedValueOnce({ affected: 3 });

    const result = await service.run(now);

    expect(announcements.update).toHaveBeenNthCalledWith(
      1,
      { status: In([AnnouncementStatus.Available, AnnouncementStatus.Open]), expiresAt: LessThanOrEqual(now) },
      { status: AnnouncementStatus.Archived },
    );
    expect(result.archived).toBe(3);
  });

  it('looks for the reminders of the next 7 days, only for announcements that never got one', async () => {
    await service.run(now);

    const where = announcements.find.mock.calls[0][0].where;
    expect(where.status).toEqual(In([AnnouncementStatus.Available, AnnouncementStatus.Open]));
    expect(where.reminderSentAt).toEqual(IsNull());
    expect(where.expiresAt).toEqual(Between(now, new Date('2026-12-08T03:00:00Z')));
  });

  it('sends one reminder to the author and writes the date, so it is not sent again', async () => {
    announcements.find.mockResolvedValue([due(8), due(9)]);

    const result = await service.run(now);

    expect(mail.archiveReminder).toHaveBeenCalledTimes(2);
    expect(mail.archiveReminder).toHaveBeenCalledWith(
      'author8@school.test',
      { id: 8, title: 'Object 8', type: 'found' },
      new Date('2026-12-05T10:00:00Z'),
    );
    expect(announcements.update).toHaveBeenCalledWith(8, { reminderSentAt: now });
    expect(announcements.update).toHaveBeenCalledWith(9, { reminderSentAt: now });
    expect(result.reminded).toBe(2);
  });

  it('archives before it reminds, so a late announcement never gets a reminder', async () => {
    await service.run(now);

    const archiveOrder = announcements.update.mock.invocationCallOrder[0];
    const findOrder = announcements.find.mock.invocationCallOrder[0];
    expect(archiveOrder).toBeLessThan(findOrder);
  });

  it('keeps going and tries again tomorrow when one email fails (no date written for it)', async () => {
    announcements.find.mockResolvedValue([due(8), due(9)]);
    mail.archiveReminder.mockRejectedValueOnce(new Error('SMTP down'));

    const result = await service.run(now);

    expect(result.reminded).toBe(1);
    expect(announcements.update).not.toHaveBeenCalledWith(8, expect.anything());
    expect(announcements.update).toHaveBeenCalledWith(9, { reminderSentAt: now });
  });

  it('does nothing when there is nothing to do (running it twice is safe)', async () => {
    expect(await service.run(now)).toEqual({ archived: 0, reminded: 0 });
    expect(await service.run(now)).toEqual({ archived: 0, reminded: 0 });
    expect(mail.archiveReminder).not.toHaveBeenCalled();
  });

  it('the daily job logs a failure instead of stopping the server', async () => {
    announcements.update.mockRejectedValue(new Error('db down'));
    await expect(service.runDailyJob()).resolves.toBeUndefined();
  });
});
