import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { AuthService } from '../auth/auth.service';
import { CredentialsDto } from '../auth/auth.dto';
import { CurrentUserId } from '../auth/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserDto } from './update-user.dto';
import { UsersService } from './users.service';

// Lab 6: "/api/users", the CRUD of the User entity.
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly auth: AuthService,
  ) {}

  // Same as POST /api/auth/register: creating a user is registering.
  @Post()
  @ApiOperation({ summary: 'Create an account (same as POST /api/auth/register)' })
  @ApiResponse({ status: 201, description: 'Account created, a verification email is sent' })
  @ApiResponse({ status: 400, description: 'Invalid email domain, weak password, missing name or no GDPR consent' })
  @ApiResponse({ status: 409, description: 'Account already exists' })
  create(@Body() dto: CredentialsDto) {
    return this.auth.register(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the accounts (administrator only)' })
  @ApiResponse({ status: 200, description: 'The accounts' })
  @ApiResponse({ status: 403, description: 'Administrator access required' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Read an account (mine, or any account for an administrator)' })
  @ApiResponse({ status: 200, description: 'The account, without the password' })
  @ApiResponse({ status: 403, description: 'Not your account' })
  @ApiResponse({ status: 404, description: 'Unknown account' })
  findOne(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(userId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the first and last name of an account' })
  @ApiResponse({ status: 200, description: 'The updated account' })
  @ApiResponse({ status: 400, description: 'Missing name' })
  @ApiResponse({ status: 403, description: 'Not your account' })
  @ApiResponse({ status: 404, description: 'Unknown account' })
  update(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an account (FR-25): the personal data are erased' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 403, description: 'Not your account' })
  @ApiResponse({ status: 404, description: 'Unknown account' })
  remove(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(userId, id);
  }
}
