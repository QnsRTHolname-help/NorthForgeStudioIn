/**
 * Formatting helpers.
 *
 * Money: the API stores and returns amounts in paise (integers) so nothing
 * drifts through floating point. Only the UI divides by 100.
 */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(paise: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (paise === null || paise === undefined) return '—';
  if (opts.compact && paise >= 10000000) {
    return `₹${(paise / 10000000).toFixed(2)} Cr`;
  }
  if (opts.compact && paise >= 100000) {
    return `₹${(paise / 100000).toFixed(2)} L`;
  }
  return `₹${inr.format(Math.round(paise / 100))}`;
}

export function formatMoneyPrecise(paise: number | null | undefined) {
  if (paise === null || paise === undefined) return '—';
  return `₹${inrPaise.format(paise / 100)}`;
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return inr.format(value);
}

export function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...opts }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  return formatDate(value, { hour: 'numeric', minute: '2-digit' });
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(date);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelative(value: string | null | undefined) {
  if (!value) return '—';
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  if (Number.isNaN(seconds)) return '—';
  const absolute = Math.abs(seconds);
  if (absolute < 45) return 'just now';
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (absolute >= unitSeconds) {
      return relative.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return 'just now';
}

/** "in 6 days" / "6 days ago" — used for renewals and due dates. */
export function formatDaysUntil(value: string | null | undefined) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (Number.isNaN(days)) return null;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function initials(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(value: string) {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDuration(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

