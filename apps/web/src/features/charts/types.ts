export const GRANULARITIES = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'weekday',
  'hour',
] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const TREND_METRICS = [
  'sales',
  'cost',
  'profit',
  'quantity',
  'orders',
] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

export const RANKING_DIMENSIONS = [
  'brand',
  'city',
  'branch',
  'region',
  'category',
  'cashier',
  'product',
] as const;
export type RankingDimension = (typeof RANKING_DIMENSIONS)[number];

export const RANKING_METRICS = ['sales', 'quantity', 'profit'] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];

export const HEATMAP_TYPES = [
  'weekday-hour',
  'year-month',
  'region-category',
] as const;
export type HeatmapType = (typeof HEATMAP_TYPES)[number];

export type TrendRow = { period: string } & Partial<
  Record<TrendMetric, string | number>
>;

export interface RankingRow {
  id: string | number;
  name: string;
  value: string;
}

export interface HeatmapRow {
  x: string | number;
  y: string | number;
  value: string | number;
}

export interface BucketRow {
  bucket: string;
  count: number;
}

export interface WaterfallStep {
  step: 'sales' | 'cost' | 'profit';
  value: number;
}

export interface GeographicSalesRow {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  sales: string;
}

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: 'Gün',
  week: 'Hafta',
  month: 'Ay',
  quarter: 'Çeyrek',
  year: 'Yıl',
  weekday: 'Haftanın günü',
  hour: 'Saat',
};

export const METRIC_LABELS: Record<TrendMetric, string> = {
  sales: 'Satış',
  cost: 'Maliyet',
  profit: 'Kâr',
  quantity: 'Miktar',
  orders: 'Fiş sayısı',
};

export const DIMENSION_LABELS: Record<RankingDimension, string> = {
  brand: 'Marka',
  city: 'Şehir',
  branch: 'Şube',
  region: 'Bölge',
  category: 'Kategori',
  cashier: 'Kasiyer',
  product: 'Ürün',
};

export const HEATMAP_LABELS: Record<HeatmapType, string> = {
  'weekday-hour': 'Gün × Saat',
  'year-month': 'Yıl × Ay',
  'region-category': 'Bölge × Kategori (ort. maliyet)',
};

/**
 * Two labels per bucket: the short one is what fits on a narrow category
 * axis, the long one carries the actual threshold and goes in the tooltip.
 * Using the long form on the axis made the four basket labels collide into
 * unreadable overlapping text.
 */
export const BUCKET_LABELS: Record<string, { short: string; long: string }> = {
  small: { short: 'Küçük', long: 'Küçük (<100₺)' },
  medium: { short: 'Orta', long: 'Orta (100-300₺)' },
  large: { short: 'Büyük', long: 'Büyük (300-600₺)' },
  xlarge: { short: 'Çok büyük', long: 'Çok büyük (600₺+)' },
  new: { short: 'Yeni', long: 'Yeni (1 ziyaret)' },
  occasional: { short: 'Ara sıra', long: 'Ara sıra (2-4 ziyaret)' },
  regular: { short: 'Düzenli', long: 'Düzenli (5-10 ziyaret)' },
  loyal: { short: 'Sadık', long: 'Sadık (10+ ziyaret)' },
};

/** Metrics measured in lira, as opposed to counts of things. */
export const MONEY_METRICS: readonly TrendMetric[] = ['sales', 'cost', 'profit'];

export function isMoneyMetric(metric: TrendMetric): boolean {
  return MONEY_METRICS.includes(metric);
}
