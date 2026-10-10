import { BadRequestException, NotFoundException } from '@nestjs/common';
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

// A fake uploaded photo, as Multer gives it to the controller.
function photo(): Express.Multer.File {
  return { mimetype: 'image/jpeg', size: 1000, buffer: Buffer.from([0xff, 0xd8, 0xff]) } as Express.Multer.File;
}

// A valid form for a found object.
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

// A valid form for a lost object: no current location, no hidden detail, no photo.
function lostForm(): CreateAnnouncementDto {
  return {
    type: AnnouncementType.Lost,
    title: 'Blue scarf',
    categoryId: 3,
    objectTypeId: 13,
    description: 'Lost in the amphitheatre',
    eventDate: '2026-10-02',
    placeId: 4,
    currentLocation: CurrentLocation.Finder, // sent by mistake: must be ignored
  };
}

// What the repository returns once the announcement is saved and reloaded with its relations.
function storedAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
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
  let announcements: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; findOneOrFail: jest.Mock };
  let users: { findOneBy: jest.Mock };
  let reference: { checkSelection: jest.Mock };
  let photoStorage: { save: jest.Mock };
  let mail: { confirmation: jest.Mock };

  beforeEach(async () => {
    announcements = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 7, ...data })),
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue(storedAnnouncement()),
    };
    users = { findOneBy: jest.fn().mockResolvedValue({ id: 1, email: 'elea@school.test' }) };
    reference = { checkSelection: jest.fn().mockResolvedValue(undefined) };
    photoStorage = { save: jest.fn().mockResolvedValue(['a.jpg']) };
    mail = { confirmation: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: ReferenceService, useValue: reference },
        { provide: PhotoStorageService, useValue: photoStorage },
        { provide: MailService, useValue: mail },
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
      expect(saved.brand).toBeNull(); // empty optional field stored as null
      const days = (saved.expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
      expect(Math.round(days)).toBe(90);
    });

    it('returns the announcement with the hidden detail, because the author is asking', async () => {
      const result = await service.create(1, foundForm(), [photo()]);
      expect(result.announcement.hiddenDetail).toBe('Cat sticker on the back');
      expect(result.announcement.photos).toEqual(['/uploads/a.jpg']);
    });

    it('refuses a found announcement without photo, before saving anything', async () => {
      await expect(service.create(1, foundForm(), [])).rejects.toThrow(BadRequestException);
      expect(photoStorage.save).not.toHaveBeenCalled();
      expect(announcements.save).not.toHaveBeenCalled();
    });

    it('refuses a date in the future', async () => {
      const form = { ...foundForm(), eventDate: '2999-01-01' };
      await expect(service.create(1, form, [photo()])).rejects.toThrow('The date cannot be in the future.');
    });

    it('refuses ids that do not match the reference lists', async () => {
      reference.checkSelection.mockRejectedValue(new BadRequestException('Choose a place from the list.'));
      await expect(service.create(1, foundForm(), [photo()])).rejects.toThrow('Choose a place from the list.');
      expect(announcements.save).not.toHaveBeenCalled();
    });

    it('refuses an unknown user', async () => {
      users.findOneBy.mockResolvedValue(null);
      await expect(service.create(99, foundForm(), [photo()])).rejects.toThrow(NotFoundException);
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
      expect(photoStorage.save).toHaveBeenCalledWith([expect.anything()]);
    });

    it('still succeeds when the confirmation email fails', async () => {
      mail.confirmation.mockRejectedValue(new Error('SMTP down'));
      await expect(service.create(1, foundForm(), [photo()])).resolves.toBeDefined();
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
      await expect(service.findPublic(8)).rejects.toThrow(NotFoundException);

      announcements.findOne.mockResolvedValue(storedAnnouncement({ status: AnnouncementStatus.Deleted }));
      await expect(service.findPublic(7)).rejects.toThrow(NotFoundException);
    });
  });
});
