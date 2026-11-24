import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDiscussionDto } from './create-discussion.dto';
import { CreateMessageDto } from './create-message.dto';
import { DiscussionsService } from './discussions.service';

// SCRUM-30 to SCRUM-32: the routes of the SDD (section 5), "/api/conversations".
// Every route needs a signed-in user. "unread-count" is written before ":id".
@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class DiscussionsController {
  constructor(private readonly service: DiscussionsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a discussion about an announcement, with a proof' })
  @ApiResponse({ status: 201, description: 'Discussion started, the author is emailed' })
  @ApiResponse({ status: 400, description: 'Missing proof or announcement' })
  @ApiResponse({ status: 403, description: 'Your own announcement' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 409, description: 'Announcement no longer available, object at the reception, or discussion already started' })
  start(@CurrentUserId() userId: number, @Body() dto: CreateDiscussionDto) {
    return this.service.start(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my discussions with their unread counts' })
  @ApiResponse({ status: 200, description: 'My discussions, newest first' })
  findMine(@CurrentUserId() userId: number) {
    return this.service.findMine(userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Number of unread messages in all my discussions' })
  @ApiResponse({ status: 200, description: '{ unreadCount }' })
  countUnread(@CurrentUserId() userId: number) {
    return this.service.countUnread(userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Read the proof and the messages of a discussion (marks them as read)' })
  @ApiResponse({ status: 200, description: 'The proof and the messages, oldest first' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  getMessages(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.getMessages(id, userId);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  sendMessage(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateMessageDto) {
    return this.service.sendMessage(id, userId, dto);
  }

  @Post(':id/return')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark the object as returned ("Confirm handover" or "Mark as recovered")' })
  @ApiResponse({ status: 200, description: 'Announcement Returned' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 409, description: 'Announcement no longer available, or object at the reception' })
  markReturned(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.markReturned(id, userId);
  }
}
