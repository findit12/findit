import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnnouncementType } from '../announcements/announcement.entity';
import { MailService } from '../mail/mail.service';
import { ReferenceService } from '../reference/reference.service';
import { SavedSearch } from './saved-search.entity';
import { SavedSearchesService } from './saved-searches.service';

// A saved search of user 5, with no criterion. Each test sets only what it needs.
function savedSearch(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 1,
    userId: 5,
    user: { id: 5, email: 'sam@school.test' },
    categoryId: null,
    objectTypeId: null,
    placeId: null,
    dateFrom: null,
    dateTo: null,
    keyword: null,
    createdAt: new Date('2026-10-10T10:00:00Z'),
    ...overrides,
  } as SavedSearch;
}

type NewAnnouncement = Parameters<SavedSearchesService['notifyMatches']>[0];

// A new announcement, written by user 1.
function newAnnouncement(overrides: Partial<NewAnnouncement> = {}): NewAnnouncement {
  return {
    id: 7,
    type: AnnouncementType.Found,
    title: 'Black phone',
    description: 'Found under a table',
    authorId: 1,
    categoryId: 1,
    objectTypeId: 1,
    placeId: 3,
    eventDate: '2026-10-05',
    ...overrides,
  };
}

describe('SavedSearchesService', () => {
  let service: SavedSearchesService;
  let searches: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    delete: jest.Mock;
  };
  let reference: { checkFilters: jest.Mock };
  let mail: { savedSearchAlert: jest.Mock };

  beforeEach(async () => {
    searches = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, createdAt: new Date('2026-10-10T10:00:00Z'), ...data })),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    reference = { checkFilters: jest.fn().mockResolvedValue(undefined) };
    mail = { savedSearchAlert: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedSearchesService,
        { provide: getRepositoryToken(SavedSearch), useValue: searches },
        { provide: ReferenceService, useValue: reference },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get(SavedSearchesService);
  });

  describe('create', () => {
    it('saves the criteria of the signed-in user and trims the keyword', async () => {
      const result = await service.create(5, {
        categoryId: 1,
        objectTypeId: 1,
        placeId: 3,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        q: '  keys  ',
      });

      expect(reference.checkFilters).toHaveBeenCalledWith(1, 1, 3);
      expect(searches.save.mock.calls[0][0]).toMatchObject({
        userId: 5,
        categoryId: 1,
        objectTypeId: 1,
        placeId: 3,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        keyword: 'keys',
      });
      expect(result.savedSearch).toMatchObject({ id: 1, categoryId: 1, q: 'keys' });
    });

    it('stores null for the criteria that are not sent', async () => {
      await service.create(5, { q: 'keys' });

      expect(searches.save.mock.calls[0][0]).toMatchObject({
        categoryId: null,
        objectTypeId: null,
        placeId: null,
        dateFrom: null,
        dateTo: null,
        keyword: 'keys',
      });
    });

    it('refuses a search with no filter and no keyword', async () => {
      await expect(service.create(5, { q: '   ' })).rejects.toThrow(BadRequestException);
      expect(searches.save).not.toHaveBeenCalled();
    });

    it('refuses filters that do not match the reference lists, before saving', async () => {
      reference.checkFilters.mockRejectedValue(new BadRequestException('Choose a place from the list.'));
      await expect(service.create(5, { placeId: 999 })).rejects.toThrow('Choose a place from the list.');
      expect(searches.save).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('lists only my searches, newest first, without the user', async () => {
      searches.find.mockResolvedValue([savedSearch({ id: 2, keyword: 'keys' })]);
      const result = await service.findMine(5);

      expect(searches.find.mock.calls[0][0]).toMatchObject({
        where: { userId: 5 },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      expect(result.savedSearches[0]).toMatchObject({ id: 2, q: 'keys' });
      expect(result.savedSearches[0]).not.toHaveProperty('userId');
    });
  });

  describe('remove', () => {
    it('deletes one of my searches', async () => {
      searches.findOneBy.mockResolvedValue(savedSearch());
      await service.remove(5, 1);
      expect(searches.delete).toHaveBeenCalledWith(1);
    });

    it('answers 404 for an unknown search', async () => {
      searches.findOneBy.mockResolvedValue(null);
      await expect(service.remove(5, 99)).rejects.toThrow(NotFoundException);
    });

    it('refuses to delete the search of someone else (403)', async () => {
      searches.findOneBy.mockResolvedValue(savedSearch({ userId: 6 }));
      await expect(service.remove(5, 1)).rejects.toThrow(ForbiddenException);
      expect(searches.delete).not.toHaveBeenCalled();
    });
  });

  describe('notifyMatches', () => {
    it('emails the owner of a search that matches the new announcement', async () => {
      searches.find.mockResolvedValue([savedSearch({ categoryId: 1, placeId: 3, keyword: 'PHONE' })]);
      await service.notifyMatches(newAnnouncement());

      expect(mail.savedSearchAlert).toHaveBeenCalledTimes(1);
      expect(mail.savedSearchAlert).toHaveBeenCalledWith('sam@school.test', {
        id: 7,
        title: 'Black phone',
        type: AnnouncementType.Found,
      });
    });

    it('sends nothing when one criterion does not match', async () => {
      searches.find.mockResolvedValue([
        savedSearch({ categoryId: 2 }),
        savedSearch({ objectTypeId: 9 }),
        savedSearch({ placeId: 9 }),
        savedSearch({ dateFrom: '2026-10-06' }),
        savedSearch({ dateTo: '2026-10-04' }),
        savedSearch({ keyword: 'scarf' }),
      ]);
      await service.notifyMatches(newAnnouncement());
      expect(mail.savedSearchAlert).not.toHaveBeenCalled();
    });

    it('finds the keyword in the description too, and a date range includes its bounds', async () => {
      searches.find.mockResolvedValue([
        savedSearch({ id: 1, userId: 5, keyword: 'TABLE' }),
        savedSearch({ id: 2, userId: 6, user: { id: 6, email: 'lea@school.test' } as never, dateFrom: '2026-10-05', dateTo: '2026-10-05' }),
      ]);
      await service.notifyMatches(newAnnouncement());

      expect(mail.savedSearchAlert).toHaveBeenCalledTimes(2);
    });

    it('sends only one email per user, even if two of their searches match', async () => {
      searches.find.mockResolvedValue([
        savedSearch({ id: 1, categoryId: 1 }),
        savedSearch({ id: 2, keyword: 'phone' }),
        savedSearch({ id: 3, userId: 6, user: { id: 6, email: 'lea@school.test' } as never, placeId: 3 }),
      ]);
      await service.notifyMatches(newAnnouncement());

      expect(mail.savedSearchAlert).toHaveBeenCalledTimes(2);
      const recipients = mail.savedSearchAlert.mock.calls.map((call) => call[0]);
      expect(recipients).toEqual(['sam@school.test', 'lea@school.test']);
    });

    it('never alerts the author about their own announcement', async () => {
      searches.find.mockResolvedValue([
        savedSearch({ userId: 1, user: { id: 1, email: 'elea@school.test' } as never, categoryId: 1 }),
      ]);
      await service.notifyMatches(newAnnouncement({ authorId: 1 }));
      expect(mail.savedSearchAlert).not.toHaveBeenCalled();
    });
  });
});
