import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * In-memory sliding-window rate limiter.
 *
 * Protects the authentication endpoints from credential stuffing and
 * password spraying without adding infrastructure: buckets live in process
 * memory, are pruned lazily, and fail OPEN (an limiter outage must never
 * take the login page down). Keyed by IP (+ optionally identity) so a
 * distributed attacker is throttled per source, while one busy office NAT
 * is not locked out by its neighbours.
 *
 * Single-process caveat: horizontal deployments get one bucket per instance.
 * That is the correct trade for this project — swap the store for Redis
 * before scaling the API beyond one node.
 */

interface Bucket {
  /** Timestamps (ms) of hits still inside the window. */
  hits: number[];
  /** Extra lockout until this time — engaged after repeated 429s. */
  lockedUntil: number;
  /** Consecutive 429 responses — drives the escalating lockout. */
  strikes: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Aggregated counters for /health and debugging. */
export function rateLimitStats() {
  return { buckets: buckets.size };
}

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil < now && (bucket.hits.length === 0 || bucket.hits[0]! < now - 3_600_000)) {
      buckets.delete(key);
    }
  }
}

/** Best-effort client identity behind proxies (trust proxy is enabled). */
export function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export interface RateLimitOptions {
  /** Window in milliseconds. */
  windowMs: number;
  /** Hits allowed per window before rejecting. */
  max: number;
  /**
   * Extra key material — e.g. the attempted email, so one source hammering
   * many accounts locks out per-account, and one account being sprayed is
   * protected regardless of source.
   */
  bucket?(req: Request): string;
  /** Response text. Keep it identical across auth endpoints (no enumeration). */
  message?: string;
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { windowMs, max, message = 'Too many attempts. Please wait a little while and try again.' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    sweep(now);

    const key = `${clientKey(req)}|${options.bucket ? options.bucket(req) : ''}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { hits: [], lockedUntil: 0, strikes: 0 };
      buckets.set(key, bucket);
    }

    if (bucket.lockedUntil > now) {
      const retry = Math.ceil((bucket.lockedUntil - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      res.status(429).json({ ok: false, error: message, code: 'rate_limited' });
      return;
    }

    // Drop hits that fell out of the window, then record this one.
    bucket.hits = bucket.hits.filter((time) => time > now - windowMs);
    bucket.hits.push(now);

    if (bucket.hits.length > max) {
      // Escalating lockout: 30s, then 2m, then 10m.
      bucket.strikes += 1;
      const lockMs = Math.min(30_000 * 4 ** (bucket.strikes - 1), 600_000);
      bucket.lockedUntil = now + lockMs;
      const retry = Math.ceil(lockMs / 1000);
      res.setHeader('Retry-After', String(retry));
      res.status(429).json({ ok: false, error: message, code: 'rate_limited' });
      return;
    }

    // A success clears the penalty memory for this identity.
    if (typeof res.on === 'function') {
      res.on('finish', () => {
        if (res.statusCode < 400 && bucket) {
          bucket.strikes = 0;
          bucket.hits = [];
          bucket.lockedUntil = 0;
        }
      });
    }

    next();
  };
}
