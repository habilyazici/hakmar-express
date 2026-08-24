import { compactCurrency, WEEKDAYS_TR, monthName, num } from '../../lib/format';
import type { HeatmapRow, HeatmapType } from './types';

/**
 * Rendered as a real table rather than a chart library grid: the axes are
 * categorical and finite, the cells carry one number each, and a table gets
 * headers and screen-reader semantics for free.
 */
export function Heatmap({
  rows,
  type,
}: {
  rows: HeatmapRow[];
  type: HeatmapType;
}) {
  const xs = [...new Set(rows.map((r) => String(r.x)))].sort(sorter(type));
  const ys = [...new Set(rows.map((r) => String(r.y)))].sort(sorter(type));

  const byKey = new Map(rows.map((r) => [`${r.x}|${r.y}`, num(r.value)]));
  const max = Math.max(...rows.map((r) => num(r.value)), 0);

  return (
    <div className="table-scroll">
      <table className="table heatmap">
        <thead>
          <tr>
            <th scope="col" />
            {xs.map((x) => (
              <th key={x} scope="col" className="num">
                {formatAxis(x, type, 'x')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map((y) => (
            <tr key={y}>
              <th scope="row">{formatAxis(y, type, 'y')}</th>
              {xs.map((x) => {
                const value = byKey.get(`${x}|${y}`);
                // Intensity is relative to the largest cell, so an all-zero
                // map stays uniformly blank instead of dividing by zero.
                const intensity = value && max > 0 ? value / max : 0;
                return (
                  <td
                    key={x}
                    className="num heatmap__cell"
                    style={{
                      background:
                        intensity > 0
                          ? `color-mix(in srgb, var(--accent) ${Math.round(
                              12 + intensity * 78,
                            )}%, transparent)`
                          : undefined,
                      color: intensity > 0.55 ? 'var(--accent-fg)' : undefined,
                    }}
                    title={
                      value === undefined
                        ? 'Veri yok'
                        : compactCurrency.format(value)
                    }
                  >
                    {value === undefined ? '' : compactCurrency.format(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Numeric axes must sort numerically; region/category names sort as text. */
function sorter(type: HeatmapType) {
  if (type === 'region-category') {
    return (a: string, b: string) => a.localeCompare(b, 'tr');
  }
  return (a: string, b: string) => Number(a) - Number(b);
}

function formatAxis(value: string, type: HeatmapType, axis: 'x' | 'y'): string {
  if (type === 'weekday-hour') {
    return axis === 'x'
      ? (WEEKDAYS_TR[Number(value) - 1] ?? value)
      : `${value.padStart(2, '0')}:00`;
  }
  if (type === 'year-month') {
    return axis === 'x' ? value : monthName(Number(value));
  }
  return value;
}
