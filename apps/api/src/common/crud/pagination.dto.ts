import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  /**
   * Free-text filter. Which columns it matches is decided per entity by the
   * service, never by the caller — the legacy app's generic engine let the
   * client name the column, which is how it ended up with an endpoint that
   * would filter on anything at all.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export type { Page } from '@hakmar/contracts';
