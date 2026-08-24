import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './use-auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  // Rendering null here left a blank white page during the silent refresh on
  // every cold load — indistinguishable from a crash.
  if (isLoading) {
    return (
      <main className="centered-page">
        <p className="muted" role="status">
          Yükleniyor…
        </p>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
