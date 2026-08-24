import { useId } from 'react';
import { useApiQuery } from '../../lib/query';
import type { FieldDef } from './resource-types';

type Values = Record<string, unknown>;

interface Page<T> {
  items: T[];
}

/** A dropdown whose options come from another resource's list endpoint. */
function ReferenceField({
  field,
  value,
  onChange,
  id,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
}) {
  const ref = field.reference!;
  const query = useApiQuery<Page<Record<string, unknown>>>(
    ['ref', ref.endpoint],
    ref.endpoint,
    { limit: 200 },
  );

  const items = query.data?.items ?? [];

  return (
    <select
      id={id}
      className="input"
      value={value === undefined || value === null ? '' : String(value)}
      required={field.required}
      disabled={query.isPending}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(undefined);
          return;
        }
        // Numeric foreign keys have to go back as numbers; a brand code is a
        // string and must not be coerced.
        const asNumber = Number(raw);
        onChange(
          ref.valueKey === 'id' && Number.isFinite(asNumber) ? asNumber : raw,
        );
      }}
    >
      <option value="">
        {query.isPending ? 'Yükleniyor…' : 'Seçiniz…'}
      </option>
      {items.map((item) => (
        <option key={String(item[ref.valueKey])} value={String(item[ref.valueKey])}>
          {String(item[ref.labelKey])}
        </option>
      ))}
    </select>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>

      {field.type === 'reference' && (
        <ReferenceField field={field} value={value} onChange={onChange} id={id} />
      )}

      {field.type === 'select' && (
        <select
          id={id}
          className="input"
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : e.target.value)
          }
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'checkbox' && (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      )}

      {(field.type === 'text' || field.type === 'number') && (
        <input
          id={id}
          className="input"
          type={field.type === 'number' ? 'number' : 'text'}
          step={field.type === 'number' ? 'any' : undefined}
          value={value === undefined || value === null ? '' : String(value)}
          required={field.required}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(undefined);
              return;
            }
            onChange(field.type === 'number' ? Number(raw) : raw);
          }}
        />
      )}

      {field.hint && <span className="field__hint">{field.hint}</span>}
    </div>
  );
}

export function ResourceForm({
  fields,
  values,
  onChange,
  onSubmit,
  onCancel,
  isSaving,
  error,
  submitLabel,
}: {
  fields: FieldDef[];
  values: Values;
  onChange: (values: Values) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="form-grid">
        {fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => onChange({ ...values, [field.name]: value })}
          />
        ))}
      </div>

      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      <div className="row-between" style={{ marginTop: 16 }}>
        <span className="muted">* zorunlu alan</span>
        <span className="btn-group">
          <button type="button" className="btn" onClick={onCancel}>
            Vazgeç
          </button>
          <button className="btn btn-primary" type="submit" disabled={isSaving}>
            {isSaving ? 'Kaydediliyor…' : submitLabel}
          </button>
        </span>
      </div>
    </form>
  );
}
