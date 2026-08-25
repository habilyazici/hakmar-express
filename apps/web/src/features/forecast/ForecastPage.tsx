import { useMutation } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import {
  compactCurrency,
  currency,
  decimal,
  deltaClass,
  integer,
  signedPercent,
} from '../../lib/format';
import type {
  ForecastMetric,
  GeoJsonPayload,
  ForecastRunResult,
} from '@hakmar/contracts';
import { runForecast, useCityGeoJson } from './queries';
import { TurkeyMap, type FeatureCollection, type MapValue } from './TurkeyMap';

const METRIC_LABELS: Record<ForecastMetric, string> = {
  quantity: 'Miktar',
  sales: 'Satış',
  cost: 'Maliyet',
  profit: 'Kâr',
};

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

function TotalsCard({
  label,
  forecast,
  baseline,
  change,
  isMoney,
}: {
  label: string;
  forecast: number;
  baseline: number;
  change: number | null;
  isMoney: boolean;
}) {
  const fmt = isMoney ? currency : integer;
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{fmt.format(forecast)}</span>
      <span className={`stat-card__delta ${deltaClass(change)}`}>
        {signedPercent(change)}{' '}
        <span className="muted">önceki {fmt.format(baseline)}</span>
      </span>
    </div>
  );
}

function toMapValues(result: ForecastRunResult): Map<number, MapValue> {
  const metric = result.params.metric;
  const isMoney = metric !== 'quantity';
  const values = new Map<number, MapValue>();
  for (const area of result.areas) {
    if (area.plateCode === null) continue;
    const value = area.forecast[metric];
    values.set(area.plateCode, {
      label: area.name,
      value,
      changePct: area.changePct[metric],
      formatted: isMoney ? compactCurrency.format(value) : integer.format(value),
    });
  }
  return values;
}

export function ForecastPage() {
  const [mapType, setMapType] = useState<'city' | 'region'>('city');
  const [metric, setMetric] = useState<ForecastMetric>('sales');
  const [periodMonths, setPeriodMonths] = useState(6);
  const [discountPct, setDiscountPct] = useState(0);
  const [costChangePct, setCostChangePct] = useState(0);
  const [purchasingPowerPct, setPurchasingPowerPct] = useState(0);

  const geojson = useCityGeoJson<GeoJsonPayload<FeatureCollection>>();

  const mutation = useMutation({
    mutationFn: () =>
      runForecast({
        mapType,
        metric,
        periodMonths,
        discountPct,
        costChangePct,
        purchasingPowerPct,
      }),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const result = mutation.data;

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Tahmin ve Senaryo</h1>
      </header>

      <section className="section">
        <form className="panel" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <span className="field__label">Kırılım</span>
              <div className="btn-group" role="group" aria-label="Kırılım">
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-pressed={mapType === 'city'}
                  onClick={() => setMapType('city')}
                >
                  Şehir
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  aria-pressed={mapType === 'region'}
                  onClick={() => setMapType('region')}
                >
                  Bölge
                </button>
              </div>
            </div>

            <div className="field">
              <span className="field__label">Sıralama metriği</span>
              <div className="btn-group" role="group" aria-label="Metrik">
                {(Object.keys(METRIC_LABELS) as ForecastMetric[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="btn btn-sm"
                    aria-pressed={metric === m}
                    onClick={() => setMetric(m)}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <NumberField
              label="Ufuk (ay)"
              hint="1-24 ay"
              value={periodMonths}
              min={1}
              max={24}
              onChange={setPeriodMonths}
            />
            <NumberField
              label="İskonto (%)"
              hint="Fiyat esnekliği 3.0 varsayılır"
              value={discountPct}
              min={0}
              max={90}
              onChange={setDiscountPct}
            />
            <NumberField
              label="Maliyet değişimi (%)"
              hint="Sadece maliyeti etkiler"
              value={costChangePct}
              min={-90}
              max={200}
              onChange={setCostChangePct}
            />
            <NumberField
              label="Alım gücü değişimi (%)"
              hint="Esneklik 0.8 varsayılır"
              value={purchasingPowerPct}
              min={-90}
              max={200}
              onChange={setPurchasingPowerPct}
            />
          </div>

          <div className="row-between" style={{ marginTop: 16 }}>
            <p className="muted">
              Her çalıştırma kaydedilir ve geçmişten tekrar okunabilir.
            </p>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Hesaplanıyor…' : 'Tahmini çalıştır'}
            </button>
          </div>

          {mutation.isError && (
            <p className="form-error" role="alert" style={{ marginTop: 12 }}>
              {isAxiosError(mutation.error) &&
              mutation.error.response?.status === 400
                ? 'Parametreler geçersiz. Aralıkları kontrol edin.'
                : 'Tahmin çalıştırılamadı. Lütfen tekrar deneyin.'}
            </p>
          )}
        </form>
      </section>

      {result && (
        <>
          <section className="section">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>
                Gelecek {result.params.periodMonths} ay
              </h2>
              <span className="muted">
                Çalıştırma #{result.runId} ·{' '}
                {new Date(result.generatedAt).toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="card-grid">
              <TotalsCard
                label="Satış"
                forecast={result.totals.forecast.sales}
                baseline={result.totals.baseline.sales}
                change={result.totals.changePct.sales}
                isMoney
              />
              <TotalsCard
                label="Maliyet"
                forecast={result.totals.forecast.cost}
                baseline={result.totals.baseline.cost}
                change={result.totals.changePct.cost}
                isMoney
              />
              <TotalsCard
                label="Kâr"
                forecast={result.totals.forecast.profit}
                baseline={result.totals.baseline.profit}
                change={result.totals.changePct.profit}
                isMoney
              />
              <TotalsCard
                label="Miktar"
                forecast={result.totals.forecast.quantity}
                baseline={result.totals.baseline.quantity}
                change={result.totals.changePct.quantity}
                isMoney={false}
              />
            </div>

            {/* Model quality is stated up front rather than buried, because a
                run where most areas fell back to their mean should not be
                read the same way as one where they were all fitted. */}
            <p className="muted" style={{ marginTop: 12 }}>
              {result.model.monthsOfHistory} aylık geçmiş ·{' '}
              {result.model.areasModeled} bölge modellendi
              {result.model.areasFallback > 0 &&
                `, ${result.model.areasFallback} bölge yetersiz veri nedeniyle ortalamaya düştü`}
              {result.model.meanRSquared !== null &&
                ` · ortalama R² ${decimal.format(result.model.meanRSquared)}`}
              {result.params.discountPct > 0 &&
                ` · iskonto cironun %${decimal.format(result.model.discountShare * 100)}'ine uygulandı`}
            </p>
          </section>

          {/* The map only makes sense per city: region rows have no plate
              code to join boundaries on. */}
          {result.params.mapType === 'city' && geojson.data && (
            <section className="section">
              <h2 className="section-title">Harita</h2>
              <div className="panel">
                <TurkeyMap
                  geojson={geojson.data.data}
                  values={toMapValues(result)}
                  metricLabel={METRIC_LABELS[result.params.metric]}
                />
              </div>
            </section>
          )}

          <section className="section">
            <h2 className="section-title">
              {result.params.mapType === 'city' ? 'Şehir' : 'Bölge'} bazında
            </h2>
            <div className="panel">
              <div className="table-scroll">
                <table className="table">
                  <caption>
                    {METRIC_LABELS[result.params.metric]} tahminine göre
                    sıralanmıştır. Değişim, gelecek dönem tahmini ile aynı
                    uzunluktaki son gerçekleşen dönemin karşılaştırmasıdır.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        {result.params.mapType === 'city' ? 'Şehir' : 'Bölge'}
                      </th>
                      <th scope="col" className="num">Satış</th>
                      <th scope="col" className="num">Kâr</th>
                      <th scope="col" className="num">Değişim</th>
                      <th scope="col">Yöntem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.areas.map((area) => (
                      <tr key={area.id}>
                        <th scope="row">
                          {area.name}
                          {area.plateCode !== null && (
                            <span className="muted"> ({area.plateCode})</span>
                          )}
                        </th>
                        <td className="num">
                          {compactCurrency.format(area.forecast.sales)}
                        </td>
                        <td className="num">
                          {compactCurrency.format(area.forecast.profit)}
                        </td>
                        <td
                          className={`num ${deltaClass(area.changePct[result.params.metric])}`}
                        >
                          {signedPercent(area.changePct[result.params.metric])}
                        </td>
                        <td>
                          {area.method === 'regression' ? (
                            <span className="tag tag--good">
                              Regresyon
                              {area.rSquared !== null &&
                                ` · R² ${decimal.format(area.rSquared)}`}
                            </span>
                          ) : (
                            <span className="tag tag--muted">Ortalama</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
