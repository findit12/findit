import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Body of POST /api/announcements/:id/claims (FR-16).
export class CreateClaimDto {
  @ApiProperty({ example: 'A cat sticker on the back and a crack near the camera.', maxLength: 1000 })
  @Trim()
  @MaxLength(1000, { message: 'The proof cannot be more than 1000 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Describe the hidden detail to prove that the object is yours.' })
  proof!: string;
}

// Body of PUT /api/claims/:id (Lab 6: merge, the fields that are not sent keep their value).
export class UpdateClaimDto extends PartialType(CreateClaimDto) {}
