import { IsEnum, IsOptional } from 'class-validator';
import { TrendMetric } from './trend-query.dto';

export enum HeatmapType {
  WEEKDAY_HOUR = 'weekday-hour',
  YEAR_MONTH = 'year-month',
  REGION_CATEGORY = 'region-category',
}

export class HeatmapQueryDto {
  @IsEnum(HeatmapType)
  type!: HeatmapType;

  /** Ignored for region-category, which is always avg unit cost. */
  @IsOptional()
  @IsEnum(TrendMetric)
  metric?: TrendMetric = TrendMetric.SALES;
}
