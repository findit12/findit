import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Remove spaces at the beginning and end of the proof description.
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Body of PUT /api/conversations/:id: the person who started the discussion corrects the proof.
export class UpdateDiscussionDto {
  @ApiProperty({ example: 'The item has a small scratch near the charging port.', maxLength: 1000 })
  @Trim()
  @MaxLength(1000, { message: 'The proof cannot be more than 1000 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Enter a description to prove ownership.' })
  description!: string;
}
