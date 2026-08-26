import type {
  HeatmapType,
  SalesDimension,
  SalesGranularity,
  SalesMetric,
} from '@hakmar/contracts';

/**
 * Turkish display labels for the sales vocabulary. The vocabulary itself
 * lives in @hakmar/contracts — this file only says how to print it, which
 * is the one part of it the API has no opinion about.
 */

export const GRANULARITY_LABELS: Record<SalesGranularity, string> = {
  day: 'Gün',
  week: 'Hafta',
  month: 'Ay',
  quarter: 'Çeyrek',
  year: 'Yıl',
  weekday: 'Haftanın günü',
  hour: 'Saat',
};

export const METRIC_LABELS: Record<SalesMetric, string> = {
  sales: 'Satış',
  cost: 'Maliyet',
  profit: 'Kâr',
  quantity: 'Miktar',
  orders: 'Fiş sayısı',
};

export const DIMENSION_LABELS: Record<SalesDimension, string> = {
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
const MONEY_METRICS: readonly SalesMetric[] = ['sales', 'cost', 'profit'];

export function isMoneyMetric(metric: SalesMetric): boolean {
  return MONEY_METRICS.includes(metric);
}
