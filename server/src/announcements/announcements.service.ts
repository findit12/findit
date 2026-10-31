
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsOrder,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { ReferenceService } from '../reference/reference.service';
import { SavedSearchesService } from '../saved-searches/saved-searches.service';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementType,
} from './announcement.entity';
import { AnnouncementMatch } from './announcement-match.entity';
import { toOwnerView, toPublicView } from './announcement.views';
import {
  DEFAULT_PAGE_SIZE,
  ListAnnouncementsQueryDto,
} from './announcements-query.dto';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './announcements.dto';
import { checkPhotos } from './photo-rules';
import { PhotoStorageService } from './photo-storage.service';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';
import { CreateDiscussionDto } from '../discussions/create-discussion.dto';
import { CreateMessageDto } from '../discussions/create-message.dto';

const DAYS_BEFORE_ARCHIVE = 90;

const EDITABLE_STATUSES = [
  AnnouncementStatus.Available,
  AnnouncementStatus.Open,
];

const GALLERY_STATUSES = [
  AnnouncementStatus.Available,
  AnnouncementStatus.Open,
];

const GALLERY_ORDERS: Record<
  'newest' | 'oldest' | 'eventDate',
  FindOptionsOrder<Announcement>
> = {
  newest: { createdAt: 'DESC', id: 'DESC' },
  oldest: { createdAt: 'ASC', id: 'ASC' },
  eventDate: { eventDate: 'DESC', createdAt: 'DESC', id: 'DESC' },
};

function emptyToNull(value?: string): string | null {
  return value ? value : null;
}

function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    @InjectRepository(Announcement)
    private readonly announcements: Repository<Announcement>,
    @InjectRepository(AnnouncementMatch)
    private readonly announcementMatches: Repository<AnnouncementMatch>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Discussion)
    private readonly discussions: Repository<Discussion>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    private readonly reference: ReferenceService,
    private readonly photoStorage: PhotoStorageService,
    private readonly mail: MailService,
    private readonly savedSearches: SavedSearchesService,
  ) {}

  // SCRUM-16 and SCRUM-20: create a found or lost announcement.
  async create(
    authorId: number,
    dto: CreateAnnouncementDto,
    files: Express.Multer.File[],
  ) {
    const author = await this.users.findOneBy({ id: authorId });

    if (!author) {
      throw new NotFoundException('User not found.');
    }

    const isFound = dto.type === AnnouncementType.Found;

    if (isFound && files.length < 1) {
      throw new BadRequestException('Add at least one photo.');
    }

    checkPhotos(files);

    if (dto.eventDate > today()) {
      throw new BadRequestException('The date cannot be in the future.');
    }

    await this.reference.checkSelection(
      dto.categoryId,
      dto.objectTypeId,
      dto.placeId,
    );

    const photos = await this.photoStorage.save(files);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DAYS_BEFORE_ARCHIVE);

    const saved = await this.announcements.save(
      this.announcements.create({
        type: dto.type,
        authorId,
        title: dto.title,
        categoryId: dto.categoryId,
        objectTypeId: dto.objectTypeId,
        description: dto.description,
        brand: emptyToNull(dto.brand),
        color: emptyToNull(dto.color),
        photos,
        eventDate: dto.eventDate,
        placeId: dto.placeId,
        placeDetails: emptyToNull(dto.placeDetails),
        currentLocation: isFound ? dto.currentLocation : null,
        hiddenDetail: emptyToNull(dto.hiddenDetail),
        status: isFound
          ? AnnouncementStatus.Available
          : AnnouncementStatus.Open,
        expiresAt,
      }),
    );

    void this.mail
      .confirmation(author.email, {
        id: saved.id,
        title: saved.title,
        type: saved.type,
      })
      .catch((err) => {
        this.logger.error(
          `Failed to send confirmation email for announcement ${saved.id}`,
          err,
        );
      });

    void this.savedSearches.notifyMatches(saved).catch((err) => {
      this.logger.error(
        'Failed to send saved search alerts for announcement ' + saved.id,
        err,
      );
    });

    void this.matchAnnouncements(saved).catch((err) => {
      this.logger.error(
        `Failed to calculate matches for announcement ${saved.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    });

    return {
      announcement: toOwnerView(await this.findWithDetails(saved.id)),
    };
  }

  // SCRUM-28: calculate compatible announcements.
  private async matchAnnouncements(source: Announcement): Promise<void> {
    const oppositeType =
      source.type === AnnouncementType.Found
        ? AnnouncementType.Lost
        : AnnouncementType.Found;

    const candidates = await this.announcements.find({
      where: {
        type: oppositeType,
        status: In(GALLERY_STATUSES),
      },
    });

    for (const candidate of candidates) {
      if (
        candidate.id === source.id ||
        candidate.authorId === source.authorId
      ) {
        continue;
      }

      const score = this.calculateMatchScore(source, candidate);

      if (score < 65) {
        continue;
      }

      const announcementId = Math.min(source.id, candidate.id);
      const matchedAnnouncementId = Math.max(source.id, candidate.id);

      try {
        await this.announcementMatches.save(
          this.announcementMatches.create({
            announcementId,
            matchedAnnouncementId,
            score,
          }),
        );
      } catch (err) {
        this.logger.warn(
          `Could not save match ${announcementId}/${matchedAnnouncementId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  private calculateMatchScore(
    source: Announcement,
    candidate: Announcement,
  ): number {
    let score = 0;

    if (source.categoryId === candidate.categoryId) score += 25;
    if (source.objectTypeId === candidate.objectTypeId) score += 30;
    if (source.placeId === candidate.placeId) score += 15;

    const sourceDate = Date.parse(`${source.eventDate}T00:00:00Z`);
    const candidateDate = Date.parse(`${candidate.eventDate}T00:00:00Z`);
    const daysApart = Math.abs(sourceDate - candidateDate) / 86_400_000;

    if (daysApart <= 7) score += 15;
    else if (daysApart <= 30) score += 10;
    else if (daysApart <= 90) score += 5;

    if (
      source.brand?.trim() &&
      candidate.brand?.trim() &&
      source.brand.trim().toLowerCase() ===
        candidate.brand.trim().toLowerCase()
    ) {
      score += 7;
    }

    if (
      source.color?.trim() &&
      candidate.color?.trim() &&
      source.color.trim().toLowerCase() ===
        candidate.color.trim().toLowerCase()
    ) {
      score += 8;
    }

    return score;
  }

  // SCRUM-30: start a discussion with proof of ownership.
  async startDiscussion(
    announcementId: number,
    userId: number,
    dto: CreateDiscussionDto,
  ) {
    const announcement = await this.announcements.findOne({
      where: { id: announcementId },
      relations: { author: true },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found.');
    }

    if (announcement.type !== AnnouncementType.Found) {
      throw new BadRequestException(
        'You can only start a discussion about a found object.',
      );
    }

    if (announcement.status !== AnnouncementStatus.Available) {
      throw new ConflictException(
        'This announcement is no longer available.',
      );
    }

    if (announcement.authorId === userId) {
      throw new ForbiddenException(
        'You cannot start a discussion about your own announcement.',
      );
    }

    const discussion = await this.discussions.save(
      this.discussions.create({
        announcementId: announcement.id,
        ownerId: userId,
        description: dto.description,
      }),
    );

    void this.mail
      .discussionStarted(announcement.author.email, {
        id: announcement.id,
        title: announcement.title,
      })
      .catch((err) => {
        this.logger.error(
          `Failed to notify finder for discussion ${discussion.id}`,
          err,
        );
      });

    return {
      message: 'Discussion started successfully.',
      discussionId: discussion.id,
    };
  }

  // SCRUM-32: finder confirms that the item has been handed over.
  async returnItem(
    userId: number,
    announcementId: number,
    discussionId: number,
  ) {
    const announcement = await this.findOwned(userId, announcementId);

    if (announcement.type !== AnnouncementType.Found) {
      throw new BadRequestException(
        'Only found announcements can be marked as returned.',
      );
    }

    if (announcement.status !== AnnouncementStatus.Available) {
      throw new ConflictException(
        'This announcement is no longer available.',
      );
    }

    const discussion = await this.discussions.findOne({
      where: { id: discussionId, announcementId },
      relations: { owner: true },
    });

    if (!discussion) {
      throw new NotFoundException('Discussion not found.');
    }

    announcement.status = AnnouncementStatus.Returned;
    announcement.returnedAt = new Date();

    await this.saveFields(announcement);

    void this.mail
      .handover(discussion.owner.email, {
        id: announcement.id,
        title: announcement.title,
      })
      .catch((err) => {
        this.logger.error(
          `Failed to notify claimant about handover for announcement ${announcement.id}`,
          err,
        );
      });

    return {
      message: 'Handover confirmed successfully.',
      announcementId: announcement.id,
      status: announcement.status,
      returnedAt: announcement.returnedAt,
    };
  }

  // SCRUM-31: find a discussion and verify its participant.
  private async findDiscussionForParticipant(
    discussionId: number,
    userId: number,
  ): Promise<Discussion> {
    const discussion = await this.discussions.findOne({
      where: { id: discussionId },
      relations: { announcement: true },
    });

    if (!discussion) {
      throw new NotFoundException('Discussion not found.');
    }

    const isFinder = discussion.announcement.authorId === userId;
    const isClaimant = discussion.ownerId === userId;

    if (!isFinder && !isClaimant) {
      throw new ForbiddenException(
        'You are not a participant in this discussion.',
      );
    }

    return discussion;
  }

  // SCRUM-31: send a message.
  async sendMessage(
    discussionId: number,
    userId: number,
    dto: CreateMessageDto,
  ) {
    const discussion = await this.findDiscussionForParticipant(discussionId, userId);
    const recipientId =
      discussion.ownerId === userId
        ? discussion.announcement.authorId
        : discussion.ownerId;

    const recipient = await this.users.findOneBy({ id: recipientId });

    const message = await this.messages.save(
      this.messages.create({
        discussionId,
        senderId: userId,
        content: dto.content,
        readAt: null,
      }),
    );

    if (recipient) {
      void this.mail
        .newMessage(recipient.email, {
          announcementId: discussion.announcement.id,
          announcementTitle: discussion.announcement.title,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to notify user ${recipient.id} about message ${message.id}`,
            err,
          );
        });
    }

    return { message };
  }

  // SCRUM-31: retrieve messages and mark incoming messages as read.
  async getMessages(discussionId: number, userId: number) {
    await this.findDiscussionForParticipant(discussionId, userId);

    await this.messages.update(
      {
        discussionId,
        senderId: Not(userId),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );

    const messages = await this.messages.find({
      where: { discussionId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    return { messages };
  }

  // SCRUM-31: count unread messages across all user discussions.
  async getUnreadCount(userId: number): Promise<{ unreadCount: number }> {
    const discussions = await this.discussions.find({
      where: [
        { ownerId: userId },
        { announcement: { authorId: userId } },
      ],
      relations: { announcement: true },
    });

    const discussionIds = discussions.map(
      (discussion) => discussion.id,
    );

    if (discussionIds.length === 0) {
      return { unreadCount: 0 };
    }

    const unreadCount = await this.messages.count({
      where: {
        discussionId: In(discussionIds),
        senderId: Not(userId),
        readAt: IsNull(),
      },
    });

    return { unreadCount };
  }

  // SCRUM-31: list all conversations belonging to the signed-in user.
  async getDiscussions(userId: number) {
    const discussions = await this.discussions.find({
      where: [
        { ownerId: userId },
        { announcement: { authorId: userId } },
      ],
      relations: {
        announcement: { author: true },
        owner: true,
      },
      order: { createdAt: 'DESC' },
    });

    const conversations = await Promise.all(
      discussions.map(async (discussion) => {
        const isFinder =
          discussion.announcement.authorId === userId;

        const otherParticipant = isFinder
          ? discussion.owner
          : discussion.announcement.author;

        const [latestMessages, unreadCount] = await Promise.all([
          this.messages.find({
            where: { discussionId: discussion.id },
            order: { createdAt: 'DESC', id: 'DESC' },
            take: 1,
          }),
          this.messages.count({
            where: {
              discussionId: discussion.id,
              senderId: Not(userId),
              readAt: IsNull(),
            },
          }),
        ]);

        const lastMessage = latestMessages[0] ?? null;

        return {
          discussionId: discussion.id,
          announcementId: discussion.announcementId,
          announcementTitle: discussion.announcement.title,
          otherParticipant: {
            id: otherParticipant.id,
            firstName: otherParticipant.firstName ?? null,
            lastName: otherParticipant.lastName ?? null,
          },
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
          createdAt: discussion.createdAt,
        };
      }),
    );

    return { discussions: conversations };
  }

  // Public announcement detail.
  async findPublic(id: number) {
    const announcement = await this.announcements.findOne({
      where: { id },
      relations: {
        category: true,
        objectType: true,
        place: true,
      },
    });

    if (
      !announcement ||
      announcement.status === AnnouncementStatus.Deleted ||
      announcement.status === AnnouncementStatus.Hidden
    ) {
      throw new NotFoundException('Announcement not found.');
    }

    return { announcement: toPublicView(announcement) };
  }

  // SCRUM-29: public matching announcements.
  async findPublicMatches(id: number) {
    await this.findPublic(id);

    const matches = await this.announcementMatches.find({
      where: [
        { announcementId: id },
        { matchedAnnouncementId: id },
      ],
      relations: {
        announcement: {
          category: true,
          objectType: true,
          place: true,
        },
        matchedAnnouncement: {
          category: true,
          objectType: true,
          place: true,
        },
      },
      order: { score: 'DESC' },
    });

    const publicMatches = matches
      .map((match) => {
        const other =
          match.announcementId === id
            ? match.matchedAnnouncement
            : match.announcement;

        return { score: match.score, other };
      })
      .filter(({ other }) =>
        GALLERY_STATUSES.includes(other.status),
      );

    return {
      matches: publicMatches.map(({ score, other }) => ({
        score,
        announcement: toPublicView(other),
      })),
    };
  }

  // SCRUM-22: public gallery.
  async findPublicPage(query: ListAnnouncementsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || DEFAULT_PAGE_SIZE;

    await this.reference.checkFilters(
      query.categoryId,
      query.objectTypeId,
      query.placeId,
    );

    const where: FindOptionsWhere<Announcement> = {
      status: In(GALLERY_STATUSES),
    };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.objectTypeId) where.objectTypeId = query.objectTypeId;
    if (query.placeId) where.placeId = query.placeId;

    if (query.dateFrom && query.dateTo) {
      where.eventDate = Between(query.dateFrom, query.dateTo);
    } else if (query.dateFrom) {
      where.eventDate = MoreThanOrEqual(query.dateFrom);
    } else if (query.dateTo) {
      where.eventDate = LessThanOrEqual(query.dateTo);
    }

    const keyword = (query.q ?? '').trim();

    let conditions:
      | FindOptionsWhere<Announcement>
      | FindOptionsWhere<Announcement>[] = where;

    if (keyword) {
      const pattern =
        '%' + keyword.replace(/[\\%_]/g, '\\$&') + '%';

      conditions = [
        { ...where, title: ILike(pattern) },
        { ...where, description: ILike(pattern) },
      ];
    }

    const [announcements, total] =
      await this.announcements.findAndCount({
        where: conditions,
        relations: {
          category: true,
          objectType: true,
          place: true,
        },
        order: GALLERY_ORDERS[query.sort ?? 'newest'],
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      announcements: announcements.map(toPublicView),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // SCRUM-18: list the signed-in user's announcements.
  async findMine(userId: number) {
    const announcements = await this.announcements.find({
      where: {
        authorId: userId,
        status: Not(AnnouncementStatus.Deleted),
      },
      relations: {
        category: true,
        objectType: true,
        place: true,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      announcements: announcements.map(toOwnerView),
    };
  }

  // SCRUM-18: read one of the signed-in user's announcements.
  async findMineById(userId: number, id: number) {
    return {
      announcement: toOwnerView(
        await this.findOwned(userId, id),
      ),
    };
  }

  // SCRUM-18 and SCRUM-21: update an announcement.
  async update(
    userId: number,
    id: number,
    dto: UpdateAnnouncementDto,
  ) {
    const announcement = await this.findOwned(userId, id);
    this.assertEditable(announcement);

    if (
      dto.status === AnnouncementStatus.Closed &&
      announcement.type !== AnnouncementType.Lost
    ) {
      throw new ConflictException(
        'Only a lost announcement can be closed.',
      );
    }

    if (dto.eventDate !== undefined && dto.eventDate > today()) {
      throw new BadRequestException(
        'The date cannot be in the future.',
      );
    }

    if (
      dto.hiddenDetail === '' &&
      announcement.type === AnnouncementType.Found
    ) {
      throw new BadRequestException(
        'Enter a hidden detail that only the owner knows.',
      );
    }

    const categoryId = dto.categoryId ?? announcement.categoryId;
    const objectTypeId = dto.objectTypeId ?? announcement.objectTypeId;
    const placeId = dto.placeId ?? announcement.placeId;

    if (
      dto.categoryId !== undefined ||
      dto.objectTypeId !== undefined ||
      dto.placeId !== undefined
    ) {
      await this.reference.checkSelection(
        categoryId,
        objectTypeId,
        placeId,
      );
    }

    if (dto.title !== undefined) announcement.title = dto.title;
    if (dto.description !== undefined) {
      announcement.description = dto.description;
    }
    if (dto.brand !== undefined) {
      announcement.brand = emptyToNull(dto.brand);
    }
    if (dto.color !== undefined) {
      announcement.color = emptyToNull(dto.color);
    }
    if (dto.eventDate !== undefined) {
      announcement.eventDate = dto.eventDate;
    }
    if (dto.placeDetails !== undefined) {
      announcement.placeDetails = emptyToNull(dto.placeDetails);
    }
    if (dto.hiddenDetail !== undefined) {
      announcement.hiddenDetail = emptyToNull(dto.hiddenDetail);
    }

    announcement.categoryId = categoryId;
    announcement.objectTypeId = objectTypeId;
    announcement.placeId = placeId;

    if (dto.status === AnnouncementStatus.Closed) {
      announcement.status = AnnouncementStatus.Closed;
    }

    await this.saveFields(announcement);

    return {
      announcement: toOwnerView(
        await this.findWithDetails(id),
      ),
    };
  }

  // SCRUM-18: logical deletion.
  async remove(userId: number, id: number): Promise<void> {
    const announcement = await this.findOwned(userId, id);
    this.assertEditable(announcement);

    announcement.status = AnnouncementStatus.Deleted;

    await this.saveFields(announcement);
  }

  // Find an announcement and verify its author.
  private async findOwned(
    userId: number,
    id: number,
  ): Promise<Announcement> {
    const announcement = await this.announcements.findOne({
      where: { id },
      relations: {
        category: true,
        objectType: true,
        place: true,
      },
    });

    if (
      !announcement ||
      announcement.status === AnnouncementStatus.Deleted
    ) {
      throw new NotFoundException('Announcement not found.');
    }

    if (announcement.authorId !== userId) {
      throw new ForbiddenException(
        'You can only change your own announcements.',
      );
    }

    return announcement;
  }

  private assertEditable(announcement: Announcement): void {
    if (!EDITABLE_STATUSES.includes(announcement.status)) {
      throw new ConflictException(
        `This announcement is ${announcement.status} and can no longer be changed.`,
      );
    }
  }

  private async saveFields(
    announcement: Announcement,
  ): Promise<void> {
    const {
      category,
      objectType,
      place,
      author,
      ...columns
    } = announcement;

    await this.announcements.save(columns);
  }

  private async findWithDetails(id: number): Promise<Announcement> {
    return this.announcements.findOneOrFail({
      where: { id },
      relations: {
        category: true,
        objectType: true,
        place: true,
      },
    });
  }
}