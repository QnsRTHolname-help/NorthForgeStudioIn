import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { LinkButton } from '@/components/ui/Button';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';

/**
 * 403 (spec §140).
 * Deliberately says nothing about whether the resource exists — confirming
 * that would itself leak information.
 */
export default function Unauthorized() {
  usePageMeta({ title: 'No access', noIndex: true });
  const { isAdmin, isClient } = useAuth();

  return (
    <main className="flex nf-min-h-viewport flex-col items-center justify-center px-5 py-24 text-center">
      <Logo className="mb-10" />
      <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-sunken text-faint">
        <ShieldAlert className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-display-sm font-semibold text-fg">You don't have access to this area.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        Your account does not have permission to open this page. Nothing has been changed.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        {isAdmin ? (
          <LinkButton to="/app" arrow>
            Back to the workspace
          </LinkButton>
        ) : isClient ? (
          <LinkButton to="/portal" arrow>
            Back to my portal
          </LinkButton>
        ) : (
          <LinkButton to="/login" arrow>
            Sign in
          </LinkButton>
        )}
        <LinkButton to="/" variant="secondary">
          NorthForge homepage
        </LinkButton>
      </div>

      <p className="mt-12 text-xs text-faint">
        If you believe this is a mistake,{' '}
        <Link to="/contact" className="underline underline-offset-2 hover:text-muted">
          contact NorthForge
        </Link>
        .
      </p>
    </main>
  );
}
