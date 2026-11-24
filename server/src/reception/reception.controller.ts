import { Controller, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReceptionService } from './reception.service';

// SCRUM-52 (FR-14, SDD section 5): POST /api/announcements/{id}/drop-off.
@ApiTags('reception')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class ReceptionController {
  constructor(private readonly service: ReceptionService) {}

  @Post(':id/drop-off')
  @HttpCode(200)
  @ApiOperation({ summary: 'The finder dropped the object at the reception (irreversible)' })
  @ApiResponse({ status: 200, description: 'Location is now reception, discussions closed, owners notified' })
  @ApiResponse({ status: 403, description: 'Not the finder' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 409, description: 'Not a found announcement, not Available, or already at the reception' })
  dropOff(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.dropOff(userId, id);
  }
}
