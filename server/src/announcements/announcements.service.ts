import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { ReferenceService } from '../reference/reference.service';
import { Announcement, AnnouncementStatus, AnnouncementType } from './announcement.entity';
import { toOwnerView, toPublicView } from './announcement.views';
import { CreateAnnouncementDto } from './announcements.dto';
import { PhotoStorageService } from './photo-storage.service';

const DAYS_BEFORE_ARCHIVE = 90;

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

    // The email is sent in the background: a mail problem never breaks the declaration (Point B2).
    void this.mail.confirmation(author.email, saved.id).catch((err) => {
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

  // Loads an announcement with the names of its category, precise object and place.
  private async findWithDetails(id: number): Promise<Announcement> {
    return this.announcements.findOneOrFail({
      where: { id },
      relations: { category: true, objectType: true, place: true },
    });
  }
}
