import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { CONTACT } from '@/data/site';
import { initialAuthUrl, looksExpired } from '@/lib/auth-url';

type Phase = 'working' | 'confirmed' | 'expired' | 'invalid';

/**
 * Where every emailed auth link lands (spec §05, §11).
 *
 * Signup confirmation, magic links and recovery links all point here so a
 * click NEVER drops someone on a page that silently does nothing:
 *
 *   - PKCE `?code=` is exchanged for a session (bounded retry, because the
 *     Supabase client may already have exchanged it on boot).
 *   - Recovery links are forwarded to /reset-password with the session up.
 *   - Expired / already-used / tampered links get a plain-language card and
 *     a route out — never a dead end.
 *
 * The link itself is built from the canonical public origin (src/lib/links.ts)
 * so a customer never receives a localhost URL.
 */
export default function AuthCallback() {
  usePageMeta({ title: 'Confirming your email', noIndex: true });

  const navigate = useNavigate();
  const { status, isAdmin } = useAuth();
  const [phase, setPhase] = useState<Phase>('working');
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = initialAuthUrl.query;
    const hash = initialAuthUrl.hash;

    const run = async () => {
      const errorCode = query.get('error_code') ?? hash.get('error_code');
      const errorParam = query.get('error') ?? hash.get('error');
      const description = query.get('error_description') ?? hash.get('error_description');

      // 1. The provider refused the link outright.
      if (errorCode || errorParam) {
        if (cancelled) return;
        setPhase(looksExpired(errorCode, description) ? 'expired' : 'invalid');
        return;
      }

      // 2. Recovery links hand off to the reset screen with the session up.
      if ((query.get('type') ?? hash.get('type')) === 'recovery') {
        if (!cancelled) navigate('/reset-password', { replace: true });
        return;
      }

      // 3. Exchange the PKCE code. "Already exchanged" is a success path:
      //    the Supabase client restores the URL session itself on boot.
      const code = query.get('code');
      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error && !/already|used|invalid flow state/i.test(error.message)) {
            if (!cancelled) setDetail(error.message);
          }
        } catch (error) {
          if (!cancelled) setDetail((error as Error).message);
        }
      }

      // 4. Give the client a moment to finish restoring the URL session.
      const deadline = Date.now() + 6_000;
      while (Date.now() < deadline) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) setPhase('confirmed');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (cancelled) return;
      setPhase(looksExpired(description) ? 'expired' : 'invalid');
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Confirmed AND signed in → walk straight into the workspace.
  useEffect(() => {
    if (phase !== 'confirmed' || status !== 'authenticated') return;
    const timer = window.setTimeout(() => navigate(isAdmin ? '/app' : '/portal', { replace: true }), 1_600);
    return () => window.clearTimeout(timer);
  }, [phase, status, isAdmin, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>

        {phase === 'working' ? (
          <>
            <Loader label="Confirming your email address" />
            <p className="mt-6 text-[13px] leading-relaxed text-muted">
              One moment — we are verifying the link you opened. This can take a few seconds.
            </p>
          </>
        ) : null}

        {phase === 'confirmed' ? (
          <>
            <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Email confirmed.</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              {status === 'authenticated'
                ? 'Your address is verified. Taking you to your workspace…'
                : 'Your address is verified. Sign in to open your workspace.'}
            </p>
            <div className="mt-8">
              <Button
                fullWidth
                size="lg"
                onClick={() => navigate(status === 'authenticated' ? (isAdmin ? '/app' : '/portal') : '/login', { replace: true })}
                arrow
              >
                {status === 'authenticated' ? 'Open my workspace' : 'Continue to sign in'}
              </Button>
            </div>
          </>
        ) : null}

        {phase === 'expired' || phase === 'invalid' ? (
          <>
            <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-warning">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">
              {phase === 'expired' ? 'That link has expired.' : "That link isn't valid."}
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              {phase === 'expired'
                ? 'Verification links are time-limited. Sign in and we will send a fresh one — or create the account again with the same email.'
                : 'The link may have been truncated by your email app, or already used. Sign in and request a new link.'}
            </p>
            {detail ? <p className="mt-2 text-2xs text-faint">Technical detail: {detail}</p> : null}
            <div className="mt-8 space-y-3">
              <Button fullWidth size="lg" onClick={() => navigate('/login', { replace: true })} arrow>
                Go to sign in
              </Button>
              <p className="text-2xs text-faint">
                Still stuck? Email{' '}
                <a href={`mailto:${CONTACT.email}`} className="underline underline-offset-2">
                  {CONTACT.email}
                </a>{' '}
                and we will confirm you manually.
              </p>
            </div>
          </>
        ) : null}

        <p className="mt-10 flex items-center justify-center gap-2 text-2xs text-faint">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Links are single-use and expire for your security.
        </p>
      </div>
    </main>
  );
}
