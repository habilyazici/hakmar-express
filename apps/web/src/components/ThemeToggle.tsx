import { setThemeChoice, useThemeChoice } from '../lib/use-color-scheme';
import type { ThemeChoice } from '../lib/use-color-scheme';

const OPTIONS: { value: ThemeChoice; label: string; title: string }[] = [
  { value: 'system', label: 'Sistem', title: 'İşletim sistemi ayarını izle' },
  { value: 'light', label: 'Açık', title: 'Her zaman açık tema' },
  { value: 'dark', label: 'Koyu', title: 'Her zaman koyu tema' },
];

/**
 * Three states rather than a two-way switch: "follow the OS" is a real
 * preference and is the default, and a plain on/off toggle has no way back
 * to it once either side has been picked.
 */
export function ThemeToggle() {
  const choice = useThemeChoice();

  return (
    <div className="btn-group" role="group" aria-label="Görünüm">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="btn btn-sm"
          title={option.title}
          aria-pressed={choice === option.value}
          onClick={() => setThemeChoice(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
