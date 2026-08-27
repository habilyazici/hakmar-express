import { useId } from 'react';
import { ReferenceSelect } from '../../components/ReferenceSelect';
import type { FieldDef } from './resource-types';

type Values = Record<string, unknown>;

/**
 * A foreign key, rendered as a dropdown over the related resource.
 *
 * The value goes back as a number for the numeric keys and as a string for a
 * brand code, which is the one entity keyed by something else.
 */
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

  return (
    <ReferenceSelect<Record<string, unknown>>
      id={id}
      endpoint={ref.endpoint}
      valueKey={ref.valueKey}
      labelOf={(item) => String(item[ref.labelKey])}
      value={value === undefined || value === null ? '' : String(value)}
      required={field.required}
      emptyLabel="Seçiniz…"
      onChange={(raw) => {
        if (raw === '') {
          onChange(undefined);
          return;
        }
        const asNumber = Number(raw);
        onChange(
          ref.valueKey === 'id' && Number.isFinite(asNumber) ? asNumber : raw,
        );
      }}
    />
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
