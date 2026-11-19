import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('reports')
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('admin/queue')
  @ApiOperation({ summary: 'Get pending reports for the administrator moderation queue' })
  @ApiResponse({ status: 200, description: 'Pending reports awaiting moderation' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Administrator access required' })
  getQueue() {
    return this.reportsService.getAdminQueue();
  }

  @Patch('admin/announcements/:id/hide')
  @ApiOperation({ summary: 'Hide a reported announcement from public views' })
  @ApiResponse({ status: 200, description: 'Announcement hidden and reports marked reviewed' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  hideAnnouncement(@Param('id', ParseIntPipe) id: number) {
    return this.reportsService.hideAnnouncement(id);
  }

  @Delete('admin/announcements/:id')
  @ApiOperation({ summary: 'Logically delete a reported announcement' })
  @ApiResponse({ status: 200, description: 'Announcement deleted and reports marked reviewed' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  deleteAnnouncement(@Param('id', ParseIntPipe) id: number) {
    return this.reportsService.deleteAnnouncement(id);
  }

  @Patch('admin/users/:id/block')
  @ApiOperation({ summary: 'Block an abusive user account and immediately invalidate their session' })
  @ApiResponse({ status: 200, description: 'User account suspended' })
  @ApiResponse({ status: 400, description: 'Cannot block your own account' })
  @ApiResponse({ status: 403, description: 'Cannot block an administrator account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  blockUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserId() actingAdminId: number,
  ) {
    return this.reportsService.blockUser(id, actingAdminId);
  }

  @Delete('admin/:id')
  @ApiOperation({ summary: 'Dismiss a pending report' })
  @ApiResponse({ status: 200, description: 'Report dismissed' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  dismissReport(@Param('id', ParseIntPipe) id: number) {
    return this.reportsService.dismissReport(id);
  }
}
