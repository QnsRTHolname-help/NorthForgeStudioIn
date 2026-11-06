import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { Loader } from '@/components/ui/Loader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';
import { verifyEmailSession, exchangeUrlAuthSession } from '@/services/auth';
import { sanitizeRedirectUrl } from '@/lib/links';

type VerificationState = 'checking' | 'verified' | 'unverified';

export default function VerifySuccess() {
  usePageMeta({
    title: 'Email Verified Successfully',
    description: 'Your email address has been verified. Your North Forge Studio account is ready.',
    noIndex: true,
  });

  const navigate = useNavigate();
  const { status, isAdmin, refresh } = useAuth();
  const [verificationState, setVerificationState] = useState<VerificationState>('checking');

  useEffect(() => {
    let cancelled = false;

    const checkVerification = async () => {
      try {
        // Handle direct landing from email confirmation link with ?code= or ?token_hash=
        await exchangeUrlAuthSession();

        // Strict security rule: check authenticated Supabase session and email_confirmed_at
        const status = await verifyEmailSession();
        if (cancelled) return;

        if (status.verified) {
          setVerificationState('verified');
          void refresh();
        } else {
          setVerificationState('unverified');
        }
      } catch {
        if (!cancelled) setVerificationState('unverified');
      }
    };

    void checkVerification();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleContinue = () => {
    if (status === 'authenticated') {
      const destination = isAdmin ? '/app' : '/portal';
      const safeDest = sanitizeRedirectUrl(destination, '/portal');
      navigate(safeDest, { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  return (
    <main className="flex nf-min-h-viewport items-center justify-center px-5 py-14">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="mb-8 inline-block transition-opacity hover:opacity-85">
          <Logo />
        </Link>

        {verificationState === 'checking' ? (
          <div className="py-12">
            <Loader label="Confirming email verification" />
            <p className="mt-4 text-xs text-muted">
              Verifying your session status with Supabase…
            </p>
          </div>
        ) : null}

        {verificationState === 'verified' ? (
          <div className="animate-fade-up">
            {/* Premium Animated Checkmark */}
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
              {/* Subtle success glow aura */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full opacity-60 blur-xl transition-all duration-700"
                style={{
                  background: 'radial-gradient(circle, rgba(82, 204, 132, 0.45) 0%, rgba(59, 130, 255, 0.2) 65%, transparent 75%)',
                }}
                aria-hidden
              />
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 animate-pulse-ring rounded-full border border-success/40" aria-hidden />

              {/* Animated checkmark circle */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-success/40 bg-surface/90 shadow-lift backdrop-blur-md">
                <svg
                  className="h-8 w-8 text-success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
                  <path
                    d="M7 12.5l3.5 3.5 7-7"
                    style={{
                      strokeDasharray: 20,
                      strokeDashoffset: 0,
                      animation: 'dash-flow 1.2s ease-out forwards',
                    }}
                  />
                </svg>
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] text-white ring-2 ring-canvas shadow-xs">
                  <Sparkles className="h-3 w-3" />
                </span>
              </div>
            </div>

            {/* Heading & Subheading from task requirements */}
            <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-fg">
              Email Verified Successfully
            </h1>

            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Your email address has been verified. Your North Forge Studio account is ready.
            </p>

            <div className="mt-8 space-y-3">
              <Button
                fullWidth
                size="lg"
                onClick={handleContinue}
                arrow
              >
                Continue to Dashboard
              </Button>

              <p className="pt-2 text-2xs text-faint">
                {status === 'authenticated'
                  ? 'Authenticated session active. Welcome to North Forge Studio.'
                  : 'Ready to access your workspace. Click to continue.'}
              </p>
            </div>
          </div>
        ) : null}

        {verificationState === 'unverified' ? (
          <div className="animate-fade-up">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/40 bg-warning/10 text-warning shadow-xs">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-fg">
              Verification Required
            </h1>

            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              We could not verify an active confirmed session. If you recently registered, please click the verification link sent to your email.
            </p>

            <div className="mt-8 space-y-3">
              <Button fullWidth size="lg" onClick={() => navigate('/login', { replace: true })}>
                Sign in to your account
              </Button>
              <Button
                variant="secondary"
                fullWidth
                size="md"
                onClick={() => navigate('/verify/pending', { replace: true })}
                iconLeft={<ArrowRight className="h-4 w-4" />}
              >
                Go to verification screen
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
