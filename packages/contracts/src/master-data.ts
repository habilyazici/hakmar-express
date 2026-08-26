/**
 * The nine master-data entities the Yönetim screen drives.
 *
 * Related records are optional here, and that is not hedging: these
 * endpoints are served by one generic CRUD base whose delegate calls are
 * typed from the model alone. Which relations come back is decided by each
 * service's `include` config, which the delegate's type cannot see. Marking
 * them required would be a claim the compiler never checks; marking them
 * optional is what the base class actually guarantees, and it is what lets
 * the scalar fields be checked for real instead of the whole CRUD path
 * flowing through `unknown`.
 */

export interface NamedRef {
  id: number;
  name: string;
}

// ------------------------------------------------------------------ catalog

export interface CategoryDto {
  id: number;
  name: string;
}

export interface SubcategoryDto {
  id: number;
  name: string;
  categoryId: number;
  category?: NamedRef;
}

/** Keyed by `code`, not the `id` every other entity uses. */
export interface BrandDto {
  code: string;
  name: string;
  categoryId: number;
  category?: NamedRef;
}

export interface ProductDto {
  id: number;
  name: string;
  brandCode: string;
  subcategoryId: number;
  brand?: { code: string; name: string };
  subcategory?: NamedRef & { category: NamedRef };
}

// ---------------------------------------------------------------------- geo

export interface RegionDto {
  id: number;
  name: string;
}

export interface CityDto {
  id: number;
  name: string;
  plateCode: number;
  regionId: number;
  region?: NamedRef;
}

export interface BranchDto {
  id: number;
  name: string;
  cityId: number;
  latitude: number | null;
  longitude: number | null;
  city?: NamedRef & { region: NamedRef };
}

// ------------------------------------------------------------------- people

export interface CustomerDto {
  id: number;
  firstName: string;
  lastName: string;
  gender: string | null;
}

export interface CashierDto {
  id: number;
  firstName: string;
  lastName: string;
  branchId: number;
  branch?: NamedRef;
}
