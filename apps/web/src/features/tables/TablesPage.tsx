import { useState } from 'react';
import { TABLE_ENTITIES, type TableEntity } from '@hakmar/contracts';
import { QueryState } from '../../components/QueryState';
import {
  currency,
  decimal,
  deltaClass,
  integer,
  num,
  signedPercent,
} from '../../lib/format';
import {
  usePriceCostHistory,
  useRegionCost,
  useTableRanking,
} from './queries';

/**
 * The list of rankable entities is the API's vocabulary, so it comes from
 * the contract rather than being restated here — this file used to keep its
 * own copy, which meant an entity added to the API appeared on no screen and
 * one removed from it stayed on this one as a button that 400s. Only the
 * Turkish labels are the web's business.
 */
const ENTITY_LABELS: Record<TableEntity, string> = {
  branch: 'Şube',
  cashier: 'Kasiyer',
  product: 'Ürün',
  customer: 'Müşteri',
};

/**
 * Presentation order, which the contract has no opinion about. A Record
 * rather than a list so the compiler still insists every entity has a place
 * — a list could silently omit one and drop its button.
 */
const ENTITY_ORDER: Record<TableEntity, number> = {
  branch: 0,
  cashier: 1,
  product: 2,
  customer: 3,
};

const ENTITIES = [...TABLE_ENTITIES].sort(
  (a, b) => ENTITY_ORDER[a] - ENTITY_ORDER[b],
);

type Cell = { key: string; label: string; format: 'text' | 'money' | 'int' | 'num' | 'date' };

/**
 * Each entity genuinely returns different columns, so the column set is
 * declared per entity rather than forced into one shared shape.
 */
const COLUMNS: Record<TableEntity, Cell[]> = {
  branch: [
    { key: 'name', label: 'Şube', format: 'text' },
    { key: 'cityName', label: 'Şehir', format: 'text' },
    { key: 'totalSales', label: 'Satış', format: 'money' },
    { key: 'totalMargin', label: 'Kâr', format: 'money' },
    { key: 'totalReceipts', label: 'Fiş', format: 'int' },
    { key: 'uniqueCustomers', label: 'Müşteri', format: 'int' },
  ],
  cashier: [
    { key: 'name', label: 'Kasiyer', format: 'text' },
    { key: 'branchName', label: 'Şube', format: 'text' },
    { key: 'totalSales', label: 'Satış', format: 'money' },
    { key: 'totalMargin', label: 'Kâr', format: 'money' },
    { key: 'totalReceipts', label: 'Fiş', format: 'int' },
  ],
  product: [
    { key: 'name', label: 'Ürün', format: 'text' },
    { key: 'brandName', label: 'Marka', format: 'text' },
    { key: 'totalQuantity', label: 'Miktar', format: 'num' },
    { key: 'totalSales', label: 'Satış', format: 'money' },
    { key: 'totalMargin', label: 'Kâr', format: 'money' },
  ],
  customer: [
    { key: 'name', label: 'Müşteri', format: 'text' },
    { key: 'totalSpend', label: 'Harcama', format: 'money' },
    { key: 'totalReceipts', label: 'Fiş', format: 'int' },
    { key: 'firstPurchase', label: 'İlk alışveriş', format: 'date' },
    { key: 'lastPurchase', label: 'Son alışveriş', format: 'date' },
  ],
};

function renderCell(value: unknown, format: Cell['format']) {
  if (value === null || value === undefined) return '—';
  switch (format) {
    case 'money':
      return currency.format(num(value as string));
    case 'int':
      return integer.format(num(value as string));
    case 'num':
      return decimal.format(num(value as string));
    case 'date':
      return new Date(String(value)).toLocaleDateString('tr-TR', {
        timeZone: 'UTC',
      });
    default:
      return String(value);
  }
}

function RankingTable() {
  const [entity, setEntity] = useState<TableEntity>('branch');
  const query = useTableRanking(entity);
  const columns = COLUMNS[entity];

  return (
    <section className="section">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Sıralama
        </h2>
        <div className="btn-group" role="group" aria-label="Varlık seçimi">
          {ENTITIES.map((e) => (
            <button
              key={e}
              type="button"
              className="btn btn-sm"
              aria-pressed={entity === e}
              onClick={() => setEntity(e)}
            >
              {ENTITY_LABELS[e]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <div className="table-scroll">
              <table className="table">
                <caption>
                  {ENTITY_LABELS[entity]} bazında tüm zamanların toplamları.
                  Hiç satışı olmayan kayıtlar da 0 olarak listelenir.
                </caption>
                <thead>
                  <tr>
                    {columns.map((c, i) => (
                      <th
                        key={c.key}
                        scope="col"
                        className={i === 0 ? undefined : 'num'}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={String(row.id ?? i)}>
                      {columns.map((c, ci) =>
                        ci === 0 ? (
                          <th key={c.key} scope="row">
                            {renderCell(row[c.key], c.format)}
                          </th>
                        ) : (
                          <td key={c.key} className="num">
                            {renderCell(row[c.key], c.format)}
                          </td>
                        ),
                      )}
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

function PriceCostHistory() {
  const query = usePriceCostHistory();

  return (
    <section className="section">
      <h2 className="section-title">Fiyat / Maliyet Geçmişi</h2>
      <div className="panel">
        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <div className="table-scroll">
              <table className="table">
                <caption>
                  Ürün-yıl bazında fiyat, maliyet ve bir önceki yıla göre fiyat
                  değişimi.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Ürün</th>
                    <th scope="col" className="num">Yıl</th>
                    <th scope="col" className="num">Fiyat</th>
                    <th scope="col" className="num">Maliyet</th>
                    <th scope="col" className="num">Marj</th>
                    <th scope="col" className="num">Değişim</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const change =
                      row.priceChangePct === null ? null : num(row.priceChangePct);
                    return (
                      <tr key={`${row.productId}-${row.year}`}>
                        <th scope="row">{row.productName}</th>
                        <td className="num">{row.year}</td>
                        <td className="num">{currency.format(num(row.price))}</td>
                        <td className="num">{currency.format(num(row.cost))}</td>
                        <td className="num">{currency.format(num(row.margin))}</td>
                        <td className={`num ${deltaClass(change)}`}>
                          {signedPercent(change)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </div>
    </section>
  );
}

function RegionCost() {
  const query = useRegionCost();

  return (
    <section className="section">
      <h2 className="section-title">Bölge Maliyetleri</h2>
      <div className="panel">
        <QueryState query={query} isEmpty={(rows) => rows.length === 0}>
          {(rows) => (
            <div className="table-scroll">
              <table className="table">
                <caption>
                  Bölge-ürün bazında ortalama birim maliyet ve o maliyete bağlı
                  satış/kâr.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Bölge</th>
                    <th scope="col">Ürün</th>
                    <th scope="col" className="num">Ort. maliyet</th>
                    <th scope="col" className="num">Satış</th>
                    <th scope="col" className="num">Kâr</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.regionId}-${row.productId}`}>
                      <th scope="row">{row.regionName}</th>
                      <td>{row.productName}</td>
                      <td className="num">{currency.format(num(row.avgCost))}</td>
                      <td className="num">{currency.format(num(row.totalSales))}</td>
                      <td className="num">{currency.format(num(row.totalProfit))}</td>
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

export function TablesPage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Tablolar</h1>
      </header>
      <RankingTable />
      <PriceCostHistory />
      <RegionCost />
    </main>
  );
}
