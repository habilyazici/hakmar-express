import { useMutation } from '@tanstack/react-query';
import type { Role } from '@hakmar/contracts';
import { useId, useState } from 'react';
import { QueryState } from '../../components/QueryState';
import { apiErrorMessage } from '../../lib/api-error';
import { useAuth } from '../auth/use-auth';
import {
  changeOwnPassword,
  createUser,
  deleteUser,
  setUserPassword,
  updateUser,
  useInvalidateUsers,
  useUsers,
  type User,
} from './queries';

const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Süper Yönetici',
  ADMIN: 'Yönetici',
  ANALYST: 'Analist',
};

const ROLE_TONE: Record<Role, string> = {
  SUPERADMIN: 'tag--good',
  ADMIN: 'tag--info',
  ANALYST: 'tag--muted',
};

const PASSWORD_HINT =
  'En az 12 karakter; küçük harf, büyük harf ve rakam içermeli.';

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        required={required}
        autoComplete={type === 'password' ? 'new-password' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

/** Anyone can change their own password; this is the one non-SUPERADMIN part. */
function OwnPasswordPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => changeOwnPassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setError(null);
      setMessage('Şifreniz güncellendi.');
    },
    onError: (err) => {
      setMessage(null);
      setError(apiErrorMessage(err, 'kullanıcı'));
    },
  });

  return (
    <section className="section">
      <h2 className="section-title">Şifremi değiştir</h2>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
      >
        <div className="form-grid">
          <TextField
            label="Mevcut şifre"
            type="password"
            value={current}
            onChange={setCurrent}
            required
          />
          <TextField
            label="Yeni şifre"
            type="password"
            value={next}
            onChange={setNext}
            required
            hint={PASSWORD_HINT}
          />
        </div>
        {error && (
          <p className="form-error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
        {message && (
          <p className="muted" role="status" style={{ marginTop: 12 }}>
            {message}
          </p>
        )}
        <div className="row-between" style={{ marginTop: 16 }}>
          <span className="muted">
            Şifre değişikliği açık oturumlarınızı sonlandırır.
          </span>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={change.isPending}
          >
            {change.isPending ? 'Kaydediliyor…' : 'Şifreyi değiştir'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function UsersPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'SUPERADMIN';

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    jobTitle: '',
    role: 'ANALYST' as Role,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const list = useUsers(isSuperadmin);
  const invalidate = useInvalidateUsers();

  const create = useMutation({
    mutationFn: () =>
      createUser({
        username: form.username,
        password: form.password,
        fullName: form.fullName,
        email: form.email || undefined,
        jobTitle: form.jobTitle || undefined,
        role: form.role,
      }),
    onSuccess: () => {
      invalidate();
      setCreating(false);
      setForm({
        username: '',
        password: '',
        fullName: '',
        email: '',
        jobTitle: '',
        role: 'ANALYST',
      });
      setFormError(null);
    },
    onError: (err) => setFormError(apiErrorMessage(err, 'kullanıcı')),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      updateUser(id, body),
    onSuccess: () => {
      setListError(null);
      invalidate();
    },
    onError: (err) => setListError(apiErrorMessage(err, 'kullanıcı')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      setListError(null);
      invalidate();
    },
    onError: (err) => setListError(apiErrorMessage(err, 'kullanıcı')),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      setUserPassword(id, password),
    onSuccess: () => {
      setResetFor(null);
      setNewPassword('');
      setListError(null);
    },
    onError: (err) => setListError(apiErrorMessage(err, 'kullanıcı')),
  });

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Kullanıcılar</h1>
      </header>

      <OwnPasswordPanel />

      {!isSuperadmin ? (
        <section className="section">
          <div className="panel">
            <p className="muted">
              Kullanıcı yönetimi yalnızca süper yöneticilere açıktır.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>
                Hesaplar
              </h2>
              <button
                className="btn btn-primary"
                onClick={() => setCreating((v) => !v)}
              >
                {creating ? 'Vazgeç' : 'Yeni kullanıcı'}
              </button>
            </div>

            {creating && (
              <form
                className="panel"
                style={{ marginBottom: 16 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate();
                }}
              >
                <div className="form-grid">
                  <TextField
                    label="Kullanıcı adı"
                    value={form.username}
                    onChange={(v) => setForm({ ...form, username: v })}
                    required
                    hint="3-40 karakter; harf, rakam, nokta, alt çizgi veya tire."
                  />
                  <TextField
                    label="Ad soyad"
                    value={form.fullName}
                    onChange={(v) => setForm({ ...form, fullName: v })}
                    required
                  />
                  <TextField
                    label="Şifre"
                    type="password"
                    value={form.password}
                    onChange={(v) => setForm({ ...form, password: v })}
                    required
                    hint={PASSWORD_HINT}
                  />
                  <TextField
                    label="E-posta"
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                  />
                  <TextField
                    label="Görev"
                    value={form.jobTitle}
                    onChange={(v) => setForm({ ...form, jobTitle: v })}
                  />
                  <div className="field">
                    <span className="field__label">Rol *</span>
                    <div className="btn-group">
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          className="btn btn-sm"
                          aria-pressed={form.role === r}
                          onClick={() => setForm({ ...form, role: r })}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {formError && (
                  <p className="form-error" role="alert" style={{ marginTop: 12 }}>
                    {formError}
                  </p>
                )}

                <div className="row-between" style={{ marginTop: 16 }}>
                  <span className="muted">* zorunlu alan</span>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={create.isPending}
                  >
                    {create.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
                  </button>
                </div>
              </form>
            )}

            {listError && (
              <div className="alert" role="alert">
                <span>{listError}</span>
                <button className="btn" onClick={() => setListError(null)}>
                  Kapat
                </button>
              </div>
            )}

            {resetFor && (
              <form
                className="panel"
                style={{ marginBottom: 16 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  resetPassword.mutate({
                    id: resetFor.id,
                    password: newPassword,
                  });
                }}
              >
                <div className="form-grid">
                  <TextField
                    label={`${resetFor.username} için yeni şifre`}
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    required
                    hint={PASSWORD_HINT}
                  />
                </div>
                <div className="row-between" style={{ marginTop: 16 }}>
                  <span className="muted">
                    Sıfırlama, bu kullanıcının açık oturumlarını sonlandırır.
                  </span>
                  <span className="btn-group">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setResetFor(null);
                        setNewPassword('');
                      }}
                    >
                      Vazgeç
                    </button>
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={resetPassword.isPending}
                    >
                      Şifreyi sıfırla
                    </button>
                  </span>
                </div>
              </form>
            )}

            <div className="panel">
              <QueryState query={list} isEmpty={(p) => p.items.length === 0}>
                {(page) => (
                  <div className="table-scroll">
                    <table className="table">
                      <caption>
                        Kendi hesabınızın rolünü değiştiremez, hesabınızı
                        kapatamaz veya silemezsiniz; son süper yönetici de
                        kaldırılamaz.
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Kullanıcı</th>
                          <th scope="col">Ad soyad</th>
                          <th scope="col">Rol</th>
                          <th scope="col">Durum</th>
                          <th scope="col" className="num">
                            İşlem
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {page.items.map((row) => {
                          const isSelf = row.id === user?.sub;
                          return (
                            <tr key={row.id}>
                              <th scope="row">
                                {row.username}
                                {isSelf && (
                                  <span className="muted"> (siz)</span>
                                )}
                              </th>
                              <td>{row.fullName}</td>
                              <td>
                                <span className={`tag ${ROLE_TONE[row.role]}`}>
                                  {ROLE_LABELS[row.role]}
                                </span>
                              </td>
                              <td>
                                {row.isActive ? (
                                  <span className="tag tag--good">Aktif</span>
                                ) : (
                                  <span className="tag tag--bad">Kapalı</span>
                                )}
                              </td>
                              <td className="num">
                                <span className="btn-group">
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => setResetFor(row)}
                                  >
                                    Şifre
                                  </button>
                                  {/* Disabled for your own row: the API
                                      refuses these, so offering them would
                                      only produce an error. */}
                                  <button
                                    className="btn btn-sm"
                                    disabled={isSelf || patch.isPending}
                                    onClick={() =>
                                      patch.mutate({
                                        id: row.id,
                                        body: { isActive: !row.isActive },
                                      })
                                    }
                                  >
                                    {row.isActive ? 'Kapat' : 'Aç'}
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    disabled={isSelf || remove.isPending}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `${row.username} silinsin mi? Bu işlem geri alınamaz.`,
                                        )
                                      ) {
                                        remove.mutate(row.id);
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
                )}
              </QueryState>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
