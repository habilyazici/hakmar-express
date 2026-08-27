/**
 * The /tables rows and the vocabulary that selects them.
 *
 * See ./kds for why money is a string.
 *
 * `D` is the date representation: the API's raw queries hand back a JS Date
 * for a DATE column, and it becomes an ISO string through JSON. Rows built
 * by a LEFT JOIN from the entity outward — so that an entity with no sales
 * still appears — have a null date and a zero total rather than vanishing.
 */

export interface CashierRankingRow {
  id: number;
  name: string;
  branchName: string;
  totalSales: string;
  totalReceipts: number;
  totalMargin: string;
}

export interface BranchRankingRow {
  id: number;
  name: string;
  cityName: string;
  totalSales: string;
  totalReceipts: number;
  uniqueCustomers: number;
  totalMargin: string;
}

export interface ProductRankingRow {
  id: number;
  name: string;
  brandName: string;
  totalQuantity: string;
  totalSales: string;
  totalMargin: string;
}

export interface CustomerRankingRow<D = string> {
  id: number;
  name: string;
  totalSpend: string;
  totalReceipts: number;
  firstPurchase: D | null;
  lastPurchase: D | null;
}

/**
 * Which row shape you get is decided by the `entity` parameter. The API
 * declares the same members as a TypeScript enum and asserts the two agree,
 * so an entity added on one side alone fails the build rather than becoming
 * a dropdown option the API answers with a 400.
 */
export const TABLE_ENTITIES = [
  'cashier',
  'branch',
  'product',
  'customer',
] as const;
export type TableEntity = (typeof TABLE_ENTITIES)[number];

export type TableRankingRow<D = string> =
  | CashierRankingRow
  | BranchRankingRow
  | ProductRankingRow
  | CustomerRankingRow<D>;

export interface PriceHistoryRow {
  productId: number;
  productName: string;
  year: number;
  price: string;
  cost: string;
  margin: string;
  previousYearPrice: string | null;
  priceChangePct: string | null;
}

export interface RegionCostRow {
  regionId: number;
  regionName: string;
  productId: number;
  productName: string;
  avgCost: string;
  totalSales: string;
  totalProfit: string;
}
