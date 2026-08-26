import type {
  SalesDimension as SalesDimensionContract,
  SalesGranularity as SalesGranularityContract,
  SalesMetric as SalesMetricContract,
} from '@hakmar/contracts';
import type { Assert, SameMembers, ValuesOf } from '../common';

/**
 * The vocabulary of the sales read model.
 *
 * These three enums are the words every analytics module is allowed to use
 * when it asks a question about sales — what to measure, over which time
 * bucket, broken down by what. They live here rather than in whichever
 * module happened to need them first (they started life inside Charts'
 * DTOs) because Dashboard, Tables and Spatial Forecast ask the same
 * questions of the same two tables, and a metric that means one thing on
 * /charts/trend and another on /tables/ranking is a reporting bug nobody
 * finds until someone compares two screens.
 */

export enum SalesMetric {
  SALES = 'sales',
  COST = 'cost',
  PROFIT = 'profit',
  QUANTITY = 'quantity',
  ORDERS = 'orders',
}

export enum SalesGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  WEEKDAY = 'weekday',
  HOUR = 'hour',
}

export enum SalesDimension {
  BRAND = 'brand',
  CITY = 'city',
  BRANCH = 'branch',
  REGION = 'region',
  CATEGORY = 'category',
  CASHIER = 'cashier',
  PRODUCT = 'product',
}

/**
 * Each of these asserts that an enum here and the union the web consumes
 * describe the same set of strings, in both directions. Add a metric to one
 * side only and the build fails, naming the member and the side missing it
 * — instead of the web offering a dropdown option the API answers with a
 * 400, which is how the two drifted apart before there was anything joining
 * them. Role and the three forecast enums are checked the same way, in
 * common/types/authenticated-user.type.ts and the forecast request DTO.
 */
export type _MetricContractMatches = Assert<
  SameMembers<ValuesOf<SalesMetric>, SalesMetricContract>
>;
export type _GranularityContractMatches = Assert<
  SameMembers<ValuesOf<SalesGranularity>, SalesGranularityContract>
>;
export type _DimensionContractMatches = Assert<
  SameMembers<ValuesOf<SalesDimension>, SalesDimensionContract>
>;
