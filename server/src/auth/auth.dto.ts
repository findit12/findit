import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CredentialsDto {
  @ApiProperty({ example: 'student@your-school.edu', description: 'School email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123', description: 'Account password (at least 8 chars and a number)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters and include a number.' })
  @Matches(/\d/, { message: 'Password must be at least 8 characters and include a number.' })
  password!: string;

  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: true, description: 'GDPR consent' })
  @IsOptional()
  @IsBoolean()
  gdprConsent?: boolean;
}

export class EmailDto {
  @ApiProperty({ example: 'student@your-school.edu', description: 'School email address' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token from email' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NewPassword123', description: 'New account password' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters and include a number.' })
  @Matches(/\d/, { message: 'Password must be at least 8 characters and include a number.' })
  password!: string;
}

export class TokenQueryDto {
  @ApiProperty({ description: 'Verification token from email' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'student@your-school.edu', description: 'School email address' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Password123', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

