import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRegionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
export class UpdateRegionDto extends PartialType(CreateRegionDto) {}

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  /** Turkish plate codes run 1-81; the range is a real constraint, not a guess. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(81)
  plateCode!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  regionId!: number;
}
export class UpdateCityDto extends PartialType(CreateCityDto) {}

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cityId!: number;

  // Validated as real coordinates rather than plain numbers: the geographic
  // sales map plots these directly, and a swapped or out-of-range pair puts a
  // branch in the sea with no error anywhere.
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
