import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../generated/prisma/enums';

/**
 * Deliberately not just a length check. A password that clears MinLength(12)
 * but is twelve identical characters is not meaningfully stronger than a
 * short one, so this also requires a mix of character classes.
 */
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{12,128}$/;
const PASSWORD_MESSAGE =
  'password must be 12-128 characters and include a lowercase letter, an uppercase letter and a digit.';

export class CreateUserDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{3,40}$/, {
    message:
      'username must be 3-40 characters, letters, digits, dot, underscore or hyphen only.',
  })
  username!: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Username and password are absent on purpose. The username is the account's
 * stable identity, and the password has its own endpoint so that changing it
 * can revoke the user's sessions — folding it in here would let a password
 * change slip through as an ordinary field edit with no session cleanup.
 */
class MutableUserFields {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateUserDto extends PartialType(MutableUserFields) {}

export class SetPasswordDto {
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;
}

export class ChangeOwnPasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword!: string;
}
