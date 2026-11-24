import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClaimsService } from './claims.service';

// SCRUM-53 (FR-16, FR-19): the reception claims queue (AG Grid table). Administrators only.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/claims')
export class AdminClaimsController {
  constructor(private readonly service: ClaimsService) {}

  @Get()
  @ApiOperation({ summary: 'Pending reception claims, with the hidden detail to compare with the proof' })
  @ApiResponse({ status: 200, description: 'Pending claims, oldest first' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Administrator access required' })
  list() {
    return this.service.listPending();
  }

  @Post(':id/confirm-handover')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm the handover: Returned, return date recorded, both people emailed' })
  @ApiResponse({ status: 200, description: 'Handover confirmed' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  @ApiResponse({ status: 409, description: 'Claim already handled, or announcement no longer available' })
  confirm(@CurrentUserId() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.confirm(adminId, id);
  }

  @Post(':id/decline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Decline the claim: the claimant is emailed, the announcement stays Available' })
  @ApiResponse({ status: 200, description: 'Claim declined' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  @ApiResponse({ status: 409, description: 'Claim already handled' })
  decline(@CurrentUserId() adminId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.decline(adminId, id);
  }
}
