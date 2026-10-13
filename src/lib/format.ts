/**
 * Formatting helpers.
 *
 * Money: the API stores and returns amounts in paise (integers) so nothing
 * drifts through floating point. Only the UI divides by 100.
 */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Currency thresholds, in PAISE.
 *
 * Money is stored in paise (₹1 = 100), so the Indian-grouping boundaries are
 * 100× the rupee figure everyone quotes:
 *
 *   ₹1 lakh   = 1,00,000        rupees = 1e5         rupees = 1e7   paise
 *   ₹1 crore  = 1,00,00,000     rupees = 1e7         rupees = 1e9   paise
 *
 * Getting this wrong is not cosmetic. The compact formatter previously tested
 * `paise >= 100000` for lakhs and divided by 1e5 — so ₹1,000 rendered as
 * "₹1.00 L", and ₹1,00,000 (a lakh) rendered as "₹1.00 Cr". Every compact
 * revenue figure on the admin dashboard was wrong by a factor of 100 and
 * labelled with the wrong unit.
 */
const PAISE_PER_LAKH = 10_000_000; // 1e7 paise = ₹1,00,000
const PAISE_PER_CRORE = 1_000_000_000; // 1e9 paise = ₹1,00,00,000

export function formatMoney(paise: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (paise === null || paise === undefined) return '—';
  const sign = paise < 0 ? '-' : '';
  const absPaise = Math.abs(paise);
  if (opts.compact && absPaise >= PAISE_PER_CRORE) {
    return `${sign}₹${(absPaise / PAISE_PER_CRORE).toFixed(2)} Cr`;
  }
  if (opts.compact && absPaise >= PAISE_PER_LAKH) {
    return `${sign}₹${(absPaise / PAISE_PER_LAKH).toFixed(2)} L`;
  }
  return `${sign}₹${inr.format(Math.round(absPaise / 100))}`;
}

export function formatMoneyPrecise(paise: number | null | undefined) {
  if (paise === null || paise === undefined) return '—';
  const sign = paise < 0 ? '-' : '';
  const absPaise = Math.abs(paise);
  return `${sign}₹${inrPaise.format(absPaise / 100)}`;
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}${inr.format(abs)}`;
}

export function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${abs}`;
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

