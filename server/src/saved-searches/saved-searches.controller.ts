import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSavedSearchDto } from './create-saved-search.dto';
import { SavedSearchesService } from './saved-searches.service';

// SCRUM-27: every route needs a signed-in user.
@ApiTags('saved searches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saved-searches')
export class SavedSearchesController {
  constructor(private readonly service: SavedSearchesService) {}

  @Post()
  @ApiOperation({ summary: 'Save the current search (filters + keyword) to get an email for new matches' })
  @ApiResponse({ status: 201, description: 'The saved search' })
  @ApiResponse({ status: 400, description: 'Empty search, or invalid filter' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  create(@CurrentUserId() userId: number, @Body() dto: CreateSavedSearchDto) {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my saved searches, newest first' })
  @ApiResponse({ status: 200, description: 'My saved searches' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  findMine(@CurrentUserId() userId: number) {
    return this.service.findMine(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one of my saved searches' })
  @ApiResponse({ status: 200, description: 'The saved search' })
  @ApiResponse({ status: 403, description: 'It belongs to someone else' })
  @ApiResponse({ status: 404, description: 'Unknown saved search' })
  findOne(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace one of my saved searches (a filter that is not sent is cleared)' })
  @ApiResponse({ status: 200, description: 'The updated saved search' })
  @ApiResponse({ status: 400, description: 'Empty search, or invalid filter' })
  @ApiResponse({ status: 403, description: 'It belongs to someone else' })
  @ApiResponse({ status: 404, description: 'Unknown saved search' })
  update(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateSavedSearchDto) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one of my saved searches' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'It belongs to someone else' })
  @ApiResponse({ status: 404, description: 'Unknown saved search' })
  remove(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(userId, id);
  }
}
