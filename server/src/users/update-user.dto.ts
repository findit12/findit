import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Remove spaces at the beginning and end of a name.
const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Body of PUT /api/users/:id. The email, the password and the role cannot be changed here.
// Both fields are optional: what is not sent is kept (same pattern as the Lab 6 example).
class UserNamesDto {
  @ApiProperty({ example: 'Elea', maxLength: 100 })
  @Trim()
  @MaxLength(100, { message: 'The first name cannot be more than 100 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Enter your first name.' })
  firstName!: string;

  @ApiProperty({ example: 'Schom', maxLength: 100 })
  @Trim()
  @MaxLength(100, { message: 'The last name cannot be more than 100 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'Enter your last name.' })
  lastName!: string;
}

export class UpdateUserDto extends PartialType(UserNamesDto) {}
