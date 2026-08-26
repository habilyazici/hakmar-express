import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { QueryState } from '../../components/QueryState';
import { compactCurrency, formatPeriod, integer, num } from '../../lib/format';
import { useIsDark, useSeriesColors } from '../../lib/use-color-scheme';
import {
  HEATMAP_TYPES,
  RANKING_METRICS,
  SALES_DIMENSIONS,
  SALES_GRANULARITIES,
  SALES_METRICS,
  type BucketRow,
  type HeatmapType,
  type RankingMetric,
  type SalesDimension,
  type SalesGranularity,
  type SalesMetric,
  type WaterfallStep,
} from '@hakmar/contracts';
import { Heatmap } from './Heatmap';
import {
  BUCKET_LABELS,
  DIMENSION_LABELS,
  GRANULARITY_LABELS,
  HEATMAP_LABELS,
  METRIC_LABELS,
  isMoneyMetric,
} from './labels';
import {
  useBasketSize,
  useCustomerLoyalty,
  useHeatmap,
  useProfitWaterfall,
  useRanking,
  useTrend,
} from './queries';

/**
 * Recharts types a tooltip value as `ValueType | undefined`, i.e. it may be a
 * string, an array, or missing. Funnelling every formatter through one
 * adapter keeps that looseness in a single place instead of casting at each
 * of the four call sites.
 */
type RechartsValue =
  | number
  | string
  | readonly (number | string)[]
  | undefined;

function tooltipFormatter(
  format: (value: number) => string,
  fallbackName: string,
) {
  return (value: RechartsValue, name?: unknown): [string, string] => [
    format(num(Array.isArray(value) ? value[0] : (value as string | number))),
    typeof name === 'string' ? name : fallbackName,
  ];
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

function Select<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels?: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="field field--inline">
      <span>{label}</span>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TrendPanel() {
  const SERIES_COLORS = useSeriesColors();
  const [granularity, setGranularity] = useState<SalesGranularity>('month');
  const [metrics, setMetrics] = useState<SalesMetric[]>(['sales', 'profit']);
  const [cumulative, setCumulative] = useState(false);

  // At least one metric must stay selected: the API rejects an empty list
  // with a 400, so the UI should not be able to ask for one.
  function toggleMetric(metric: SalesMetric) {
    setMetrics((current) =>
      current.includes(metric)
        ? current.length > 1
          ? current.filter((m) => m !== metric)
          : current
        : [...current, metric],
    );
  }

  const query = useTrend(granularity, metrics, cumulative);

  const hasMoney = metrics.some(isMoneyMetric);
  const hasCount = metrics.some((m) => !isMoneyMetric(m));

  return (
    <section className="section">
      <h2 className="section-title">Trend</h2>
      <div className="panel">
        <Toolbar>
          <Select
            label="Kırılım"
            value={granularity}
            options={SALES_GRANULARITIES}
            labels={GRANULARITY_LABELS}
            onChange={setGranularity}
          />
          <div className="btn-group" role="group" aria-label="Metrikler">
            {SALES_METRICS.map((metric) => (
              <button
                key={metric}
                type="button"
                className="btn btn-sm"
                aria-pressed={metrics.includes(metric)}
                onClick={() => toggleMetric(metric)}
              >
                {METRIC_LABELS[metric]}
              </button>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={cumulative}
              onChange={(e) => setCumulative(e.target.checked)}
            />
            <span>Kümülatif</span>
          </label>
        </Toolbar>

        <QueryState
          query={query}
          isEmpty={(rows) => rows.length === 0}
          emptyText="Bu kırılımda kayıtlı satış yok."
        >
          {(rows) => (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={rows.map((row) => ({
                  ...row,
                  label: formatPeriod(row.period, granularity),
                }))}
                margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="chart-grid" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} />
                {/* Lira and unit counts share no scale and no unit, so they
                    get their own axes. A single axis formatted as currency
                    labelled a count of 12 receipts as "₺12". Each axis is
                    only rendered when a metric actually needs it. */}
                {hasMoney && (
                  <YAxis
                    yAxisId="money"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => compactCurrency.format(v)}
                    width={72}
                  />
                )}
                {hasCount && (
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) => integer.format(v)}
                    width={56}
                  />
                )}
                <Tooltip
                  formatter={(value, name) => {
                    const metric = metrics.find(
                      (m) => METRIC_LABELS[m] === name,
                    );
                    const n = num(
                      Array.isArray(value)
                        ? value[0]
                        : (value as string | number),
                    );
                    return [
                      metric && !isMoneyMetric(metric)
                        ? integer.format(n)
                        : compactCurrency.format(n),
                      typeof name === 'string' ? name : 'Değer',
                    ];
                  }}
                />
                <Legend />
                {metrics.map((metric, i) => (
                  <Line
                    key={metric}
                    yAxisId={isMoneyMetric(metric) ? 'money' : 'count'}
                    type="monotone"
                    dataKey={metric}
                    name={METRIC_LABELS[metric]}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </QueryState>
      </div>
    </section>
  );
}

function RankingPanel() {
  const SERIES_COLORS = useSeriesColors();
  const [dimension, setDimension] = useState<SalesDimension>('branch');
  const [metric, setMetric] = useState<RankingMetric>('sales');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');

  const query = useRanking(dimension, metric, order);

  return (
    <section className="section">
      <h2 className="section-title">Sıralama</h2>
      <div className="panel">
        <Toolbar>
          <Select
            label="Boyut"
            value={dimension}
            options={SALES_DIMENSIONS}
            labels={DIMENSION_LABELS}
            onChange={setDimension}
          />
          <Select
            label="Metrik"
            value={metric}
            options={RANKING_METRICS}
            labels={METRIC_LABELS}
            onChange={setMetric}
          />
          <div className="btn-group" role="group" aria-label="Sıralama yönü">
            <button
              type="button"
              className="btn btn-sm"
              aria-pressed={order === 'desc'}
              onClick={() => setOrder('desc')}
            >
              En yüksek
            </button>
            <button
              type="button"
              className="btn btn-sm"
              aria-pressed={order === 'asc'}
              onClick={() => setOrder('asc')}
            >
              En düşük
            </button>
          </div>
        </Toolbar>

        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 28)}>
              <BarChart
                layout="vertical"
                data={rows.map((r) => ({ name: r.name, value: num(r.value) }))}
                margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="chart-grid" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    metric === 'quantity' ? integer.format(v) : compactCurrency.format(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={tooltipFormatter(
                    (v) =>
                      metric === 'quantity'
                        ? integer.format(v)
                        : compactCurrency.format(v),
                    METRIC_LABELS[metric],
                  )}
                />
                <Bar dataKey="value" fill={SERIES_COLORS[0]} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </QueryState>
      </div>
    </section>
  );
}

function HeatmapPanel() {
  const [type, setType] = useState<HeatmapType>('weekday-hour');
  const [metric, setMetric] = useState<SalesMetric>('sales');
  const isCostMap = type === 'region-category';

  const query = useHeatmap(type, metric);

  return (
    <section className="section">
      <h2 className="section-title">Isı Haritası</h2>
      <div className="panel">
        <Toolbar>
          <Select
            label="Tip"
            value={type}
            options={HEATMAP_TYPES}
            labels={HEATMAP_LABELS}
            onChange={setType}
          />
          {/* region-category always reports average unit cost, so a metric
              picker there would be a control that does nothing. */}
          {!isCostMap && (
            <Select
              label="Metrik"
              value={metric}
              options={SALES_METRICS}
              labels={METRIC_LABELS}
              onChange={setMetric}
            />
          )}
        </Toolbar>

        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => <Heatmap rows={rows} type={type} />}
        </QueryState>
      </div>
    </section>
  );
}

function BasketSizePanel() {
  const query = useBasketSize();
  return <BucketPanel title="Sepet Büyüklüğü" query={query} />;
}

function CustomerLoyaltyPanel() {
  const query = useCustomerLoyalty();
  return <BucketPanel title="Müşteri Sadakati" query={query} />;
}

function BucketPanel({
  title,
  query,
}: {
  title: string;
  query: UseQueryResult<BucketRow[]>;
}) {
  const SERIES_COLORS = useSeriesColors();

  return (
    <div className="panel">
      <h3 className="section-title">{title}</h3>
      <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
        {(rows) => (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={rows.map((r) => ({
                name: BUCKET_LABELS[r.bucket]?.short ?? r.bucket,
                full: BUCKET_LABELS[r.bucket]?.long ?? r.bucket,
                count: r.count,
              }))}
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="chart-grid" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={44} />
              <Tooltip
                formatter={tooltipFormatter((v) => integer.format(v), 'Adet')}
                labelFormatter={(_label: unknown, payload) =>
                  (payload?.[0]?.payload as { full?: string } | undefined)
                    ?.full ?? String(_label)
                }
              />
              <Bar dataKey="count" fill={SERIES_COLORS[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </QueryState>
    </div>
  );
}

function WaterfallPanel() {
  const SERIES_COLORS = useSeriesColors();
  const NEGATIVE_FILL = useIsDark() ? '#f87171' : '#b91c1c';
  const query = useProfitWaterfall();
  const labels: Record<WaterfallStep['step'], string> = {
    sales: 'Satış',
    cost: 'Maliyet',
    profit: 'Kâr',
  };

  return (
    <div className="panel">
      <h3 className="section-title">Kâr Dağılımı</h3>
      <QueryState
        query={query}
        isEmpty={(rows) => rows.every((r) => r.value === 0)}
      >
        {(rows) => (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={rows.map((r) => ({ name: labels[r.step], value: r.value }))}
              margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="chart-grid" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => compactCurrency.format(v)}
                width={72}
              />
              <Tooltip
                formatter={tooltipFormatter(
                  (v) => compactCurrency.format(v),
                  'Tutar',
                )}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {rows.map((row) => (
                  <Cell
                    key={row.step}
                    fill={row.value < 0 ? NEGATIVE_FILL : SERIES_COLORS[0]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </QueryState>
    </div>
  );
}

export function ChartsPage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Grafikler</h1>
      </header>

      <TrendPanel />
      <RankingPanel />
      <HeatmapPanel />

      <section className="section">
        <h2 className="section-title">Dağılımlar</h2>
        <div className="panel-grid">
          <BasketSizePanel />
          <CustomerLoyaltyPanel />
          <WaterfallPanel />
        </div>
      </section>
    </main>
  );
}
