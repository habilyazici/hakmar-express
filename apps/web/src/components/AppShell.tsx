import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/use-auth';
import { ThemeToggle } from './ThemeToggle';
import { Icon, type IconName } from './icons';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/dashboard', label: 'Genel Bakış', icon: 'dashboard' },
  { to: '/charts', label: 'Grafikler', icon: 'charts' },
  { to: '/tables', label: 'Tablolar', icon: 'tables' },
  { to: '/kds', label: 'KDS Analiz', icon: 'kds' },
  { to: '/forecast', label: 'Tahmin', icon: 'forecast' },
  { to: '/transactions', label: 'İşlemler', icon: 'transactions' },
  { to: '/admin', label: 'Yönetim', icon: 'admin' },
  { to: '/users', label: 'Kullanıcılar', icon: 'users' },
];

/*
 * A rail rather than a top bar. Eight destinations plus the account block
 * and the theme switch had outgrown one horizontal row — it wrapped to two
 * lines well before the viewport got narrow — and a vertical list has room
 * for the labels to sit beside icons and for the list to keep growing.
 *
 * Each page renders its own <main className="page">, so the content side is
 * a plain div; wrapping it in a second <main> would nest two landmarks.
 */
export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden="true">
            HE
          </span>
          <span className="sidebar__wordmark">Hakmar Express</span>
        </div>

        <nav className="sidebar__nav" aria-label="Ana menü">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'
              }
            >
              <Icon name={item.icon} />
              <span className="sidebar__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <ThemeToggle />
          <div className="sidebar__account">
            <span className="sidebar__username">{user?.username}</span>
            <span className="sidebar__role">{user?.role}</span>
          </div>
          <button className="btn btn-sm" onClick={() => void logout()}>
            Çıkış yap
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <Outlet />
      </div>
    </div>
  );
}
