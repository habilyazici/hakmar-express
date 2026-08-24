# Reference data

## `tr-cities.json`

Province (il) boundaries for Türkiye as a GeoJSON `FeatureCollection` — 81
features, each a `MultiPolygon` with two properties:

| property | meaning |
| --- | --- |
| `name` | Province name, e.g. `Adana` |
| `number` | Licence-plate code, 1–81 |

`number` is what joins this file to the application: it matches
`City.plateCode`, so a forecast result can be painted onto the map without
any name matching (which would be fragile across spellings like
Afyon / Afyonkarahisar).

**Source:** [alpers/Turkey-Maps-GeoJSON](https://github.com/alpers/Turkey-Maps-GeoJSON),
file `tr-cities.json`.
**Licence:** Apache License 2.0 — redistribution is permitted with
attribution, which is what this file provides.

The legacy application referenced this same filename from
`scripts/load_geojson.js` but the data itself was never committed, so the map
could not be rendered from a fresh checkout. It is committed here for that
reason: the boundaries change essentially never, and a checkout that cannot
draw its own map is not reproducible.

Loaded into the `geojson_data` table by `pnpm --filter api exec prisma db seed`.
