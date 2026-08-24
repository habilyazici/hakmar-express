import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum TableEntity {
  CASHIER = 'cashier',
  BRANCH = 'branch',
  PRODUCT = 'product',
  CUSTOMER = 'customer',
}

export class TableRankingQueryDto {
  @IsEnum(TableEntity)
  entity!: TableEntity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;
}
