import { isAxiosError } from 'axios';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './use-auth';

function loginErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 429) {
      return 'Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin.';
    }
    if (err.response?.status === 401) {
      return 'Kullanıcı adı veya şifre hatalı.';
    }
  }
  return 'Bir şeyler ters gitti. Lütfen daha sonra tekrar deneyin.';
}

export function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const usernameId = useId();
  const passwordId = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // An already-signed-in user landing on /login (via a bookmark, or the back
  // button after logging in) used to get the form again with no indication
  // they already had a session.
  useEffect(() => {
    if (!isLoading && user) navigate('/dashboard', { replace: true });
  }, [isLoading, user, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="centered-page">
      <form
        onSubmit={handleSubmit}
        className="panel stack"
        /* max-width, not width: .centered-page adds 24px of padding either
           side, so a fixed 320 overflows a 360px-wide phone by eight pixels
           and the sign-in page — the one screen every session starts on —
           scrolls sideways. */
        style={{ width: '100%', maxWidth: 320, gap: 16 }}
      >
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="page-title">Hakmar Express</h1>
          <p className="muted">Yönetim paneline giriş yapın.</p>
        </div>

        <div className="field">
          <label htmlFor={usernameId}>Kullanıcı adı</label>
          <input
            id={usernameId}
            className="input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div className="field">
          <label htmlFor={passwordId}>Şifre</label>
          <input
            id={passwordId}
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </main>
  );
}
