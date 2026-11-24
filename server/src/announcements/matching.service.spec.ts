import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between, In, Not } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { Announcement, AnnouncementStatus, AnnouncementType } from './announcement.entity';
import { AnnouncementMatch } from './announcement-match.entity';
import { keywords, MATCH_THRESHOLD, matchScore, MatchingService, shiftDay } from './matching.service';

// A found phone, declared by user 1. Each test changes only what it checks.
function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 10,
    type: AnnouncementType.Found,
    status: AnnouncementStatus.Available,
    authorId: 1,
    author: { id: 1, email: 'finder@school.test' },
    title: 'Black phone',
    description: 'Found under a table',
    brand: 'Samsung',
    color: 'black',
    categoryId: 1,
    objectTypeId: 2,
    placeId: 3,
    eventDate: '2026-10-05',
    ...overrides,
  } as Announcement;
}

describe('matching rules (SCRUM-28)', () => {
  it('moves a day forward and backward, across months', () => {
    expect(shiftDay('2026-10-05', -7)).toBe('2026-09-28');
    expect(shiftDay('2026-10-30', 7)).toBe('2026-11-06');
  });

  it('keeps the useful words of the title, brand, color and description', () => {
    const words = keywords(announcement({ title: 'Lost my BLACK phone!', description: 'Near the café' }));
    // "lost", "near" and "the" are stop words, "my" is too short.
    expect([...words].sort()).toEqual(['black', 'café', 'phone', 'samsung']);
  });

  it('gives 100 to the same object, place and day with two shared words', () => {
    const lost = announcement({ id: 11, type: AnnouncementType.Lost, title: 'My phone', description: 'Samsung, black' });
    expect(matchScore(announcement(), lost)).toBe(100);
  });

  it('removes 2 points per day apart, and nothing is given for the date after 7 days', () => {
    const base = announcement({ brand: null, color: null, description: '', title: 'aa' });
    expect(matchScore(base, { ...base, eventDate: '2026-10-08' })).toBe(30 + 30 + 15 + 9);
    expect(matchScore(base, { ...base, eventDate: '2026-10-12' })).toBe(30 + 30 + 15 + 1);
    expect(matchScore(base, { ...base, eventDate: '2026-10-20' })).toBe(30 + 30 + 15);
  });

  it('does not reach the threshold with the category alone', () => {
    const other = announcement({ objectTypeId: 9, placeId: 9, title: 'Tablet', brand: null, color: null, description: '' });
    expect(matchScore(announcement(), other)).toBeLessThan(MATCH_THRESHOLD);
  });
});

describe('MatchingService', () => {
  let service: MatchingService;
  let announcements: { find: jest.Mock };
  let matches: { create: jest.Mock; save: jest.Mock };
  let users: { findOneBy: jest.Mock };
  let mail: { matchAlert: jest.Mock };

  beforeEach(async () => {
    announcements = { find: jest.fn().mockResolvedValue([]) };
    matches = { create: jest.fn((data) => data), save: jest.fn((data) => Promise.resolve(data)) };
    users = { findOneBy: jest.fn().mockResolvedValue({ id: 1, email: 'finder@school.test' }) };
    mail = { matchAlert: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        { provide: getRepositoryToken(AnnouncementMatch), useValue: matches },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(MatchingService);
  });

  it('only asks for public announcements of the opposite type, same category, within 7 days, by someone else', async () => {
    await service.matchNewAnnouncement(announcement());

    expect(announcements.find.mock.calls[0][0].where).toEqual({
      type: AnnouncementType.Lost,
      status: In([AnnouncementStatus.Available, AnnouncementStatus.Open]),
      categoryId: 1,
      eventDate: Between('2026-09-28', '2026-10-12'),
      authorId: Not(1),
    });
  });

  it('saves a good candidate with the smaller id first, emails both authors and counts it', async () => {
    const lost = announcement({
      id: 4,
      type: AnnouncementType.Lost,
      status: AnnouncementStatus.Open,
      authorId: 2,
      author: { id: 2, email: 'owner@school.test' } as User,
      title: 'Lost phone',
    });
    announcements.find.mockResolvedValue([lost]);

    const count = await service.matchNewAnnouncement(announcement());
    await new Promise((resolve) => setImmediate(resolve)); // lets the emails in the background finish

    expect(count).toBe(1);
    expect(matches.save.mock.calls[0][0]).toMatchObject({ announcementId: 4, matchedAnnouncementId: 10 });
    expect(mail.matchAlert).toHaveBeenCalledWith('finder@school.test', { id: 4, title: 'Lost phone', type: 'lost' });
    expect(mail.matchAlert).toHaveBeenCalledWith('owner@school.test', { id: 10, title: 'Black phone', type: 'found' });
  });

  it('ignores a candidate under the threshold', async () => {
    announcements.find.mockResolvedValue([
      announcement({ id: 4, type: AnnouncementType.Lost, authorId: 2, objectTypeId: 9, placeId: 9, title: 'Tablet', brand: null, color: null, description: '' }),
    ]);

    expect(await service.matchNewAnnouncement(announcement())).toBe(0);
    expect(matches.save).not.toHaveBeenCalled();
    expect(mail.matchAlert).not.toHaveBeenCalled();
  });

  it('does not count nor email a pair that is already saved', async () => {
    announcements.find.mockResolvedValue([announcement({ id: 4, type: AnnouncementType.Lost, authorId: 2 })]);
    matches.save.mockRejectedValue(new Error('duplicate key'));

    expect(await service.matchNewAnnouncement(announcement())).toBe(0);
    expect(mail.matchAlert).not.toHaveBeenCalled();
  });
});
