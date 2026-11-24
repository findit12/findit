import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// Remove spaces at the beginning and end of a name.
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Bodies of the administrator routes of the reference data (Lab 6). POST needs every required field;
// PUT uses the same DTO with every field optional (the Update... classes at the end): the fields that
// are sent replace the old values, the others are kept.
export class CategoryDto {
  @ApiProperty({ example: 'Electronics', maxLength: 60 })
  @Trim()
  @MaxLength(60, { message: 'The name cannot be more than 60 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a name.' })
  name!: string;
}

export class ObjectTypeDto {
  @ApiProperty({ example: 1, description: 'The category of the precise object' })
  @Type(() => Number)
  @Min(1, { message: 'Choose a category.' })
  @IsInt({ message: 'Choose a category.' })
  categoryId!: number;

  @ApiProperty({ example: 'Phone', maxLength: 60 })
  @Trim()
  @MaxLength(60, { message: 'The name cannot be more than 60 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a name.' })
  name!: string;
}

export class PlaceDto {
  @ApiProperty({ example: 'Library', maxLength: 80 })
  @Trim()
  @MaxLength(80, { message: 'The name cannot be more than 80 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a name.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Building A', maxLength: 40 })
  @IsOptional()
  @Trim()
  @MaxLength(40, { message: 'The building cannot be more than 40 characters.' })
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: '2', maxLength: 20 })
  @IsOptional()
  @Trim()
  @MaxLength(20, { message: 'The floor cannot be more than 20 characters.' })
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: true, description: 'An inactive place is no longer offered in the forms' })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be true or false.' })
  isActive?: boolean;
}

// PUT bodies: every field is optional, what is not sent is kept (same pattern as the Lab 6 example).
export class UpdateCategoryDto extends PartialType(CategoryDto) {}
export class UpdateObjectTypeDto extends PartialType(ObjectTypeDto) {}
export class UpdatePlaceDto extends PartialType(PlaceDto) {}
