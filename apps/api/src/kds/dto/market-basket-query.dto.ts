import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MarketBasketQueryDto {
  /** Min(1) like every other id in this API: ids are positive, and rejecting
   *  a zero or negative one is a 400 rather than an empty basket that reads
   *  as "this product has no co-purchases". */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
