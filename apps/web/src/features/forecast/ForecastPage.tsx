import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { QueryState } from '../../components/QueryState';
import {
  compactCurrency,
  currency,
  decimal,
  deltaClass,
  integer,
  num,
  signedPercent,
} from '../../lib/format';
import { ReferenceSelect } from '../../components/ReferenceSelect';
import {
  DISCOUNT_SCOPES,
  MAP_TYPES,
  type DiscountScope,
  type ForecastMetric,
  type GeoJsonPayload,
  type ForecastRunResult,
  type ForecastRunSummary,
  type MapType,
} from '@hakmar/contracts';
import {
  FORECAST_RUNS_KEY,
  loadForecastRun,
  runForecast,
  useCityGeoJson,
  useForecastRuns,
} from './queries';
import { TurkeyMap, type FeatureCollection, type MapValue } from './TurkeyMap';

const METRIC_LABELS: Record<ForecastMetric, string> = {
  quantity: 'Miktar',
  sales: 'Satış',
  cost: 'Maliyet',
  profit: 'Kâr',
};

const MAP_TYPE_LABELS: Record<MapType, string> = {
  city: 'Şehir',
  region: 'Bölge',
};

/**
 * A discount can be applied to everything or aimed at one category or
 * product, and the API reads that target's real share of revenue out of the
 * database rather than assuming one. None of that was reachable: the form
 * never sent a scope, so every simulation discounted the whole basket and
 * the "iskonto cironun %100'üne uygulandı" line said the same thing forever.
 */
const SCOPE_LABELS: Record<DiscountScope, string> = {
  all: 'Tüm ürünler',
  category: 'Kategori',
  product: 'Ürün',
};

const SCOPE_ENDPOINTS: Record<Exclude<DiscountScope, 'all'>, string> = {
  category: '/catalog/categories',
  product: '/catalog/products',
};

function DiscountTargetSelect({
  scope,
  value,
  onChange,
}: {
  scope: Exclude<DiscountScope, 'all'>;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id}>{SCOPE_LABELS[scope]}</label>
      <ReferenceSelect<{ id: number; name: string }>
        id={id}
        endpoint={SCOPE_ENDPOINTS[scope]}
        valueKey="id"
        labelOf={(item) => item.name}
        value={value === undefined ? '' : String(value)}
        required
        emptyLabel="Seçiniz…"
        hint="İskonto yalnızca bu seçimin cirodaki payına uygulanır."
        onChange={(raw) => onChange(raw === '' ? undefined : Number(raw))}
      />
    </div>
  );
}

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

const runTimestamp = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * Looks up a label for a value that came back out of a text column.
 *
 * `mapType`, `metric` and `discountType` are stored as text precisely so a
 * run made under an older vocabulary still reads back, which means a stored
 * value need not be one this build has a label for. Showing the raw value is
 * the honest fallback; a cast to the current union would only be a claim.
 */
function label(labels: Record<string, string>, value: string | null): string {
  if (value === null) return '—';
  return labels[value] ?? value;
}

/** A stored run's parameters, written the way the form asks for them. */
function scenarioSummary(run: ForecastRunSummary): string {
  const parts: string[] = [];

  const discount = num(run.discountPct);
  if (discount !== 0) {
    const scope = run.discountType;
    const where =
      scope !== null && scope !== 'all'
        ? ` (${label(SCOPE_LABELS, scope)} #${String(run.discountTargetId ?? '?')})`
        : '';
    parts.push(`iskonto %${decimal.format(discount)}${where}`);
  }

  // Signed, so these read as the deltas they are and match how every other
  // change in the app is written.
  const cost = num(run.costChangePct);
  if (cost !== 0) parts.push(`maliyet ${signedPercent(cost)}`);
  const power = num(run.purchasingPowerPct);
  if (power !== 0) parts.push(`alım gücü ${signedPercent(power)}`);

  return parts.length > 0 ? parts.join(' · ') : 'senaryosuz';
}

/**
 * The recorded runs.
 *
 * Every run has always been written to spatial_forecast_runs and both read
 * endpoints have always existed — the page just said so without offering a
 * way in. Reloading one restores exactly the numbers it produced, which is
 * the point of storing the whole result rather than the parameters alone.
 */
function RunHistory({
  activeRunId,
  restoringId,
  onRestore,
}: {
  activeRunId: number | null;
  restoringId: number | null;
  onRestore: (id: number) => void;
}) {
  // Twenty is enough to find the run you just made; the rest is an archive
  // you occasionally need. The API caps retention well above this, so "more"
  // has a definite end rather than growing without bound.
  const [limit, setLimit] = useState(20);
  const runs = useForecastRuns(limit);

  return (
    <section className="section">
      <h2 className="section-title">Geçmiş çalıştırmalar</h2>
      <div className="panel">
        <QueryState
          query={runs}
          isEmpty={(rows) => rows.length === 0}
          emptyText="Henüz kayıtlı bir çalıştırma yok."
        >
          {(rows) => (
            <div className="table-scroll">
              <table className="table">
                <caption>
                  Her çalıştırma sonucuyla birlikte saklanır; buradan
                  yüklendiğinde ürettiği sayıların aynısı görüntülenir.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="num">#</th>
                    <th scope="col">Tarih</th>
                    <th scope="col">Kırılım</th>
                    <th scope="col">Metrik</th>
                    <th scope="col" className="num">Ufuk</th>
                    <th scope="col">Senaryo</th>
                    <th scope="col" className="num" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((run) => (
                    <tr key={run.id}>
                      <th scope="row" className="num">
                        #{run.id}
                      </th>
                      <td>{runTimestamp.format(new Date(run.createdAt))}</td>
                      <td>{label(MAP_TYPE_LABELS, run.mapType)}</td>
                      <td>{label(METRIC_LABELS, run.metric)}</td>
                      <td className="num">{run.periodMonths} ay</td>
                      <td className="muted">{scenarioSummary(run)}</td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={restoringId !== null}
                          aria-pressed={activeRunId === run.id}
                          onClick={() => onRestore(run.id)}
                        >
                          {restoringId === run.id ? 'Yükleniyor…' : 'Görüntüle'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {rows.length >= limit && (
                <div className="row-between" style={{ marginTop: 12 }}>
                  <span className="muted">
                    En son {rows.length} çalıştırma gösteriliyor.
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={runs.isFetching}
                    onClick={() => setLimit((n) => n + 30)}
                  >
                    {runs.isFetching ? 'Yükleniyor…' : 'Daha fazla göster'}
                  </button>
                </div>
              )}
            </div>
          )}
        </QueryState>
      </div>
    </section>
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
  const queryClient = useQueryClient();
  const [mapType, setMapType] = useState<MapType>('city');
  const [metric, setMetric] = useState<ForecastMetric>('sales');
  const [periodMonths, setPeriodMonths] = useState(6);
  const [discountPct, setDiscountPct] = useState(0);
  const [discountScope, setDiscountScope] = useState<DiscountScope>('all');
  const [discountTargetId, setDiscountTargetId] = useState<number>();
  const [costChangePct, setCostChangePct] = useState(0);
  const [purchasingPowerPct, setPurchasingPowerPct] = useState(0);

  // One piece of state for what is on screen, fed by two sources: a run just
  // computed, or one loaded back out of the history. Reading mutation.data
  // directly meant the history could not put anything there.
  const [result, setResult] = useState<ForecastRunResult | null>(null);

  const geojson = useCityGeoJson<GeoJsonPayload<FeatureCollection>>();

  const scopeNeedsTarget = discountScope !== 'all';

  const mutation = useMutation({
    mutationFn: () =>
      runForecast({
        mapType,
        metric,
        periodMonths,
        discountPct,
        discountScope,
        // Only sent when the scope asks for one; the API requires it then and
        // rejects the request without it.
        ...(scopeNeedsTarget ? { discountTargetId } : {}),
        costChangePct,
        purchasingPowerPct,
      }),
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: FORECAST_RUNS_KEY });
    },
  });

  const restore = useMutation({
    mutationFn: (id: number) => loadForecastRun(id),
    onSuccess: (data) => setResult(data),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

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
                {MAP_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn btn-sm"
                    aria-pressed={mapType === t}
                    onClick={() => setMapType(t)}
                  >
                    {MAP_TYPE_LABELS[t]}
                  </button>
                ))}
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

            <div className="field">
              <span className="field__label">İskonto kapsamı</span>
              <div className="btn-group" role="group" aria-label="İskonto kapsamı">
                {DISCOUNT_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    className="btn btn-sm"
                    aria-pressed={discountScope === scope}
                    onClick={() => {
                      setDiscountScope(scope);
                      // The target belongs to the scope that asked for it.
                      setDiscountTargetId(undefined);
                    }}
                  >
                    {SCOPE_LABELS[scope]}
                  </button>
                ))}
              </div>
            </div>

            {scopeNeedsTarget && (
              <DiscountTargetSelect
                scope={discountScope}
                value={discountTargetId}
                onChange={setDiscountTargetId}
              />
            )}
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
              Her çalıştırma kaydedilir; aşağıdaki geçmiş listesinden tekrar
              görüntülenebilir.
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
                {runTimestamp.format(new Date(result.generatedAt))}
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

      {restore.isError && (
        <div className="alert" role="alert">
          <span>Kayıtlı çalıştırma yüklenemedi.</span>
          <button className="btn" onClick={() => restore.reset()}>
            Kapat
          </button>
        </div>
      )}

      {/* Last, so a run's own numbers stay next to the form that asked for
          them rather than being pushed down the page by the archive. */}
      <RunHistory
        activeRunId={result?.runId ?? null}
        restoringId={restore.isPending ? (restore.variables ?? null) : null}
        onRestore={(id) => restore.mutate(id)}
      />
    </main>
  );
}
