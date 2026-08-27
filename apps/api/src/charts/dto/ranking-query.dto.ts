import type { RankingMetric as RankingMetricContract } from '@hakmar/contracts';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Assert, SameMembers, ValuesOf } from '../../common';
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

/**
 * The one query-string vocabulary that was in the contract, offered by the
 * web as a dropdown, and joined to this list by nothing at all.
 *
 * Being a subset is exactly what made it worth checking: SalesMetric is
 * asserted against the contract in sales.model.ts, but which three of the
 * five ranking exposes was restated here and in @hakmar/contracts
 * independently. Narrow this list without narrowing that one and the web
 * keeps offering an option the API answers with a 400 — the failure every
 * other one of these assertions exists to prevent.
 */
export type _RankingMetricMatches = Assert<
  SameMembers<ValuesOf<RankingMetric>, RankingMetricContract>
>;

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
