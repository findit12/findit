import { Controller, Delete, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

// FR-19: every route is for administrators only (401 if not signed in, 403 for a student).
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

  @Get('admin/users')
  @ApiOperation({ summary: 'List the user accounts (AG Grid users table)' })
  @ApiResponse({ status: 200, description: 'All accounts, newest first' })
  getUsers() {
    return this.reportsService.listUsers();
  }

  @Get('admin/announcements/hidden')
  @ApiOperation({ summary: 'List the hidden announcements, to restore or delete them' })
  @ApiResponse({ status: 200, description: 'Hidden announcements' })
  getHiddenAnnouncements() {
    return this.reportsService.listHiddenAnnouncements();
  }

  @Get('admin/audit-log')
  @ApiOperation({ summary: 'Read the audit trail of the moderation actions' })
  @ApiResponse({ status: 200, description: 'The last 200 actions, newest first' })
  getAuditLog() {
    return this.reportsService.getAuditLog();
  }

  @Patch('admin/announcements/:id/hide')
  @ApiOperation({ summary: 'Hide an active announcement from public views' })
  @ApiResponse({ status: 200, description: 'Announcement hidden and reports marked reviewed' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 409, description: 'The announcement is not active' })
  hideAnnouncement(@Param('id', ParseIntPipe) id: number, @CurrentUserId() adminId: number) {
    return this.reportsService.hideAnnouncement(id, adminId);
  }

  @Patch('admin/announcements/:id/restore')
  @ApiOperation({ summary: 'Restore a hidden announcement to its previous status' })
  @ApiResponse({ status: 200, description: 'Announcement visible again (Available or Open)' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 409, description: 'The announcement is not hidden' })
  restoreAnnouncement(@Param('id', ParseIntPipe) id: number, @CurrentUserId() adminId: number) {
    return this.reportsService.restoreAnnouncement(id, adminId);
  }

  @Delete('admin/announcements/:id')
  @ApiOperation({ summary: 'Logically delete an active or hidden announcement' })
  @ApiResponse({ status: 200, description: 'Announcement deleted and reports marked reviewed' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 409, description: 'Final status (Returned, Closed, Archived)' })
  deleteAnnouncement(@Param('id', ParseIntPipe) id: number, @CurrentUserId() adminId: number) {
    return this.reportsService.deleteAnnouncement(id, adminId);
  }

  @Patch('admin/users/:id/block')
  @ApiOperation({ summary: 'Block an abusive user account and immediately invalidate their session' })
  @ApiResponse({ status: 200, description: 'User account suspended' })
  @ApiResponse({ status: 400, description: 'Cannot block your own account' })
  @ApiResponse({ status: 403, description: 'Cannot block an administrator account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  blockUser(@Param('id', ParseIntPipe) id: number, @CurrentUserId() actingAdminId: number) {
    return this.reportsService.blockUser(id, actingAdminId);
  }

  @Patch('admin/users/:id/unblock')
  @ApiOperation({ summary: 'Unblock a user account' })
  @ApiResponse({ status: 200, description: 'User account active again' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'The account is not blocked' })
  unblockUser(@Param('id', ParseIntPipe) id: number, @CurrentUserId() actingAdminId: number) {
    return this.reportsService.unblockUser(id, actingAdminId);
  }

  @Delete('admin/:id')
  @ApiOperation({ summary: 'Dismiss a pending report' })
  @ApiResponse({ status: 200, description: 'Report dismissed' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  dismissReport(@Param('id', ParseIntPipe) id: number) {
    return this.reportsService.dismissReport(id);
  }
}
