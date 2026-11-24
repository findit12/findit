import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { AnnouncementType } from './announcement.entity';

// FR-27: the page size is fixed. The client cannot change it.
export const PAGE_SIZE = 12;

// FR-23: the three sort orders of the gallery.
export const GALLERY_SORTS = ['newest', 'closestDate', 'bestMatch'] as const;
export type GallerySort = (typeof GALLERY_SORTS)[number];

// Query string of GET /api/announcements, for example:
// ?type=found&categoryId=1&dateFrom=2026-10-01&q=phone&sort=bestMatch&page=2
// Every filter is optional and they combine with AND (FR-09).
// The last decorator written is the one whose message is shown first (see announcements.dto.ts).
export class ListAnnouncementsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The page must be 1 or more.' })
  @IsInt({ message: 'The page must be a whole number.' })
  page?: number;

  // FR-08: the "Found objects" and "Lost announcements" tabs.
  @ApiPropertyOptional({ enum: AnnouncementType, description: 'found or lost (both when missing)' })
  @IsOptional()
  @IsEnum(AnnouncementType, { message: 'The type must be found or lost.' })
  type?: AnnouncementType;

  @ApiPropertyOptional({ example: 1, description: 'Category id' })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The category must be 1 or more.' })
  @IsInt({ message: 'The category must be a whole number.' })
  categoryId?: number;

  @ApiPropertyOptional({ example: 2, description: 'Precise object id' })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The object must be 1 or more.' })
  @IsInt({ message: 'The object must be a whole number.' })
  objectTypeId?: number;

  @ApiPropertyOptional({ example: 3, description: 'Place id' })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The place must be 1 or more.' })
  @IsInt({ message: 'The place must be a whole number.' })
  placeId?: number;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Earliest event date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'The start date must look like 2026-10-01.' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Latest event date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'The end date must look like 2026-10-31.' })
  dateTo?: string;

  // FR-21: searched in the title, description, brand and color (never in the hidden detail).
  @ApiPropertyOptional({ example: 'phone', description: 'Keyword searched in the title, description, brand and color' })
  @IsOptional()
  @MaxLength(100, { message: 'The keyword cannot be more than 100 characters.' })
  @IsString({ message: 'The keyword must be text.' })
  q?: string;

  // FR-23: newest (default); closestDate needs a date filter; bestMatch needs a keyword.
  @ApiPropertyOptional({ enum: GALLERY_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(GALLERY_SORTS, { message: 'The sort must be newest, closestDate or bestMatch.' })
  sort?: GallerySort;
}
