import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

// Body of POST /api/saved-searches (SCRUM-27): the filters and the keyword of the gallery.
// The sort and the page are not saved: they mean nothing for an alert.
// The last decorator written is the one whose message is shown first (see announcements.dto.ts).
export class CreateSavedSearchDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The category must be 1 or more.' })
  @IsInt({ message: 'The category must be a whole number.' })
  categoryId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The object must be 1 or more.' })
  @IsInt({ message: 'The object must be a whole number.' })
  objectTypeId?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: 'The place must be 1 or more.' })
  @IsInt({ message: 'The place must be a whole number.' })
  placeId?: number;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'The start date must look like 2026-10-01.' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'The end date must look like 2026-10-31.' })
  dateTo?: string;

  @ApiPropertyOptional({ example: 'keys', description: 'Keyword searched in the title, description, brand and color' })
  @IsOptional()
  @MaxLength(100, { message: 'The keyword cannot be more than 100 characters.' })
  @IsString({ message: 'The keyword must be text.' })
  q?: string;
}
