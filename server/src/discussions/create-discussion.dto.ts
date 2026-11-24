import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

// Remove spaces at the beginning and end of the proof description.
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Body of POST /api/conversations (SCRUM-30, FR-11).
// The last decorator written is the one whose message is shown first (see announcements.dto.ts).
export class CreateDiscussionDto {
  @ApiProperty({ example: 7, description: 'The announcement the discussion is about' })
  @Type(() => Number)
  @Min(1, { message: 'Choose an announcement.' })
  @IsInt({ message: 'Choose an announcement.' })
  announcementId!: number;

  @ApiProperty({
    example: 'The item has a small scratch near the charging port.',
    maxLength: 1000,
    description: 'Proof (a private detail of the object), read only by the author of the announcement.',
  })
  @Trim()
  @MaxLength(1000, { message: 'The proof cannot be more than 1000 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a description to prove ownership.' })
  description!: string;
}
