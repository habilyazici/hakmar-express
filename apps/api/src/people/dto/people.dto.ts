import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  // The column is CHAR(1) with no constraint behind it; whitelisting here is
  // the only thing stopping an arbitrary single character becoming a "gender".
  @IsOptional()
  @IsIn(['M', 'F', 'O'])
  gender?: string;
}
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CreateCashierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId!: number;
}
export class UpdateCashierDto extends PartialType(CreateCashierDto) {}
