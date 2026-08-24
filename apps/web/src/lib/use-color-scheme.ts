import { useSyncExternalStore } from 'react';

/**
 * The viewer either pins a theme or leaves it following the OS. 'system' is
 * the default and is stored as the absence of a data-theme attribute, so the
 * CSS needs no rule for it — light-dark() already resolves against the OS.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

const STORAGE_KEY = 'hakmar.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Pure so it can be tested without a DOM: the two inputs are the stored
 * choice and what the OS currently says.
 */
export function resolveIsDark(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): boolean {
  return choice === 'system' ? systemPrefersDark : choice === 'dark';
}

function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    value === 'system' || value === 'light' || value === 'dark'
  );
}

function readStoredChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isThemeChoice(raw) ? raw : 'system';
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. Following the OS is the right fallback.
    return 'system';
  }
}

function applyChoice(next: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);
}

/*
 * One module-level store rather than a context: the switch in the header and
 * the chart palettes several routes away read the same value, and threading
 * a provider through lazy-loaded routes to share one enum is more machinery
 * than the problem needs.
 */
const listeners = new Set<() => void>();
let choice: ThemeChoice = readStoredChoice();

const media =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY)
    : null;
let systemPrefersDark = media?.matches ?? false;

function emit(): void {
  for (const listener of listeners) listener();
}

// Never removed: the store outlives every component that reads it, and a
// change while 'system' is selected has to reach the charts without a reload.
media?.addEventListener('change', (event) => {
  systemPrefersDark = event.matches;
  emit();
});

// The inline script in index.html has already done this for the first paint;
// repeating it keeps the attribute right if that script was skipped.
applyChoice(choice);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getChoice(): ThemeChoice {
  return choice;
}

function getIsDark(): boolean {
  return resolveIsDark(choice, systemPrefersDark);
}

export function setThemeChoice(next: ThemeChoice): void {
  if (next === choice) return;
  choice = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage being unavailable costs the choice on the next load, not now.
  }
  applyChoice(next);
  emit();
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getChoice, getChoice);
}

/**
 * Charts need real colour strings, not CSS variables — recharts writes them
 * into SVG attributes — so the palette has to be picked in JS rather than by
 * the cascade. This tracks the resolved theme, whether that came from the
 * viewer's choice or from the OS, and follows a live change without a reload.
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, getIsDark, getIsDark);
}

/**
 * Two palettes rather than one. The light set is dark enough to read on a
 * white panel; on the dark ground those same hues fall to about 3:1, which
 * is under the 4.5:1 a legend label needs and leaves the thinner lines hard
 * to pick out. The dark set is the same hues lifted to stay legible.
 */
const LIGHT_SERIES = ['#0f766e', '#b45309', '#6d28d9', '#0369a1', '#be123c'];
const DARK_SERIES = ['#2dd4bf', '#fbbf24', '#c4b5fd', '#7dd3fc', '#fda4af'];

export function useSeriesColors(): string[] {
  return useIsDark() ? DARK_SERIES : LIGHT_SERIES;
}
