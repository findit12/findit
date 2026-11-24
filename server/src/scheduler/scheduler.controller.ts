import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchedulerService } from './scheduler.service';

// SCRUM-51: lets an administrator run the daily job now (TC-ADMIN-04 asks to run it twice).
@ApiTags('Scheduler')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Post('run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run the daily job now: archive the 90-day announcements, send the reminders' })
  @ApiResponse({ status: 200, description: 'How many announcements were archived and how many reminders were sent' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Administrator access required' })
  run() {
    return this.scheduler.run();
  }
}
