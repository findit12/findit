import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, ILike, In, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { ReferenceService } from '../reference/reference.service';
import { Announcement, AnnouncementStatus, AnnouncementType } from './announcement.entity';
import { toOwnerView, toPublicView } from './announcement.views';
import { DEFAULT_PAGE_SIZE, ListAnnouncementsQueryDto } from './announcements-query.dto';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';
import { checkPhotos } from './photo-rules';
import { PhotoStorageService } from './photo-storage.service';

const DAYS_BEFORE_ARCHIVE = 90;

// The author can only change an announcement that is still active (SDD: Returned, Closed,
// Deleted and Archived are final; Hidden is decided by an administrator).
const EDITABLE_STATUSES = [AnnouncementStatus.Available, AnnouncementStatus.Open];

// SCRUM-22: only these statuses appear in the public gallery. Closed, Returned, Deleted, Hidden
// and Archived never do.
const GALLERY_STATUSES = [AnnouncementStatus.Available, AnnouncementStatus.Open];

// Turns an empty optional field ("") into null, so the database stores "no value".
function emptyToNull(value?: string): string | null {
  return value ? value : null;
}

// Today's date as "YYYY-MM-DD", in the time zone of the server.
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
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly reference: ReferenceService,
    private readonly photoStorage: PhotoStorageService,
    private readonly mail: MailService,
  ) {}

  // SCRUM-16 and SCRUM-20: saves a found or lost declaration with its photos.
  async create(authorId: number, dto: CreateAnnouncementDto, files: Express.Multer.File[]) {
    const author = await this.users.findOneBy({ id: authorId });
    if (!author) {
      throw new NotFoundException('User not found.');
    }

    const isFound = dto.type === AnnouncementType.Found;

    // Every check runs before anything is saved, so an error never leaves half an announcement.
    // Photos: 1 to 4 for a found object (FR-05), optional for a lost one (FR-15).
    if (isFound && files.length < 1) {
      throw new BadRequestException('Add at least one photo.');
    }
    checkPhotos(files); // SCRUM-19: at most 4 photos, 5 MB each, real JPEG, PNG or WebP
    if (dto.eventDate > today()) {
      throw new BadRequestException('The date cannot be in the future.');
    }
    await this.reference.checkSelection(dto.categoryId, dto.objectTypeId, dto.placeId);

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
        // Only a found object has a current location (SDD integrity rules).
        currentLocation: isFound ? dto.currentLocation : null,
        hiddenDetail: emptyToNull(dto.hiddenDetail),
        // Initial status: Available for a found object, Open for a lost one.
        status: isFound ? AnnouncementStatus.Available : AnnouncementStatus.Open,
        expiresAt,
      }),
    );

    // SCRUM-17: confirmation email, for found and lost declarations (FR-07).
    // It is sent in the background: a mail problem never breaks the declaration (Point B2).
    void this.mail
      .confirmation(author.email, { id: saved.id, title: saved.title, type: saved.type })
      .catch((err) => {
        this.logger.error(`Failed to send confirmation email for announcement ${saved.id}`, err);
      });

    return { announcement: toOwnerView(await this.findWithDetails(saved.id)) };
  }

  // Detail page: anyone can read an announcement, except a deleted or hidden one.
  async findPublic(id: number) {
    const announcement = await this.announcements.findOne({
      where: { id },
      relations: { category: true, objectType: true, place: true },
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

  // SCRUM-22: one page of the public gallery, newest first. toPublicView never includes the
  // hidden detail. Number() makes sure we have numbers even if the query arrives as text.
  async findPublicPage(query: ListAnnouncementsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || DEFAULT_PAGE_SIZE;
    // SCRUM-23: each filter that is sent adds one condition; all of them must be true.
    const where: FindOptionsWhere<Announcement> = { status: In(GALLERY_STATUSES) };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.objectTypeId) where.objectTypeId = query.objectTypeId;
    if (query.placeId) where.placeId = query.placeId;
    if (query.dateFrom && query.dateTo) where.eventDate = Between(query.dateFrom, query.dateTo);
    else if (query.dateFrom) where.eventDate = MoreThanOrEqual(query.dateFrom);
    else if (query.dateTo) where.eventDate = LessThanOrEqual(query.dateTo);

    // SCRUM-24: keyword, case does not matter. A % or _ typed by the user is escaped, so it is
    // read as an ordinary character. With a keyword, one condition per column (OR between them),
    // and each condition keeps the status and the filters above (AND).
    const keyword = (query.q ?? '').trim();
    let conditions: FindOptionsWhere<Announcement> | FindOptionsWhere<Announcement>[] = where;
    if (keyword) {
      const pattern = '%' + keyword.replace(/[\\%_]/g, '\\$&') + '%';
      conditions = [
        { ...where, title: ILike(pattern) },
        { ...where, description: ILike(pattern) },
        { ...where, brand: ILike(pattern) },
        { ...where, color: ILike(pattern) },
      ];
    }

    const [announcements, total] = await this.announcements.findAndCount({
      where: conditions,
      relations: { category: true, objectType: true, place: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      announcements: announcements.map(toPublicView),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  // SCRUM-18: the announcements of the signed-in user, newest first, with their hidden detail.
  async findMine(userId: number) {
    const announcements = await this.announcements.find({
      where: { authorId: userId, status: Not(AnnouncementStatus.Deleted) },
      relations: { category: true, objectType: true, place: true },
      order: { createdAt: 'DESC' },
    });
    return { announcements: announcements.map(toOwnerView) };
  }

  // SCRUM-18: one announcement of the signed-in user, for the edit page.
  async findMineById(userId: number, id: number) {
    return { announcement: toOwnerView(await this.findOwned(userId, id)) };
  }

  // SCRUM-18: the author changes some fields of an active announcement.
  // SCRUM-21: the author of a lost announcement can also close it (status: Closed).
  async update(userId: number, id: number, dto: UpdateAnnouncementDto) {
    const announcement = await this.findOwned(userId, id);
    this.assertEditable(announcement);

    if (dto.status === AnnouncementStatus.Closed && announcement.type !== AnnouncementType.Lost) {
      throw new ConflictException('Only a lost announcement can be closed.');
    }

    if (dto.eventDate !== undefined && dto.eventDate > today()) {
      throw new BadRequestException('The date cannot be in the future.');
    }
    if (dto.hiddenDetail === '' && announcement.type === AnnouncementType.Found) {
      throw new BadRequestException('Enter a hidden detail that only the owner knows.');
    }

    // If one of the three choices changes, the new combination is checked as a whole.
    const categoryId = dto.categoryId ?? announcement.categoryId;
    const objectTypeId = dto.objectTypeId ?? announcement.objectTypeId;
    const placeId = dto.placeId ?? announcement.placeId;
    if (dto.categoryId !== undefined || dto.objectTypeId !== undefined || dto.placeId !== undefined) {
      await this.reference.checkSelection(categoryId, objectTypeId, placeId);
    }

    // Copies the fields that are present in the request. "undefined" means "not sent".
    if (dto.title !== undefined) announcement.title = dto.title;
    if (dto.description !== undefined) announcement.description = dto.description;
    if (dto.brand !== undefined) announcement.brand = emptyToNull(dto.brand);
    if (dto.color !== undefined) announcement.color = emptyToNull(dto.color);
    if (dto.eventDate !== undefined) announcement.eventDate = dto.eventDate;
    if (dto.placeDetails !== undefined) announcement.placeDetails = emptyToNull(dto.placeDetails);
    if (dto.hiddenDetail !== undefined) announcement.hiddenDetail = emptyToNull(dto.hiddenDetail);
    announcement.categoryId = categoryId;
    announcement.objectTypeId = objectTypeId;
    announcement.placeId = placeId;
    if (dto.status === AnnouncementStatus.Closed) {
      announcement.status = AnnouncementStatus.Closed; // final status: no more edit or delete
    }

    await this.saveFields(announcement);
    return { announcement: toOwnerView(await this.findWithDetails(id)) };
  }

  // SCRUM-18: logical deletion. The row stays in the database with the status Deleted.
  async remove(userId: number, id: number): Promise<void> {
    const announcement = await this.findOwned(userId, id);
    this.assertEditable(announcement);
    announcement.status = AnnouncementStatus.Deleted;
    await this.saveFields(announcement);
  }

  // Finds an announcement and checks that the signed-in user is its author.
  // 404 if it does not exist (or is deleted), 403 if it belongs to someone else.
  private async findOwned(userId: number, id: number): Promise<Announcement> {
    const announcement = await this.announcements.findOne({
      where: { id },
      relations: { category: true, objectType: true, place: true },
    });
    if (!announcement || announcement.status === AnnouncementStatus.Deleted) {
      throw new NotFoundException('Announcement not found.');
    }
    if (announcement.authorId !== userId) {
      throw new ForbiddenException('You can only change your own announcements.');
    }
    return announcement;
  }

  // 409 if the announcement is no longer active (SDD: invalid transition).
  private assertEditable(announcement: Announcement): void {
    if (!EDITABLE_STATUSES.includes(announcement.status)) {
      throw new ConflictException(`This announcement is ${announcement.status} and can no longer be changed.`);
    }
  }

  // Saves the changed columns only. The loaded relations are removed first, otherwise TypeORM
  // would take the old category, precise object or place from them instead of the new ids.
  private async saveFields(announcement: Announcement): Promise<void> {
    const { category, objectType, place, author, ...columns } = announcement;
    await this.announcements.save(columns);
  }

  // Loads an announcement with the names of its category, precise object and place.
  private async findWithDetails(id: number): Promise<Announcement> {
    return this.announcements.findOneOrFail({
      where: { id },
      relations: { category: true, objectType: true, place: true },
    });
  }
}
