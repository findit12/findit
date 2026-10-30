import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const Trim = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateMessageDto {
  @ApiProperty({
    example: 'I can meet you tomorrow to collect the item.',
    maxLength: 2000,
  })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty.' })
  @MaxLength(2000)
  content!: string;
}