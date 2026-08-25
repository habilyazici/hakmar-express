import type { Period as PeriodContract } from '@hakmar/contracts';
import type { Assert, SameMembers, ValuesOf } from '../../common';

export enum Period {
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

export const PERIOD_DAYS: Record<Period, number> = {
  [Period.WEEK]: 7,
  [Period.MONTH]: 30,
  [Period.QUARTER]: 90,
  [Period.YEAR]: 365,
};

export type _PeriodContractMatches = Assert<
  SameMembers<ValuesOf<Period>, PeriodContract>
>;
