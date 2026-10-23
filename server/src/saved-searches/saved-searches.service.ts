import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../announcements/announcement.entity';
import { MailService } from '../mail/mail.service';
import { ReferenceService } from '../reference/reference.service';
import { CreateSavedSearchDto } from './create-saved-search.dto';
import { SavedSearch } from './saved-search.entity';

// What a saved search needs to know about a new announcement.
type MatchableAnnouncement = Pick<
  Announcement,
  'id' | 'type' | 'title' | 'description' | 'authorId' | 'categoryId' | 'objectTypeId' | 'placeId' | 'eventDate'
>;

// Same rules as the gallery (SCRUM-23, SCRUM-24): every criterion that is filled in must match.
// The keyword is searched in the title and the description, whatever the case. The hidden detail
// is never used.
function matches(search: SavedSearch, announcement: MatchableAnnouncement): boolean {
  if (search.categoryId && search.categoryId !== announcement.categoryId) return false;
  if (search.objectTypeId && search.objectTypeId !== announcement.objectTypeId) return false;
  if (search.placeId && search.placeId !== announcement.placeId) return false;
  if (search.dateFrom && announcement.eventDate < search.dateFrom) return false;
  if (search.dateTo && announcement.eventDate > search.dateTo) return false;
  if (search.keyword) {
    const keyword = search.keyword.toLowerCase();
    const inTitle = announcement.title.toLowerCase().includes(keyword);
    const inDescription = announcement.description.toLowerCase().includes(keyword);
    if (!inTitle && !inDescription) return false;
  }
  return true;
}

// What the API sends back. "q" has the same name as in the gallery address (?q=keys).
function toView(search: SavedSearch) {
  return {
    id: search.id,
    categoryId: search.categoryId,
    objectTypeId: search.objectTypeId,
    placeId: search.placeId,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    q: search.keyword,
    createdAt: search.createdAt,
  };
}

@Injectable()
export class SavedSearchesService {
  constructor(
    @InjectRepository(SavedSearch) private readonly searches: Repository<SavedSearch>,
    private readonly reference: ReferenceService,
    private readonly mail: MailService,
  ) {}

  // Saves the current search of the gallery for the signed-in user.
  async create(userId: number, dto: CreateSavedSearchDto) {
    const keyword = (dto.q ?? '').trim();
    // An empty search would match every announcement and flood the user with emails.
    if (!dto.categoryId && !dto.objectTypeId && !dto.placeId && !dto.dateFrom && !dto.dateTo && !keyword) {
      throw new BadRequestException('Choose at least one filter or a keyword before saving a search.');
    }
    await this.reference.checkFilters(dto.categoryId, dto.objectTypeId, dto.placeId);

    const saved = await this.searches.save(
      this.searches.create({
        userId,
        categoryId: dto.categoryId ?? null,
        objectTypeId: dto.objectTypeId ?? null,
        placeId: dto.placeId ?? null,
        dateFrom: dto.dateFrom ?? null,
        dateTo: dto.dateTo ?? null,
        keyword: keyword || null,
      }),
    );
    return { savedSearch: toView(saved) };
  }

  // The searches of the signed-in user, newest first.
  async findMine(userId: number) {
    const searches = await this.searches.find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return { savedSearches: searches.map(toView) };
  }

  async remove(userId: number, id: number): Promise<void> {
    const search = await this.searches.findOneBy({ id });
    if (!search) {
      throw new NotFoundException('Saved search not found.');
    }
    if (search.userId !== userId) {
      throw new ForbiddenException('You can only delete your own saved searches.');
    }
    await this.searches.delete(id);
  }

  // Called when an announcement is created: compares it with every saved search and emails the
  // owners of the searches that match. A user gets ONE email per announcement, even if two of
  // their searches match, and the author never gets an alert for their own announcement.
  async notifyMatches(announcement: MatchableAnnouncement): Promise<void> {
    const searches = await this.searches.find({ relations: { user: true } });

    const recipients = new Map<number, string>(); // user id -> email: one entry per user
    for (const search of searches) {
      if (search.userId === announcement.authorId) continue;
      if (!matches(search, announcement)) continue;
      recipients.set(search.userId, search.user.email);
    }

    for (const email of recipients.values()) {
      await this.mail.savedSearchAlert(email, {
        id: announcement.id,
        title: announcement.title,
        type: announcement.type,
      });
    }
  }
}
