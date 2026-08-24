import { useEffect, useState } from 'react';

/**
 * Charts need real colour strings, not CSS variables — recharts writes them
 * into SVG attributes — so the palette has to be picked in JS rather than by
 * the cascade. This tracks the viewer's scheme so the chart palette can
 * follow it, and follows a live change without a reload.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isDark;
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
