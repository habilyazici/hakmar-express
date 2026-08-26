import type { LoginBody } from '@hakmar/contracts';
import type { Assert, SameMembers } from '../../common';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export type _LoginShape = Assert<SameMembers<LoginDto, LoginBody>>;
