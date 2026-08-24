export type FieldType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'reference';

export interface FieldDef {
  name: string;
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

export interface ColumnDef {
  /** Dot path, so a joined relation can be shown: `category.name`. */
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ResourceDef {
  key: string;
  title: string;
  /** Singular, for buttons and confirmations. */
  noun: string;
  endpoint: string;
  /** `id` everywhere except Brand, which is keyed by `code`. */
  idField: string;
  columns: ColumnDef[];
  fields: FieldDef[];
  /** Shown above the table when the list is empty. */
  emptyHint?: string;
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
