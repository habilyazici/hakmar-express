import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
} from 'class-validator';

export enum TrendGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  WEEKDAY = 'weekday',
  HOUR = 'hour',
}

export enum TrendMetric {
  SALES = 'sales',
  COST = 'cost',
  PROFIT = 'profit',
  QUANTITY = 'quantity',
  ORDERS = 'orders',
}

const METRIC_VALUES = Object.values(TrendMetric);

export class TrendQueryDto {
  @IsEnum(TrendGranularity)
  granularity: TrendGranularity;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(METRIC_VALUES, { each: true })
  // Accepts both ?metrics=sales,profit (CSV, what our own frontend sends)
  // and ?metrics=sales&metrics=profit (axios's default array serialization,
  // and the more natural way to call this from `params: { metrics: [...] }`)
  // — qs/Express already parses the latter into a real array, so splitting
  // on ',' unconditionally crashed with a 500 instead of a clean 400.
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : value.split(','),
  )
  metrics: TrendMetric[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: string }) => value === 'true')
  cumulative?: boolean;
}
