import { describe, expect, it } from 'vitest';
import {
  deltaClass,
  formatPeriod,
  monthName,
  num,
  signedPercent,
} from './format';

describe('num', () => {
  /**
   * Postgres numerics arrive as strings so large decimals do not lose
   * precision in transit; every chart and table has to coerce them.
   */
  it('parses the numeric strings the API returns', () => {
    expect(num('1234.56')).toBeCloseTo(1234.56, 9);
    expect(num(42)).toBe(42);
  });

  it('treats missing and unparseable values as zero rather than NaN', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('not a number')).toBe(0);
  });
});

describe('signedPercent', () => {
  it('prefixes a plus sign only for non-negative values', () => {
    expect(signedPercent(12.34)).toBe('+12,3%');
    expect(signedPercent(-8.5)).toBe('-8,5%');
    expect(signedPercent(0)).toBe('+0%');
  });

  // The API returns null when the baseline is zero, precisely so the UI does
  // not present a fabricated percentage. It must stay visibly absent.
  it('renders a dash when there is no comparable baseline', () => {
    expect(signedPercent(null)).toBe('—');
  });
});

describe('deltaClass', () => {
  it('maps sign to the semantic colour class', () => {
    expect(deltaClass(5)).toBe('delta-positive');
    expect(deltaClass(-5)).toBe('delta-negative');
    expect(deltaClass(0)).toBe('delta-positive');
  });

  it('stays neutral when the value is null', () => {
    expect(deltaClass(null)).toBe('delta-neutral');
  });
});

describe('formatPeriod', () => {
  /**
   * The trend endpoint returns a date for calendar granularities but a bare
   * number for weekday and hour. Formatting has to follow the granularity;
   * guessing from the value alone renders "1" as a date.
   */
  it('renders weekday indices as Turkish day names', () => {
    expect(formatPeriod(1, 'weekday')).toBe('Pzt');
    expect(formatPeriod(7, 'weekday')).toBe('Paz');
  });

  it('renders hour indices as a padded clock time', () => {
    expect(formatPeriod(9, 'hour')).toBe('09:00');
    expect(formatPeriod(14, 'hour')).toBe('14:00');
  });

  it('renders a year granularity as just the year', () => {
    expect(formatPeriod('2026-01-01T00:00:00.000Z', 'year')).toBe('2026');
  });

  it('renders a month granularity as month and year', () => {
    expect(formatPeriod('2026-03-01T00:00:00.000Z', 'month')).toBe('Mar 2026');
  });

  it('falls back to the raw value when the date cannot be parsed', () => {
    expect(formatPeriod('garbage', 'day')).toBe('garbage');
  });

  // Receipt dates are DATE columns serialized as UTC midnight; formatting in
  // local time would shift them a day backwards west of Greenwich.
  it('formats day granularity in UTC, not the local timezone', () => {
    expect(formatPeriod('2026-03-01T00:00:00.000Z', 'day')).toContain('1');
    expect(formatPeriod('2026-03-01T00:00:00.000Z', 'day')).toContain('Mar');
  });
});

describe('monthName', () => {
  it('maps 1-12 to Turkish abbreviations', () => {
    expect(monthName(1)).toBe('Oca');
    expect(monthName(12)).toBe('Ara');
  });

  it('passes an out-of-range month through unchanged', () => {
    expect(monthName(13)).toBe('13');
  });
});
