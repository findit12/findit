
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
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
import { ListAnnouncementsQueryDto, PAGE_SIZE } from './announcements-query.dto';
import {
  CreateAnnouncementDto,
  ReplaceAnnouncementDto,
  UpdateAnnouncementDto,
} from './announcements.dto';
import { checkPhotos } from './photo-rules';
import { PhotoStorageService } from './photo-storage.service';
import { MatchingService } from './matching.service';
import { Discussion } from '../discussions/discussion.entity';
import { Message } from '../discussions/message.entity';
import { CreateDiscussionDto } from '../discussions/create-discussion.dto';
import { CreateMessageDto } from '../discussions/create-message.dto';

const DAYS_BEFORE_ARCHIVE = 90;

const EDITABLE_STATUSES = [
  AnnouncementStatus.Available,
  AnnouncementStatus.Open,
];

// SCRUM-29: at most 4 similar announcements on a detail page.
const MAX_SIMILAR = 4;

const GALLERY_STATUSES = [
  AnnouncementStatus.Available,
  AnnouncementStatus.Open,
];

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
    private readonly matching: MatchingService,
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

    // SCRUM-28: the matching runs before the answer, so the page can say "We will alert you if
    // a similar object is found" when there is no match yet (UC-3). If it fails, the
    // announcement is still published: matchCount is then 0.
    let matchCount = 0;
    try {
      matchCount = await this.matching.matchNewAnnouncement(saved);
    } catch (err) {
      this.logger.error(
        `Failed to calculate matches for announcement ${saved.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return {
      announcement: toOwnerView(await this.findWithDetails(saved.id)),
      matchCount,
    };
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

  // SCRUM-32: owner or finder confirms that the item has been returned.
  async returnItem(
    userId: number,
    announcementId: number,
    discussionId: number,
  ) {
    const announcement = await this.announcements.findOne({
      where: { id: announcementId },
    });

    if (!announcement || announcement.status === AnnouncementStatus.Deleted) {
      throw new NotFoundException('Announcement not found.');
    }

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

    const isFinder = announcement.authorId === userId;
    const isOwner = discussion.ownerId === userId;

    if (!isFinder && !isOwner) {
      throw new ForbiddenException('Only the owner or finder can confirm the handover.');
    }

    announcement.status = AnnouncementStatus.Returned;
    announcement.returnedAt = new Date();

    await this.saveFields(announcement);

    const recipientEmail = isFinder
      ? discussion.owner.email
      : (await this.users.findOneBy({ id: announcement.authorId }))?.email;

    if (recipientEmail) {
      void this.mail
      .handover(recipientEmail, {
        id: announcement.id,
        title: announcement.title,
      }, isFinder ? 'finder' : 'owner')
      .catch((err) => {
        this.logger.error(
          `Failed to notify the other participant about handover for announcement ${announcement.id}`,
          err,
        );
      });
    }

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

  // SCRUM-29: the similar announcements of the opposite type, best score first, 4 at most.
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
      matches: publicMatches.slice(0, MAX_SIMILAR).map(({ score, other }) => ({
        score,
        announcement: toPublicView(other),
      })),
    };
  }

  // SCRUM-22 to SCRUM-25: public gallery, 12 announcements per page (FR-08, FR-09, FR-21,
  // FR-23, FR-27). The query is built with the QueryBuilder and bound parameters (:name).
  async findPublicPage(query: ListAnnouncementsQueryDto) {
    const page = query.page ?? 1;
    const sort = query.sort ?? 'newest';
    const keyword = (query.q ?? '').trim();

    // FR-23: "closest date" needs a date, "best match" needs a keyword.
    if (sort === 'closestDate' && !query.dateFrom && !query.dateTo) {
      throw new BadRequestException('Choose a date to sort by closest date.');
    }
    if (sort === 'bestMatch' && !keyword) {
      throw new BadRequestException('Type a keyword to sort by best match.');
    }
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      throw new BadRequestException('The start date must be before the end date.');
    }

    await this.reference.checkFilters(query.categoryId, query.objectTypeId, query.placeId);

    const search = this.announcements
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.category', 'category')
      .innerJoinAndSelect('a.objectType', 'objectType')
      .innerJoinAndSelect('a.place', 'place')
      .where('a.status IN (:...statuses)', { statuses: GALLERY_STATUSES });

    // FR-09: every filter that is sent is added with AND.
    if (query.type) search.andWhere('a.type = :type', { type: query.type });
    if (query.categoryId) search.andWhere('a.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.objectTypeId) search.andWhere('a.objectTypeId = :objectTypeId', { objectTypeId: query.objectTypeId });
    if (query.placeId) search.andWhere('a.placeId = :placeId', { placeId: query.placeId });
    if (query.dateFrom) search.andWhere('a.eventDate >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) search.andWhere('a.eventDate <= :dateTo', { dateTo: query.dateTo });

    // FR-21: the keyword can be in the title, the description, the brand or the color.
    // % and _ typed by the user are escaped, so they are searched as normal characters.
    if (keyword) {
      search.andWhere(
        new Brackets((where) => {
          where
            .where('a.title ILIKE :pattern')
            .orWhere('a.description ILIKE :pattern')
            .orWhere('a.brand ILIKE :pattern')
            .orWhere('a.color ILIKE :pattern');
        }),
        { pattern: '%' + keyword.replace(/[\\%_]/g, '\\$&') + '%' },
      );
    }

    // FR-23 and SCRUM-25 "stable sort": the last criterion is always the id, which is unique,
    // so two pages never show the same announcement twice.
    if (sort === 'closestDate') {
      // Number of days between the event and the chosen date (the start date, or the end date).
      search
        .orderBy('ABS(a.eventDate - CAST(:referenceDate AS date))', 'ASC')
        .setParameter('referenceDate', query.dateFrom ?? query.dateTo);
    } else if (sort === 'bestMatch') {
      // A keyword found in the title counts more than one found in the brand, color or description.
      search.orderBy(
        '(CASE WHEN a.title ILIKE :pattern THEN 4 ELSE 0 END)' +
          ' + (CASE WHEN a.brand ILIKE :pattern THEN 2 ELSE 0 END)' +
          ' + (CASE WHEN a.color ILIKE :pattern THEN 2 ELSE 0 END)' +
          ' + (CASE WHEN a.description ILIKE :pattern THEN 1 ELSE 0 END)',
        'DESC',
      );
    }
    search.addOrderBy('a.createdAt', 'DESC').addOrderBy('a.id', 'DESC');

    // offset/limit (and not skip/take): the joins are many-to-one, so one row = one announcement.
    const [announcements, totalItems] = await search
      .offset((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .getManyAndCount();

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    // SDD section 5: "data" (at most 12 items) and "meta".
    return {
      data: announcements.map(toPublicView),
      meta: {
        page,
        pageSize: PAGE_SIZE,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
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

  // Lab 6: PUT = full replacement. The missing optional fields are emptied, then the normal
  // update rules apply (author only, editable status, date, reference data, hidden detail).
  async replace(
    userId: number,
    id: number,
    dto: ReplaceAnnouncementDto,
  ) {
    return this.update(userId, id, {
      ...dto,
      brand: dto.brand ?? '',
      color: dto.color ?? '',
      placeDetails: dto.placeDetails ?? '',
      hiddenDetail: dto.hiddenDetail ?? '',
    });
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

  // SCRUM-36: Platform-wide recovery metrics for the admin statistics dashboard.
  async getAdminStatistics() {
    const all = await this.announcements.find({
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        returnedAt: true,
      },
    });

    const declared = all.filter((a) => a.status !== AnnouncementStatus.Deleted);
    const declaredCount = declared.length;
    const returned = declared.filter((a) => a.status === AnnouncementStatus.Returned);
    const returnedCount = returned.length;
    const recoveryRate =
      declaredCount === 0
        ? 0
        : Math.round((returnedCount / declaredCount) * 1000) / 10;

    const durationsMs = returned
      .filter((a) => a.returnedAt !== null)
      .map((a) => new Date(a.returnedAt!).getTime() - new Date(a.createdAt).getTime())
      .filter((ms) => ms >= 0);

    let averageReturnTimeHours: number | null = null;
    let averageReturnTimeDays: number | null = null;
    if (durationsMs.length > 0) {
      const avgMs = durationsMs.reduce((sum, ms) => sum + ms, 0) / durationsMs.length;
      const hours = avgMs / (1000 * 60 * 60);
      averageReturnTimeHours = Math.round(hours * 10) / 10;
      averageReturnTimeDays = Math.round((hours / 24) * 10) / 10;
    }

    return {
      declaredCount,
      returnedCount,
      recoveryRate,
      averageReturnTimeHours,
      averageReturnTimeDays,
      breakdown: {
        foundDeclared: declared.filter((a) => a.type === AnnouncementType.Found).length,
        lostDeclared: declared.filter((a) => a.type === AnnouncementType.Lost).length,
        foundReturned: returned.filter((a) => a.type === AnnouncementType.Found).length,
        lostReturned: returned.filter((a) => a.type === AnnouncementType.Lost).length,
        activeCount: declared.filter((a) => a.status === AnnouncementStatus.Available || a.status === AnnouncementStatus.Open).length,
        closedCount: declared.filter((a) => a.status === AnnouncementStatus.Closed).length,
        archivedCount: declared.filter((a) => a.status === AnnouncementStatus.Archived).length,
        hiddenCount: declared.filter((a) => a.status === AnnouncementStatus.Hidden).length,
      },
    };
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