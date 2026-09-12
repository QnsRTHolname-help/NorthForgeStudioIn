import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button, LinkButton } from '@/components/ui/Button';
import { usePageMeta } from '@/hooks/usePageMeta';

/** 500 (spec §96) — honest, recoverable, no stack traces. */
export default function ServerError() {
  usePageMeta({ title: 'Something went wrong', noIndex: true });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-24 text-center">
      <Logo className="mb-10" />
      <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-danger/25 bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-display-sm font-semibold text-fg">Something went wrong on our side.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        We could not complete that request. Your data is safe — try again, and if it keeps happening we will want to know
        about it.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => window.location.reload()} iconLeft={<RefreshCw className="h-4 w-4" />}>
          Try again
        </Button>
        <LinkButton to="/" variant="secondary">
          Back to NorthForge
        </LinkButton>
      </div>

      <p className="mt-12 text-xs text-faint">
        Persistent problem?{' '}
        <Link to="/contact" className="underline underline-offset-2 hover:text-muted">
          Tell us what happened
        </Link>
        .
      </p>
    </main>
  );
}
