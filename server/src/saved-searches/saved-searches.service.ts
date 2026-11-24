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
  | 'id'
  | 'type'
  | 'title'
  | 'description'
  | 'brand'
  | 'color'
  | 'authorId'
  | 'categoryId'
  | 'objectTypeId'
  | 'placeId'
  | 'eventDate'
>;

// Same rules as the gallery (SCRUM-23, SCRUM-24): every criterion that is filled in must match.
// The keyword is searched in the title, description, brand and color, whatever the case (FR-21).
// The hidden detail is never used.
function matches(search: SavedSearch, announcement: MatchableAnnouncement): boolean {
  if (search.categoryId && search.categoryId !== announcement.categoryId) return false;
  if (search.objectTypeId && search.objectTypeId !== announcement.objectTypeId) return false;
  if (search.placeId && search.placeId !== announcement.placeId) return false;
  if (search.dateFrom && announcement.eventDate < search.dateFrom) return false;
  if (search.dateTo && announcement.eventDate > search.dateTo) return false;
  if (search.keyword) {
    const keyword = search.keyword.toLowerCase();
    const texts = [announcement.title, announcement.description, announcement.brand, announcement.color];
    if (!texts.some((text) => (text ?? '').toLowerCase().includes(keyword))) return false;
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

  // An empty search would match every announcement and flood the user with emails, so it is refused.
  // The ids of the filters are checked with the reference lists. Returns the cleaned keyword.
  private async checkSearch(dto: CreateSavedSearchDto): Promise<string> {
    const keyword = (dto.q ?? '').trim();
    if (!dto.categoryId && !dto.objectTypeId && !dto.placeId && !dto.dateFrom && !dto.dateTo && !keyword) {
      throw new BadRequestException('Choose at least one filter or a keyword before saving a search.');
    }
    if (dto.dateFrom && dto.dateTo && dto.dateFrom > dto.dateTo) {
      throw new BadRequestException('The start date must be before the end date.');
    }
    await this.reference.checkFilters(dto.categoryId, dto.objectTypeId, dto.placeId);
    return keyword;
  }

  // Loads a saved search and checks that it belongs to the signed-in user.
  private async findOwned(userId: number, id: number, action: string): Promise<SavedSearch> {
    const search = await this.searches.findOneBy({ id });
    if (!search) {
      throw new NotFoundException('Saved search not found.');
    }
    if (search.userId !== userId) {
      throw new ForbiddenException(`You can only ${action} your own saved searches.`);
    }
    return search;
  }

  // Saves the current search of the gallery for the signed-in user.
  async create(userId: number, dto: CreateSavedSearchDto) {
    const keyword = await this.checkSearch(dto);

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

  // Lab 6, "retrieve by id": one of my saved searches.
  async findOne(userId: number, id: number) {
    return { savedSearch: toView(await this.findOwned(userId, id, 'read')) };
  }

  // Lab 6, "update" (same pattern as the lab: { ...old, ...body }): a field that is sent replaces the
  // old value, a field that is not sent is kept. Send null to clear a filter. The result is checked
  // like a new search (it cannot be empty).
  async update(userId: number, id: number, dto: CreateSavedSearchDto) {
    const search = await this.findOwned(userId, id, 'change');
    const merged: CreateSavedSearchDto = {
      categoryId: dto.categoryId !== undefined ? dto.categoryId : search.categoryId ?? undefined,
      objectTypeId: dto.objectTypeId !== undefined ? dto.objectTypeId : search.objectTypeId ?? undefined,
      placeId: dto.placeId !== undefined ? dto.placeId : search.placeId ?? undefined,
      dateFrom: dto.dateFrom !== undefined ? dto.dateFrom : search.dateFrom ?? undefined,
      dateTo: dto.dateTo !== undefined ? dto.dateTo : search.dateTo ?? undefined,
      q: dto.q !== undefined ? dto.q : search.keyword ?? undefined,
    };
    const keyword = await this.checkSearch(merged);

    search.categoryId = merged.categoryId ?? null;
    search.objectTypeId = merged.objectTypeId ?? null;
    search.placeId = merged.placeId ?? null;
    search.dateFrom = merged.dateFrom ?? null;
    search.dateTo = merged.dateTo ?? null;
    search.keyword = keyword || null;
    return { savedSearch: toView(await this.searches.save(search)) };
  }

  async remove(userId: number, id: number): Promise<void> {
    await this.findOwned(userId, id, 'delete');
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
