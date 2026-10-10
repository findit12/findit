import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAnnouncementDto } from './announcements.dto';
import { AnnouncementsService } from './announcements.service';

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('photos', 4))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Declare a found object (1 to 4 photos) or a lost object (0 to 4 photos)' })
  @ApiResponse({ status: 201, description: 'Announcement created (Available if found, Open if lost)' })
  @ApiResponse({ status: 400, description: 'Missing or invalid field, or invalid photos' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  create(
    @CurrentUserId() userId: number,
    @Body() dto: CreateAnnouncementDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.service.create(userId, dto, files);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an announcement (the hidden detail is never included)' })
  @ApiResponse({ status: 200, description: 'Announcement details' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findPublic(id);
  }
}
