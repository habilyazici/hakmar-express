import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum RankingDimension {
  BRAND = 'brand',
  CITY = 'city',
  BRANCH = 'branch',
  REGION = 'region',
  CATEGORY = 'category',
  CASHIER = 'cashier',
  PRODUCT = 'product',
}

export enum RankingMetric {
  SALES = 'sales',
  QUANTITY = 'quantity',
  PROFIT = 'profit',
}

export class RankingQueryDto {
  @IsEnum(RankingDimension)
  dimension!: RankingDimension;

  @IsEnum(RankingMetric)
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
