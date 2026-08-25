import type {
  DiscountScope as DiscountScopeContract,
  ForecastMetric as ForecastMetricContract,
  MapType as MapTypeContract,
} from '@hakmar/contracts';
import type { Assert, SameMembers, ValuesOf } from '../../common';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export type _MapTypeMatches = Assert<
  SameMembers<ValuesOf<MapType>, MapTypeContract>
>;
export type _MetricMatches = Assert<
  SameMembers<ValuesOf<ForecastMetric>, ForecastMetricContract>
>;
export type _ScopeMatches = Assert<
  SameMembers<ValuesOf<DiscountScope>, DiscountScopeContract>
>;

export enum MapType {
  CITY = 'city',
  REGION = 'region',
}

export enum ForecastMetric {
  QUANTITY = 'quantity',
  SALES = 'sales',
  COST = 'cost',
  PROFIT = 'profit',
}

export enum DiscountScope {
  ALL = 'all',
  CATEGORY = 'category',
  PRODUCT = 'product',
}

export class ForecastRequestDto {
  @IsOptional()
  @IsEnum(MapType)
  mapType?: MapType = MapType.CITY;

  /** Which metric drives the map colouring; all four are always returned. */
  @IsOptional()
  @IsEnum(ForecastMetric)
  metric?: ForecastMetric = ForecastMetric.SALES;

  /** Forecast horizon. Capped at 24: beyond two years a trend fitted on
   *  monthly history stops being informative. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  periodMonths?: number = 6;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(90)
  discountPct?: number = 0;

  @IsOptional()
  @IsEnum(DiscountScope)
  discountScope?: DiscountScope = DiscountScope.ALL;

  /**
   * Required when the discount is scoped to a category or product, because
   * the simulation reads that target's real share of revenue from the
   * database rather than assuming one.
   */
  @ValidateIf((o: ForecastRequestDto) => o.discountScope !== DiscountScope.ALL)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  discountTargetId?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(-90)
  @Max(200)
  costChangePct?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @Min(-90)
  @Max(200)
  purchasingPowerPct?: number = 0;
}
