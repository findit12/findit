import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateFoundAnnouncementDto {
  @ApiProperty({ example: 'Blue Backpack', description: 'Item name or short title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'Found in the library on floor 2 near the computers.',
    description: 'Detailed description of where and what was found',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
