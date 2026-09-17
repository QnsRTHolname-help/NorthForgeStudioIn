import { describe, expect, it } from 'vitest';
import { billableLines, isOwed, nextInvoiceNumber, sumOwed, totalize, GST_RATE } from './billing';

const LEAD = {
  id: 'plan_lead',
  name: 'LEAD',
  amount: 750_000,
  setupAmount: 1_500_000,
  intervalDays: 30,
};

describe('billing math', () => {
  it('bills management only when setup is excluded', () => {
    const lines = billableLines(LEAD, { includeSetup: false });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBe(750_000);
    expect(lines[0]!.description).toContain('30-day');
  });

  it('bills the one-time setup fee with the first cycle', () => {
    const lines = billableLines(LEAD, { includeSetup: true });
    expect(lines.map((line) => line.amount)).toEqual([1_500_000, 750_000]);
  });

  it('computes GST once, on the subtotal, in integer paise', () => {
    const totals = totalize(billableLines(LEAD, { includeSetup: true }));
    expect(totals.subtotal).toBe(2_250_000);
    expect(totals.tax).toBe(Math.round(2_250_000 * GST_RATE));
    expect(totals.total).toBe(totals.subtotal + totals.tax);
  });

  it('rounds tax to whole paise and never drifts from the line items', () => {
    const totals = totalize([{ label: 'Odd amount', amount: 33_333 }]);
    expect(totals.tax).toBe(6_000); // 5999.94 → 6000
    expect(totals.total).toBe(39_333);
  });

  it('keeps operator-added line items out of the plan pricing', () => {
    const lines = billableLines(LEAD, {
      includeSetup: false,
      extraLines: [{ label: 'Extra landing page', amount: 500_000 }, { label: '  ', amount: 1 }],
    });
    expect(lines.map((line) => line.label)).toEqual(['LEAD — management', 'Extra landing page']);
    expect(totalize(lines).subtotal).toBe(1_250_000);
  });

  it('handles a custom (unpriced) plan without inventing a number', () => {
    const lines = billableLines({ name: 'CUSTOM QUOTE', amount: null, setupAmount: null });
    expect(lines).toEqual([]);
    expect(totalize(lines)).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });

  it('treats only open and uncollectible invoices as money owed', () => {
    expect(isOwed('open')).toBe(true);
    expect(isOwed('uncollectible')).toBe(true);
    expect(isOwed('draft')).toBe(false);
    expect(isOwed('void')).toBe(false);
    expect(isOwed('paid')).toBe(false);

    expect(
      sumOwed([
        { status: 'paid', total: 100 },
        { status: 'draft', total: 999 },
        { status: 'void', total: 999 },
        { status: 'open', total: 250 },
      ]),
    ).toBe(250);
  });

  it('builds a dated, unique-enough invoice number', () => {
    const number = nextInvoiceNumber(new Date('2026-03-09T10:00:00Z'), 'AB12');
    expect(number).toBe('NF-202603-AB12');
  });
});
