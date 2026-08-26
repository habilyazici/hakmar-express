import type { Page } from '@hakmar/contracts';
import { useApiQuery } from '../../lib/query';
import { useReferenceList } from '../../lib/reference-query';

/** See the note in ../tables/queries.ts on why these row types are declared
 *  here rather than in @hakmar/contracts. */

export interface ReceiptRow {
  id: number;
  receiptDate: string;
  receiptTime: string;
  branchId: number;
  branchName: string;
  cashierName: string;
  customerName: string;
  itemCount: number;
  total: string;
  margin: string;
}

export interface ReceiptItem {
  id: number;
  productId: number;
  productName: string;
  brandName: string;
  quantity: string;
  totalPrice: string;
  totalCost: string;
  totalMargin: string;
}

export interface ReceiptDetail extends ReceiptRow {
  items: ReceiptItem[];
}

/** Something with a display name, as the filter dropdowns need it. */
export interface Named {
  id: number;
  name?: string;
  firstName?: string;
  lastName?: string;
}

export interface ReceiptFilters {
  [key: string]: unknown;
  limit: number;
  offset: number;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  cashierId?: string;
  customerId?: string;
}

export function useReceipts(filters: ReceiptFilters) {
  return useApiQuery<Page<ReceiptRow>>(
    ['transactions', 'receipts', filters],
    '/transactions/receipts',
    filters,
  );
}

export function useReceipt(id: number) {
  return useApiQuery<ReceiptDetail>(
    ['transactions', 'receipt', id],
    `/transactions/receipts/${id}`,
  );
}

/** The reference lists behind the filter dropdowns. */
export function useNamedReferenceList(endpoint: string) {
  return useReferenceList<Named>(endpoint);
}
