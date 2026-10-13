import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, ShieldCheck } from 'lucide-react';
import { FormError } from '@/components/ui/Form';
import { OtpInput } from '@/components/ui/OtpInput';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { useAuth } from '@/app/providers/AuthProvider';
import { useCooldown } from '@/hooks/useCooldown';
import { emailMfaService } from '@/services/public';

/**
 * Email second-factor challenge (migration 0016).
 *
 * For an account that switched on "email me a code at sign-in", the password
 * alone is not enough: `authService.login` drops the first-factor session and
 * emails a 6-digit code, then sends the person here. Nothing in the product is
 * readable until this screen succeeds.
 *
 * The address is carried in router state from the sign-in attempt and never
 * typed again. If it is missing — a direct hit, a refresh, an old bookmark —
 * there is nothing to verify, so we send the person back to sign in rather than
 * showing a code box that cannot work.
 *
 * Mounted OUTSIDE the dashboard guards (see router.tsx), like /mfa: at this
 * point the session deliberately does not exist.
 */
export default function EmailMfaVerify() {
  usePageMeta({ title: 'Confirm your email code', noIndex: true });

  const navigate = useNavigate();
  const location = useLocation();
  const { refresh, status, session } = useAuth();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  // Codes are rate-limited per address; keep the wait visible and countable.
  const cooldown = useCooldown(45);

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  // Already signed in (another tab finished the step) — go where the role goes.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const role = session?.user.role;
    navigate(role === 'admin' || role === 'super_admin' ? '/app' : '/portal', { replace: true });
  }, [status, session, navigate]);

  /**
   * The code is passed in rather than read from state: the OTP field submits
   * itself the instant the sixth digit lands, and a mutation closing over the
   * previous render's `code` would verify one code behind.
   */
  const verify = useMutation(
    async (submitted: string) => {
      await emailMfaService.verifyCode(email, submitted);
    },
    {
      silent: true,
      onSuccess: async () => {
        // Refresh FIRST so the role is known, then route by it — an admin must
        // never be dropped into the client portal.
        const fresh = await refresh();
        const role = fresh?.user.role;
        navigate(role === 'admin' || role === 'super_admin' ? '/app' : '/portal', { replace: true });
      },
      onError: () => {
        // Codes expire; clear the boxes so the next attempt starts from typing.
        setCode('');
      },
    },
  );

  const submit = (submitted: string) => {
    if (submitted.replace(/\D/g, '').length !== 6 || verify.pending || !email) return;
    setError(null);
    void verify.mutate(submitted).catch(() => undefined);
  };

  const resend = async () => {
    setError(null);
    setResent(false);
    cooldown.start(45);
    try {
      await emailMfaService.sendCode(email);
      setResent(true);
    } catch (err) {
      const retry = (err as { retryAfterSeconds?: number }).retryAfterSeconds;
      if (retry) cooldown.start(retry);
      setError((err as Error).message);
    }
  };

  if (!email) return null;

  return (
    <main className="flex nf-min-h-viewport items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>

        <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand/30 bg-brand/10 text-brand">
          <MailCheck className="h-5 w-5" aria-hidden />
        </span>

        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Check your email.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Your password was accepted. We sent a 6-digit code to{' '}
          <span className="font-medium text-fg">{email}</span> — enter it to finish signing in. It checks and continues
          on its own as soon as the last digit lands.
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(code);
          }}
          noValidate
          className="mt-8 space-y-4"
        >
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
            ) : resent ? (
              <span className="text-success">A new code is on its way.</span>
            ) : (
              <span className="text-faint">Codes expire quickly — request another if this one is stale.</span>
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

        <div className="mt-6 flex items-center justify-between gap-3 text-[13px]">
          <button
            type="button"
            onClick={resend}
            disabled={cooldown.active}
            className="nf-focus text-brand transition-colors hover:underline disabled:text-faint disabled:no-underline"
          >
            {cooldown.active ? `Send a new code in ${cooldown.remaining}s` : 'Send a new code'}
          </button>
          <Link to="/login" className="text-muted transition-colors hover:text-fg">
            Use a different account
          </Link>
        </div>

        <p className="mt-8 text-center text-2xs text-faint">
          <ShieldCheck className="mr-1 inline h-3 w-3 text-success" aria-hidden />
          Lost access to this mailbox? Contact NorthForge support to reset your second factor.
        </p>
      </div>
    </main>
  );
}