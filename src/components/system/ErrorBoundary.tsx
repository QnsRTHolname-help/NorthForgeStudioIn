import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';

interface State {
  error: Error | null;
}

/**
 * Last line of defence (spec §96).
 * A render error in one widget must never produce a blank product — we
 * show a recoverable panel with the option to reload or return home.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Real error reporting would go here (Sentry, etc.). We never print
    // stack traces to the user.
    console.error('[northforge] render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8 text-center">
          <Logo className="mx-auto mb-6" />
          <h1 className="text-lg font-semibold tracking-tight text-fg">Something went wrong</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            NorthForge hit an unexpected error. Your data is safe — reload to continue, or head back to the homepage.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => window.location.reload()} iconLeft={<RefreshCw className="h-4 w-4" />}>
              Reload NorthForge
            </Button>
            <Button variant="secondary" onClick={() => window.location.assign('/')}>
              Back to homepage
            </Button>
          </div>
          {import.meta.env.DEV ? (
            <pre className="mt-6 overflow-x-auto rounded border border-line bg-sunken p-3 text-left text-[11px] leading-relaxed text-faint">
              {error.message}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
