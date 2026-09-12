import type { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';
import { ToastProvider } from './ToastProvider';
import { CommandPaletteProvider } from '@/components/ui/CommandPalette';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';

/**
 * Provider composition (spec §133).
 * Each provider owns exactly one concern: theme, session, notifications,
 * global search. Nothing here knows about routing.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
                          <CommandPaletteProvider>{children}</CommandPaletteProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
