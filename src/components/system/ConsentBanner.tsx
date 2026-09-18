import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { applyAnalyticsConsent, analyticsConfigured } from '@/lib/analytics';
import { isDecided, writeConsent } from '@/lib/consent';

/**
 * Cookie / analytics consent (spec §41, §53).
 *
 * Shown only when optional measurement is actually configured AND the visitor
 * has not yet decided. Necessary cookies (the authentication session and the
 * theme preference) are not asked about because they are not optional — they
 * are what makes the page the visitor asked for work at all.
 *
 * No tracking load happens until "Allow analytics" is chosen; dismissing the
 * banner by picking the essential option is a real "no", not a snooze.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(() => analyticsConfigured && !isDecided());

  if (!visible) return null;

  const decide = (analytics: boolean) => {
    const state = writeConsent({ analytics, marketing: false, decidedAt: new Date().toISOString() });
    applyAnalyticsConsent(state);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-24 z-[70] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm"
    >
      <div className="rounded-lg border border-line bg-surface p-4 shadow-panel">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg">Cookies &amp; analytics</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              We use what is necessary to keep you signed in and to remember your theme. With your
              permission we would also use Google Analytics to understand which pages are useful.
              You can change this any time in Settings. See our{' '}
              <Link to="/privacy" className="text-brand underline decoration-brand/30 underline-offset-2">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide(true)}>
            Allow analytics
          </Button>
          <Button size="sm" variant="secondary" onClick={() => decide(false)}>
            Essential only
          </Button>
        </div>
      </div>
    </div>
  );
}
