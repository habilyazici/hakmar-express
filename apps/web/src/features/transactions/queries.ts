import type {
  Page,
  ReceiptDetail,
  ReceiptListRow,
} from '@hakmar/contracts';
import { useApiQuery } from '../../lib/query';
import { useReferenceList } from '../../lib/reference-query';

/** Row shapes come from @hakmar/contracts. */
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
  return useApiQuery<Page<ReceiptListRow>>(
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
