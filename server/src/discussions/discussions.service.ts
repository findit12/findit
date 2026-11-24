import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
  CurrentLocation,
} from '../announcements/announcement.entity';
import { DailyLimitsService } from '../limits/daily-limits.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { CreateDiscussionDto } from './create-discussion.dto';
import { CreateMessageDto } from './create-message.dto';
import { Discussion } from './discussion.entity';
import { UpdateDiscussionDto } from './update-discussion.dto';
import { Message } from './message.entity';

// SCRUM-30 to SCRUM-32 (FR-11, FR-12, FR-13, FR-17), the "ConversationService" of the SDD.
//
// Who is who in a discussion:
//   - the AUTHOR wrote the announcement (announcement.authorId);
//   - the INITIATOR started the discussion (discussion.ownerId, the column name kept from Sprint 2).
// For a found object, the author is the finder and the initiator says the object is theirs.
// For a lost object, it is the opposite: the author is the owner, the initiator found it.

// A discussion can only start, and a handover only happen, while the announcement is public.
const ACTIVE_STATUSES = [AnnouncementStatus.Available, AnnouncementStatus.Open];

@Injectable()
export class DiscussionsService {
  private readonly logger = new Logger(DiscussionsService.name);

  constructor(
    @InjectRepository(Discussion) private readonly discussions: Repository<Discussion>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
    private readonly limits: DailyLimitsService,
  ) {}

  // SCRUM-30 (FR-11): start a discussion from an announcement page, with a proof.
  async start(userId: number, dto: CreateDiscussionDto) {
    const announcement = await this.announcements.findOne({
      where: { id: dto.announcementId },
      relations: { author: true },
    });
    if (
      !announcement ||
      announcement.status === AnnouncementStatus.Deleted ||
      announcement.status === AnnouncementStatus.Hidden
    ) {
      throw new NotFoundException('Announcement not found.');
    }
    if (announcement.authorId === userId) {
      throw new ForbiddenException('You cannot start a discussion about your own announcement.');
    }
    if (!ACTIVE_STATUSES.includes(announcement.status)) {
      throw new ConflictException('This announcement is no longer available.');
    }
    // FR-11 and FR-16: an object left at the reception desk is claimed there, not in a discussion.
    if (announcement.currentLocation === CurrentLocation.Reception) {
      throw new ConflictException('This object is at the reception desk: claim it there.');
    }
    // SDD section 4: at most one discussion per user and announcement. The id of the existing
    // one is sent back, so the page can open it.
    const existing = await this.discussions.findOneBy({ announcementId: announcement.id, ownerId: userId });
    if (existing) {
      throw new ConflictException({
        error: 'You already have a discussion about this announcement.',
        discussionId: existing.id,
      });
    }

    // FR-31: 20 new discussions per day for a student (429 beyond).
    await this.limits.assertCanStartDiscussion(userId);

    const discussion = await this.discussions.save(
      this.discussions.create({ announcementId: announcement.id, ownerId: userId, description: dto.description }),
    );

    void this.mail
      .discussionStarted(
        announcement.author.email,
        { id: announcement.id, title: announcement.title, type: announcement.type },
        discussion.id,
      )
      .catch((err) => this.logger.error(`Failed to notify the author of discussion ${discussion.id}`, err));

    return { message: 'Discussion started successfully.', discussionId: discussion.id };
  }

  // SCRUM-31 (FR-12): my discussions, newest first, with the unread count of each one.
  async findMine(userId: number) {
    const discussions = await this.discussions.find({
      where: [{ ownerId: userId }, { announcement: { authorId: userId } }],
      relations: { announcement: { author: true }, owner: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    const list = await Promise.all(
      discussions.map(async (discussion) => {
        const announcement = discussion.announcement;
        const isAuthor = announcement.authorId === userId;
        const other = isAuthor ? discussion.owner : announcement.author;

        const [latest, unreadCount] = await Promise.all([
          this.messages.find({ where: { discussionId: discussion.id }, order: { createdAt: 'DESC', id: 'DESC' }, take: 1 }),
          this.messages.count({ where: { discussionId: discussion.id, senderId: Not(userId), readAt: IsNull() } }),
        ]);
        const lastMessage = latest[0] ?? null;

        return {
          discussionId: discussion.id,
          announcementId: announcement.id,
          announcementTitle: announcement.title,
          announcementType: announcement.type,
          announcementStatus: announcement.status,
          // FR-17: who I am for this object, to show "Confirm handover" or "Mark as recovered".
          myRole: this.isObjectOwner(discussion, announcement, userId) ? 'owner' : 'finder',
          // NFR-PRIV-02: the name only, never the email.
          otherParticipant: { id: other.id, firstName: other.firstName ?? null, lastName: other.lastName ?? null },
          lastMessage: lastMessage
            ? { content: lastMessage.content, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt }
            : null,
          unreadCount,
          closed: discussion.closedAt !== null && discussion.closedAt !== undefined,
          createdAt: discussion.createdAt,
        };
      }),
    );
    return { discussions: list };
  }

  // SCRUM-31 (FR-12): the number of unread messages, for the badge of the header.
  async countUnread(userId: number): Promise<{ unreadCount: number }> {
    const discussions = await this.discussions.find({
      where: [{ ownerId: userId }, { announcement: { authorId: userId } }],
      relations: { announcement: true },
    });
    if (discussions.length === 0) {
      return { unreadCount: 0 };
    }
    const unreadCount = await this.messages.count({
      where: { discussionId: In(discussions.map((d) => d.id)), senderId: Not(userId), readAt: IsNull() },
    });
    return { unreadCount };
  }

  // Lab 6, "retrieve by id": one of my discussions, with its proof. Only the two participants can read it.
  async findOne(discussionId: number, userId: number) {
    const discussion = await this.findForParticipant(discussionId, userId);
    return {
      discussion: {
        id: discussion.id,
        announcementId: discussion.announcementId,
        initiatorId: discussion.ownerId,
        proof: discussion.description,
        createdAt: discussion.createdAt,
      },
    };
  }

  // Lab 6, "update": the initiator corrects the proof, as long as the announcement is still public.
  async updateProof(discussionId: number, userId: number, dto: UpdateDiscussionDto) {
    const discussion = await this.findForInitiator(discussionId, userId);
    if (!ACTIVE_STATUSES.includes(discussion.announcement.status)) {
      throw new ConflictException('This announcement is no longer available.');
    }
    discussion.description = dto.description;
    await this.discussions.save(discussion);
    return this.findOne(discussionId, userId);
  }

  // Lab 6, "delete": the initiator stops the discussion. The messages are deleted with it.
  async remove(discussionId: number, userId: number): Promise<void> {
    const discussion = await this.findForInitiator(discussionId, userId);
    await this.discussions.delete(discussion.id);
  }

  // Lab 6: one message of a discussion.
  async getMessage(discussionId: number, messageId: number, userId: number) {
    await this.findForParticipant(discussionId, userId);
    return { message: await this.findMessage(discussionId, messageId) };
  }

  // Lab 6: only the sender can change a message, and only while the other person has not read it.
  async updateMessage(discussionId: number, messageId: number, userId: number, dto: CreateMessageDto) {
    await this.findForParticipant(discussionId, userId);
    const message = await this.findOwnUnreadMessage(discussionId, messageId, userId);
    message.content = dto.content;
    return { message: await this.messages.save(message) };
  }

  // Lab 6: only the sender can delete a message, and only while the other person has not read it.
  async removeMessage(discussionId: number, messageId: number, userId: number): Promise<void> {
    await this.findForParticipant(discussionId, userId);
    const message = await this.findOwnUnreadMessage(discussionId, messageId, userId);
    await this.messages.delete(message.id);
  }

  private async findMessage(discussionId: number, messageId: number): Promise<Message> {
    const message = await this.messages.findOneBy({ id: messageId, discussionId });
    if (!message) {
      throw new NotFoundException('Message not found.');
    }
    return message;
  }

  private async findOwnUnreadMessage(discussionId: number, messageId: number, userId: number): Promise<Message> {
    const message = await this.findMessage(discussionId, messageId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only change your own messages.');
    }
    if (message.readAt) {
      throw new ConflictException('This message has already been read.');
    }
    return message;
  }

  // SCRUM-31: the proof and the messages of a discussion. The messages received are marked as read.
  // FR-11: the author reads the proof here to check it (only the two participants can).
  async getMessages(discussionId: number, userId: number) {
    const discussion = await this.findForParticipant(discussionId, userId);

    await this.messages.update(
      { discussionId, senderId: Not(userId), readAt: IsNull() },
      { readAt: new Date() },
    );
    const messages = await this.messages.find({ where: { discussionId }, order: { createdAt: 'ASC', id: 'ASC' } });

    return {
      proof: { content: discussion.description, senderId: discussion.ownerId, createdAt: discussion.createdAt },
      messages,
    };
  }

  // SCRUM-31: send a message. FR-13: an email only for the FIRST unread message, then nothing
  // more until the other person has read the conversation.
  async sendMessage(discussionId: number, userId: number, dto: CreateMessageDto) {
    const discussion = await this.findForParticipant(discussionId, userId);
    // FR-14: after a drop-off at the reception, the conversation is closed.
    if (discussion.closedAt) {
      throw new ConflictException('This discussion is closed: the object was dropped at the reception.');
    }
    const recipientId = discussion.ownerId === userId ? discussion.announcement.authorId : discussion.ownerId;

    const alreadyUnread = await this.messages.count({
      where: { discussionId, senderId: userId, readAt: IsNull() },
    });

    const message = await this.messages.save(
      this.messages.create({ discussionId, senderId: userId, content: dto.content, readAt: null, isSystem: false }),
    );

    if (alreadyUnread === 0) {
      const recipient = await this.users.findOneBy({ id: recipientId });
      if (recipient) {
        void this.mail
          .newMessage(recipient.email, { discussionId, announcementTitle: discussion.announcement.title })
          .catch((err) => this.logger.error(`Failed to notify user ${recipient.id} about message ${message.id}`, err));
      }
    }

    return { message };
  }

  // SCRUM-32 (FR-17): direct handover. The finder clicks "Confirm handover", the owner
  // "Mark as recovered"; both set the announcement to Returned, which removes it from the gallery.
  async markReturned(discussionId: number, userId: number) {
    const discussion = await this.findForParticipant(discussionId, userId);
    const announcement = discussion.announcement;

    if (!ACTIVE_STATUSES.includes(announcement.status)) {
      throw new ConflictException('This announcement is no longer available.');
    }
    if (announcement.currentLocation === CurrentLocation.Reception) {
      throw new ConflictException('This object is at the reception desk: the staff confirm its handover.');
    }

    announcement.status = AnnouncementStatus.Returned;
    announcement.returnedAt = new Date();
    await this.announcements.update(announcement.id, {
      status: AnnouncementStatus.Returned,
      returnedAt: announcement.returnedAt,
    });

    const confirmedBy = this.isObjectOwner(discussion, announcement, userId) ? 'owner' : 'finder';
    const otherId = discussion.ownerId === userId ? announcement.authorId : discussion.ownerId;
    const other = await this.users.findOneBy({ id: otherId });
    if (other) {
      void this.mail
        .handover(other.email, { id: announcement.id, title: announcement.title }, confirmedBy)
        .catch((err) => this.logger.error(`Failed to notify the handover of announcement ${announcement.id}`, err));
    }

    return {
      message: 'Handover confirmed successfully.',
      announcementId: announcement.id,
      status: announcement.status,
      returnedAt: announcement.returnedAt,
    };
  }

  // The owner of the object: the initiator for a found object, the author for a lost one.
  private isObjectOwner(discussion: Discussion, announcement: Announcement, userId: number): boolean {
    const ownerId = announcement.type === AnnouncementType.Found ? discussion.ownerId : announcement.authorId;
    return ownerId === userId;
  }

  // Same as findForParticipant, but only the person who started the discussion is accepted.
  private async findForInitiator(discussionId: number, userId: number): Promise<Discussion> {
    const discussion = await this.findForParticipant(discussionId, userId);
    if (discussion.ownerId !== userId) {
      throw new ForbiddenException('Only the person who started the discussion can do this.');
    }
    return discussion;
  }

  // Loads a discussion with its announcement, and refuses anyone who is not one of the two people.
  private async findForParticipant(discussionId: number, userId: number): Promise<Discussion> {
    const discussion = await this.discussions.findOne({
      where: { id: discussionId },
      relations: { announcement: true },
    });
    if (!discussion) {
      throw new NotFoundException('Discussion not found.');
    }
    if (discussion.announcement.authorId !== userId && discussion.ownerId !== userId) {
      throw new ForbiddenException('You are not a participant in this discussion.');
    }
    return discussion;
  }
}
