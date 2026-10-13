import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

// Query string of GET /api/announcements (SCRUM-22): ?page=1&limit=20.
// The filters (SCRUM-23), the keyword (SCRUM-24) and the sort (SCRUM-25) will be added here later.
// The last decorator written is the one whose message is shown first (see announcements.dto.ts).
export class ListAnnouncementsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The page must be 1 or more.' })
  @IsInt({ message: 'The page must be a whole number.' })
  page?: number;

  @ApiPropertyOptional({ example: DEFAULT_PAGE_SIZE, default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @Max(MAX_PAGE_SIZE, { message: `The limit cannot be more than ${MAX_PAGE_SIZE}.` })
  @Min(1, { message: 'The limit must be 1 or more.' })
  @IsInt({ message: 'The limit must be a whole number.' })
  limit?: number;

  // SCRUM-23: filters. They can be combined; a missing one means "no filter".
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

  // SCRUM-24: keyword searched in the title, description, brand and color.
  @ApiPropertyOptional({ example: 'phone', description: 'Keyword searched in the title, description, brand and color' })
  @IsOptional()
  @MaxLength(100, { message: 'The keyword cannot be more than 100 characters.' })
  @IsString({ message: 'The keyword must be text.' })
  q?: string;
}
