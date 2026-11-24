import { ConflictException, ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, IsNull, Not } from 'typeorm';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
  CurrentLocation,
} from '../announcements/announcement.entity';
import { DailyLimitsService } from '../limits/daily-limits.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { Discussion } from './discussion.entity';
import { DiscussionsService } from './discussions.service';
import { Message } from './message.entity';

// A found phone kept by its finder (user 1).
function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 7,
    type: AnnouncementType.Found,
    status: AnnouncementStatus.Available,
    authorId: 1,
    author: { id: 1, email: 'finder@school.test', firstName: 'Fin', lastName: 'Der' },
    title: 'Black phone',
    currentLocation: CurrentLocation.Finder,
    ...overrides,
  } as Announcement;
}

// User 2 started a discussion about it.
function discussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: 3,
    announcementId: 7,
    ownerId: 2,
    owner: { id: 2, email: 'owner@school.test', firstName: 'Own', lastName: 'Er' },
    description: 'Cat sticker on the back',
    closedAt: null,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    announcement: announcement(),
    ...overrides,
  } as Discussion;
}

describe('DiscussionsService', () => {
  let service: DiscussionsService;
  let discussions: { findOne: jest.Mock; findOneBy: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let messages: { find: jest.Mock; count: jest.Mock; update: jest.Mock; create: jest.Mock; save: jest.Mock };
  let announcements: { findOne: jest.Mock; update: jest.Mock };
  let users: { findOneBy: jest.Mock };
  let mail: { discussionStarted: jest.Mock; newMessage: jest.Mock; handover: jest.Mock };
  let limits: { assertCanStartDiscussion: jest.Mock };

  beforeEach(async () => {
    discussions = {
      findOne: jest.fn().mockResolvedValue(discussion()),
      findOneBy: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 3, ...data })),
    };
    messages = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 9, ...data })),
    };
    announcements = { findOne: jest.fn().mockResolvedValue(announcement()), update: jest.fn() };
    users = { findOneBy: jest.fn(({ id }) => Promise.resolve({ id, email: id === 1 ? 'finder@school.test' : 'owner@school.test' })) };
    limits = { assertCanStartDiscussion: jest.fn().mockResolvedValue(undefined) };
    mail = {
      discussionStarted: jest.fn().mockResolvedValue(undefined),
      newMessage: jest.fn().mockResolvedValue(undefined),
      handover: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionsService,
        { provide: getRepositoryToken(Discussion), useValue: discussions },
        { provide: getRepositoryToken(Message), useValue: messages },
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: MailService, useValue: mail },
        { provide: DailyLimitsService, useValue: limits },
      ],
    }).compile();

    service = module.get(DiscussionsService);
  });

  describe('start (SCRUM-30, FR-11)', () => {
    it('saves the proof and emails the author with a link to the discussion', async () => {
      const result = await service.start(2, { announcementId: 7, description: 'Cat sticker on the back' });

      expect(discussions.save.mock.calls[0][0]).toEqual({
        announcementId: 7,
        ownerId: 2,
        description: 'Cat sticker on the back',
      });
      expect(mail.discussionStarted).toHaveBeenCalledWith(
        'finder@school.test',
        { id: 7, title: 'Black phone', type: AnnouncementType.Found },
        3,
      );
      expect(result).toEqual({ message: 'Discussion started successfully.', discussionId: 3 });
    });

    it('asks the daily limit and saves nothing when it is reached (FR-31, 429)', async () => {
      limits.assertCanStartDiscussion.mockRejectedValue(new HttpException('Too many.', HttpStatus.TOO_MANY_REQUESTS));

      await expect(service.start(2, { announcementId: 7, description: 'Cat sticker' })).rejects.toMatchObject({ status: 429 });

      expect(limits.assertCanStartDiscussion).toHaveBeenCalledWith(2);
      expect(discussions.save).not.toHaveBeenCalled();
      expect(mail.discussionStarted).not.toHaveBeenCalled();
    });

    it('also works for a lost announcement (the initiator found the object)', async () => {
      announcements.findOne.mockResolvedValue(announcement({ type: AnnouncementType.Lost, status: AnnouncementStatus.Open, currentLocation: null }));
      await expect(service.start(2, { announcementId: 7, description: 'Found near the library' })).resolves.toMatchObject({ discussionId: 3 });
    });

    it('refuses an object held at the reception desk (FR-16)', async () => {
      announcements.findOne.mockResolvedValue(announcement({ currentLocation: CurrentLocation.Reception }));
      await expect(service.start(2, { announcementId: 7, description: 'Mine' })).rejects.toThrow(
        'This object is at the reception desk: claim it there.',
      );
      expect(discussions.save).not.toHaveBeenCalled();
    });

    it('refuses a second discussion of the same user and gives the id of the first one', async () => {
      discussions.findOneBy.mockResolvedValue(discussion({ id: 5 }));

      const error = await service.start(2, { announcementId: 7, description: 'Again' }).catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        error: 'You already have a discussion about this announcement.',
        discussionId: 5,
      });
      expect(discussions.findOneBy).toHaveBeenCalledWith({ announcementId: 7, ownerId: 2 });
    });

    it('refuses my own announcement (403), a final status (409), and a missing or hidden one (404)', async () => {
      await expect(service.start(1, { announcementId: 7, description: 'x' })).rejects.toThrow(ForbiddenException);

      announcements.findOne.mockResolvedValue(announcement({ status: AnnouncementStatus.Returned }));
      await expect(service.start(2, { announcementId: 7, description: 'x' })).rejects.toThrow(ConflictException);

      announcements.findOne.mockResolvedValue(announcement({ status: AnnouncementStatus.Hidden }));
      await expect(service.start(2, { announcementId: 7, description: 'x' })).rejects.toThrow(NotFoundException);

      announcements.findOne.mockResolvedValue(null);
      await expect(service.start(2, { announcementId: 99, description: 'x' })).rejects.toThrow(NotFoundException);
      expect(discussions.save).not.toHaveBeenCalled();
    });
  });

  describe('getMessages (FR-11, FR-12)', () => {
    it('gives the proof to the author, with the messages, and marks the received ones as read', async () => {
      messages.find.mockResolvedValue([{ id: 1, content: 'Hello' }]);

      const result = await service.getMessages(3, 1);

      expect(result.proof).toEqual({
        content: 'Cat sticker on the back',
        senderId: 2,
        createdAt: new Date('2026-11-01T10:00:00Z'),
      });
      expect(result.messages).toEqual([{ id: 1, content: 'Hello' }]);
      expect(messages.update).toHaveBeenCalledWith(
        { discussionId: 3, senderId: Not(1), readAt: IsNull() },
        { readAt: expect.any(Date) },
      );
    });

    it('refuses someone who is not one of the two people (403), and an unknown discussion (404)', async () => {
      await expect(service.getMessages(3, 4)).rejects.toThrow(ForbiddenException);
      discussions.findOne.mockResolvedValue(null);
      await expect(service.getMessages(99, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendMessage (FR-13)', () => {
    it('saves the message and emails the other person for the first unread message', async () => {
      await service.sendMessage(3, 2, { content: 'Hello' });

      expect(messages.save.mock.calls[0][0]).toMatchObject({ discussionId: 3, senderId: 2, content: 'Hello', readAt: null });
      expect(messages.count).toHaveBeenCalledWith({ where: { discussionId: 3, senderId: 2, readAt: IsNull() } });
      expect(mail.newMessage).toHaveBeenCalledWith('finder@school.test', { discussionId: 3, announcementTitle: 'Black phone' });
    });

    it('sends no email while a previous message is still unread', async () => {
      messages.count.mockResolvedValue(1);
      await service.sendMessage(3, 2, { content: 'Are you there?' });
      expect(messages.save).toHaveBeenCalled();
      expect(mail.newMessage).not.toHaveBeenCalled();
    });

    it('refuses a message in a discussion closed by a drop-off at the reception (FR-14)', async () => {
      discussions.findOne.mockResolvedValue(discussion({ closedAt: new Date('2026-11-03T10:00:00Z') }));
      await expect(service.sendMessage(3, 2, { content: 'Hello' })).rejects.toThrow('closed');
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('emails the initiator when the author writes', async () => {
      await service.sendMessage(3, 1, { content: 'Yes, it is here' });
      expect(mail.newMessage).toHaveBeenCalledWith('owner@school.test', expect.anything());
    });
  });

  describe('markReturned (SCRUM-32, FR-17)', () => {
    it('lets the finder confirm the handover: Returned, return date, email to the owner', async () => {
      const result = await service.markReturned(3, 1);

      expect(announcements.update).toHaveBeenCalledWith(7, {
        status: AnnouncementStatus.Returned,
        returnedAt: expect.any(Date),
      });
      expect(mail.handover).toHaveBeenCalledWith('owner@school.test', { id: 7, title: 'Black phone' }, 'finder');
      expect(result.status).toBe(AnnouncementStatus.Returned);
    });

    it('lets the owner mark a lost announcement as recovered (the author is then the owner)', async () => {
      discussions.findOne.mockResolvedValue(
        discussion({ announcement: announcement({ type: AnnouncementType.Lost, status: AnnouncementStatus.Open, currentLocation: null }) }),
      );
      await service.markReturned(3, 1);
      expect(mail.handover).toHaveBeenCalledWith('owner@school.test', expect.anything(), 'owner');
    });

    it('refuses a final status and an object at the reception (409), and a stranger (403)', async () => {
      discussions.findOne.mockResolvedValue(discussion({ announcement: announcement({ status: AnnouncementStatus.Returned }) }));
      await expect(service.markReturned(3, 1)).rejects.toThrow('This announcement is no longer available.');

      discussions.findOne.mockResolvedValue(discussion({ announcement: announcement({ currentLocation: CurrentLocation.Reception }) }));
      await expect(service.markReturned(3, 1)).rejects.toThrow(ConflictException);

      discussions.findOne.mockResolvedValue(discussion());
      await expect(service.markReturned(3, 4)).rejects.toThrow(ForbiddenException);
      expect(announcements.update).not.toHaveBeenCalled();
    });
  });

  describe('findMine and countUnread (FR-12)', () => {
    it('lists my discussions with the other person (name only), my role and the unread count', async () => {
      discussions.find.mockResolvedValue([discussion()]);
      messages.find.mockResolvedValue([{ content: 'Hello', senderId: 2, createdAt: new Date('2026-11-02T10:00:00Z') }]);
      messages.count.mockResolvedValue(2);

      const { discussions: list } = await service.findMine(1);

      expect(list[0]).toEqual({
        discussionId: 3,
        announcementId: 7,
        announcementTitle: 'Black phone',
        announcementType: AnnouncementType.Found,
        announcementStatus: AnnouncementStatus.Available,
        closed: false,
        myRole: 'finder',
        otherParticipant: { id: 2, firstName: 'Own', lastName: 'Er' },
        lastMessage: { content: 'Hello', senderId: 2, createdAt: new Date('2026-11-02T10:00:00Z') },
        unreadCount: 2,
        createdAt: new Date('2026-11-01T10:00:00Z'),
      });
      expect(JSON.stringify(list)).not.toContain('@school.test');
    });

    it('shows the finder to the owner, with the owner role', async () => {
      discussions.find.mockResolvedValue([discussion()]);
      const { discussions: list } = await service.findMine(2);
      expect(list[0]).toMatchObject({ myRole: 'owner', otherParticipant: { id: 1, firstName: 'Fin' } });
    });

    it('counts the unread messages of all my discussions', async () => {
      discussions.find.mockResolvedValue([{ id: 3 }, { id: 4 }]);
      messages.count.mockResolvedValue(5);

      expect(await service.countUnread(1)).toEqual({ unreadCount: 5 });
      expect(messages.count).toHaveBeenCalledWith({
        where: { discussionId: In([3, 4]), senderId: Not(1), readAt: IsNull() },
      });
    });

    it('answers 0 without counting when I have no discussion', async () => {
      expect(await service.countUnread(1)).toEqual({ unreadCount: 0 });
      expect(messages.count).not.toHaveBeenCalled();
    });
  });
});
