import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import {
  useDailySummary,
  useGeneralStats,
  useMonthlySales,
  usePerformance,
  useSummary,
} from './hooks';
import type { Period } from './types';

const currency = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Hafta',
  month: 'Ay',
  quarter: 'Çeyrek',
  year: 'Yıl',
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
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
    <div style={{ display: 'flex', gap: 6 }}>
      {(Object.keys(PERIOD_LABELS) as Period[]).map((period) => (
        <button
          key={period}
          onClick={() => onChange(period)}
          aria-pressed={value === period}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #ccc',
            background: value === period ? '#222' : '#fff',
            color: value === period ? '#fff' : '#222',
            cursor: 'pointer',
          }}
        >
          {PERIOD_LABELS[period]}
        </button>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const summary = useSummary();
  const stats = useGeneralStats();
  const performance = usePerformance(period);
  const dailySummary = useDailySummary();
  const monthlySales = useMonthlySales();
  const queries = [summary, stats, performance, dailySummary, monthlySales];
  const hasError = queries.some((q) => q.isError);

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22 }}>Genel Bakış</h1>
        <div>
          <span style={{ marginRight: 12, fontSize: 14, color: '#666' }}>
            {user?.username} ({user?.role})
          </span>
          <button onClick={() => logout()}>Çıkış yap</button>
        </div>
      </header>

      {hasError && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            marginBottom: 20,
            background: '#fdecea',
            border: '1px solid #f3b4ac',
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 14, color: '#7a1f14' }}>
            Bazı veriler yüklenemedi.
          </span>
          <button
            onClick={() => queries.forEach((q) => q.isError && q.refetch())}
          >
            Tekrar dene
          </button>
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Toplam Satış"
          value={summary.data ? currency.format(Number(summary.data.totalSales)) : '…'}
        />
        <StatCard
          label="Toplam Kâr"
          value={summary.data ? currency.format(Number(summary.data.totalProfit)) : '…'}
        />
        <StatCard label="Şube" value={stats.data ? String(stats.data.branches) : '…'} />
        <StatCard label="Müşteri" value={stats.data ? String(stats.data.customers) : '…'} />
        <StatCard label="Ürün" value={stats.data ? String(stats.data.products) : '…'} />
        <StatCard label="Fiş" value={stats.data ? String(stats.data.receipts) : '…'} />
      </section>

      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <h2 style={{ fontSize: 16 }}>
            Bu {PERIOD_LABELS[period]} vs. Geçen {PERIOD_LABELS[period]}
          </h2>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
        {performance.isFetching && (
          <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            Güncelleniyor…
          </p>
        )}
        {performance.data && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td>Satış değişimi</td>
                <td>{formatPct(performance.data.changePct.sales)}</td>
              </tr>
              <tr>
                <td>Kâr değişimi</td>
                <td>{formatPct(performance.data.changePct.profit)}</td>
              </tr>
              <tr>
                <td>Fiş sayısı değişimi</td>
                <td>{formatPct(performance.data.changePct.orders)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Son 30 Gün</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          {dailySummary.data?.length ?? 0} günlük kayıt (veritabanı henüz boş olduğu için 0 olabilir).
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Aylık Satış Trendi</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          {monthlySales.data?.length ?? 0} aylık kayıt.
        </p>
      </section>
    </main>
  );
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}
