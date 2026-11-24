import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
  CurrentLocation,
} from '../announcements/announcement.entity';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';
import { MailService } from '../mail/mail.service';

export const DROP_OFF_SYSTEM_MESSAGE =
  'The finder dropped the object at the reception. This discussion is closed: claim the object at the reception.';

// SCRUM-52 (FR-14): "I dropped it at the reception".
@Injectable()
export class ReceptionService {
  private readonly logger = new Logger(ReceptionService.name);

  constructor(
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    @InjectRepository(Discussion) private readonly discussions: Repository<Discussion>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly mail: MailService,
  ) {}

  async dropOff(userId: number, announcementId: number) {
    const announcement = await this.announcements.findOneBy({ id: announcementId });
    if (!announcement || announcement.status === AnnouncementStatus.Deleted) {
      throw new NotFoundException('Announcement not found.');
    }
    if (announcement.authorId !== userId) {
      throw new ForbiddenException('Only the finder can drop the object at the reception.');
    }
    if (announcement.type !== AnnouncementType.Found) {
      throw new ConflictException('Only a found object can be dropped at the reception.');
    }
    if (announcement.status !== AnnouncementStatus.Available) {
      throw new ConflictException(`This announcement is ${announcement.status} and can no longer be changed.`);
    }
    // The change is irreversible (FR-14): a second call is refused.
    if (announcement.currentLocation === CurrentLocation.Reception) {
      throw new ConflictException('This object is already at the reception.');
    }

    await this.announcements.update(announcement.id, { currentLocation: CurrentLocation.Reception });

    // Open conversations are closed with a system message, and the initiators are notified.
    const open = await this.discussions.find({
      where: { announcementId: announcement.id, closedAt: IsNull() },
      relations: { owner: true },
    });
    const now = new Date();
    for (const discussion of open) {
      await this.discussions.update(discussion.id, { closedAt: now });
      await this.messages.save(
        this.messages.create({
          discussionId: discussion.id,
          senderId: userId,
          content: DROP_OFF_SYSTEM_MESSAGE,
          isSystem: true,
          readAt: null,
        }),
      );
      void this.mail
        .droppedAtReception(discussion.owner.email, { id: announcement.id, title: announcement.title })
        .catch((err) => this.logger.error(`Failed to notify user ${discussion.ownerId} of the drop-off`, err));
    }

    return {
      message: 'The object is now at the reception.',
      announcementId: announcement.id,
      currentLocation: CurrentLocation.Reception,
      closedDiscussions: open.length,
    };
  }
}
