import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CredentialsDto, EmailDto, ResetPasswordDto, TokenQueryDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid email domain or weak password' })
  @ApiResponse({ status: 409, description: 'Account already exists' })
  register(@Body() body: CredentialsDto) {
    return this.authService.register(body);
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify email address via token link' })
  @ApiResponse({ status: 200, description: 'Account verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  verify(@Query() query: TokenQueryDto) {
    return this.authService.verify(query.token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend verification email for unverified accounts' })
  @ApiResponse({ status: 200, description: 'Verification email sent if unverified account exists' })
  resend(@Body() body: EmailDto) {
    return this.authService.resend(body.email);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({ status: 200, description: 'Signed in, returns session token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or unverified account' })
  login(@Body() body: CredentialsDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  forgot(@Body() body: EmailDto) {
    return this.authService.forgot(body.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  reset(@Body() body: ResetPasswordDto) {
    return this.authService.reset(body.token, body.password);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out' })
  @ApiResponse({ status: 204, description: 'Signed out' })
  logout(): void {}
}
