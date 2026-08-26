import type {
  DailySummaryRow,
  GeneralStatsDto,
  MonthlySalesRow,
  Period,
  PerformanceDto,
  SummaryDto,
} from '@hakmar/contracts';
import { useApiQuery } from '../../lib/query';

/**
 * The /dashboard endpoints.
 *
 * These went through a private copy of fetchData that predated lib/query.ts
 * and had drifted from it — same job, two implementations, and only one of
 * them gained anything the other later needed.
 */

export function useSummary() {
  return useApiQuery<SummaryDto>(['dashboard', 'summary'], '/dashboard/summary');
}

export function useGeneralStats() {
  return useApiQuery<GeneralStatsDto>(
    ['dashboard', 'general-stats'],
    '/dashboard/general-stats',
  );
}

export function usePerformance(period: Period) {
  return useApiQuery<PerformanceDto>(
    ['dashboard', 'performance', period],
    `/dashboard/performance/${period}`,
  );
}

export function useDailySummary() {
  return useApiQuery<DailySummaryRow[]>(
    ['dashboard', 'daily-summary'],
    '/dashboard/daily-summary',
  );
}

export function useMonthlySales() {
  return useApiQuery<MonthlySalesRow[]>(
    ['dashboard', 'monthly-sales'],
    '/dashboard/monthly-sales',
  );
}
