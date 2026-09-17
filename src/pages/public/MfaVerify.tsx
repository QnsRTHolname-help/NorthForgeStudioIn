import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Smartphone, ShieldCheck } from 'lucide-react';
import { Input, FormError } from '@/components/ui/Form';
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

  const verify = useMutation(
    async () => {
      const factorIds = await mfaService.verifiedFactorIds();
      if (factorIds.length === 0) {
        throw new AuthError({
          code: 'AUTH_UNKNOWN',
          message: 'No two-factor device is registered for this account. Sign in again or contact support.',
        });
      }
      await mfaService.verifyChallenge(factorIds[0]!, code);
    },
    {
      onSuccess: async () => {
        // Refresh FIRST so the role is known, then route by it — admins
        // must never be dumped into the client portal.
        const session = await refresh();
        const role = session?.user.role;
        navigate(role === 'admin' || role === 'super_admin' ? '/app' : '/portal', { replace: true });
      },
    },
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError(null);
    await verify.mutate().catch(() => undefined);
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

        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Two-factor verification.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Your password was accepted. Enter the 6-digit code from your authenticator app to finish signing in. Codes
          rotate every 30 seconds.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <Input
            label="Authentication code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            error={error ?? undefined}
            placeholder="000000"
            className="tracking-[0.4em] font-mono"
          />

          <FormError message={verify.error} />

          <Button type="submit" fullWidth size="lg" loading={verify.pending} disabled={verify.pending} arrow>
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
