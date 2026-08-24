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
  @Transform(({ value }: { value: string }) => value.split(','))
  metrics: TrendMetric[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: string }) => value === 'true')
  cumulative?: boolean;
}
