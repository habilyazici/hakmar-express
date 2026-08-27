export type FieldType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'reference';

/**
 * A writable field: one of the entity's own scalars. Relations are excluded
 * on purpose — the API takes `categoryId`, not `category`, and naming the
 * object here would produce a 400 the form could only display.
 */
export type ScalarKeys<T> = string extends keyof T
  ? string // the renderer's loose view of a row: any key goes
  : {
      [K in Extract<keyof T, string>]: NonNullable<T[K]> extends object
        ? never
        : K;
    }[Extract<keyof T, string>];

/**
 * A displayable column: one of the entity's own fields, or one field of a
 * related record (`category.name`). Two levels is all the admin table uses
 * and all it should — a third would be a report, not a column.
 */
export type ColumnPath<T> = string extends keyof T
  ? string
  :
      | Extract<keyof T, string>
      | {
          [K in Extract<keyof T, string>]: NonNullable<T[K]> extends object
            ? `${K}.${Extract<keyof NonNullable<T[K]>, string>}`
            : never;
        }[Extract<keyof T, string>];

export interface FieldDef<T = Record<string, unknown>> {
  name: ScalarKeys<T>;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  /** Fixed choices, for `select`. */
  options?: { value: string; label: string }[];
  /** Where to load choices from, for `reference`. */
  reference?: { endpoint: string; valueKey: string; labelKey: string };
  /**
   * Present on create but not on edit. Used for identity fields the API
   * refuses to change — the brand code is a primary key, so offering it in
   * the edit form would only produce a 400.
   */
  createOnly?: boolean;
}

export interface ColumnDef<T = Record<string, unknown>> {
  /** Dot path, so a joined relation can be shown: `category.name`. */
  key: ColumnPath<T>;
  label: string;
  align?: 'left' | 'right';
  /**
   * How to print a column whose stored value is a code rather than a word —
   * a customer's gender is one letter in the database. A value with no entry
   * prints as itself: the column is not constrained by the database, so a row
   * holding something this build has no word for is possible, and showing it
   * is more honest than blanking it.
   */
  labels?: Record<string, string>;
}

export interface ResourceDef<T = Record<string, unknown>> {
  key: string;
  title: string;
  /** Singular, for buttons and confirmations. */
  noun: string;
  endpoint: string;
  /** `id` everywhere except Brand, which is keyed by `code`. */
  idField: ScalarKeys<T>;
  columns: ColumnDef<T>[];
  fields: FieldDef<T>[];
  /** Shown above the table when the list is empty. */
  emptyHint?: string;
}

/**
 * Declares one entity's table, checked against the shape the API actually
 * returns, then widened for the renderer — which walks these definitions
 * generically and has no use for the entity type.
 *
 * The checking is the point: this file used to say it mirrored the API's
 * DTOs, by hand, with nothing comparing the two. A mistyped field name
 * reached the user as a 400 from a form that looked fine.
 */
export function defineResource<T>(def: ResourceDef<T>): ResourceDef {
  return def as ResourceDef;
}

/** Reads a dot path off a row, so columns can reach into joined relations. */
export function readPath(row: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      row,
    );
}
