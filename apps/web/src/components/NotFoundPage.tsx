import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="centered-page">
      <div className="panel stack">
        <h1 className="page-title">Sayfa bulunamadı</h1>
        <p className="muted">
          Aradığınız sayfa taşınmış veya hiç var olmamış olabilir.
        </p>
        <Link className="btn btn-primary" to="/dashboard">
          Panele dön
        </Link>
      </div>
    </main>
  );
}
