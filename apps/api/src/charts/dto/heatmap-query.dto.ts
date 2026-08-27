import type { HeatmapType as HeatmapTypeContract } from '@hakmar/contracts';
import { IsEnum, IsOptional } from 'class-validator';
import type { Assert, SameMembers, ValuesOf } from '../../common';
import { SalesMetric } from '../../sales';

export enum HeatmapType {
  WEEKDAY_HOUR = 'weekday-hour',
  YEAR_MONTH = 'year-month',
  REGION_CATEGORY = 'region-category',
}

/**
 * The three axis pairings travel in a query string and the web offers them
 * as a dropdown, so they are vocabulary in the same sense the sales enums
 * are — checked against the contract in both directions rather than agreeing
 * by coincidence.
 */
export type _HeatmapTypeMatches = Assert<
  SameMembers<ValuesOf<HeatmapType>, HeatmapTypeContract>
>;

export class HeatmapQueryDto {
  @IsEnum(HeatmapType)
  type!: HeatmapType;

  /** Ignored for region-category, which is always avg unit cost. */
  @IsOptional()
  @IsEnum(SalesMetric)
  metric?: SalesMetric = SalesMetric.SALES;
}
