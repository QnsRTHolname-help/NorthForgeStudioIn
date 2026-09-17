import { useCallback, useEffect, useState } from 'react';

/**
 * A short, visible cooldown for "resend email" style actions.
 *
 * Two jobs:
 *   1. Stop the person hammering the button (each attempt burns the
 *      provider's per-address allowance and makes the next one slower).
 *   2. Make the wait countable instead of a mystery error — the label
 *      shows exactly how long is left.
 *
 * `start(seconds)` is called on click, and again with the provider's own
 * number when Supabase answers "…only request this after N seconds".
 */
export function useCooldown(defaultSeconds = 45) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [until]);

  useEffect(() => {
    if (until && now >= until) setUntil(0);
  }, [until, now]);

  const start = useCallback(
    (seconds?: number) => {
      const wait = Math.max(0, Math.min(seconds ?? defaultSeconds, 3_600));
      setNow(Date.now());
      setUntil(Date.now() + wait * 1_000);
    },
    [defaultSeconds],
  );

  const remaining = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;

  return { remaining, active: remaining > 0, start, clear: () => setUntil(0) };
}
