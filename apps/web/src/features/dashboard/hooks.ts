import { useQuery } from '@tanstack/react-query';
import { apiClient, type ApiEnvelope } from '../../lib/api-client';
import type {
  DailySummaryRow,
  GeneralStatsDto,
  MonthlySalesRow,
  Period,
  PerformanceDto,
  SummaryDto,
} from './types';

async function fetchData<T>(url: string): Promise<T> {
  const res = await apiClient.get<ApiEnvelope<T>>(url);
  return res.data.data;
}

export function useSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => fetchData<SummaryDto>('/dashboard/summary'),
  });
}

export function useGeneralStats() {
  return useQuery({
    queryKey: ['dashboard', 'general-stats'],
    queryFn: () => fetchData<GeneralStatsDto>('/dashboard/general-stats'),
  });
}

export function usePerformance(period: Period) {
  return useQuery({
    queryKey: ['dashboard', 'performance', period],
    queryFn: () => fetchData<PerformanceDto>(`/dashboard/performance/${period}`),
  });
}

export function useDailySummary() {
  return useQuery({
    queryKey: ['dashboard', 'daily-summary'],
    queryFn: () => fetchData<DailySummaryRow[]>('/dashboard/daily-summary'),
  });
}

export function useMonthlySales() {
  return useQuery({
    queryKey: ['dashboard', 'monthly-sales'],
    queryFn: () => fetchData<MonthlySalesRow[]>('/dashboard/monthly-sales'),
  });
}
