import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReportBodyDto } from './report-body.dto';
import { CreateReportDto } from './create-report.dto';
import { ReportsService } from './reports.service';

// Lab 6: "/api/reports", the CRUD of the Report entity for the person who wrote the report.
// The routes of the administrator are all under "/api/reports/admin/...", so they never meet ":id".
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Report an announcement (same as POST /api/announcements/:id/reports)' })
  @ApiResponse({ status: 201, description: 'Report submitted for moderation' })
  @ApiResponse({ status: 400, description: 'A valid announcement and reason are required' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  create(@CurrentUserId() userId: number, @Body() dto: CreateReportBodyDto) {
    return this.service.createReport(dto.announcementId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my reports' })
  @ApiResponse({ status: 200, description: 'My reports, newest first' })
  findMine(@CurrentUserId() userId: number) {
    return this.service.listMine(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one of my reports' })
  @ApiResponse({ status: 200, description: 'The report' })
  @ApiResponse({ status: 403, description: 'Not your report' })
  @ApiResponse({ status: 404, description: 'Unknown report' })
  findOne(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.getMine(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Change the reason of one of my pending reports' })
  @ApiResponse({ status: 200, description: 'The updated report' })
  @ApiResponse({ status: 403, description: 'Not your report' })
  @ApiResponse({ status: 404, description: 'Unknown report' })
  @ApiResponse({ status: 409, description: 'Already handled by an administrator' })
  update(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateReportDto) {
    return this.service.updateMine(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Withdraw one of my pending reports' })
  @ApiResponse({ status: 204, description: 'Report withdrawn' })
  @ApiResponse({ status: 403, description: 'Not your report' })
  @ApiResponse({ status: 404, description: 'Unknown report' })
  @ApiResponse({ status: 409, description: 'Already handled by an administrator' })
  remove(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.removeMine(id, userId);
  }
}
