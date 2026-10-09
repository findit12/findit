import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AnnouncementsService } from './announcements.service';
import { CreateFoundAnnouncementDto } from './announcements.dto';

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(
    private readonly service: AnnouncementsService,
    private readonly jwt: JwtService,
  ) {}

  private extractUserId(authHeader?: string): number {
    if (!authHeader) {
      throw new UnauthorizedException('Authentication required.');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException('Authentication required.');
    }
    try {
      const payload = this.jwt.verify(token);
      const sub = Number(payload.sub);
      if (!sub) throw new Error();
      return sub;
    } catch {
      throw new UnauthorizedException('Authentication required.');
    }
  }

  @Post('found')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a found item announcement' })
  @ApiResponse({ status: 201, description: 'Announcement created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Headers('authorization') auth: string,
    @Body() dto: CreateFoundAnnouncementDto,
  ) {
    const userId = this.extractUserId(auth);
    return this.service.create(userId, dto.title, dto.description);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a found item announcement by ID' })
  @ApiResponse({ status: 200, description: 'Announcement details' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  find(@Param('id') id: string) {
    return this.service.find(Number(id));
  }
}
