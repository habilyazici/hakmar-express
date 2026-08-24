import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * These were originally one shared DTO carrying both `days` and `limit`,
 * which meant every KDS route advertised — and silently accepted — a
 * parameter it does not read. ?days=7 on demand-forecast validated, changed
 * nothing, and still produced a distinct cache key. Each route now takes
 * only what it actually honours, so an inapplicable parameter is rejected
 * by forbidNonWhitelisted instead of quietly ignored.
 */

/** ABC analysis: revenue is summed over a lookback window. */
export class AbcQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number = 90;
}

/** Demand forecast and RFM segmentation: ranked lists, capped by size. */
export class TopNQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;
}
