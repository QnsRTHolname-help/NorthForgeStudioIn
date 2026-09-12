import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordInput, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { authService } from '@/services';
import { useToast } from '@/app/providers/ToastProvider';
import { Loader } from '@/components/ui/Loader';

/**
 * Password reset (spec §09).
 *
 * Supabase PKCE recovery links land here signed-in (the code rides the URL
 * fragment and is exchanged automatically by the client). This page verifies
 * a recovery session exists — waiting out the exchange — then updates the
 * password for that session. The legacy `?token=` parameter is gone: it never
 * existed in Supabase recovery links and made every real link look invalid.
 */
export default function ResetPassword() {
  usePageMeta({ title: 'Set a new password', noIndex: true });

  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Verify the recovery session; waits briefly for the PKCE exchange. */
  const recovery = useAsync(() => authService.verifyRecovery().then((r) => r.hasSession), []);

  const mutation = useMutation(
    async () => authService.resetPassword('', password),
    {
      onSuccess: () => {
        toast.success('Password updated', 'Sign in with your new password.');
        navigate('/login', { replace: true });
      },
    },
  );

  // After a successful update the recovery session is force-signed-out so
  // the user re-authenticates with the fresh password (spec §47, §48).
  useEffect(() => {
    if (mutation.success) void authService.logout();
  }, [mutation.success]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setError(null);
    await mutation.mutate().catch(() => undefined);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>

        {recovery.loading ? (
          <div className="flex flex-col items-center text-center">
            <Loader label="Verifying your reset link" />
          </div>
        ) : recovery.data === false ? (
          <>
            <h1 className="text-[24px] font-semibold text-fg">This reset link has expired.</h1>
            <p className="mt-3 text-[13px] text-muted">
              Reset links are valid for a short time. Open the most recent email, or request a new one.
            </p>
            <div className="mt-8">
              <Link to="/forgot-password" className="text-[13px] font-medium text-brand underline underline-offset-2">
                Request a new link
              </Link>
            </div>
            {recovery.error ? <p className="mt-6 text-xs text-faint">{recovery.error}</p> : null}
          </>
        ) : (
          <>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Set a new password.</h1>
            <p className="mt-2 text-[13px] text-muted">Choose something you have not used before.</p>

            <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
              <PasswordInput
                label="New password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                error={error ?? undefined}
                hint="At least 8 characters."
              />
              <FormError message={mutation.error} />
              <Button type="submit" fullWidth size="lg" loading={mutation.pending}>
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
