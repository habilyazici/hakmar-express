import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { QueryState } from '../../components/QueryState';
import { apiErrorMessage } from '../../lib/api-error';
import { useHasRole } from '../auth/use-auth';
import {
  PAGE_SIZE,
  createResource,
  deleteResource,
  updateResource,
  useInvalidateResource,
  useResourceList,
  type ResourceRow as Row,
  type ResourceValues as Values,
} from './queries';
import { ResourceForm } from './ResourceForm';
import { readPath, type ResourceDef } from './resource-types';

/**
 * Turns the form's values into the request body.
 *
 * A blank optional field means different things in the two modes, and
 * treating them alike is what made an optional value impossible to remove:
 * every blank was dropped, so clearing a branch's coordinates or setting a
 * customer's gender back to "Belirtilmemiş" sent a PATCH that omitted the
 * field, and the API — correctly — left the old value alone. On edit a blank
 * optional field is now an explicit `null`, which every nullable column
 * accepts and `@IsOptional()` skips validating.
 *
 * Required fields stay omitted when blank rather than being sent as null,
 * which would reach a NOT NULL column. The inputs carry `required`, so the
 * browser blocks that submit before it gets here.
 */
function payloadFor(
  resource: ResourceDef,
  values: Values,
  mode: 'create' | 'edit',
): Values {
  const out: Values = {};
  for (const field of resource.fields) {
    if (mode === 'edit' && field.createOnly) continue;
    const value = values[field.name];
    const isBlank = value === undefined || value === null || value === '';
    if (isBlank) {
      if (mode === 'edit' && !field.required) out[field.name] = null;
      continue;
    }
    out[field.name] = value;
  }
  return out;
}

export function ResourceManager({ resource }: { resource: ResourceDef }) {
  // Master data is read-open to every role and write-restricted to ADMIN and
  // above, decided per method on the API. An ANALYST was still shown "Yeni
  // …", "Düzenle" and "Sil", every one of which could only ever come back
  // 403 — a permission boundary presented as a broken screen.
  const canWrite = useHasRole('SUPERADMIN', 'ADMIN');
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const list = useResourceList(resource, offset, search);
  const invalidate = useInvalidateResource(resource);

  function closeForm() {
    setEditing(null);
    setCreating(false);
    setValues({});
    setFormError(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateResource(
          resource,
          editing[resource.idField],
          payloadFor(resource, values, 'edit'),
        );
      } else {
        await createResource(resource, payloadFor(resource, values, 'create'));
      }
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (error) => setFormError(apiErrorMessage(error, resource.noun)),
  });

  const remove = useMutation({
    mutationFn: (row: Row) => deleteResource(resource, row[resource.idField]),
    onSuccess: () => {
      setListError(null);
      invalidate();
    },
    onError: (error) => setListError(apiErrorMessage(error, resource.noun)),
  });

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setValues({});
    setFormError(null);
  }

  function startEdit(row: Row) {
    setCreating(false);
    setEditing(row);
    setFormError(null);
    const initial: Values = {};
    for (const field of resource.fields) {
      initial[field.name] = row[field.name];
    }
    setValues(initial);
  }

  const isFormOpen = creating || editing !== null;

  return (
    <section className="section">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          {resource.title}
        </h2>
        <div className="toolbar" style={{ padding: 0, margin: 0, border: 0 }}>
          <label className="field field--inline">
            <span>Ara</span>
            <input
              className="input"
              type="search"
              value={search}
              placeholder="İsme göre…"
              onChange={(e) => {
                setSearch(e.target.value);
                // A filtered list has different pages; staying on page 3 of
                // the old result would show an empty table.
                setOffset(0);
              }}
            />
          </label>
          {canWrite && (
            <button className="btn btn-primary" onClick={startCreate}>
              Yeni {resource.noun}
            </button>
          )}
        </div>
      </div>

      {!canWrite && (
        <p className="muted" style={{ marginBottom: 12 }}>
          Bu kayıtları görüntüleyebilirsiniz; değiştirmek için yönetici
          yetkisi gerekir.
        </p>
      )}

      {isFormOpen && (
        <div style={{ marginBottom: 16 }}>
          <ResourceForm
            fields={resource.fields.filter(
              (f) => !(editing !== null && f.createOnly),
            )}
            values={values}
            onChange={setValues}
            onSubmit={() => save.mutate()}
            onCancel={closeForm}
            isSaving={save.isPending}
            error={formError}
            submitLabel={editing ? 'Güncelle' : 'Oluştur'}
          />
        </div>
      )}

      {listError && (
        <div className="alert" role="alert">
          <span>{listError}</span>
          <button className="btn" onClick={() => setListError(null)}>
            Kapat
          </button>
        </div>
      )}

      <div className="panel">
        <QueryState
          query={list}
          isEmpty={(page) => page.items.length === 0}
          emptyText={
            search
              ? 'Aramanızla eşleşen kayıt yok.'
              : (resource.emptyHint ?? 'Henüz kayıt yok.')
          }
        >
          {(page) => (
            <>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      {resource.columns.map((c) => (
                        <th
                          key={c.key}
                          scope="col"
                          className={c.align === 'right' ? 'num' : undefined}
                        >
                          {c.label}
                        </th>
                      ))}
                      {canWrite && (
                        <th scope="col" className="num">
                          İşlem
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((row) => {
                      const id = String(row[resource.idField]);
                      return (
                        <tr key={id}>
                          {resource.columns.map((c, i) => {
                            const raw = readPath(row, c.key);
                            const text =
                              raw === null || raw === undefined
                                ? '—'
                                : (c.labels?.[String(raw)] ?? String(raw));
                            return i === 0 ? (
                              <th
                                key={c.key}
                                scope="row"
                                className={c.align === 'right' ? 'num' : undefined}
                              >
                                {text}
                              </th>
                            ) : (
                              <td
                                key={c.key}
                                className={c.align === 'right' ? 'num' : undefined}
                              >
                                {text}
                              </td>
                            );
                          })}
                          {canWrite && (
                            <td className="num">
                              <span className="btn-group">
                                <button
                                  className="btn btn-sm"
                                  onClick={() => startEdit(row)}
                                >
                                  Düzenle
                                </button>
                                <button
                                  className="btn btn-sm"
                                  disabled={remove.isPending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Bu ${resource.noun} silinsin mi? Bu işlem geri alınamaz.`,
                                      )
                                    ) {
                                      remove.mutate(row);
                                    }
                                  }}
                                >
                                  Sil
                                </button>
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="row-between" style={{ marginTop: 12 }}>
                <span className="muted">
                  {page.total} kayıt · {offset + 1}-
                  {Math.min(offset + page.items.length, page.total)} arası
                </span>
                <span className="btn-group">
                  <button
                    className="btn btn-sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Önceki
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={offset + PAGE_SIZE >= page.total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Sonraki
                  </button>
                </span>
              </div>
            </>
          )}
        </QueryState>
      </div>
    </section>
  );
}
