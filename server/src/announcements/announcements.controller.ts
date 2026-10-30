
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';
import { AnnouncementsService } from './announcements.service';
import { ListAnnouncementsQueryDto } from './announcements-query.dto';
import { CreateDiscussionDto } from '../discussions/create-discussion.dto';
import { CreateMessageDto } from '../discussions/create-message.dto';

// Multer accepts more than the rules allow, so that checkPhotos() can answer with a clear
// message ("You can add up to 4 photos.", "... is too large") instead of a generic error.
const UPLOAD_LIMITS = { files: 10, fileSize: 20 * 1024 * 1024 };

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('photos', UPLOAD_LIMITS.files, { limits: UPLOAD_LIMITS }))
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

  // SCRUM-22: public gallery, one page at a time (?page=1&limit=20).
  @Get()
  @ApiOperation({ summary: 'Browse the public announcements, newest first (Available found and Open lost only)' })
  @ApiResponse({ status: 200, description: 'A page of announcements and the pagination data' })
  @ApiResponse({ status: 400, description: 'Invalid page or limit' })
  findAll(@Query() query: ListAnnouncementsQueryDto) {
    return this.service.findPublicPage(query);
  }

  // The "mine" routes are written before ":id", otherwise "mine" would be read as an id.
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my announcements (with their hidden detail)' })
  @ApiResponse({ status: 200, description: 'My announcements, newest first, deleted ones excluded' })
  findMine(@CurrentUserId() userId: number) {
    return this.service.findMine(userId);
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read one of my announcements, for the edit page' })
  @ApiResponse({ status: 403, description: 'Not the author' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  findMineById(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findMineById(userId, id);
  }

  // SCRUM-31: count unread messages for the signed-in user.
// SCRUM-31: list conversations for the signed-in user.
@Get('discussions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'List my conversations' })
@ApiResponse({ status: 200, description: 'User conversations' })
@ApiResponse({ status: 401, description: 'Not signed in' })
getDiscussions(@CurrentUserId() userId: number) {
  return this.service.getDiscussions(userId);
}
  @Get('discussions/unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the number of unread conversation messages' })
  @ApiResponse({ status: 200, description: 'Unread message count' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  getUnreadCount(@CurrentUserId() userId: number) {
    return this.service.getUnreadCount(userId);
  }

  // SCRUM-31: retrieve messages in a discussion.
  @Get('discussions/:discussionId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation messages' })
  @ApiResponse({ status: 403, description: 'Not a discussion participant' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  getMessages(
    @CurrentUserId() userId: number,
    @Param('discussionId', ParseIntPipe) discussionId: number,
  ) {
    return this.service.getMessages(discussionId, userId);
  }

  // SCRUM-31: send a message in a discussion.
  @Post('discussions/:discussionId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid message content' })
  @ApiResponse({ status: 403, description: 'Not a discussion participant' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  sendMessage(
    @CurrentUserId() userId: number,
    @Param('discussionId', ParseIntPipe) discussionId: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.service.sendMessage(discussionId, userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit my announcement, or close my lost announcement with status "Closed" (author only)' })
  @ApiResponse({ status: 200, description: 'Announcement updated' })
  @ApiResponse({ status: 403, description: 'Not the author' })
  @ApiResponse({ status: 409, description: 'Final status, or closing a found announcement' })
  update(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my announcement (logical deletion, author only)' })
  @ApiResponse({ status: 204, description: 'Announcement deleted' })
  @ApiResponse({ status: 403, description: 'Not the author' })
  @ApiResponse({ status: 409, description: 'The announcement can no longer be changed' })
  remove(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(userId, id);
  }

  // SCRUM-30: start a discussion with proof of ownership.
  @Post(':id/discussions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a discussion about a found object with proof of ownership' })
  @ApiResponse({ status: 201, description: 'Discussion started successfully' })
  @ApiResponse({ status: 400, description: 'Missing or invalid proof description' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 403, description: 'Cannot claim your own announcement' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 409, description: 'Announcement is no longer available' })
  startDiscussion(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDiscussionDto,
  ) {
    return this.service.startDiscussion(id, userId, dto);
  }

  @Get(':id/matches')
  @ApiOperation({ summary: 'Get public matching announcements for an announcement' })
  @ApiResponse({ status: 200, description: 'Matching public announcements, ordered by score' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  findPublicMatches(@Param('id', ParseIntPipe) id: number) {
    return this.service.findPublicMatches(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read an announcement (the hidden detail is never included)' })
  @ApiResponse({ status: 200, description: 'Announcement details' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findPublic(id);
  }
}