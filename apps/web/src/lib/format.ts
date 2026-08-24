export const currency = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

export const compactCurrency = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const decimal = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 2,
});

export const integer = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
});

export const percent = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 1,
});

/** Endpoints return Postgres numerics as strings to avoid float drift. */
export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function signedPercent(value: number | null): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${percent.format(value)}%`;
}

export function deltaClass(value: number | null): string {
  if (value === null) return 'delta-neutral';
  return value >= 0 ? 'delta-positive' : 'delta-negative';
}

const MONTHS_TR = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

export const WEEKDAYS_TR = [
  'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz',
];

export function monthName(month: number): string {
  return MONTHS_TR[month - 1] ?? String(month);
}

/**
 * Trend periods come back as whatever the granularity produced: a date for
 * day/week/month/quarter/year, a bare number for weekday/hour. Formatting
 * has to follow the granularity, not guess from the value.
 */
export function formatPeriod(value: unknown, granularity: string): string {
  if (granularity === 'weekday') {
    return WEEKDAYS_TR[Number(value) - 1] ?? String(value);
  }
  if (granularity === 'hour') {
    return `${String(value).padStart(2, '0')}:00`;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  switch (granularity) {
    case 'year':
      return String(date.getUTCFullYear());
    case 'month':
    case 'quarter':
      return `${monthName(date.getUTCMonth() + 1)} ${date.getUTCFullYear()}`;
    default:
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
  }
}
