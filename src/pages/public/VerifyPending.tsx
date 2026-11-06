import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle2, ArrowRight, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { useCooldown } from '@/hooks/useCooldown';
import { authService } from '@/services/public';
import { getLeadCredentials } from '@/lib/leadStorage';
import { maskEmail } from '@/lib/format';
import { useAuth } from '@/app/providers/AuthProvider';

interface LocationState {
  email?: string;
  name?: string;
}

export default function VerifyPending() {
  usePageMeta({
    title: 'Check your inbox',
    description: "We've sent a verification link to your registered email address.",
    noIndex: true,
  });

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();

  const state = location.state as LocationState | null;
  const initialEmail = state?.email || searchParams.get('email') || getLeadCredentials().email || '';
  const [customEmail, setCustomEmail] = useState('');
  const email = (customEmail || initialEmail).trim();
  const masked = maskEmail(email);

  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Cooldown timer to prevent rapid, repetitive resends and respect rate limits
  const cooldown = useCooldown(45);

  const resend = useMutation((targetEmail: string) => authService.resendConfirmation(targetEmail));

  const verifyOtp = useMutation(
    async (code: string) => {
      setOtpError(null);
      const session = await authService.verifySignupOtp(email, code);
      await refresh();
      return session;
    },
    {
      onSuccess: () => {
        navigate('/verify/success', { replace: true });
      },
      onError: (err) => {
        setOtpError((err as Error).message || 'Invalid or expired confirmation code.');
      },
    },
  );

  const handleResend = async () => {
    if (!email || cooldown.active || resend.pending) return;
    cooldown.start(45);
    try {
      await resend.mutate(email);
    } catch (error) {
      const retry = (error as { retryAfterSeconds?: number }).retryAfterSeconds;
      if (retry && retry > 0) {
        cooldown.start(retry);
      }
    }
  };

  return (
    <main className="flex nf-min-h-viewport items-center justify-center px-5 py-14">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="mb-8 inline-block transition-opacity hover:opacity-85">
          <Logo />
        </Link>

        {/* Animated Email Icon Container */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          {/* Subtle glowing radial blur */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full opacity-60 blur-xl transition-all duration-700"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 255, 0.45) 0%, rgba(124, 92, 255, 0.2) 60%, transparent 75%)',
            }}
            aria-hidden
          />
          {/* Animated pulsing outer ring */}
          <div className="absolute inset-0 animate-pulse-ring rounded-full border border-brand/40" aria-hidden />

          {/* Central circular badge */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/35 bg-surface/90 shadow-lift backdrop-blur-md">
            <Mail className="h-8 w-8 text-brand animate-fade-in" aria-hidden />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] text-white ring-2 ring-canvas shadow-xs">
              <Sparkles className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-fg">
          Check your inbox
        </h1>

        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          We've sent a verification link to your registered email address.
        </p>

        {/* Masked Email Address Chip */}
        {email ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/90 px-4 py-1.5 text-xs font-mono text-fg shadow-xs">
            <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
            <span>{masked}</span>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-line/80 bg-surface/60 p-4 text-left shadow-xs backdrop-blur-sm">
            <label htmlFor="manual-pending-email" className="block text-xs font-semibold text-fg">
              Enter your registered email address
            </label>
            <p className="mt-1 text-2xs text-muted">
              Provide your email to receive a fresh verification link or enter your OTP:
            </p>
            <input
              id="manual-pending-email"
              type="email"
              placeholder="you@company.com"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              className="mt-2 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
            />
          </div>
        )}

        {/* Next step explanation */}
        <p className="mt-4 text-xs leading-relaxed text-faint">
          Click the link inside the email to activate your account and access your North Forge Studio workspace.
          Please check your <strong className="text-muted font-medium">spam or junk folder</strong> if you don't see it within two minutes.
        </p>

        {/* Direct OTP confirmation box */}
        {email ? (
          <div className="mt-6 rounded-2xl border border-line/80 bg-surface/70 p-5 text-left shadow-xs backdrop-blur-sm">
            <label htmlFor="pending-otp" className="block text-xs font-semibold text-fg">
              Have the 6-digit confirmation code?
            </label>
            <p className="mt-1 text-2xs text-muted">
              Enter the numeric code sent in your email to activate immediately:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (otpCode.trim()) verifyOtp.mutate(otpCode.trim());
              }}
              className="mt-3 flex gap-2"
            >
              <input
                id="pending-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value);
                  setOtpError(null);
                }}
                placeholder="000000"
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-center font-mono text-base tracking-widest text-fg focus:border-brand focus:outline-none transition-colors"
              />
              <Button
                type="submit"
                size="sm"
                loading={verifyOtp.pending}
                disabled={!otpCode.trim() || verifyOtp.pending}
              >
                Verify
              </Button>
            </form>
            {otpError ? <p className="mt-2 text-xs text-danger">{otpError}</p> : null}
          </div>
        ) : null}

        {/* Resend actions & Feedback */}
        <div className="mt-6 space-y-3">
          {resend.success ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5 text-xs text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Verification email sent again. Please check your inbox.</span>
            </div>
          ) : null}

          {resend.error ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{resend.error}</span>
            </div>
          ) : null}

          <Button
            variant="secondary"
            fullWidth
            size="md"
            loading={resend.pending}
            disabled={cooldown.active || !email}
            onClick={handleResend}
            iconLeft={<RefreshCw className={`h-3.5 w-3.5 ${resend.pending ? 'animate-spin' : ''}`} />}
          >
            {cooldown.active
              ? `Resend available in ${cooldown.remaining}s`
              : resend.pending
                ? 'Sending verification email…'
                : 'Resend verification email'}
          </Button>

          {/* Change email or go back */}
          <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted">
            <Link
              to="/register?changeEmail=true"
              className="text-brand transition-colors hover:text-fg underline decoration-brand/30 underline-offset-4"
            >
              Wrong email address? Change email
            </Link>
            <span className="text-line-strong" aria-hidden>·</span>
            <Link
              to="/login"
              className="text-muted transition-colors hover:text-fg inline-flex items-center gap-1"
            >
              <span>Continue to sign in</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
