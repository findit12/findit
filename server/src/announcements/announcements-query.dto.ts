import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

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
}
