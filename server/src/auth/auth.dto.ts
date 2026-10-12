import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Removes the spaces before and after a text, so that "   " counts as empty.
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CredentialsDto {
  @ApiProperty({ example: 'student@your-school.edu', description: 'School email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123', description: 'Account password (at least 8 chars and a number)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters and include a number.' })
  @Matches(/\d/, { message: 'Password must be at least 8 characters and include a number.' })
  password!: string;

  // FR-01: first name, last name and GDPR consent are required to create an account.
  @ApiProperty({ example: 'Elea', description: 'First name' })
  @Transform(trim)
  @IsString()
  @MaxLength(60, { message: 'The first name must be 60 characters or fewer.' })
  @IsNotEmpty({ message: 'Enter your first name.' })
  firstName!: string;

  @ApiProperty({ example: 'Schom', description: 'Last name' })
  @Transform(trim)
  @IsString()
  @MaxLength(60, { message: 'The last name must be 60 characters or fewer.' })
  @IsNotEmpty({ message: 'Enter your last name.' })
  lastName!: string;

  @ApiProperty({ example: true, description: 'GDPR consent: must be true to create an account' })
  @Equals(true, { message: 'You must accept the privacy policy to create an account.' })
  gdprConsent!: boolean;
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