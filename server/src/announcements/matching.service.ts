import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { Announcement, AnnouncementStatus, AnnouncementType } from './announcement.entity';
import { AnnouncementMatch } from './announcement-match.entity';

// SCRUM-28 (FR-15, SDD 6.1 "MatchingService"): compares a new announcement with the announcements
// of the opposite type. A candidate must have the same category and an event date within 7 days;
// it then gets a score out of 100, and the pairs scoring MATCH_THRESHOLD or more are saved and
// emailed to both authors.

export const MATCH_THRESHOLD = 60;
export const MAX_DAYS_APART = 7;

// Only the announcements still visible in the gallery can be matched.
const MATCHABLE_STATUSES = [AnnouncementStatus.Available, AnnouncementStatus.Open];

// Frequent words that say nothing about the object itself.
const STOP_WORDS = new Set([
  'the', 'and', 'with', 'near', 'found', 'lost', 'for', 'from', 'was', 'were', 'its', 'his', 'her',
  'this', 'that', 'object', 'left', 'one', 'has', 'have', 'our', 'your', 'not', 'are', 'but',
]);

// "2026-10-05" moved by a number of days, still as "YYYY-MM-DD" (computed in UTC: no time zone shift).
export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The useful words of an announcement: title, brand, color and description, in lower case,
// 3 letters or more, without the stop words. The hidden detail is never used.
export function keywords(announcement: Pick<Announcement, 'title' | 'brand' | 'color' | 'description'>): Set<string> {
  const text = [announcement.title, announcement.brand, announcement.color, announcement.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const words = text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return new Set(words);
}

type Scored = Pick<
  Announcement,
  'categoryId' | 'objectTypeId' | 'placeId' | 'eventDate' | 'title' | 'brand' | 'color' | 'description'
>;

// Score out of 100 of two announcements (Jira SCRUM-28: category, date proximity, place, keywords).
//   same category .............. 30 (always true for a candidate)
//   same precise object ......... 30
//   same place .................. 15
//   date: 15 the same day, 2 points less per day apart (1 point at 7 days)
//   shared keywords ............. 5 per word, 10 at most
export function matchScore(a: Scored, b: Scored): number {
  let score = 0;
  if (a.categoryId === b.categoryId) score += 30;
  if (a.objectTypeId === b.objectTypeId) score += 30;
  if (a.placeId === b.placeId) score += 15;

  const daysApart =
    Math.abs(Date.parse(`${a.eventDate}T00:00:00Z`) - Date.parse(`${b.eventDate}T00:00:00Z`)) / 86_400_000;
  if (daysApart <= MAX_DAYS_APART) score += 15 - 2 * daysApart;

  const wordsOfB = keywords(b);
  const shared = [...keywords(a)].filter((word) => wordsOfB.has(word)).length;
  score += Math.min(10, shared * 5);

  return score;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Announcement) private readonly announcements: Repository<Announcement>,
    @InjectRepository(AnnouncementMatch) private readonly matches: Repository<AnnouncementMatch>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  // Called right after an announcement is created. Returns the number of matches found, so the
  // author of a lost announcement can be told "We will alert you..." when there is none (UC-3).
  async matchNewAnnouncement(source: Announcement): Promise<number> {
    const oppositeType = source.type === AnnouncementType.Found ? AnnouncementType.Lost : AnnouncementType.Found;

    // The database only returns the possible candidates: opposite type, still public, same
    // category, event within 7 days, written by someone else.
    const candidates = await this.announcements.find({
      where: {
        type: oppositeType,
        status: In(MATCHABLE_STATUSES),
        categoryId: source.categoryId,
        eventDate: Between(shiftDay(source.eventDate, -MAX_DAYS_APART), shiftDay(source.eventDate, MAX_DAYS_APART)),
        authorId: Not(source.authorId),
      },
      relations: { author: true },
    });

    let found = 0;
    for (const candidate of candidates) {
      const score = matchScore(source, candidate);
      if (score < MATCH_THRESHOLD) continue;

      // The pair is stored with the smaller id first (database check "announcement_id < matched_announcement_id").
      try {
        await this.matches.save(
          this.matches.create({
            announcementId: Math.min(source.id, candidate.id),
            matchedAnnouncementId: Math.max(source.id, candidate.id),
            score,
          }),
        );
      } catch (error) {
        // Already saved (unique pair): nothing new to tell the users.
        this.logger.warn(`Match ${source.id}/${candidate.id} not saved: ${(error as Error).message}`);
        continue;
      }
      found += 1;
      void this.notify(source, candidate).catch((error) =>
        this.logger.error(`Match emails failed for ${source.id}/${candidate.id}`, error),
      );
    }
    return found;
  }

  // Both authors get an email with a link to the OTHER announcement (FR-13 "match alert").
  private async notify(source: Announcement, candidate: Announcement): Promise<void> {
    const sourceAuthor = await this.users.findOneBy({ id: source.authorId });
    if (sourceAuthor) {
      await this.mail.matchAlert(sourceAuthor.email, { id: candidate.id, title: candidate.title, type: candidate.type });
    }
    await this.mail.matchAlert(candidate.author.email, { id: source.id, title: source.title, type: source.type });
  }
}
