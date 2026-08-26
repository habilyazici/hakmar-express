import { PartialType } from '@nestjs/mapped-types';
import type {
  ChangeOwnPasswordBody,
  CreateUserBody,
  SetPasswordBody,
  UpdateUserBody,
} from '@hakmar/contracts';
import { Role, type Assert, type SameMembers } from '../../common';
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

/**
 * The validators above are this API's own; the shapes they validate are the
 * contract's. Asserting both — the key set and the structure — catches a
 * field added on one side alone, which `forbidNonWhitelisted` would
 * otherwise turn into a 400 the form has to explain.
 *
 * `isActive` is the reason this exists: CreateUserDto has had it since it
 * was written, and the first draft of the contract did not, with nothing to
 * say so.
 */
export type _CreateUserKeys = Assert<
  SameMembers<keyof CreateUserDto, keyof CreateUserBody>
>;
export type _CreateUserShape = Assert<
  SameMembers<CreateUserDto, CreateUserBody>
>;

export type _UpdateUserKeys = Assert<
  SameMembers<keyof UpdateUserDto, keyof UpdateUserBody>
>;
export type _UpdateUserShape = Assert<
  SameMembers<UpdateUserDto, UpdateUserBody>
>;

export type _SetPasswordShape = Assert<
  SameMembers<SetPasswordDto, SetPasswordBody>
>;
export type _ChangeOwnPasswordShape = Assert<
  SameMembers<ChangeOwnPasswordDto, ChangeOwnPasswordBody>
>;
