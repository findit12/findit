import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Announcement, AnnouncementStatus, AnnouncementType } from '../announcements/announcement.entity';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { Discussion } from './discussion.entity';
import { DiscussionsService } from './discussions.service';
import { Message } from './message.entity';

// Lab 6: the read-one, update and delete routes of the conversations and of their messages.
// Discussion 3 was started by user 2 about a phone found by user 1.
function discussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: 3,
    announcementId: 7,
    ownerId: 2,
    description: 'Cat sticker on the back',
    createdAt: new Date('2026-11-01T10:00:00Z'),
    announcement: { id: 7, type: AnnouncementType.Found, status: AnnouncementStatus.Available, authorId: 1 },
    ...overrides,
  } as Discussion;
}

function message(overrides: Partial<Message> = {}): Message {
  return { id: 9, discussionId: 3, senderId: 2, content: 'Hello', readAt: null, ...overrides } as Message;
}

describe('DiscussionsService (CRUD routes)', () => {
  let service: DiscussionsService;
  let discussions: { findOne: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let messages: { findOneBy: jest.Mock; save: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    discussions = {
      findOne: jest.fn().mockResolvedValue(discussion()),
      save: jest.fn((data) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    messages = {
      findOneBy: jest.fn().mockResolvedValue(message()),
      save: jest.fn((data) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscussionsService,
        { provide: getRepositoryToken(Discussion), useValue: discussions },
        { provide: getRepositoryToken(Message), useValue: messages },
        { provide: getRepositoryToken(Announcement), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: MailService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(DiscussionsService);
  });

  describe('findOne', () => {
    it('gives the discussion and its proof to the initiator and to the author', async () => {
      for (const userId of [1, 2]) {
        const { discussion: view } = await service.findOne(3, userId);
        expect(view).toEqual({
          id: 3,
          announcementId: 7,
          initiatorId: 2,
          proof: 'Cat sticker on the back',
          createdAt: new Date('2026-11-01T10:00:00Z'),
        });
      }
    });

    it('refuses a third person and answers not found for an unknown discussion', async () => {
      await expect(service.findOne(3, 9)).rejects.toBeInstanceOf(ForbiddenException);
      discussions.findOne.mockResolvedValue(null);
      await expect(service.findOne(99, 2)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateProof', () => {
    it('lets the initiator correct the proof', async () => {
      const { discussion: view } = await service.updateProof(3, 2, { description: 'A new proof' });
      expect(discussions.save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, description: 'A new proof' }));
      expect(view.id).toBe(3);
    });

    it('refuses the author of the announcement: the proof is not theirs', async () => {
      await expect(service.updateProof(3, 1, { description: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(discussions.save).not.toHaveBeenCalled();
    });

    it('refuses when the announcement is no longer public', async () => {
      discussions.findOne.mockResolvedValue(
        discussion({ announcement: { id: 7, status: AnnouncementStatus.Returned, authorId: 1 } as Announcement }),
      );
      await expect(service.updateProof(3, 2, { description: 'x' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('lets the initiator delete the discussion', async () => {
      await service.remove(3, 2);
      expect(discussions.delete).toHaveBeenCalledWith(3);
    });

    it('refuses the author of the announcement', async () => {
      await expect(service.remove(3, 1)).rejects.toBeInstanceOf(ForbiddenException);
      expect(discussions.delete).not.toHaveBeenCalled();
    });
  });

  describe('messages', () => {
    it('reads one message of the discussion', async () => {
      const { message: found } = await service.getMessage(3, 9, 1);
      expect(found.id).toBe(9);
      expect(messages.findOneBy).toHaveBeenCalledWith({ id: 9, discussionId: 3 });
    });

    it('answers not found when the message is in another discussion', async () => {
      messages.findOneBy.mockResolvedValue(null);
      await expect(service.getMessage(3, 99, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets the sender change an unread message', async () => {
      const { message: saved } = await service.updateMessage(3, 9, 2, { content: 'Hello again' });
      expect(saved.content).toBe('Hello again');
    });

    it('refuses to change the message of the other person, or a message already read', async () => {
      await expect(service.updateMessage(3, 9, 1, { content: 'x' })).rejects.toBeInstanceOf(ForbiddenException);

      messages.findOneBy.mockResolvedValue(message({ readAt: new Date() }));
      await expect(service.updateMessage(3, 9, 2, { content: 'x' })).rejects.toBeInstanceOf(ConflictException);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('lets the sender delete an unread message and refuses the other cases', async () => {
      await service.removeMessage(3, 9, 2);
      expect(messages.delete).toHaveBeenCalledWith(9);

      await expect(service.removeMessage(3, 9, 1)).rejects.toBeInstanceOf(ForbiddenException);
      messages.findOneBy.mockResolvedValue(message({ readAt: new Date() }));
      await expect(service.removeMessage(3, 9, 2)).rejects.toBeInstanceOf(ConflictException);
      expect(messages.delete).toHaveBeenCalledTimes(1);
    });

    it('refuses a third person for every message route', async () => {
      await expect(service.getMessage(3, 9, 8)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.updateMessage(3, 9, 8, { content: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.removeMessage(3, 9, 8)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
