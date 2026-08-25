import type { ReactNode } from 'react';

/*
 * Eight nav glyphs drawn inline rather than pulled from an icon package.
 * A dependency would ship a few hundred sprites and a tree-shaking question
 * to answer for the eight this app actually renders; these inherit
 * currentColor, so the active/hover states cost no extra rules.
 */
export type IconName =
  | 'dashboard'
  | 'charts'
  | 'tables'
  | 'kds'
  | 'forecast'
  | 'transactions'
  | 'admin'
  | 'users';

const PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  charts: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8.5 20v-6" />
      <path d="M13 20V8" />
      <path d="M17.5 20v-9" />
    </>
  ),
  tables: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M3 15h18" />
      <path d="M10 9.5V20" />
    </>
  ),
  kds: (
    <>
      <path d="M12 3 21 8l-9 5-9-5 9-5Z" />
      <path d="m3.5 12.5 8.5 4.7 8.5-4.7" />
      <path d="m3.5 16.8 8.5 4.7 8.5-4.7" />
    </>
  ),
  forecast: (
    <>
      <path d="M3 17.5 9 11l4 4 8-8.5" />
      <path d="M15.5 6.5H21v5.5" />
    </>
  ),
  transactions: (
    <>
      <path d="M6 2.5h12v19l-3-1.8-3 1.8-3-1.8-3 1.8v-19Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 12h5" />
    </>
  ),
  admin: (
    <>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.3" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.3 3.3 0 0 1 0 5.6" />
      <path d="M18.2 14.4A6.5 6.5 0 0 1 21 20" />
    </>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
