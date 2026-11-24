import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
  CurrentLocation,
} from '../announcements/announcement.entity';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';
import { MailService } from '../mail/mail.service';
import { DROP_OFF_SYSTEM_MESSAGE, ReceptionService } from './reception.service';

describe('ReceptionService.dropOff (SCRUM-52, FR-14)', () => {
  let service: ReceptionService;
  let announcements: { findOneBy: jest.Mock; update: jest.Mock };
  let discussions: { find: jest.Mock; update: jest.Mock };
  let messages: { create: jest.Mock; save: jest.Mock };
  let mail: { droppedAtReception: jest.Mock };

  const found = (extra: Partial<Announcement> = {}) =>
    ({
      id: 8,
      authorId: 5,
      type: AnnouncementType.Found,
      status: AnnouncementStatus.Available,
      currentLocation: CurrentLocation.Finder,
      title: 'Black phone',
      ...extra,
    }) as Announcement;

  beforeEach(async () => {
    announcements = { findOneBy: jest.fn().mockResolvedValue(found()), update: jest.fn().mockResolvedValue({}) };
    discussions = { find: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) };
    messages = { create: jest.fn((x) => x), save: jest.fn().mockResolvedValue({}) };
    mail = { droppedAtReception: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ReceptionService,
        { provide: getRepositoryToken(Announcement), useValue: announcements },
        { provide: getRepositoryToken(Discussion), useValue: discussions },
        { provide: getRepositoryToken(Message), useValue: messages },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    service = module.get(ReceptionService);
  });

  it('moves the object to the reception', async () => {
    const result = await service.dropOff(5, 8);

    expect(announcements.update).toHaveBeenCalledWith(8, { currentLocation: CurrentLocation.Reception });
    expect(result).toMatchObject({ announcementId: 8, currentLocation: 'reception', closedDiscussions: 0 });
  });

  it('closes every open discussion with a system message and emails each initiator', async () => {
    discussions.find.mockResolvedValue([
      { id: 1, ownerId: 20, owner: { email: 'a@school.test' } },
      { id: 2, ownerId: 21, owner: { email: 'b@school.test' } },
    ]);

    const result = await service.dropOff(5, 8);

    expect(discussions.find).toHaveBeenCalledWith({
      where: { announcementId: 8, closedAt: IsNull() },
      relations: { owner: true },
    });
    expect(discussions.update).toHaveBeenCalledWith(1, { closedAt: expect.any(Date) });
    expect(discussions.update).toHaveBeenCalledWith(2, { closedAt: expect.any(Date) });
    expect(messages.save).toHaveBeenCalledTimes(2);
    expect(messages.save).toHaveBeenCalledWith(
      expect.objectContaining({ discussionId: 1, senderId: 5, content: DROP_OFF_SYSTEM_MESSAGE, isSystem: true }),
    );
    expect(mail.droppedAtReception).toHaveBeenCalledWith('a@school.test', { id: 8, title: 'Black phone' });
    expect(mail.droppedAtReception).toHaveBeenCalledWith('b@school.test', { id: 8, title: 'Black phone' });
    expect(result.closedDiscussions).toBe(2);
  });

  it('still answers when an email fails', async () => {
    discussions.find.mockResolvedValue([{ id: 1, ownerId: 20, owner: { email: 'a@school.test' } }]);
    mail.droppedAtReception.mockRejectedValue(new Error('SMTP down'));

    await expect(service.dropOff(5, 8)).resolves.toMatchObject({ closedDiscussions: 1 });
  });

  it('refuses an unknown or deleted announcement (404)', async () => {
    announcements.findOneBy.mockResolvedValue(null);
    await expect(service.dropOff(5, 8)).rejects.toBeInstanceOf(NotFoundException);
    announcements.findOneBy.mockResolvedValue(found({ status: AnnouncementStatus.Deleted }));
    await expect(service.dropOff(5, 8)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses someone who is not the finder (403)', async () => {
    await expect(service.dropOff(6, 8)).rejects.toBeInstanceOf(ForbiddenException);
    expect(announcements.update).not.toHaveBeenCalled();
  });

  it('refuses a lost announcement (409)', async () => {
    announcements.findOneBy.mockResolvedValue(found({ type: AnnouncementType.Lost }));
    await expect(service.dropOff(5, 8)).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses an announcement that is not Available (409)', async () => {
    announcements.findOneBy.mockResolvedValue(found({ status: AnnouncementStatus.Returned }));
    await expect(service.dropOff(5, 8)).rejects.toBeInstanceOf(ConflictException);
  });

  it('is irreversible: a second drop-off is refused (409)', async () => {
    announcements.findOneBy.mockResolvedValue(found({ currentLocation: CurrentLocation.Reception }));
    await expect(service.dropOff(5, 8)).rejects.toThrow('already at the reception');
    expect(discussions.find).not.toHaveBeenCalled();
  });
});
