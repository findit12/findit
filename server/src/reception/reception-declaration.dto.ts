import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Body of POST /api/admin/announcements (FR-32): the photos are the only mandatory field and
// are read by the controller. A hidden detail is optional.
export class ReceptionDeclarationDto {
  @ApiPropertyOptional({ example: 'Sticker of a cat on the back', maxLength: 200 })
  @Trim()
  @IsOptional()
  @MaxLength(200)
  @IsString()
  @IsNotEmpty({ message: 'Enter a hidden detail or leave the field out.' })
  hiddenDetail?: string;

  // Only for the Swagger page: the photos are read by the controller, not from this object.
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: '1 to 4 photos (mandatory)',
  })
  @IsOptional()
  photos?: unknown;
}
