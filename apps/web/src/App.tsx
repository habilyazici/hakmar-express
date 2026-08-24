import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Suspense, lazy } from 'react';
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFoundPage } from './components/NotFoundPage';
import { AuthProvider } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { DashboardPage } from './features/dashboard/DashboardPage';

/**
 * Recharts is by far the heaviest dependency in the app and only three of the
 * five pages use it. Loading those routes on demand keeps it out of the
 * initial bundle, so login and the dashboard — the first thing every session
 * hits — do not pay for a charting library they never render.
 */
const ChartsPage = lazy(() =>
  import('./features/charts/ChartsPage').then((m) => ({ default: m.ChartsPage })),
);
const TablesPage = lazy(() =>
  import('./features/tables/TablesPage').then((m) => ({ default: m.TablesPage })),
);
const KdsPage = lazy(() =>
  import('./features/kds/KdsPage').then((m) => ({ default: m.KdsPage })),
);
const AdminPage = lazy(() =>
  import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);
const UsersPage = lazy(() =>
  import('./features/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const ForecastPage = lazy(() =>
  import('./features/forecast/ForecastPage').then((m) => ({
    default: m.ForecastPage,
  })),
);

function PageFallback() {
  return (
    <main className="page">
      <p className="muted" role="status">
        Yükleniyor…
      </p>
    </main>
  );
}

/**
 * Defaults matter here because every dashboard query hits an aggregate over
 * the whole receipt history. React Query's stock behaviour (staleTime 0 +
 * refetchOnWindowFocus) re-ran all five of them on every tab focus, and its
 * stock retry (3 attempts) hammered the API on errors that will never
 * succeed on retry — a 401 is already handled by the refresh interceptor,
 * and a 4xx in general is not worth repeating.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isAxiosError(error)) {
          const status = error.response?.status;
          if (status && status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageFallback />}>
                      <AppShell />
                    </Suspense>
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/charts" element={<ChartsPage />} />
                <Route path="/tables" element={<TablesPage />} />
                <Route path="/kds" element={<KdsPage />} />
                <Route path="/forecast" element={<ForecastPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
