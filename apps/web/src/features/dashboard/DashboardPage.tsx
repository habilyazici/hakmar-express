import { useState } from 'react';
// Number formatting lives in lib/format, which every other page reads it
// from. This one kept its own currency/compact/count formatters, so a change
// to how the app writes lira reached seven screens and quietly missed this
// one. The two date labels below stay here: they are this page's own choice
// of axis caption, not a shared convention.
import {
  compactCurrency,
  currency,
  deltaClass,
  integer,
  num,
  signedPercent,
} from '../../lib/format';
import {
  useDailySummary,
  useGeneralStats,
  useMonthlySales,
  usePerformance,
  useSummary,
} from './queries';
import type {
  DailySummaryRow,
  MonthlySalesRow,
  Period,
} from '@hakmar/contracts';

/*
 * Both axes label a DATE column, which arrives as midnight UTC. Formatted in
 * the viewer's own zone that is the previous day everywhere west of UTC, so
 * every bar on both charts would be captioned one day early — and the totals
 * beside them would still be right, which is what makes it hard to spot.
 * lib/format's formatPeriod pins UTC for this reason; so do the İşlemler and
 * Tablolar date cells. These two were the ones that did not.
 */
const dayLabel = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const monthLabel = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The API compares rolling day windows ending today, not calendar periods:
 * "month" is the last 30 days against the 30 before it. Labelling those
 * buttons "Ay" and the columns "Bu Ay / Geçen Ay" read as August versus
 * July, which is not what the number is. Day counts say what it does.
 */
const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const PERIOD_LABELS: Record<Period, string> = {
  week: '7 gün',
  month: '30 gün',
  quarter: '90 gün',
  year: '365 gün',
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
    </div>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <div className="btn-group" role="group" aria-label="Dönem seçimi">
      {(Object.keys(PERIOD_LABELS) as Period[]).map((period) => (
        <button
          key={period}
          type="button"
          className="btn"
          onClick={() => onChange(period)}
          aria-pressed={value === period}
        >
          {PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  );
}

/**
 * Both trend sections used to render nothing but a row count plus the note
 * "(veritabanı henüz boş olduğu için 0 olabilir)" — a development placeholder
 * that shipped as the actual UI. This draws the series the endpoint already
 * returns.
 */
function BarSeries({
  points,
}: {
  points: { key: string; label: string; value: number }[];
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  return (
    <div className="bars" role="img" aria-label={`${points.length} noktalı seri`}>
      {points.map((point) => (
        <div
          key={point.key}
          className="bars__item"
          style={{ height: max > 0 ? `${(point.value / max) * 100}%` : '2px' }}
          title={`${point.label}: ${currency.format(point.value)}`}
        />
      ))}
    </div>
  );
}

function TrendSection({
  title,
  points,
  isLoading,
  emptyText,
}: {
  title: string;
  points: { key: string; label: string; value: number }[];
  isLoading: boolean;
  emptyText: string;
}) {
  const total = points.reduce((sum, p) => sum + p.value, 0);
  return (
    <section className="section">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          {title}
        </h2>
        {points.length > 0 && (
          <span className="muted">Toplam {compactCurrency.format(total)}</span>
        )}
      </div>
      <div className="panel">
        {isLoading && <p className="muted">Yükleniyor…</p>}
        {!isLoading && points.length === 0 && (
          <p className="muted">{emptyText}</p>
        )}
        {!isLoading && points.length > 0 && (
          <>
            <BarSeries points={points} />
            <div className="row-between" style={{ marginTop: 8 }}>
              <span className="muted">{points[0].label}</span>
              <span className="muted">{points[points.length - 1].label}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function DeltaCell({ value }: { value: number | null }) {
  return (
    <td
      className={`num ${deltaClass(value)}`}
      title={value === null ? 'Önceki dönemde veri yok' : undefined}
    >
      {signedPercent(value)}
    </td>
  );
}

function toDayPoints(rows: DailySummaryRow[] | undefined) {
  return (rows ?? []).map((row) => ({
    key: row.day,
    label: dayLabel.format(new Date(row.day)),
    value: num(row.sales),
  }));
}

function toMonthPoints(rows: MonthlySalesRow[] | undefined) {
  return (rows ?? []).map((row) => ({
    key: row.month,
    label: monthLabel.format(new Date(row.month)),
    value: num(row.sales),
  }));
}

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month');
  const summary = useSummary();
  const stats = useGeneralStats();
  const performance = usePerformance(period);
  const dailySummary = useDailySummary();
  const monthlySales = useMonthlySales();
  const queries = [summary, stats, performance, dailySummary, monthlySales];
  const hasError = queries.some((q) => q.isError);

  const days = PERIOD_DAYS[period];

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Genel Bakış</h1>
      </header>

      {hasError && (
        <div className="alert" role="alert">
          <span>Bazı veriler yüklenemedi.</span>
          <button
            className="btn"
            onClick={() => {
              queries.forEach((q) => {
                if (q.isError) void q.refetch();
              });
            }}
          >
            Tekrar dene
          </button>
        </div>
      )}

      <section className="section">
        <div className="card-grid">
          <StatCard
            label="Toplam Satış"
            value={
              summary.data ? currency.format(num(summary.data.totalSales)) : '…'
            }
          />
          <StatCard
            label="Toplam Kâr"
            value={
              summary.data
                ? currency.format(num(summary.data.totalProfit))
                : '…'
            }
          />
          <StatCard
            label="Şube"
            value={stats.data ? integer.format(stats.data.branches) : '…'}
          />
          <StatCard
            label="Müşteri"
            value={stats.data ? integer.format(stats.data.customers) : '…'}
          />
          <StatCard
            label="Ürün"
            value={stats.data ? integer.format(stats.data.products) : '…'}
          />
          <StatCard
            label="Fiş"
            value={stats.data ? integer.format(stats.data.receipts) : '…'}
          />
        </div>
      </section>

      <section className="section">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            Son {days} gün vs. önceki {days} gün
          </h2>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
        <div className="panel">
          {performance.isFetching && <p className="muted">Güncelleniyor…</p>}
          {performance.data && (
            <div className="table-scroll">
              <table className="table">
                <caption>
                  Bugün dahil son {days} gün, kendisinden önceki {days} günlük
                  dönemle karşılaştırılır. Takvim ayı/yılı değil, kayan
                  penceredir.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Ölçüt</th>
                    <th scope="col" className="num">
                      Son {days} gün
                    </th>
                    <th scope="col" className="num">
                      Önceki {days} gün
                    </th>
                    <th scope="col" className="num">
                      Değişim
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Satış</th>
                    <td className="num">
                      {currency.format(performance.data.current.sales)}
                    </td>
                    <td className="num">
                      {currency.format(performance.data.previous.sales)}
                    </td>
                    <DeltaCell value={performance.data.changePct.sales} />
                  </tr>
                  <tr>
                    <th scope="row">Kâr</th>
                    <td className="num">
                      {currency.format(performance.data.current.profit)}
                    </td>
                    <td className="num">
                      {currency.format(performance.data.previous.profit)}
                    </td>
                    <DeltaCell value={performance.data.changePct.profit} />
                  </tr>
                  <tr>
                    <th scope="row">Fiş sayısı</th>
                    <td className="num">
                      {integer.format(performance.data.current.orders)}
                    </td>
                    <td className="num">
                      {integer.format(performance.data.previous.orders)}
                    </td>
                    <DeltaCell value={performance.data.changePct.orders} />
                  </tr>
                  <tr>
                    <th scope="row">Ortalama sepet</th>
                    <td className="num">
                      {currency.format(performance.data.current.avgBasket)}
                    </td>
                    <td className="num">
                      {currency.format(performance.data.previous.avgBasket)}
                    </td>
                    <DeltaCell value={performance.data.changePct.avgBasket} />
                  </tr>
                  <tr>
                    <th scope="row">Farklı ürün</th>
                    <td className="num">
                      {integer.format(performance.data.current.distinctProducts)}
                    </td>
                    <td className="num">
                      {integer.format(performance.data.previous.distinctProducts)}
                    </td>
                    <DeltaCell
                      value={performance.data.changePct.distinctProducts}
                    />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <TrendSection
        title="Son 30 Gün"
        points={toDayPoints(dailySummary.data)}
        isLoading={dailySummary.isPending}
        emptyText="Son 30 günde kayıtlı satış yok."
      />

      <TrendSection
        title="Aylık Satış Trendi"
        points={toMonthPoints(monthlySales.data)}
        isLoading={monthlySales.isPending}
        emptyText="Henüz aylık satış kaydı yok."
      />
    </main>
  );
}
