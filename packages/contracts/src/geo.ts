/**
 * A stored GeoJSON document — currently Türkiye's 81 provinces, joined to
 * forecast rows on licence-plate code.
 *
 * `T` is the document itself. It is a JSON column, so the API genuinely does
 * not know its shape and leaves it `unknown`; the map component that draws
 * it does know, and says so. That difference is real, which is why it is a
 * parameter rather than one side quietly asserting for both.
 */
export interface GeoJsonPayload<T = unknown> {
  dataType: string;
  version: number;
  data: T;
}

/**
 * Which stored document `/geo/geojson/:type` serves. Only province
 * boundaries exist today; the union is here so adding a second one is a
 * change both sides see rather than a string the web has to guess.
 */
export const GEOJSON_TYPES = ['city'] as const;
export type GeoJsonType = (typeof GEOJSON_TYPES)[number];
