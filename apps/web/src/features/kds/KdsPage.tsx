import { useState } from 'react';
import { QueryState } from '../../components/QueryState';
import { currency, decimal, integer, num, percent } from '../../lib/format';
import { useApiQuery } from '../../lib/query';

interface AbcRow {
  id: number;
  name: string;
  revenue: string;
  class: 'A' | 'B' | 'C';
}

interface DemandRow {
  productId: number;
  productName: string;
  forecastQty: string;
}

interface RfmRow {
  id: number;
  name: string;
  recencyDays: number | null;
  frequency: number;
  monetary: string;
  segment: 'Champions' | 'Loyal' | 'At Risk' | 'Lost';
}

interface BasketRow {
  productId: number;
  productName: string;
  coCount: number;
  confidencePct: string | null;
}

const SEGMENT_LABELS: Record<RfmRow['segment'], string> = {
  Champions: 'Şampiyonlar',
  Loyal: 'Sadık',
  'At Risk': 'Riskli',
  Lost: 'Kayıp',
};

const SEGMENT_TONE: Record<RfmRow['segment'], string> = {
  Champions: 'tag--good',
  Loyal: 'tag--info',
  'At Risk': 'tag--warn',
  Lost: 'tag--bad',
};

const ABC_TONE: Record<AbcRow['class'], string> = {
  A: 'tag--good',
  B: 'tag--warn',
  C: 'tag--muted',
};

function AbcPanel() {
  const [days, setDays] = useState(90);
  const query = useApiQuery<AbcRow[]>(['kds', 'abc', days], '/kds/abc-analysis', {
    days,
  });

  return (
    <section className="section">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          ABC Analizi
        </h2>
        <div className="btn-group" role="group" aria-label="Dönem">
          {[30, 90, 365].map((d) => (
            <button
              key={d}
              type="button"
              className="btn btn-sm"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
            >
              {d} gün
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => {
            const counts = rows.reduce<Record<string, number>>((acc, r) => {
              acc[r.class] = (acc[r.class] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Kümülatif ciro payına göre: A sınıfı ilk %80, B %95'e kadar,
                  C kalanı. A: {counts.A ?? 0} ürün · B: {counts.B ?? 0} · C:{' '}
                  {counts.C ?? 0}
                </p>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Ürün</th>
                        <th scope="col" className="num">Ciro</th>
                        <th scope="col">Sınıf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((row) => (
                        <tr key={row.id}>
                          <th scope="row">{row.name}</th>
                          <td className="num">{currency.format(num(row.revenue))}</td>
                          <td>
                            <span className={`tag ${ABC_TONE[row.class]}`}>
                              {row.class}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          }}
        </QueryState>
      </div>
    </section>
  );
}

function DemandPanel({
  onPickProduct,
}: {
  onPickProduct: (id: number, name: string) => void;
}) {
  const query = useApiQuery<DemandRow[]>(
    ['kds', 'demand-forecast'],
    '/kds/demand-forecast',
    { limit: 50 },
  );

  return (
    <section className="section">
      <h2 className="section-title">Talep Tahmini</h2>
      <div className="panel">
        <p className="muted" style={{ marginBottom: 12 }}>
          Her ürünün son satış gününde hesaplanan 7 günlük hareketli ortalama
          satış miktarı.
        </p>
        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Ürün</th>
                    <th scope="col" className="num">Günlük tahmin</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.productId}>
                      <th scope="row">{row.productName}</th>
                      <td className="num">{decimal.format(num(row.forecastQty))}</td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() =>
                            onPickProduct(row.productId, row.productName)
                          }
                        >
                          Sepet analizi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
    </section>
  );
}

function SegmentationPanel() {
  const query = useApiQuery<RfmRow[]>(
    ['kds', 'segmentation'],
    '/kds/customer-segmentation',
    { limit: 100 },
  );

  return (
    <section className="section">
      <h2 className="section-title">Müşteri Segmentasyonu (RFM)</h2>
      <div className="panel">
        <p className="muted" style={{ marginBottom: 12 }}>
          Recency (son alışveriş), Frequency (sıklık) ve Monetary (tutar)
          çeyreklik skorlarına göre segment.
        </p>
        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Müşteri</th>
                    <th scope="col" className="num">Son alışveriş</th>
                    <th scope="col" className="num">Fiş</th>
                    <th scope="col" className="num">Toplam</th>
                    <th scope="col">Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.name}</th>
                      <td className="num">
                        {row.recencyDays === null
                          ? '—'
                          : `${integer.format(row.recencyDays)} gün önce`}
                      </td>
                      <td className="num">{integer.format(row.frequency)}</td>
                      <td className="num">{currency.format(num(row.monetary))}</td>
                      <td>
                        <span className={`tag ${SEGMENT_TONE[row.segment]}`}>
                          {SEGMENT_LABELS[row.segment]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
    </section>
  );
}

function MarketBasketPanel({
  product,
}: {
  product: { id: number; name: string } | null;
}) {
  const query = useApiQuery<BasketRow[]>(
    ['kds', 'market-basket', product?.id],
    '/kds/market-basket',
    { productId: product?.id, limit: 20 },
    product !== null,
  );

  return (
    <section className="section">
      <h2 className="section-title">Sepet Analizi</h2>
      <div className="panel">
        {product === null ? (
          <p className="muted">
            Talep tahmini tablosundan bir ürün seçin; o ürünle birlikte en çok
            satılan ürünler burada listelenir.
          </p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 12 }}>
              <strong>{product.name}</strong> ile aynı fişte satılan ürünler.
              Güven, o ürünün geçtiği fişlerin yüzde kaçında birlikte
              göründüğüdür.
            </p>
            <QueryState
              query={query}
              isEmpty={(rows) => rows.length === 0}
              emptyText="Bu ürünle birlikte satılan başka ürün bulunamadı."
            >
              {(rows) => (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Ürün</th>
                        <th scope="col" className="num">Birlikte</th>
                        <th scope="col" className="num">Güven</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.productId}>
                          <th scope="row">{row.productName}</th>
                          <td className="num">{integer.format(row.coCount)}</td>
                          <td className="num">
                            {row.confidencePct === null
                              ? '—'
                              : `${percent.format(num(row.confidencePct))}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </QueryState>
          </>
        )}
      </div>
    </section>
  );
}

export function KdsPage() {
  const [product, setProduct] = useState<{ id: number; name: string } | null>(
    null,
  );

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">KDS Analiz</h1>
      </header>

      <AbcPanel />
      <DemandPanel
        onPickProduct={(id, name) => setProduct({ id, name })}
      />
      <MarketBasketPanel product={product} />
      <SegmentationPanel />
    </main>
  );
}
