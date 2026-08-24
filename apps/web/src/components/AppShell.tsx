import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth';

const NAV = [
  { to: '/dashboard', label: 'Genel Bakış' },
  { to: '/charts', label: 'Grafikler' },
  { to: '/tables', label: 'Tablolar' },
  { to: '/kds', label: 'KDS Analiz' },
  { to: '/forecast', label: 'Tahmin' },
  { to: '/admin', label: 'Yönetim' },
  { to: '/users', label: 'Kullanıcılar' },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="shell__bar">
        <div className="shell__brand">Hakmar Express</div>
        <nav className="shell__nav" aria-label="Ana menü">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'shell__link shell__link--active' : 'shell__link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="shell__user">
          <span className="user-chip">
            {user?.username} ({user?.role})
          </span>
          <button className="btn" onClick={() => void logout()}>
            Çıkış yap
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
