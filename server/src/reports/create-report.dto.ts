import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateReportDto {
  @ApiProperty({
    example: 'This announcement contains misleading information.',
    maxLength: 1000,
    description: 'Required reason for reporting the announcement.',
  })
  @Trim()
  @MaxLength(1000)
  @IsString()
  @IsNotEmpty({ message: 'Enter a reason for reporting this announcement.' })
  reason!: string;
}
