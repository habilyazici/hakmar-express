import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SalesDimension, SalesMetric } from '../../sales';

/**
 * Ranking exposes three of the five sales metrics. Ordering branches by
 * "orders" or "cost" would be meaningful, but it has never been part of
 * this endpoint's contract — pinning the list here means widening it stays
 * a deliberate edit rather than something that follows silently from
 * SalesMetric gaining a member.
 */
export const RANKING_METRICS = [
  SalesMetric.SALES,
  SalesMetric.QUANTITY,
  SalesMetric.PROFIT,
] as const;

export type RankingMetric = (typeof RANKING_METRICS)[number];

export class RankingQueryDto {
  @IsEnum(SalesDimension)
  dimension!: SalesDimension;

  @IsIn(RANKING_METRICS)
  metric!: RankingMetric;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
