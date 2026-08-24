import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateSubcategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;
}
export class UpdateSubcategoryDto extends PartialType(CreateSubcategoryDto) {}

export class CreateBrandDto {
  /**
   * Brand's primary key is a caller-supplied string, so unlike every other
   * entity here the client chooses the identity. Constrained to a short
   * uppercase alphanumeric code to keep it usable in URLs and to stop
   * whitespace or punctuation ending up in a primary key.
   */
  @IsString()
  @Matches(/^[A-Z0-9]{2,16}$/, {
    message: 'code must be 2-16 uppercase letters or digits.',
  })
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;
}

/**
 * `code` is deliberately absent: it is the primary key, and changing it would
 * orphan every product pointing at the old value. Replacing a brand code is a
 * create-plus-migrate operation, not a field edit. Because the global
 * ValidationPipe runs with forbidNonWhitelisted, sending `code` to PATCH is
 * rejected outright rather than silently ignored.
 */
class BrandMutableFields {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;
}
export class UpdateBrandDto extends PartialType(BrandMutableFields) {}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9]{2,16}$/)
  brandCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  subcategoryId!: number;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}
