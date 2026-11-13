import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReportDto } from './create-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('announcements')
export class AnnouncementReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post(':id/reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report an announcement with a required reason' })
  @ApiResponse({ status: 201, description: 'Report submitted for moderation' })
  @ApiResponse({ status: 400, description: 'A valid report reason is required' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  create(
    @Param('id', ParseIntPipe) announcementId: number,
    @CurrentUserId() reporterId: number,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport(announcementId, reporterId, dto);
  }
}
