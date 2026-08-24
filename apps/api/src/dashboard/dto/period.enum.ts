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
