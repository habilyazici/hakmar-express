import { isAxiosError } from 'axios';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';

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
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Hakmar Express</h1>
        <input
          type="text"
          placeholder="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p style={{ color: 'crimson', fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </main>
  );
}
