import { IsEnum, IsOptional } from 'class-validator';
import { SalesMetric } from '../../sales';

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
  @IsEnum(SalesMetric)
  metric?: SalesMetric = SalesMetric.SALES;
}
