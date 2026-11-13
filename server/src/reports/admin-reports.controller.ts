import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('admin/queue')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation( { summary: 'Get pending reports for the administrator moderation queue' })
  @ApiResponse({ status: 200, description: 'Pending reports awaiting moderation' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Administrator access required' })
  getQueue() {
    return this.reportsService.getAdminQueue();
  }
}
