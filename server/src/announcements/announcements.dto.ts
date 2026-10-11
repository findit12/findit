import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AnnouncementType, CurrentLocation } from './announcement.entity';

// Removes the spaces at the start and at the end of a text field.
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Fields of the "declare an object" form. They arrive as multipart/form-data, so every value
// arrives as text: @Type(() => Number) turns the ids back into numbers.
// When several rules fail, the error filter shows the first message, which is the one of the
// LAST decorator written. That is why @IsNotEmpty({ message }) is always written last.
export class CreateAnnouncementDto {
  @ApiProperty({ enum: AnnouncementType, example: 'found' })
  @IsEnum(AnnouncementType, { message: 'The type must be "found" or "lost".' })
  type!: AnnouncementType;

  @ApiProperty({ example: 'Black iPhone 13', maxLength: 100 })
  @Trim()
  @MaxLength(100)
  @IsString()
  @IsNotEmpty({ message: 'Enter a title.' })
  title!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Choose a category.' })
  categoryId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Choose a precise object.' })
  objectTypeId!: number;

  @ApiProperty({ example: 'Black phone with a cracked screen protector.', maxLength: 1000 })
  @Trim()
  @MaxLength(1000)
  @IsString()
  @IsNotEmpty({ message: 'Enter a description.' })
  description!: string;

  @ApiPropertyOptional({ example: 'Apple', maxLength: 50 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string;

  @ApiPropertyOptional({ example: 'Black', maxLength: 50 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiProperty({ example: '2026-10-10', description: 'Day when the object was found or lost, YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'Enter a valid date.' })
  eventDate!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Choose a place.' })
  placeId!: number;

  @ApiPropertyOptional({ example: 'Second floor, near the printers', maxLength: 200 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeDetails?: string;

  // Required when the object was found: "I keep it" (finder) or "Reception".
  @ApiPropertyOptional({ enum: CurrentLocation, description: 'Required for a found object' })
  @ValidateIf((dto: CreateAnnouncementDto) => dto.type === AnnouncementType.Found)
  @IsEnum(CurrentLocation, { message: 'Say where the object is now.' })
  currentLocation?: CurrentLocation;

  // Required when the object was found: a private detail to check the owner's claim.
  @ApiPropertyOptional({ example: 'Sticker of a cat on the back', maxLength: 200 })
  @Trim()
  @ValidateIf((dto: CreateAnnouncementDto) => dto.type === AnnouncementType.Found)
  @MaxLength(200)
  @IsString()
  @IsNotEmpty({ message: 'Enter a hidden detail that only the owner knows.' })
  hiddenDetail?: string;

  // Only for the Swagger page: the photos are read by the controller, not from this object.
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '1 to 4 photos for a found object, 0 to 4 for a lost one',
  })
  @IsOptional()
  photos?: unknown;
}

// Fields that the author can change (SCRUM-18 and SCRUM-21), sent as JSON. Every field is
// optional: only the fields present in the request are changed. The type, the current location
// and the photos cannot be changed here.
export class UpdateAnnouncementDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @Trim()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  @IsNotEmpty({ message: 'Enter a title.' })
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Choose a category.' })
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Choose a precise object.' })
  objectTypeId?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Trim()
  @IsOptional()
  @MaxLength(1000)
  @IsString()
  @IsNotEmpty({ message: 'Enter a description.' })
  description?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ example: '2026-10-10' })
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Enter a valid date.' })
  eventDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Choose a place.' })
  placeId?: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeDetails?: string;

  // For a found object, the service refuses an empty hidden detail.
  @ApiPropertyOptional({ maxLength: 200 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hiddenDetail?: string;
}
