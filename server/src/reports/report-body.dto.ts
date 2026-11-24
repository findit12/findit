import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { CreateReportDto } from './create-report.dto';

// Body of POST /api/reports (Lab 6): the same reason as POST /api/announcements/:id/reports,
// and the announcement written in the body instead of the address.
export class CreateReportBodyDto extends CreateReportDto {
  @ApiProperty({ example: 7, description: 'The announcement that is reported' })
  @Type(() => Number)
  @Min(1, { message: 'Choose an announcement.' })
  @IsInt({ message: 'Choose an announcement.' })
  announcementId!: number;
}
