import { useMemo, useState } from 'react';

/**
 * A choropleth of Türkiye's provinces, drawn as plain SVG.
 *
 * Deliberately not Leaflet: this map has one job — fill 81 fixed polygons
 * with a colour — and needs neither pan/zoom over a tile basemap nor an
 * external tile server. Projecting the coordinates ourselves keeps the map
 * free of another runtime dependency, free of any outbound request, and able
 * to take its colours straight from the app's own CSS tokens so it themes
 * with everything else.
 */

interface Feature {
  properties: { name: string; number: number };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface FeatureCollection {
  features: Feature[];
}

export interface MapValue {
  label: string;
  value: number;
  changePct: number | null;
  formatted: string;
}

const WIDTH = 1000;
const HEIGHT = 420;
const PADDING = 8;

/** Rings for a feature, normalising Polygon and MultiPolygon to one shape. */
function ringsOf(feature: Feature): number[][][] {
  if (feature.geometry.type === 'Polygon') {
    return feature.geometry.coordinates as number[][][];
  }
  return (feature.geometry.coordinates as number[][][][]).flat();
}

interface Bounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

function boundsOf(features: Feature[]): Bounds {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const feature of features) {
    for (const ring of ringsOf(feature)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Equirectangular, with longitude degrees narrowed by cos(mean latitude).
 * Without that correction Türkiye at ~39°N comes out roughly 30% too wide
 * and the country looks visibly stretched.
 */
function makeProjection(bounds: Bounds) {
  const meanLat = ((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.cos(meanLat);

  const spanX = (bounds.maxLon - bounds.minLon) * lonScale;
  const spanY = bounds.maxLat - bounds.minLat;
  const scale = Math.min(
    (WIDTH - PADDING * 2) / spanX,
    (HEIGHT - PADDING * 2) / spanY,
  );

  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (HEIGHT - spanY * scale) / 2;

  return ([lon, lat]: number[]): [number, number] => [
    offsetX + (lon - bounds.minLon) * lonScale * scale,
    // SVG y grows downward; latitude grows upward.
    offsetY + (bounds.maxLat - lat) * scale,
  ];
}

function pathFor(
  feature: Feature,
  project: (point: number[]) => [number, number],
): string {
  let d = '';
  for (const ring of ringsOf(feature)) {
    ring.forEach((point, i) => {
      const [x, y] = project(point);
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    d += 'Z';
  }
  return d;
}

export function TurkeyMap({
  geojson,
  values,
  metricLabel,
}: {
  geojson: FeatureCollection;
  /** Keyed by licence-plate code, which is what joins data to boundaries. */
  values: Map<number, MapValue>;
  metricLabel: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const { paths, max } = useMemo(() => {
    const project = makeProjection(boundsOf(geojson.features));
    return {
      paths: geojson.features.map((feature) => ({
        plate: feature.properties.number,
        name: feature.properties.name,
        d: pathFor(feature, project),
      })),
      max: Math.max(...[...values.values()].map((v) => v.value), 0),
    };
  }, [geojson, values]);

  const active = hovered === null ? null : values.get(hovered);
  const activeName =
    hovered === null
      ? null
      : (paths.find((p) => p.plate === hovered)?.name ?? null);

  return (
    <div className="map">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="map__svg"
        role="img"
        aria-label={`${metricLabel} tahmininin il bazında dağılımı`}
      >
        {paths.map((p) => {
          const value = values.get(p.plate);
          // Provinces with no branch are left blank rather than painted as a
          // zero: "no data" and "sold nothing" are different statements.
          const intensity = value && max > 0 ? value.value / max : null;
          return (
            <path
              key={p.plate}
              d={p.d}
              className={
                hovered === p.plate ? 'map__area map__area--hover' : 'map__area'
              }
              style={{
                fill:
                  intensity === null
                    ? 'var(--map-empty)'
                    : `color-mix(in srgb, var(--accent) ${Math.round(
                        10 + intensity * 85,
                      )}%, var(--map-empty))`,
              }}
              onMouseEnter={() => setHovered(p.plate)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>
                {value
                  ? `${p.name}: ${value.formatted}`
                  : `${p.name}: veri yok`}
              </title>
            </path>
          );
        })}
      </svg>

      <div className="map__legend">
        <span className="muted">Düşük</span>
        <span className="map__ramp" aria-hidden="true" />
        <span className="muted">Yüksek</span>
        <span className="map__readout">
          {activeName ? (
            <>
              <strong>{activeName}</strong>{' '}
              {active ? active.formatted : 'veri yok'}
            </>
          ) : (
            <span className="muted">
              Bir ilin üzerine gelin ({metricLabel})
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
