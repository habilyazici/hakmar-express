import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
} from 'class-validator';
import { SalesGranularity, SalesMetric } from '../../sales';

const METRIC_VALUES = Object.values(SalesMetric);

export class TrendQueryDto {
  @IsEnum(SalesGranularity)
  granularity!: SalesGranularity;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(METRIC_VALUES, { each: true })
  // Accepts both ?metrics=sales,profit (CSV, what our own frontend sends)
  // and ?metrics=sales&metrics=profit (axios's default array serialization,
  // and the more natural way to call this from `params: { metrics: [...] }`)
  // — qs/Express already parses the latter into a real array, so splitting
  // on ',' unconditionally crashed with a 500 instead of a clean 400.
  //
  // Deduplicated because a metric asked for twice was answered twice: the
  // SELECT list gained two columns under one alias, and the cumulative mode
  // added the same value to its running total once per repeat, reporting
  // double. Our own UI cannot produce that, but the endpoint is public to
  // any caller and should not have two answers.
  @Transform(({ value }: { value: string | string[] }) => [
    ...new Set(Array.isArray(value) ? value : value.split(',')),
  ])
  metrics!: SalesMetric[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: string }) => value === 'true')
  cumulative?: boolean;
}
