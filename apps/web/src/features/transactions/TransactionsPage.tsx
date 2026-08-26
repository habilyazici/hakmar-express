import { useState } from 'react';
import { QueryState } from '../../components/QueryState';
import { currency, decimal, integer, num } from '../../lib/format';
import {
  useReceipt,
  useReceipts,
  useNamedReferenceList,
  type Named,
  type ReceiptFilters,
} from './queries';

const PAGE_SIZE = 25;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('tr-TR', { timeZone: 'UTC' });
}

/** receipt_time is a TIME column, serialized against the epoch date. */
function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function labelOf(item: Named): string {
  return item.name ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
}

function FilterSelect({
  label,
  value,
  endpoint,
  onChange,
}: {
  label: string;
  value: string;
  endpoint: string;
  onChange: (value: string) => void;
}) {
  const query = useNamedReferenceList(endpoint);
  return (
    <label className="field field--inline">
      <span>{label}</span>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Tümü</option>
        {(query.data?.items ?? []).map((item) => (
          <option key={item.id} value={String(item.id)}>
            {labelOf(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReceiptDetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useReceipt(id);

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          Fiş #{id}
        </h2>
        <button className="btn btn-sm" onClick={onClose}>
          Kapat
        </button>
      </div>

      <QueryState query={query}>
        {(receipt) => (
          <>
            <div className="card-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card">
                <span className="stat-card__label">Tarih</span>
                <span className="stat-card__value">
                  {formatDate(receipt.receiptDate)}
                </span>
                <span className="muted">{formatTime(receipt.receiptTime)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__label">Şube</span>
                <span className="stat-card__value">{receipt.branchName}</span>
                <span className="muted">{receipt.cashierName}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__label">Müşteri</span>
                <span className="stat-card__value">{receipt.customerName}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card__label">Tutar</span>
                <span className="stat-card__value">
                  {currency.format(num(receipt.total))}
                </span>
                <span className="muted">
                  Kâr {currency.format(num(receipt.margin))}
                </span>
              </div>
            </div>

            {receipt.items.length === 0 ? (
              <p className="muted">Bu fişte kalem yok.</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <caption>Fiş kalemleri</caption>
                  <thead>
                    <tr>
                      <th scope="col">Ürün</th>
                      <th scope="col">Marka</th>
                      <th scope="col" className="num">Miktar</th>
                      <th scope="col" className="num">Tutar</th>
                      <th scope="col" className="num">Maliyet</th>
                      <th scope="col" className="num">Kâr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">{item.productName}</th>
                        <td>{item.brandName}</td>
                        <td className="num">
                          {decimal.format(num(item.quantity))}
                        </td>
                        <td className="num">
                          {currency.format(num(item.totalPrice))}
                        </td>
                        <td className="num">
                          {currency.format(num(item.totalCost))}
                        </td>
                        <td className="num">
                          {currency.format(num(item.totalMargin))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

export function TransactionsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const params: ReceiptFilters = {
    limit: PAGE_SIZE,
    offset,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    branchId: branchId || undefined,
    cashierId: cashierId || undefined,
    customerId: customerId || undefined,
  };

  const list = useReceipts(params);

  /** Any filter change invalidates the current page number. */
  function withReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setOffset(0);
    };
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">İşlemler</h1>
      </header>

      <section className="section">
        <div className="panel">
          <div className="toolbar" style={{ marginBottom: 0, paddingBottom: 0, border: 0 }}>
            <label className="field field--inline">
              <span>Başlangıç</span>
              <input
                className="input"
                type="date"
                value={dateFrom}
                onChange={(e) => withReset(setDateFrom)(e.target.value)}
              />
            </label>
            <label className="field field--inline">
              <span>Bitiş</span>
              <input
                className="input"
                type="date"
                value={dateTo}
                onChange={(e) => withReset(setDateTo)(e.target.value)}
              />
            </label>
            <FilterSelect
              label="Şube"
              value={branchId}
              endpoint="/geo/branches"
              onChange={withReset(setBranchId)}
            />
            <FilterSelect
              label="Kasiyer"
              value={cashierId}
              endpoint="/people/cashiers"
              onChange={withReset(setCashierId)}
            />
            <FilterSelect
              label="Müşteri"
              value={customerId}
              endpoint="/people/customers"
              onChange={withReset(setCustomerId)}
            />
            <button
              className="btn"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setBranchId('');
                setCashierId('');
                setCustomerId('');
                setOffset(0);
              }}
            >
              Filtreleri temizle
            </button>
          </div>
        </div>
      </section>

      {selected !== null && (
        <ReceiptDetailPanel id={selected} onClose={() => setSelected(null)} />
      )}

      <section className="section">
        <div className="panel">
          <QueryState
            query={list}
            isEmpty={(page) => page.items.length === 0}
            emptyText="Bu filtrelerle eşleşen fiş yok."
          >
            {(page) => (
              <>
                <div className="table-scroll">
                  <table className="table">
                    <caption>
                      Tarih aralığı her iki ucu da kapsar. En yeni fiş en üstte.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="num">Fiş</th>
                        <th scope="col">Tarih</th>
                        <th scope="col">Şube</th>
                        <th scope="col">Kasiyer</th>
                        <th scope="col">Müşteri</th>
                        <th scope="col" className="num">Kalem</th>
                        <th scope="col" className="num">Tutar</th>
                        <th scope="col" className="num">Kâr</th>
                        <th scope="col" className="num" />
                      </tr>
                    </thead>
                    <tbody>
                      {page.items.map((row) => (
                        <tr key={row.id}>
                          <th scope="row" className="num">
                            #{row.id}
                          </th>
                          <td>
                            {formatDate(row.receiptDate)}{' '}
                            <span className="muted">
                              {formatTime(row.receiptTime)}
                            </span>
                          </td>
                          <td>{row.branchName}</td>
                          <td>{row.cashierName}</td>
                          <td>{row.customerName}</td>
                          <td className="num">{integer.format(row.itemCount)}</td>
                          <td className="num">
                            {currency.format(num(row.total))}
                          </td>
                          <td className="num">
                            {currency.format(num(row.margin))}
                          </td>
                          <td className="num">
                            <button
                              className="btn btn-sm"
                              onClick={() => setSelected(row.id)}
                            >
                              Detay
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="row-between" style={{ marginTop: 12 }}>
                  <span className="muted">
                    {integer.format(page.total)} fiş · {offset + 1}-
                    {offset + page.items.length} arası
                  </span>
                  <span className="btn-group">
                    <button
                      className="btn btn-sm"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    >
                      Önceki
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={offset + PAGE_SIZE >= page.total}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                    >
                      Sonraki
                    </button>
                  </span>
                </div>
              </>
            )}
          </QueryState>
        </div>
      </section>
    </main>
  );
}
