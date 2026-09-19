import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Smartphone, ShieldCheck } from 'lucide-react';
import { FormError } from '@/components/ui/Form';
import { OtpInput } from '@/components/ui/OtpInput';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { useAuth } from '@/app/providers/AuthProvider';
import { mfaService } from '@/services';
import { AuthError } from '@/lib/auth-errors';

/**
 * Second-factor challenge (spec §05).
 *
 * Supabase MFA flow: `signInWithPassword` succeeds at AAL1 (first factor
 * only) even when a TOTP factor is enrolled. The session EXISTS but is not
 * elevated, so admin data calls would fail with 403 from RLS. This screen
 * completes the elevation: challenge → verify → AAL2 → continue to the
 * intended destination.
 *
 * Deliberately mounted OUTSIDE the dashboard guards (see router.tsx) so a
 * stale AAL1 session can browse nowhere except here.
 */
export default function MfaVerify() {
  usePageMeta({ title: 'Two-factor verification', noIndex: true });

  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * The code is passed in rather than read from state: the OTP field submits
   * itself the instant the sixth digit lands, and a mutation that closed over
   * the previous render's `code` would verify one code behind.
   */
  const verify = useMutation(
    async (submitted: string) => {
      const factorIds = await mfaService.verifiedFactorIds();
      if (factorIds.length === 0) {
        throw new AuthError({
          code: 'AUTH_UNKNOWN',
          message: 'No two-factor device is registered for this account. Sign in again or contact support.',
        });
      }
      await mfaService.verifyChallenge(factorIds[0]!, submitted);
    },
    {
      onSuccess: async () => {
        // Refresh FIRST so the role is known, then route by it — admins
        // must never be dumped into the client portal.
        const session = await refresh();
        const role = session?.user.role;
        navigate(role === 'admin' || role === 'super_admin' ? '/app' : '/portal', { replace: true });
      },
      onError: () => {
        // Codes rotate every 30 seconds; clear the boxes so the next attempt
        // starts from typing rather than from editing a rejected one.
        setCode('');
      },
    },
  );

  const submit = (submitted: string) => {
    if (submitted.replace(/\D/g, '').length !== 6 || verify.pending) return;
    setError(null);
    void verify.mutate(submitted).catch(() => undefined);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit(code);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>

        <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-brand">
          <Smartphone className="h-5 w-5" aria-hidden />
        </span>

        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Confirm it&rsquo;s you.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Your password was accepted. Enter the 6-digit code from your authenticator app — it checks and continues on
          its own as soon as the last digit lands.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              setError(null);
            }}
            onComplete={submit}
            disabled={verify.pending}
            invalid={Boolean(error ?? verify.error)}
            autoFocus
          />

          <p className="min-h-[1rem] text-2xs" aria-live="polite">
            {verify.pending ? (
              <span className="text-muted">Checking that code…</span>
            ) : code.length === 6 ? (
              <span className="text-faint">Code complete.</span>
            ) : (
              <span className="text-faint">Paste it, or type it — codes rotate every 30 seconds.</span>
            )}
          </p>

          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
          <FormError message={verify.error} />

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={verify.pending}
            disabled={verify.pending || code.length !== 6}
            arrow
          >
            {verify.pending ? 'Verifying…' : 'Verify and continue'}
          </Button>
        </form>

        <p className="mt-8 text-center text-2xs text-faint">
          <ShieldCheck className="mr-1 inline h-3 w-3 text-success" aria-hidden />
          Lost your device? Contact NorthForge support to reset your second factor.
        </p>
      </div>
    </main>
  );
}
