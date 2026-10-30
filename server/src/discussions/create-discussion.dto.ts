
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Remove spaces at the beginning and end of the proof description.
const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateDiscussionDto {
  @ApiProperty({
    example: 'The item has a small scratch near the charging port.',
    maxLength: 1000,
    description: 'Private proof of ownership, visible only to the finder through the discussion process.',
  })
  @Trim()
  @MaxLength(1000)
  @IsString()
  @IsNotEmpty({ message: 'Enter a description to prove ownership.' })
  description!: string;
}
