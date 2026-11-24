import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MoreThanOrEqual } from 'typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { Discussion } from '../discussions/discussion.entity';
import { User } from '../users/user.entity';
import {
  DailyLimitsService,
  MAX_ANNOUNCEMENTS_PER_DAY,
  MAX_DISCUSSIONS_PER_DAY,
  startOfToday,
} from './daily-limits.service';

describe('DailyLimitsService (SCRUM-50, FR-31)', () => {
  let service: DailyLimitsService;
  let announcements: { count: jest.Mock };
  let discussions: { count: jest.Mock };
  let users: { findOneBy: jest.Mock };

  beforeEach(async () => {
    announcements = { count: jest.fn().mockResolvedValue(0) };
    discussions = { count: jest.fn().mockResolvedValue(0) };
    users = { findOneBy: jest.fn().mockResolvedValue({ id: 5, role: 'student' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyLimitsService,
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        { provide: getRepositoryToken(Discussion), useValue: discussions },
        { provide: getRepositoryToken(User), useValue: users },
      ],
    }).compile();
    service = module.get(DailyLimitsService);
  });

  it('has the limits of the SRS: 10 announcements and 20 discussions', () => {
    expect(MAX_ANNOUNCEMENTS_PER_DAY).toBe(10);
    expect(MAX_DISCUSSIONS_PER_DAY).toBe(20);
  });

  it('starts the day at midnight', () => {
    const start = startOfToday(new Date(2026, 9, 14, 17, 42, 11));
    expect(start).toEqual(new Date(2026, 9, 14, 0, 0, 0, 0));
  });

  describe('assertCanDeclare', () => {
    it('lets a student declare while they have fewer than 10 announcements today', async () => {
      announcements.count.mockResolvedValue(9);
      await expect(service.assertCanDeclare(5)).resolves.toBeUndefined();
    });

    it('counts the announcements of the user created today, whatever their status', async () => {
      await service.assertCanDeclare(5);
      const where = announcements.count.mock.calls[0][0].where;
      expect(where.authorId).toBe(5);
      expect(where.createdAt).toEqual(MoreThanOrEqual(startOfToday()));
    });

    it('refuses the 11th announcement with a 429 and a clear message', async () => {
      announcements.count.mockResolvedValue(10);
      await expect(service.assertCanDeclare(5)).rejects.toMatchObject({
        status: 429,
        message: 'You have reached the limit of 10 announcements per day. Try again tomorrow.',
      });
    });

    it('does not limit an administrator (reception staff, FR-32)', async () => {
      users.findOneBy.mockResolvedValue({ id: 1, role: 'admin' });
      announcements.count.mockResolvedValue(50);
      await expect(service.assertCanDeclare(1)).resolves.toBeUndefined();
      expect(announcements.count).not.toHaveBeenCalled();
    });
  });

  describe('assertCanStartDiscussion', () => {
    it('lets a student start a discussion while they have fewer than 20 today', async () => {
      discussions.count.mockResolvedValue(19);
      await expect(service.assertCanStartDiscussion(5)).resolves.toBeUndefined();
    });

    it('refuses the 21st discussion with a 429 and a clear message', async () => {
      discussions.count.mockResolvedValue(20);
      await expect(service.assertCanStartDiscussion(5)).rejects.toMatchObject({
        status: 429,
        message: 'You have reached the limit of 20 new discussions per day. Try again tomorrow.',
      });
    });

    it('counts the discussions started by the user today', async () => {
      await service.assertCanStartDiscussion(5);
      const where = discussions.count.mock.calls[0][0].where;
      expect(where.ownerId).toBe(5);
      expect(where.createdAt).toEqual(MoreThanOrEqual(startOfToday()));
    });
  });
});
