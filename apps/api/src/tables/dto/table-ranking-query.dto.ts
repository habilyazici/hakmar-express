import type { TableEntity as TableEntityContract } from '@hakmar/contracts';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Assert, SameMembers, ValuesOf } from '../../common';

export enum TableEntity {
  CASHIER = 'cashier',
  BRANCH = 'branch',
  PRODUCT = 'product',
  CUSTOMER = 'customer',
}

/**
 * Which entity a caller may rank is vocabulary the web has to know, so it
 * lives in the contract and is checked here in both directions. The web used
 * to keep its own hand-written copy of this list.
 */
export type _TableEntityMatches = Assert<
  SameMembers<ValuesOf<TableEntity>, TableEntityContract>
>;

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
