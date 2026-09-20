import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { LinkButton } from '@/components/ui/Button';
import { usePageMeta } from '@/hooks/usePageMeta';

/** 404 (spec §139) — restrained, one line of motion. */
export default function NotFound() {
  usePageMeta({ title: 'Page not found', noIndex: true });

  return (
    <main className="flex nf-min-h-viewport flex-col items-center justify-center px-5 py-24 text-center">
      <Logo className="mb-10" />
      <span className="nf-eyebrow">Error 404</span>
      <h1 className="mt-5 text-display-sm font-semibold text-fg">This page doesn't exist.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        The link may be out of date or the page may have moved. Everything else is still working.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <LinkButton to="/" arrow>
          Back to NorthForge
        </LinkButton>
        <LinkButton to="/contact" variant="secondary">
          Contact us
        </LinkButton>
      </div>

      <p className="mt-12 flex items-center gap-2 text-xs text-faint">
        <Link to="/pricing" className="inline-flex items-center gap-1 hover:text-muted">
          Pricing <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
        <span aria-hidden>·</span>
        <Link to="/how-it-works" className="inline-flex items-center gap-1 hover:text-muted">
          How it works <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </p>
    </main>
  );
}
