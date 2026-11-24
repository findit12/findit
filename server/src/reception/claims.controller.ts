import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateClaimDto, UpdateClaimDto } from './claim.dto';
import { ClaimsService } from './claims.service';

// SCRUM-53 (FR-16): "Claim at reception". Every route needs a signed-in user.
@ApiTags('claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ClaimsController {
  constructor(private readonly service: ClaimsService) {}

  @Post('announcements/:id/claims')
  @ApiOperation({ summary: 'Claim an object held at the reception, with a proof' })
  @ApiResponse({ status: 201, description: 'Claim submitted (pending)' })
  @ApiResponse({ status: 400, description: 'Missing proof' })
  @ApiResponse({ status: 403, description: 'Your own announcement' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 409, description: 'Not at the reception, not available, or already claimed' })
  create(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateClaimDto) {
    return this.service.create(userId, id, dto);
  }

  @Get('claims')
  @ApiOperation({ summary: 'List my claims' })
  @ApiResponse({ status: 200, description: 'My claims, newest first' })
  findMine(@CurrentUserId() userId: number) {
    return this.service.findMine(userId);
  }

  @Get('claims/:id')
  @ApiOperation({ summary: 'Read one of my claims' })
  @ApiResponse({ status: 200, description: 'The claim' })
  @ApiResponse({ status: 403, description: 'Not your claim' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  findOne(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(userId, id);
  }

  @Put('claims/:id')
  @ApiOperation({ summary: 'Change the proof of one of my pending claims' })
  @ApiResponse({ status: 200, description: 'The updated claim' })
  @ApiResponse({ status: 403, description: 'Not your claim' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  @ApiResponse({ status: 409, description: 'Already handled by the staff' })
  update(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClaimDto) {
    return this.service.update(userId, id, dto);
  }

  @Delete('claims/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Withdraw one of my pending claims' })
  @ApiResponse({ status: 204, description: 'Claim deleted' })
  @ApiResponse({ status: 403, description: 'Not your claim' })
  @ApiResponse({ status: 404, description: 'Claim not found' })
  @ApiResponse({ status: 409, description: 'Already handled by the staff' })
  remove(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(userId, id);
  }
}
