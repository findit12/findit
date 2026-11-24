
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AnnouncementMatch } from './announcement-match.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { ReferenceService } from '../reference/reference.service';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
  CurrentLocation,
} from './announcement.entity';
import { CreateAnnouncementDto } from './announcements.dto';
import { AnnouncementsService } from './announcements.service';
import { PhotoStorageService } from './photo-storage.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import { MatchingService } from './matching.service';

function photo(): Express.Multer.File {
  return {
    mimetype: 'image/jpeg',
    size: 1000,
    buffer: Buffer.from([0xff, 0xd8, 0xff]),
  } as Express.Multer.File;
}

function foundForm(): CreateAnnouncementDto {
  return {
    type: AnnouncementType.Found,
    title: 'Black phone',
    categoryId: 1,
    objectTypeId: 2,
    description: 'Found under a table',
    brand: '',
    eventDate: '2026-10-01',
    placeId: 3,
    currentLocation: CurrentLocation.Finder,
    hiddenDetail: 'Cat sticker on the back',
  };
}

function lostForm(): CreateAnnouncementDto {
  return {
    type: AnnouncementType.Lost,
    title: 'Blue scarf',
    categoryId: 3,
    objectTypeId: 13,
    description: 'Lost in the amphitheatre',
    eventDate: '2026-10-02',
    placeId: 4,
    currentLocation: CurrentLocation.Finder,
  };
}

function storedAnnouncement(
  overrides: Partial<Announcement> = {},
): Announcement {
  return {
    id: 7,
    type: AnnouncementType.Found,
    status: AnnouncementStatus.Available,
    authorId: 1,
    title: 'Black phone',
    categoryId: 1,
    category: { id: 1, name: 'Electronics' },
    objectTypeId: 2,
    objectType: { id: 2, name: 'Phone' },
    description: 'Found under a table',
    brand: null,
    color: null,
    photos: ['a.jpg'],
    eventDate: '2026-10-01',
    placeId: 3,
    place: { id: 3, name: 'Library' },
    placeDetails: null,
    currentLocation: CurrentLocation.Finder,
    hiddenDetail: 'Cat sticker on the back',
    createdAt: new Date('2026-10-10T10:00:00Z'),
    expiresAt: new Date('2027-01-08T10:00:00Z'),
    returnedAt: null,
    reminderSentAt: null,
    ...overrides,
  } as Announcement;
}

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  let announcements: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  let users: { findOneBy: jest.Mock };
  let reference: {
    checkSelection: jest.Mock;
    checkFilters: jest.Mock;
  };
  let photoStorage: { save: jest.Mock };

  let mail: { confirmation: jest.Mock };

  let savedSearches: { notifyMatches: jest.Mock };
  let matching: { matchNewAnnouncement: jest.Mock };
  let announcementMatches: { find: jest.Mock };

  beforeEach(async () => {
    announcements = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 7, ...data })),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue(storedAnnouncement()),
      createQueryBuilder: jest.fn(),
    };

    users = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 1,
        email: 'elea@school.test',
      }),
    };

    reference = {
      checkSelection: jest.fn().mockResolvedValue(undefined),
      checkFilters: jest.fn().mockResolvedValue(undefined),
    };

    photoStorage = {
      save: jest.fn().mockResolvedValue(['a.jpg']),
    };

    mail = { confirmation: jest.fn().mockResolvedValue(undefined) };

    savedSearches = {
      notifyMatches: jest.fn().mockResolvedValue(undefined),
    };

    matching = { matchNewAnnouncement: jest.fn().mockResolvedValue(0) };
    announcementMatches = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        {
          provide: getRepositoryToken(Announcement),
          useValue: announcements,
        },
        {
          provide: getRepositoryToken(AnnouncementMatch),
          useValue: announcementMatches,
        },
        {
          provide: getRepositoryToken(User),
          useValue: users,
        },
        {
          provide: ReferenceService,
          useValue: reference,
        },
        {
          provide: PhotoStorageService,
          useValue: photoStorage,
        },
        {
          provide: MailService,
          useValue: mail,
        },
        {
          provide: SavedSearchesService,
          useValue: savedSearches,
        },
        {
          provide: MatchingService,
          useValue: matching,
        },
      ],
    }).compile();

    service = module.get(AnnouncementsService);
  });

  describe('create', () => {
    it('saves a found announcement as Available, expiring in 90 days', async () => {
      const before = Date.now();
      await service.create(1, foundForm(), [photo()]);

      const saved = announcements.save.mock.calls[0][0];

      expect(saved.status).toBe(AnnouncementStatus.Available);
      expect(saved.authorId).toBe(1);
      expect(saved.photos).toEqual(['a.jpg']);
      expect(saved.brand).toBeNull();

      const days =
        (saved.expiresAt.getTime() - before) /
        (24 * 60 * 60 * 1000);

      expect(Math.round(days)).toBe(90);
    });

    it('returns the announcement with the hidden detail, because the author is asking', async () => {
      const result = await service.create(1, foundForm(), [photo()]);

      expect(result.announcement.hiddenDetail).toBe(
        'Cat sticker on the back',
      );
      expect(result.announcement.photos).toEqual(['/uploads/a.jpg']);
    });

    it('refuses a found announcement without photo, before saving anything', async () => {
      await expect(
        service.create(1, foundForm(), []),
      ).rejects.toThrow(BadRequestException);

      expect(photoStorage.save).not.toHaveBeenCalled();
      expect(announcements.save).not.toHaveBeenCalled();
    });

    it('refuses an invalid photo before saving anything (SCRUM-19)', async () => {
      const fake = {
        originalname: 'notes.jpg',
        size: 12,
        buffer: Buffer.from('not an image'),
      } as Express.Multer.File;

      await expect(
        service.create(1, foundForm(), [fake]),
      ).rejects.toThrow(
        '"notes.jpg" is not a JPEG, PNG or WebP image.',
      );

      expect(photoStorage.save).not.toHaveBeenCalled();
      expect(announcements.save).not.toHaveBeenCalled();
    });

    it('refuses a date in the future', async () => {
      const form = {
        ...foundForm(),
        eventDate: '2999-01-01',
      };

      await expect(
        service.create(1, form, [photo()]),
      ).rejects.toThrow('The date cannot be in the future.');
    });

    it('refuses ids that do not match the reference lists', async () => {
      reference.checkSelection.mockRejectedValue(
        new BadRequestException('Choose a place from the list.'),
      );

      await expect(
        service.create(1, foundForm(), [photo()]),
      ).rejects.toThrow('Choose a place from the list.');

      expect(announcements.save).not.toHaveBeenCalled();
    });

    it('refuses an unknown user', async () => {
      users.findOneBy.mockResolvedValue(null);

      await expect(
        service.create(99, foundForm(), [photo()]),
      ).rejects.toThrow(NotFoundException);
    });

    it('saves a lost announcement as Open, without current location (SCRUM-20)', async () => {
      photoStorage.save.mockResolvedValue([]);

      await service.create(1, lostForm(), []);

      const saved = announcements.save.mock.calls[0][0];

      expect(saved.type).toBe(AnnouncementType.Lost);
      expect(saved.status).toBe(AnnouncementStatus.Open);
      expect(saved.currentLocation).toBeNull();
      expect(saved.hiddenDetail).toBeNull();
      expect(saved.photos).toEqual([]);
    });

    it('accepts photos for a lost announcement too', async () => {
      await service.create(1, lostForm(), [photo()]);

      expect(photoStorage.save).toHaveBeenCalledWith([
        expect.anything(),
      ]);
    });

    it('sends the confirmation email with the id, title and type (SCRUM-17)', async () => {
      await service.create(1, foundForm(), [photo()]);

      expect(mail.confirmation).toHaveBeenCalledWith(
        'elea@school.test',
        {
          id: 7,
          title: 'Black phone',
          type: AnnouncementType.Found,
        },
      );

      await service.create(1, lostForm(), []);

      expect(mail.confirmation).toHaveBeenLastCalledWith(
        'elea@school.test',
        {
          id: 7,
          title: 'Blue scarf',
          type: AnnouncementType.Lost,
        },
      );
    });

    it('asks the saved searches to alert their owners about the new announcement (SCRUM-27)', async () => {
      await service.create(1, foundForm(), [photo()]);

      expect(savedSearches.notifyMatches).toHaveBeenCalledTimes(1);

      expect(savedSearches.notifyMatches.mock.calls[0][0]).toMatchObject({
        id: 7,
        authorId: 1,
        title: 'Black phone',
      });
    });

    it('still succeeds when the saved search alerts fail (SCRUM-27)', async () => {
      savedSearches.notifyMatches.mockRejectedValue(
        new Error('boom'),
      );

      await expect(
        service.create(1, foundForm(), [photo()]),
      ).resolves.toBeDefined();
    });

    it('runs the matching before answering and returns the number of matches (SCRUM-28, UC-3)', async () => {
      matching.matchNewAnnouncement.mockResolvedValue(2);

      const result = await service.create(1, lostForm(), []);

      expect(matching.matchNewAnnouncement.mock.calls[0][0]).toMatchObject({ id: 7, type: AnnouncementType.Lost });
      expect(result.matchCount).toBe(2);
    });

    it('still succeeds, with 0 match, when the matching fails', async () => {
      matching.matchNewAnnouncement.mockRejectedValue(new Error('database busy'));

      const result = await service.create(1, foundForm(), [photo()]);

      expect(result.matchCount).toBe(0);
    });

    it('still succeeds when the confirmation email fails', async () => {
      mail.confirmation.mockRejectedValue(
        new Error('SMTP down'),
      );

      await expect(
        service.create(1, foundForm(), [photo()]),
      ).resolves.toBeDefined();
    });
  });

  describe('findPublic', () => {
    it('never returns the hidden detail', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      const result = await service.findPublic(7);

      expect(result.announcement).not.toHaveProperty('hiddenDetail');
      expect(result.announcement.place.name).toBe('Library');
    });

    it('answers 404 for an unknown or deleted announcement', async () => {
      announcements.findOne.mockResolvedValue(null);

      await expect(
        service.findPublic(8),
      ).rejects.toThrow(NotFoundException);

      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          status: AnnouncementStatus.Deleted,
        }),
      );

      await expect(
        service.findPublic(7),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPublicMatches (SCRUM-29)', () => {
    it('shows at most 4 public similar announcements, without the hidden detail', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());
      const pairs = [1, 2, 3, 4, 5].map((n) => ({
        announcementId: n,
        matchedAnnouncementId: 7,
        score: 100 - n,
        announcement: storedAnnouncement({ id: n, type: AnnouncementType.Lost, status: AnnouncementStatus.Open }),
      }));
      pairs[0].announcement.status = AnnouncementStatus.Closed; // no longer public: left out
      announcementMatches.find.mockResolvedValue(pairs);

      const result = await service.findPublicMatches(7);

      expect(result.matches.map((match) => match.announcement.id)).toEqual([2, 3, 4, 5]);
      expect(result.matches[0].announcement).not.toHaveProperty('hiddenDetail');
    });
  });

  describe('findPublicPage (SCRUM-22 to SCRUM-25)', () => {
    // A fake QueryBuilder: every method returns the builder, and getManyAndCount gives the result.
    // The calls are recorded, so the tests can check the conditions and the order.
    function fakeSearch(result: [Announcement[], number] = [[], 0]) {
      const builder: Record<string, jest.Mock> = {};
      for (const method of ['innerJoinAndSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'setParameter', 'offset', 'limit']) {
        builder[method] = jest.fn(() => builder);
      }
      builder.getManyAndCount = jest.fn().mockResolvedValue(result);
      announcements.createQueryBuilder.mockReturnValue(builder);
      return builder;
    }

    // The conditions written in andWhere, as text.
    const conditions = (builder: Record<string, jest.Mock>) =>
      builder.andWhere.mock.calls.map((call) => call[0]).filter((condition) => typeof condition === 'string');

    it('returns 12 public announcements per page, never the hidden detail (FR-27)', async () => {
      const builder = fakeSearch([[storedAnnouncement()], 1]);

      const result = await service.findPublicPage({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('hiddenDetail');
      expect(result.data[0].photos).toEqual(['/uploads/a.jpg']);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 12,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
      expect(builder.offset).toHaveBeenCalledWith(0);
      expect(builder.limit).toHaveBeenCalledWith(12);
    });

    it('only shows Available and Open announcements, newest first, with the id as last criterion', async () => {
      const builder = fakeSearch();

      await service.findPublicPage({});

      expect(builder.where).toHaveBeenCalledWith('a.status IN (:...statuses)', {
        statuses: [AnnouncementStatus.Available, AnnouncementStatus.Open],
      });
      expect(builder.orderBy).not.toHaveBeenCalled();
      expect(builder.addOrderBy.mock.calls).toEqual([
        ['a.createdAt', 'DESC'],
        ['a.id', 'DESC'],
      ]);
    });

    it('skips the previous pages and tells if there is a next and a previous page (FR-28)', async () => {
      const builder = fakeSearch([[storedAnnouncement()], 41]);

      const result = await service.findPublicPage({ page: 3 });

      expect(builder.offset).toHaveBeenCalledWith(24);
      expect(result.meta).toMatchObject({ page: 3, totalItems: 41, totalPages: 4, hasNext: true, hasPrevious: true });
    });

    it('adds one condition for each filter that is sent, including the tab (FR-08, FR-09)', async () => {
      const builder = fakeSearch();

      await service.findPublicPage({
        type: AnnouncementType.Lost,
        categoryId: 1,
        objectTypeId: 2,
        placeId: 3,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      });

      expect(conditions(builder)).toEqual([
        'a.type = :type',
        'a.categoryId = :categoryId',
        'a.objectTypeId = :objectTypeId',
        'a.placeId = :placeId',
        'a.eventDate >= :dateFrom',
        'a.eventDate <= :dateTo',
      ]);
      expect(builder.andWhere).toHaveBeenCalledWith('a.type = :type', { type: AnnouncementType.Lost });
    });

    it('does not filter on anything that is not sent', async () => {
      const builder = fakeSearch();
      await service.findPublicPage({ q: '   ' });
      expect(builder.andWhere).not.toHaveBeenCalled();
    });

    it('searches the keyword in the title, description, brand and color (FR-21), with % and _ escaped', async () => {
      const builder = fakeSearch();

      await service.findPublicPage({ q: ' 50%_off ' });

      const [brackets, parameters] = builder.andWhere.mock.calls[0];
      expect(parameters).toEqual({ pattern: '%50\\%\\_off%' });

      // Runs the inside of the brackets on a fake "where" to read its conditions.
      const inner: Record<string, jest.Mock> = {};
      inner.where = jest.fn(() => inner);
      inner.orWhere = jest.fn(() => inner);
      brackets.whereFactory(inner);
      expect(inner.where).toHaveBeenCalledWith('a.title ILIKE :pattern');
      expect(inner.orWhere.mock.calls.map((call: string[]) => call[0])).toEqual([
        'a.description ILIKE :pattern',
        'a.brand ILIKE :pattern',
        'a.color ILIKE :pattern',
      ]);
    });

    it('sorts by closest date to the chosen date (FR-23)', async () => {
      const builder = fakeSearch();

      await service.findPublicPage({ dateFrom: '2026-10-05', sort: 'closestDate' });

      expect(builder.orderBy).toHaveBeenCalledWith('ABS(a.eventDate - CAST(:referenceDate AS date))', 'ASC');
      expect(builder.setParameter).toHaveBeenCalledWith('referenceDate', '2026-10-05');
      expect(builder.addOrderBy).toHaveBeenLastCalledWith('a.id', 'DESC');
    });

    it('uses the end date for the closest date when there is no start date', async () => {
      const builder = fakeSearch();
      await service.findPublicPage({ dateTo: '2026-10-20', sort: 'closestDate' });
      expect(builder.setParameter).toHaveBeenCalledWith('referenceDate', '2026-10-20');
    });

    it('sorts by best match, the title counting more than the rest (FR-23)', async () => {
      const builder = fakeSearch();

      await service.findPublicPage({ q: 'phone', sort: 'bestMatch' });

      const [expression, direction] = builder.orderBy.mock.calls[0];
      expect(expression).toContain('a.title ILIKE :pattern THEN 4');
      expect(expression).toContain('a.description ILIKE :pattern THEN 1');
      expect(direction).toBe('DESC');
    });

    it('refuses "closest date" without a date and "best match" without a keyword', async () => {
      fakeSearch();
      await expect(service.findPublicPage({ sort: 'closestDate' })).rejects.toThrow(
        'Choose a date to sort by closest date.',
      );
      await expect(service.findPublicPage({ sort: 'bestMatch', q: '  ' })).rejects.toThrow(
        'Type a keyword to sort by best match.',
      );
    });

    it('refuses a start date after the end date', async () => {
      fakeSearch();
      await expect(service.findPublicPage({ dateFrom: '2026-10-20', dateTo: '2026-10-01' })).rejects.toThrow(
        'The start date must be before the end date.',
      );
    });

    it('checks the filters with the reference lists, before searching (SCRUM-23)', async () => {
      fakeSearch();
      reference.checkFilters.mockRejectedValue(
        new BadRequestException('Choose a precise object that belongs to the selected category.'),
      );

      await expect(service.findPublicPage({ categoryId: 1, objectTypeId: 9 })).rejects.toThrow(
        'Choose a precise object that belongs to the selected category.',
      );
      expect(reference.checkFilters).toHaveBeenCalledWith(1, 9, undefined);
      expect(announcements.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findMine (SCRUM-18)', () => {
    it('lists my announcements with their hidden detail', async () => {
      announcements.find.mockResolvedValue([storedAnnouncement()]);

      const result = await service.findMine(1);

      expect(
        announcements.find.mock.calls[0][0].where.authorId,
      ).toBe(1);

      expect(result.announcements[0].hiddenDetail).toBe(
        'Cat sticker on the back',
      );
    });

    it("gives one of my announcements to the edit page, but not someone else's", async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      await expect(
        service.findMineById(1, 7),
      ).resolves.toBeDefined();

      await expect(
        service.findMineById(2, 7),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update (SCRUM-18)', () => {
    it('changes only the fields that are sent', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      await service.update(1, 7, {
        title: 'Black iPhone',
        brand: '',
      });

      const saved = announcements.save.mock.calls[0][0];

      expect(saved.title).toBe('Black iPhone');
      expect(saved.brand).toBeNull();
      expect(saved.description).toBe('Found under a table');
      expect(saved).not.toHaveProperty('category');
      expect(reference.checkSelection).not.toHaveBeenCalled();
    });

    it('checks the new combination when the category, object or place changes', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      await service.update(1, 7, { placeId: 5 });

      expect(reference.checkSelection).toHaveBeenCalledWith(1, 2, 5);
    });

    it("refuses the edit of someone else's announcement (403)", async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({ authorId: 2 }),
      );

      await expect(
        service.update(1, 7, { title: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses the edit of a deleted announcement (404)', async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          status: AnnouncementStatus.Deleted,
        }),
      );

      await expect(
        service.update(1, 7, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses the edit of a final status (409)', async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          status: AnnouncementStatus.Returned,
        }),
      );

      await expect(
        service.update(1, 7, { title: 'X' }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuses an empty hidden detail on a found announcement and a future date', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      await expect(
        service.update(1, 7, { hiddenDetail: '' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update(1, 7, { eventDate: '2999-01-01' }),
      ).rejects.toThrow(BadRequestException);

      expect(announcements.save).not.toHaveBeenCalled();
    });
  });

  describe('replace (Lab 6, PUT)', () => {
    const fullForm = {
      title: 'Black iPhone 13',
      categoryId: 1,
      objectTypeId: 2,
      description: 'Found under a table in room B204',
      eventDate: '2026-10-01',
      placeId: 3,
      hiddenDetail: 'Cat sticker on the back',
    };

    it('replaces every field and empties the optional ones that are missing', async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({ brand: 'Apple', color: 'Black', placeDetails: 'Second floor' }),
      );

      await service.replace(1, 7, fullForm);

      const saved = announcements.save.mock.calls[0][0];

      expect(saved.title).toBe('Black iPhone 13');
      expect(saved.description).toBe('Found under a table in room B204');
      expect(saved.brand).toBeNull();
      expect(saved.color).toBeNull();
      expect(saved.placeDetails).toBeNull();
      expect(reference.checkSelection).toHaveBeenCalledWith(1, 2, 3);
    });

    it('refuses a found announcement without hidden detail (400)', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      await expect(
        service.replace(1, 7, { ...fullForm, hiddenDetail: undefined }),
      ).rejects.toThrow(BadRequestException);
      expect(announcements.save).not.toHaveBeenCalled();
    });

    it("refuses someone else's announcement (403) and a final one (409)", async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement({ authorId: 2 }));
      await expect(service.replace(1, 7, fullForm)).rejects.toThrow(ForbiddenException);

      announcements.findOne.mockResolvedValue(
        storedAnnouncement({ status: AnnouncementStatus.Returned }),
      );
      await expect(service.replace(1, 7, fullForm)).rejects.toThrow(ConflictException);
    });

    it('refuses an unknown announcement (404)', async () => {
      announcements.findOne.mockResolvedValue(null);
      await expect(service.replace(1, 99, fullForm)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove (SCRUM-18)', () => {
    it('sets the status to Deleted instead of erasing the row', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      await service.remove(1, 7);

      expect(
        announcements.save.mock.calls[0][0].status,
      ).toBe(AnnouncementStatus.Deleted);
    });

    it("refuses to delete someone else's announcement or a final one", async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({ authorId: 2 }),
      );

      await expect(
        service.remove(1, 7),
      ).rejects.toThrow(ForbiddenException);

      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          status: AnnouncementStatus.Archived,
        }),
      );

      await expect(
        service.remove(1, 7),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('close a lost announcement (SCRUM-21)', () => {
    it('closes my open lost announcement', async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          type: AnnouncementType.Lost,
          status: AnnouncementStatus.Open,
          currentLocation: null,
        }),
      );

      await service.update(1, 7, {
        status: AnnouncementStatus.Closed,
      });

      expect(
        announcements.save.mock.calls[0][0].status,
      ).toBe(AnnouncementStatus.Closed);
    });

    it('refuses to close a found announcement (409)', async () => {
      announcements.findOne.mockResolvedValue(storedAnnouncement());

      await expect(
        service.update(1, 7, {
          status: AnnouncementStatus.Closed,
        }),
      ).rejects.toThrow('Only a lost announcement can be closed.');
    });

    it('refuses to change a closed announcement again (409)', async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          type: AnnouncementType.Lost,
          status: AnnouncementStatus.Closed,
        }),
      );

      await expect(
        service.update(1, 7, { title: 'X' }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.remove(1, 7),
      ).rejects.toThrow(ConflictException);
    });

    it('accepts an empty hidden detail on a lost announcement (it is optional)', async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          type: AnnouncementType.Lost,
          status: AnnouncementStatus.Open,
        }),
      );

      await service.update(1, 7, { hiddenDetail: '' });

      expect(
        announcements.save.mock.calls[0][0].hiddenDetail,
      ).toBeNull();
    });

    it("refuses to close someone else's lost announcement (403)", async () => {
      announcements.findOne.mockResolvedValue(
        storedAnnouncement({
          type: AnnouncementType.Lost,
          status: AnnouncementStatus.Open,
          authorId: 2,
        }),
      );

      await expect(
        service.update(1, 7, {
          status: AnnouncementStatus.Closed,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAdminStatistics (SCRUM-36)', () => {
    it('returns zeroed metrics and null average return time when no announcements exist', async () => {
      announcements.find.mockResolvedValue([]);
      const stats = await service.getAdminStatistics();
      expect(stats).toEqual({
        declaredCount: 0,
        returnedCount: 0,
        recoveryRate: 0,
        averageReturnTimeHours: null,
        averageReturnTimeDays: null,
        breakdown: {
          foundDeclared: 0,
          lostDeclared: 0,
          foundReturned: 0,
          lostReturned: 0,
          activeCount: 0,
          closedCount: 0,
          archivedCount: 0,
          hiddenCount: 0,
        },
      });
    });

    it('computes declared counts, recovery rate, average return time, and status breakdown', async () => {
      announcements.find.mockResolvedValue([
        { id: 1, type: AnnouncementType.Found, status: AnnouncementStatus.Returned, createdAt: new Date('2026-11-01T00:00:00Z'), returnedAt: new Date('2026-11-02T00:00:00Z') },
        { id: 2, type: AnnouncementType.Lost, status: AnnouncementStatus.Returned, createdAt: new Date('2026-11-01T00:00:00Z'), returnedAt: new Date('2026-11-04T00:00:00Z') },
        { id: 3, type: AnnouncementType.Found, status: AnnouncementStatus.Available, createdAt: new Date('2026-11-05T00:00:00Z'), returnedAt: null },
        { id: 4, type: AnnouncementType.Lost, status: AnnouncementStatus.Closed, createdAt: new Date('2026-11-05T00:00:00Z'), returnedAt: null },
        { id: 5, type: AnnouncementType.Found, status: AnnouncementStatus.Deleted, createdAt: new Date('2026-11-05T00:00:00Z'), returnedAt: null },
      ]);
      const stats = await service.getAdminStatistics();
      expect(stats.declaredCount).toBe(4);
      expect(stats.returnedCount).toBe(2);
      expect(stats.recoveryRate).toBe(50);
      expect(stats.averageReturnTimeHours).toBe(48);
      expect(stats.averageReturnTimeDays).toBe(2);
      expect(stats.breakdown).toEqual({
        foundDeclared: 2,
        lostDeclared: 2,
        foundReturned: 1,
        lostReturned: 1,
        activeCount: 1,
        closedCount: 1,
        archivedCount: 0,
        hiddenCount: 0,
      });
    });
  });
});
