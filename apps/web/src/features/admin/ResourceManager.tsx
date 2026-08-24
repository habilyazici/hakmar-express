import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { QueryState } from '../../components/QueryState';
import { apiClient } from '../../lib/api-client';
import { apiErrorMessage } from '../../lib/api-error';
import { fetchData } from '../../lib/query';
import { ResourceForm } from './ResourceForm';
import { readPath, type ResourceDef } from './resource-types';

type Row = Record<string, unknown>;
type Values = Record<string, unknown>;

interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 25;

/** Strips fields the API refuses on edit, plus anything left blank. */
function payloadFor(
  resource: ResourceDef,
  values: Values,
  mode: 'create' | 'edit',
): Values {
  const out: Values = {};
  for (const field of resource.fields) {
    if (mode === 'edit' && field.createOnly) continue;
    const value = values[field.name];
    if (value === undefined || value === '') continue;
    out[field.name] = value;
  }
  return out;
}

export function ResourceManager({ resource }: { resource: ResourceDef }) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const listKey = [resource.key, 'list', offset, search] as const;

  const list = useQuery({
    queryKey: listKey,
    queryFn: () =>
      fetchData<Page<Row>>(resource.endpoint, {
        limit: PAGE_SIZE,
        offset,
        search: search || undefined,
      }),
  });

  function invalidate() {
    // The reference dropdowns in other forms read the same endpoints, so the
    // whole resource's cache goes, not just this page of it.
    void queryClient.invalidateQueries({ queryKey: [resource.key] });
    void queryClient.invalidateQueries({ queryKey: ['ref', resource.endpoint] });
  }

  function closeForm() {
    setEditing(null);
    setCreating(false);
    setValues({});
    setFormError(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const id = editing[resource.idField];
        await apiClient.patch(
          `${resource.endpoint}/${String(id)}`,
          payloadFor(resource, values, 'edit'),
        );
      } else {
        await apiClient.post(
          resource.endpoint,
          payloadFor(resource, values, 'create'),
        );
      }
    },
    onSuccess: () => {
      invalidate();
      closeForm();
    },
    onError: (error) => setFormError(apiErrorMessage(error, resource.noun)),
  });

  const remove = useMutation({
    mutationFn: (row: Row) =>
      apiClient.delete(
        `${resource.endpoint}/${String(row[resource.idField])}`,
      ),
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
          <button className="btn btn-primary" onClick={startCreate}>
            Yeni {resource.noun}
          </button>
        </div>
      </div>

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
                      <th scope="col" className="num">
                        İşlem
                      </th>
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
                                : String(raw);
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
