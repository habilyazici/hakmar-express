import { useState } from 'react';
import { ResourceManager } from './ResourceManager';
import { RESOURCES } from './resources';

const GROUPS = [
  { label: 'Katalog', keys: ['categories', 'subcategories', 'brands', 'products'] },
  { label: 'Coğrafya', keys: ['regions', 'cities', 'branches'] },
  { label: 'Kişiler', keys: ['customers', 'cashiers'] },
];

export function AdminPage() {
  const [active, setActive] = useState(RESOURCES[0].key);
  const resource = RESOURCES.find((r) => r.key === active) ?? RESOURCES[0];

  return (
    <main className="page">
      <header className="page-header">
        <h1 className="page-title">Yönetim</h1>
      </header>

      {/* Grouped rather than one flat list of nine: the ordering within each
          group is also the order records have to be created in, since a
          product needs a brand and a brand needs a category. */}
      <nav className="tabs" aria-label="Kayıt türü">
        {GROUPS.map((group) => (
          <div key={group.label} className="tabs__group">
            <span className="tabs__label">{group.label}</span>
            <div className="btn-group">
              {group.keys.map((key) => {
                const item = RESOURCES.find((r) => r.key === key);
                if (!item) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    className="btn btn-sm"
                    aria-pressed={active === key}
                    onClick={() => setActive(key)}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Keyed so switching resources remounts: otherwise an open edit form
          and its half-filled values would carry over to a different entity. */}
      <ResourceManager key={resource.key} resource={resource} />
    </main>
  );
}
