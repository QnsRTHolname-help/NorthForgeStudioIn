import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyPrecise, formatNumber, formatCompact, formatPercent, formatDate, formatDaysUntil, titleCase, initials } from './format';

/**
 * Money formatting is a correctness surface, not a cosmetic one.
 *
 * `formatMoney(paise, { compact: true })` decides the unit a revenue figure is
 * read in. A factor-of-100 error in that function turned ₹1,000 into "₹1.00 L"
 * and a real lakh into "₹1.00 Cr" on the admin dashboard — numbers that look
 * authoritative and are simply false. These tests pin the boundary in paise.
 */
describe('formatMoney', () => {
  it('renders exact rupee values across standard thresholds', () => {
    expect(formatMoney(750_000)).toBe('₹7,500');
    expect(formatMoney(1_000_000)).toBe('₹10,000');
    expect(formatMoney(5_000_000)).toBe('₹50,000');
    expect(formatMoney(10_000_000)).toBe('₹1,00,000');
    expect(formatMoney(15_000_000)).toBe('₹1,50,000');
    expect(formatMoney(100_000_000)).toBe('₹10,00,000');
    expect(formatMoney(1_000_000_000)).toBe('₹1,00,00,000');
  });

  it('renders compact notation across standard thresholds', () => {
    expect(formatMoney(750_000, { compact: true })).toBe('₹7,500');
    expect(formatMoney(1_000_000, { compact: true })).toBe('₹10,000');
    expect(formatMoney(5_000_000, { compact: true })).toBe('₹50,000');
    expect(formatMoney(10_000_000, { compact: true })).toBe('₹1.00 L');
    expect(formatMoney(15_000_000, { compact: true })).toBe('₹1.50 L');
    expect(formatMoney(100_000_000, { compact: true })).toBe('₹10.00 L');
    expect(formatMoney(1_000_000_000, { compact: true })).toBe('₹1.00 Cr');
  });

  it('handles negative amounts cleanly in default and compact modes', () => {
    // Non-compact negative amounts
    expect(formatMoney(-750_000)).toBe('-₹7,500');
    expect(formatMoney(-1_000_000)).toBe('-₹10,000');
    expect(formatMoney(-5_000_000)).toBe('-₹50,000');
    expect(formatMoney(-10_000_000)).toBe('-₹1,00,000');
    expect(formatMoney(-15_000_000)).toBe('-₹1,50,000');
    expect(formatMoney(-100_000_000)).toBe('-₹10,00,000');
    expect(formatMoney(-1_000_000_000)).toBe('-₹1,00,00,000');

    // Compact negative amounts
    expect(formatMoney(-750_000, { compact: true })).toBe('-₹7,500');
    expect(formatMoney(-1_000_000, { compact: true })).toBe('-₹10,000');
    expect(formatMoney(-5_000_000, { compact: true })).toBe('-₹50,000');
    expect(formatMoney(-10_000_000, { compact: true })).toBe('-₹1.00 L');
    expect(formatMoney(-15_000_000, { compact: true })).toBe('-₹1.50 L');
    expect(formatMoney(-100_000_000, { compact: true })).toBe('-₹10.00 L');
    expect(formatMoney(-1_000_000_000, { compact: true })).toBe('-₹1.00 Cr');
  });

  it('answers "—" for an absent amount rather than inventing ₹0', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(0)).toBe('₹0');
  });

  it('switches to lakhs only at a real lakh (1e7 paise)', () => {
    // ₹99,999 — still plain rupees, NOT a fraction of a lakh.
    expect(formatMoney(9_999_900, { compact: true })).toBe('₹99,999');
    // Exactly ₹1,00,000 = 1 lakh = 1e7 paise.
    expect(formatMoney(PAISE(1_00_000), { compact: true })).toBe('₹1.00 L');
    expect(formatMoney(PAISE(1_50_000), { compact: true })).toBe('₹1.50 L');
  });

  it('switches to crores only at a real crore (1e9 paise)', () => {
    expect(formatMoney(PAISE(99_00_000), { compact: true })).toBe('₹99.00 L');
    expect(formatMoney(PAISE(1_00_00_000), { compact: true })).toBe('₹1.00 Cr');
    expect(formatMoney(PAISE(2_50_00_000), { compact: true })).toBe('₹2.50 Cr');
  });

  it('never labels a small amount in lakhs', () => {
    // The regression: ₹1,000 used to read "₹1.00 L".
    expect(formatMoney(PAISE(1_000), { compact: true })).toBe('₹1,000');
    expect(formatMoney(PAISE(5_000), { compact: true })).not.toContain('L');
    expect(formatMoney(PAISE(99_000), { compact: true })).not.toContain('Cr');
  });
});

/** Rupees → the paise the API actually stores. */
function PAISE(rupees: number): number {
  return rupees * 100;
}

describe('other formatters', () => {
  it('shows money precisely only where precision is claimed', () => {
    expect(formatMoneyPrecise(1_234_56)).toBe('₹1,234.56');
    expect(formatMoneyPrecise(-1_234_56)).toBe('-₹1,234.56');
  });

  it('counts plain quantities separately from money', () => {
    expect(formatNumber(1234567)).toBe('12,34,567');
    expect(formatNumber(-1234567)).toBe('-12,34,567');
    expect(formatCompact(1200)).toBe('1.2k');
    expect(formatCompact(-1200)).toBe('-1.2k');
    expect(formatCompact(150000)).toBe('1.5L');
    expect(formatCompact(-150000)).toBe('-1.5L');
    expect(formatCompact(10_000_000)).toBe('1.0Cr');
    expect(formatCompact(25_000_000)).toBe('2.5Cr');
    expect(formatCompact(-10_000_000)).toBe('-1.0Cr');
    expect(formatPercent(12.345)).toBe('12.3%');
  });

  it('treats an unparseable or missing date as absent, not as today', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDate('2026-03-09T00:00:00Z')).toContain('2026');
  });

  it('describes due dates in whole days', () => {
    expect(formatDaysUntil(null)).toBeNull();
    const inThree = new Date(Date.now() + 3 * 86400000).toISOString();
    expect(formatDaysUntil(inThree)).toBe('in 3 days');
  });

  it('title-cases enum values and derives initials', () => {
    expect(titleCase('in_progress')).toBe('In Progress');
    expect(initials('Aditi Sharma')).toBe('AS');
    expect(initials(null)).toBe('?');
  });
});