import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme, type ThemePreference } from '@/app/providers/ThemeProvider';
import { Segmented } from './Tabs';

/** Compact cycle button (light → dark → system). */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, theme, setPreference } = useTheme();
  const next: ThemePreference = preference === 'light' ? 'dark' : preference === 'dark' ? 'system' : 'light';

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded border border-line text-muted transition-colors hover:bg-sunken hover:text-fg',
        className,
      )}
      aria-label={`Theme: ${preference}. Switch to ${next}.`}
      title={`Theme: ${preference} (click for ${next})`}
    >
      {preference === 'system' ? (
        <Monitor className="h-4 w-4" />
      ) : theme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}

/** Explicit three-way control for settings screens. */
export function ThemeSelector() {
  const { preference, setPreference, systemTheme } = useTheme();
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        ariaLabel="Theme preference"
        value={preference}
        onChange={setPreference}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ]}
      />
      <p className="text-xs text-faint">
        {preference === 'system' ? `Following your system setting, currently ${systemTheme}.` : `Always using ${preference} theme.`}
      </p>
    </div>
  );
}
