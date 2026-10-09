import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnnouncementsService } from './announcements.service';
import { FoundAnnouncement } from './found-announcement.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let itemsRepo: {
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let usersRepo: {
    findOneBy: jest.Mock;
  };
  let mailService: {
    confirmation: jest.Mock;
  };

  beforeEach(async () => {
    itemsRepo = {
      findOneBy: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) =>
        Promise.resolve({
          id: 42,
          createdAt: new Date('2026-10-09T00:00:00Z'),
          ...entity,
        }),
      ),
    };

    usersRepo = {
      findOneBy: jest.fn(),
    };

    mailService = {
      confirmation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: getRepositoryToken(FoundAnnouncement), useValue: itemsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);

      await expect(service.create(999, 'Keys', 'Found near gym')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should save announcement and send confirmation email in background without failing if email fails (Point B2)', async () => {
      const user = { id: 1, email: 'student@school.edu' };
      usersRepo.findOneBy.mockResolvedValue(user);
      mailService.confirmation.mockRejectedValue(new Error('SMTP connection error'));

      const result = await service.create(1, 'Wallet', 'Found on 3rd floor');

      expect(itemsRepo.save).toHaveBeenCalled();
      expect(result).toEqual({
        announcement: {
          id: 42,
          title: 'Wallet',
          description: 'Found on 3rd floor',
          created_at: new Date('2026-10-09T00:00:00Z'),
        },
      });
    });
  });

  describe('find', () => {
    it('should throw NotFoundException if announcement is not found', async () => {
      itemsRepo.findOneBy.mockResolvedValue(null);

      await expect(service.find(999)).rejects.toThrow(NotFoundException);
    });

    it('should return announcement details when found', async () => {
      itemsRepo.findOneBy.mockResolvedValue({
        id: 42,
        title: 'Calculator',
        description: 'TI-84 in room 201',
        createdAt: new Date('2026-10-09T00:00:00Z'),
      });

      const res = await service.find(42);
      expect(res).toEqual({
        announcement: {
          id: 42,
          title: 'Calculator',
          description: 'TI-84 in room 201',
          created_at: new Date('2026-10-09T00:00:00Z'),
        },
      });
    });
  });
});
