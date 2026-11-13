
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AnnouncementMatch } from './announcement-match.entity';
import { Discussion } from '../discussions/discussion.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ILike, In, IsNull, MoreThanOrEqual, Not } from 'typeorm';
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
import { Message } from '../discussions/message.entity';

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
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
  };

  let users: { findOneBy: jest.Mock };
  let reference: {
    checkSelection: jest.Mock;
    checkFilters: jest.Mock;
  };
  let photoStorage: { save: jest.Mock };

  let mail: {
    confirmation: jest.Mock;
    discussionStarted: jest.Mock;
    newMessage: jest.Mock;
    handover: jest.Mock;
  };

  let savedSearches: { notifyMatches: jest.Mock };

  let discussions: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let messages: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };

  beforeEach(async () => {
    announcements = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 7, ...data })),
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue(storedAnnouncement()),
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

    mail = {
      confirmation: jest.fn().mockResolvedValue(undefined),
      discussionStarted: jest.fn().mockResolvedValue(undefined),
      newMessage: jest.fn().mockResolvedValue(undefined),
      handover: jest.fn().mockResolvedValue(undefined),
    };

    savedSearches = {
      notifyMatches: jest.fn().mockResolvedValue(undefined),
    };

    discussions = {
      create: jest.fn((data) => data),
      save: jest.fn().mockImplementation(async (data) => ({
        id: 1,
        ...data,
      })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
messages = {
  create: jest.fn((data) => data),
  save: jest.fn().mockImplementation(async (data) => ({
    id: 1,
    ...data,
  })),
  find: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue({ affected: 0 }),
  count: jest.fn().mockResolvedValue(0),
};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        {
          provide: getRepositoryToken(Announcement),
          useValue: announcements,
        },
        {
          provide: getRepositoryToken(AnnouncementMatch),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((data) => data),
            save: jest.fn().mockImplementation(async (data) => data),
          },
        },
        {
          provide: getRepositoryToken(Discussion),
          useValue: discussions,
        },
{
  provide: getRepositoryToken(Message),
  useValue: messages,
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

  describe('findPublicPage (SCRUM-22)', () => {
    it('returns the public view of the announcements, never the hidden detail', async () => {
      announcements.findAndCount.mockResolvedValue([
        [storedAnnouncement()],
        1,
      ]);

      const result = await service.findPublicPage({});

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0]).not.toHaveProperty('hiddenDetail');
      expect(result.announcements[0].photos).toEqual(['/uploads/a.jpg']);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('only asks for Available and Open announcements, newest first', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({});

      const options = announcements.findAndCount.mock.calls[0][0];

      expect(options.where.status).toEqual(
        In([
          AnnouncementStatus.Available,
          AnnouncementStatus.Open,
        ]),
      );

      expect(options.order).toEqual({
        createdAt: 'DESC',
        id: 'DESC',
      });
    });

    it('skips the previous pages and counts the total number of pages', async () => {
      announcements.findAndCount.mockResolvedValue([
        [storedAnnouncement()],
        41,
      ]);

      const result = await service.findPublicPage({
        page: 3,
        limit: 20,
      });

      const options = announcements.findAndCount.mock.calls[0][0];

      expect(options.skip).toBe(40);
      expect(options.take).toBe(20);
      expect(result.meta).toEqual({
        page: 3,
        limit: 20,
        total: 41,
        totalPages: 3,
      });
    });

    it('adds one condition for each filter that is sent (SCRUM-23)', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({
        categoryId: 1,
        objectTypeId: 2,
        placeId: 3,
        dateFrom: '2026-10-01',
      });

      const where = announcements.findAndCount.mock.calls[0][0].where;

      expect(where.categoryId).toBe(1);
      expect(where.objectTypeId).toBe(2);
      expect(where.placeId).toBe(3);
      expect(where.eventDate).toEqual(
        MoreThanOrEqual('2026-10-01'),
      );
      expect(where.status).toEqual(
        In([
          AnnouncementStatus.Available,
          AnnouncementStatus.Open,
        ]),
      );
    });

    it('does not filter on anything that is not sent', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({ placeId: 3 });

      const where = announcements.findAndCount.mock.calls[0][0].where;

      expect(where).not.toHaveProperty('categoryId');
      expect(where).not.toHaveProperty('eventDate');
    });

    it('searches the keyword in the title and description only (SCRUM-24)', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({
        q: '  phone  ',
        placeId: 3,
      });

      const where = announcements.findAndCount.mock.calls[0][0].where;

      expect(where).toHaveLength(2);
      expect(where[0].title).toEqual(ILike('%phone%'));
      expect(where[1].description).toEqual(ILike('%phone%'));

      where.forEach((condition: Record<string, unknown>) => {
        expect(condition).not.toHaveProperty('brand');
        expect(condition).not.toHaveProperty('color');
        expect(condition).not.toHaveProperty('hiddenDetail');
      });

      where.forEach((condition: Record<string, unknown>) => {
        expect(condition.placeId).toBe(3);
        expect(condition.status).toEqual(
          In([
            AnnouncementStatus.Available,
            AnnouncementStatus.Open,
          ]),
        );
      });
    });

    it('escapes % and _ typed in the keyword', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({ q: '50%_' });

      const where = announcements.findAndCount.mock.calls[0][0].where;

      expect(where[0].title).toEqual(ILike('%50\\%\\_%'));
    });

    it('ignores an empty keyword', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({ q: '   ' });

      const where = announcements.findAndCount.mock.calls[0][0].where;

      expect(Array.isArray(where)).toBe(false);
    });

    it('sorts the oldest first when asked (SCRUM-25)', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({ sort: 'oldest' });

      expect(
        announcements.findAndCount.mock.calls[0][0].order,
      ).toEqual({
        createdAt: 'ASC',
        id: 'ASC',
      });
    });

    it('sorts by event date, the most recent event first (SCRUM-25)', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({ sort: 'eventDate' });

      expect(
        announcements.findAndCount.mock.calls[0][0].order,
      ).toEqual({
        eventDate: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      });
    });

    it('sorts the newest first when the sort is missing or newest (SCRUM-25)', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({});
      await service.findPublicPage({ sort: 'newest' });

      expect(
        announcements.findAndCount.mock.calls[0][0].order,
      ).toEqual({
        createdAt: 'DESC',
        id: 'DESC',
      });

      expect(
        announcements.findAndCount.mock.calls[1][0].order,
      ).toEqual({
        createdAt: 'DESC',
        id: 'DESC',
      });
    });

    it('checks the filters that are sent with the reference lists (SCRUM-23)', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      await service.findPublicPage({
        categoryId: 1,
        objectTypeId: 2,
        placeId: 3,
      });

      expect(reference.checkFilters).toHaveBeenCalledWith(1, 2, 3);
    });

    it('refuses an object that does not belong to the category, before searching (SCRUM-23)', async () => {
      reference.checkFilters.mockRejectedValue(
        new BadRequestException(
          'Choose a precise object that belongs to the selected category.',
        ),
      );

      await expect(
        service.findPublicPage({
          categoryId: 1,
          objectTypeId: 13,
        }),
      ).rejects.toThrow(
        'Choose a precise object that belongs to the selected category.',
      );

      expect(announcements.findAndCount).not.toHaveBeenCalled();
    });

    it('uses page 1 and 20 per page by default, and always has at least one page', async () => {
      announcements.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPublicPage({});

      const options = announcements.findAndCount.mock.calls[0][0];

      expect(options.skip).toBe(0);
      expect(options.take).toBe(20);
      expect(result.meta.totalPages).toBe(1);
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

  describe('startDiscussion (Jira task)', () => {
    it('allows another user to start a discussion with proof', async () => {
      announcements.findOne.mockResolvedValue({
        ...storedAnnouncement(),
        author: {
          id: 1,
          email: 'finder@school.test',
        },
      });

      const result = await service.startDiscussion(7, 2, {
        description: 'The phone has a scratch near the charging port.',
      });

      expect(discussions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementId: 7,
          ownerId: 2,
          description: 'The phone has a scratch near the charging port.',
        }),
      );

      expect(mail.discussionStarted).toHaveBeenCalledWith(
        'finder@school.test',
        {
          id: 7,
          title: 'Black phone',
        },
      );

      expect(result.message).toBe('Discussion started successfully.');
    });

    it('does not allow the finder to claim their own announcement', async () => {
      announcements.findOne.mockResolvedValue({
        ...storedAnnouncement(),
        author: {
          id: 1,
          email: 'finder@school.test',
        },
      });

      await expect(
        service.startDiscussion(7, 1, {
          description: 'I own this phone.',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(discussions.save).not.toHaveBeenCalled();
      expect(mail.discussionStarted).not.toHaveBeenCalled();
    });

    it('rejects discussions about lost announcements', async () => {
      announcements.findOne.mockResolvedValue({
        ...storedAnnouncement({
          type: AnnouncementType.Lost,
        }),
        author: {
          id: 1,
          email: 'finder@school.test',
        },
      });

      await expect(
        service.startDiscussion(7, 2, {
          description: 'This is my phone.',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(discussions.save).not.toHaveBeenCalled();
    });

    it('rejects discussions when the found announcement is unavailable', async () => {
      announcements.findOne.mockResolvedValue({
        ...storedAnnouncement({
          status: AnnouncementStatus.Returned,
        }),
        author: {
          id: 1,
          email: 'finder@school.test',
        },
      });

      await expect(
        service.startDiscussion(7, 2, {
          description: 'This is my phone.',
        }),
      ).rejects.toThrow(ConflictException);

      expect(discussions.save).not.toHaveBeenCalled();
    });

    it('does not create a discussion if the announcement does not exist', async () => {
      announcements.findOne.mockResolvedValue(null);

      await expect(
        service.startDiscussion(999, 2, {
          description: 'This is my phone.',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(discussions.save).not.toHaveBeenCalled();
    });
  });

  describe('returnItem (SCRUM-32)', () => {
    const announcement = {
      ...storedAnnouncement(),
      authorId: 1,
      type: AnnouncementType.Found,
      status: AnnouncementStatus.Available,
      title: 'Black phone',
      returnedAt: null,
    };

    const discussion = {
      id: 1,
      announcementId: 7,
      ownerId: 2,
      owner: {
        id: 2,
        email: 'claimant@school.test',
      },
    };

    beforeEach(() => {
      announcement.status = AnnouncementStatus.Available;
      announcement.returnedAt = null;
      announcements.findOne.mockResolvedValue({ ...announcement });
      discussions.findOne.mockResolvedValue({ ...discussion });
    });

    it('allows the finder to confirm handover and notifies the claimant', async () => {
      const result = await service.returnItem(1, 7, 1);

      expect(discussions.findOne).toHaveBeenCalledWith({
        where: { id: 1, announcementId: 7 },
        relations: { owner: true },
      });

      expect(announcements.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AnnouncementStatus.Returned,
          returnedAt: expect.any(Date),
        }),
      );

      expect(mail.handover).toHaveBeenCalledWith(
        'claimant@school.test',
        {
          id: 7,
          title: 'Black phone',
        },
        'finder',
      );

      expect(result.status).toBe(AnnouncementStatus.Returned);
    });

    it('allows the claimant to confirm handover and notifies the finder', async () => {
      const result = await service.returnItem(2, 7, 1);

      expect(users.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(mail.handover).toHaveBeenCalledWith(
        'elea@school.test',
        {
          id: 7,
          title: 'Black phone',
        },
        'owner',
      );
      expect(announcements.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AnnouncementStatus.Returned,
          returnedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(AnnouncementStatus.Returned);
    });

    it('does not allow an unrelated user to confirm handover', async () => {
      await expect(
        service.returnItem(3, 7, 1),
      ).rejects.toThrow(ForbiddenException);

      expect(announcements.save).not.toHaveBeenCalled();
      expect(mail.handover).not.toHaveBeenCalled();
    });

    it('rejects a discussion belonging to another announcement', async () => {
  announcements.findOne.mockResolvedValue({
    ...storedAnnouncement(),
    authorId: 1,
    type: AnnouncementType.Found,
    status: AnnouncementStatus.Available,
  });

  discussions.findOne.mockResolvedValue(null);

      await expect(
        service.returnItem(1, 7, 99),
      ).rejects.toThrow(NotFoundException);

      expect(announcements.save).not.toHaveBeenCalled();
      expect(mail.handover).not.toHaveBeenCalled();
    });

    it('rejects an announcement that is already returned', async () => {
      announcements.findOne.mockResolvedValue({
        ...announcement,
        status: AnnouncementStatus.Returned,
      });

      await expect(
        service.returnItem(1, 7, 1),
      ).rejects.toThrow(ConflictException);

      expect(discussions.findOne).not.toHaveBeenCalled();
      expect(mail.handover).not.toHaveBeenCalled();
    });
  });

  describe('SCRUM-31 messaging', () => {
    const discussion = {
  id: 1,
  ownerId: 2,
  announcement: {
    id: 7,
    title: 'Black phone',
    authorId: 1,
  },
};

    beforeEach(() => {
      discussions.findOne.mockResolvedValue(discussion);
    });

    describe('sendMessage', () => {
      it('allows a participant to send a message', async () => {
        const result = await service.sendMessage(1, 2, {
          content: 'I can collect the phone tomorrow.',
        });

        expect(discussions.findOne).toHaveBeenCalledWith({
          where: { id: 1 },
          relations: { announcement: true },
        });

        expect(messages.create).toHaveBeenCalledWith({
          discussionId: 1,
          senderId: 2,
          content: 'I can collect the phone tomorrow.',
          readAt: null,
        });

        expect(messages.save).toHaveBeenCalled();
        expect(result.message).toMatchObject({
          discussionId: 1,
          senderId: 2,
          content: 'I can collect the phone tomorrow.',
        });
      });

      it('notifies the finder when the claimant sends a message', async () => {
        await service.sendMessage(1, 2, {
          content: 'I can collect the phone tomorrow.',
        });

        expect(users.findOneBy).toHaveBeenCalledWith({ id: 1 });
        expect(mail.newMessage).toHaveBeenCalledWith(
          'elea@school.test',
          {
            announcementId: 7,
            announcementTitle: 'Black phone',
          },
        );
      });

      it('notifies the claimant when the finder sends a message', async () => {
        discussions.findOne.mockResolvedValue({
          ...discussion,
          ownerId: 2,
        });

        users.findOneBy.mockResolvedValue({
          id: 2,
          email: 'claimant@school.test',
        });

        await service.sendMessage(1, 1, {
          content: 'I found your claim details correct.',
        });

        expect(users.findOneBy).toHaveBeenCalledWith({ id: 2 });
        expect(mail.newMessage).toHaveBeenCalledWith(
          'claimant@school.test',
          {
            announcementId: 7,
            announcementTitle: 'Black phone',
          },
        );
      });

      it('rejects a user who is not a participant', async () => {
        await expect(
          service.sendMessage(1, 3, {
            content: 'Hello',
          }),
        ).rejects.toThrow(ForbiddenException);

        expect(messages.save).not.toHaveBeenCalled();
      });

      it('returns 404 when the discussion does not exist', async () => {
        discussions.findOne.mockResolvedValue(null);

        await expect(
          service.sendMessage(999, 2, {
            content: 'Hello',
          }),
        ).rejects.toThrow(NotFoundException);

        expect(messages.save).not.toHaveBeenCalled();
      });
    });

    describe('getMessages', () => {
      it('returns messages and marks incoming messages as read', async () => {
        const conversationMessages = [
          {
            id: 1,
            discussionId: 1,
            senderId: 2,
            content: 'Hello',
          },
          {
            id: 2,
            discussionId: 1,
            senderId: 1,
            content: 'Hello, how can I help?',
          },
        ];

        messages.find.mockResolvedValue(conversationMessages);

        const result = await service.getMessages(1, 2);

        expect(messages.update).toHaveBeenCalledWith(
          {
            discussionId: 1,
            senderId: Not(2),
            readAt: IsNull(),
          },
          {
            readAt: expect.any(Date),
          },
        );

        expect(messages.find).toHaveBeenCalledWith({
          where: { discussionId: 1 },
          order: { createdAt: 'ASC', id: 'ASC' },
        });

        expect(result.messages).toEqual(conversationMessages);
      });

      it('rejects a user who is not a participant', async () => {
        await expect(
          service.getMessages(1, 3),
        ).rejects.toThrow(ForbiddenException);

        expect(messages.find).not.toHaveBeenCalled();
        expect(messages.update).not.toHaveBeenCalled();
      });

      it('returns 404 when the discussion does not exist', async () => {
        discussions.findOne.mockResolvedValue(null);

        await expect(
          service.getMessages(999, 2),
        ).rejects.toThrow(NotFoundException);
      });
    });

        describe('getUnreadCount', () => {
      it('counts unread messages across the user discussions', async () => {
        discussions.find.mockResolvedValue([
          { id: 1 },
          { id: 2 },
        ]);

        messages.count.mockResolvedValue(3);

        const result = await service.getUnreadCount(2);

        expect(discussions.find).toHaveBeenCalledWith({
          where: [
            { ownerId: 2 },
            { announcement: { authorId: 2 } },
          ],
          relations: { announcement: true },
        });

        expect(messages.count).toHaveBeenCalledWith({
          where: {
            discussionId: In([1, 2]),
            senderId: Not(2),
            readAt: IsNull(),
          },
        });

        expect(result).toEqual({ unreadCount: 3 });
      });

      it('returns zero without querying messages when there are no discussions', async () => {
        discussions.find.mockResolvedValue([]);

        const result = await service.getUnreadCount(2);

        expect(result).toEqual({ unreadCount: 0 });
        expect(messages.count).not.toHaveBeenCalled();
      });
    });

    describe('getDiscussions', () => {
      it('shows the claimant to the finder in the inbox', async () => {
        discussions.find.mockResolvedValue([
          {
            id: 1,
            announcementId: 7,
            ownerId: 2,
            description: 'Private proof description',
            createdAt: new Date('2026-10-20T10:00:00Z'),
            announcement: {
              authorId: 1,
              title: 'Black phone',
              author: {
                id: 1,
                firstName: 'Finder',
                lastName: 'One',
              },
            },
            owner: {
              id: 2,
              firstName: 'Claimant',
              lastName: 'Two',
            },
          },
        ]);

        messages.find.mockResolvedValue([
          {
            content: 'I can collect it tomorrow.',
            senderId: 2,
            createdAt: new Date('2026-10-20T11:00:00Z'),
          },
        ]);

        messages.count.mockResolvedValue(1);

        const result = await service.getDiscussions(1);

        expect(result.discussions).toHaveLength(1);
        expect(result.discussions[0]).toMatchObject({
          discussionId: 1,
          announcementId: 7,
          announcementTitle: 'Black phone',
          otherParticipant: {
            id: 2,
            firstName: 'Claimant',
            lastName: 'Two',
          },
          lastMessage: {
            content: 'I can collect it tomorrow.',
            senderId: 2,
          },
          unreadCount: 1,
        });

        expect(result.discussions[0]).not.toHaveProperty('description');
      });

      it('shows the finder to the claimant in the inbox', async () => {
        discussions.find.mockResolvedValue([
          {
            id: 1,
            announcementId: 7,
            ownerId: 2,
            description: 'Private proof description',
            createdAt: new Date('2026-10-20T10:00:00Z'),
            announcement: {
              authorId: 1,
              title: 'Black phone',
              author: {
                id: 1,
                firstName: 'Finder',
                lastName: 'One',
              },
            },
            owner: {
              id: 2,
              firstName: 'Claimant',
              lastName: 'Two',
            },
          },
        ]);

        messages.find.mockResolvedValue([]);
        messages.count.mockResolvedValue(0);

        const result = await service.getDiscussions(2);

        expect(result.discussions[0].otherParticipant).toEqual({
          id: 1,
          firstName: 'Finder',
          lastName: 'One',
        });

        expect(result.discussions[0].lastMessage).toBeNull();
        expect(result.discussions[0].unreadCount).toBe(0);
        expect(result.discussions[0]).not.toHaveProperty('description');
      });

      it('returns an empty list when the user has no discussions', async () => {
        discussions.find.mockResolvedValue([]);

        const result = await service.getDiscussions(2);

        expect(result).toEqual({ discussions: [] });
        expect(messages.find).not.toHaveBeenCalled();
        expect(messages.count).not.toHaveBeenCalled();
      });
    });
  });
});