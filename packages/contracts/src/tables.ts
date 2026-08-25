/**
 * The /tables rows. See ./kds for why money is a string.
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

/** Which one you get is decided by the `entity` parameter. */
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
