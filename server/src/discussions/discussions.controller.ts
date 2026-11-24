import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDiscussionDto } from './create-discussion.dto';
import { CreateMessageDto } from './create-message.dto';
import { UpdateDiscussionDto } from './update-discussion.dto';
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

  @Get(':id')
  @ApiOperation({ summary: 'Read one of my discussions with its proof' })
  @ApiResponse({ status: 200, description: 'The discussion' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  findOne(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Correct the proof of a discussion (only the person who started it)' })
  @ApiResponse({ status: 200, description: 'The updated discussion' })
  @ApiResponse({ status: 400, description: 'Missing proof' })
  @ApiResponse({ status: 403, description: 'Not the person who started the discussion' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  @ApiResponse({ status: 409, description: 'Announcement no longer available' })
  updateProof(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDiscussionDto) {
    return this.service.updateProof(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a discussion and its messages (only the person who started it)' })
  @ApiResponse({ status: 204, description: 'Discussion deleted' })
  @ApiResponse({ status: 403, description: 'Not the person who started the discussion' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  remove(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, userId);
  }

  @Get(':id/messages/:messageId')
  @ApiOperation({ summary: 'Read one message' })
  @ApiResponse({ status: 200, description: 'The message' })
  @ApiResponse({ status: 403, description: 'Not a participant' })
  @ApiResponse({ status: 404, description: 'Discussion or message not found' })
  getMessage(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.service.getMessage(id, messageId, userId);
  }

  @Put(':id/messages/:messageId')
  @ApiOperation({ summary: 'Change one of my messages while it is unread' })
  @ApiResponse({ status: 200, description: 'The updated message' })
  @ApiResponse({ status: 403, description: 'Not your message' })
  @ApiResponse({ status: 404, description: 'Discussion or message not found' })
  @ApiResponse({ status: 409, description: 'The message has already been read' })
  updateMessage(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.service.updateMessage(id, messageId, userId, dto);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one of my messages while it is unread' })
  @ApiResponse({ status: 204, description: 'Message deleted' })
  @ApiResponse({ status: 403, description: 'Not your message' })
  @ApiResponse({ status: 404, description: 'Discussion or message not found' })
  @ApiResponse({ status: 409, description: 'The message has already been read' })
  removeMessage(
    @CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.service.removeMessage(id, messageId, userId);
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
