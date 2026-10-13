import { describe, expect, it } from 'vitest';
import { billableLines, isOwed, nextInvoiceNumber, sumOwed, totalize, TAX_RATE } from './billing';

const LEAD = {
  id: 'plan_lead',
  name: 'LEAD',
  amount: 750_000,
  setupAmount: 1_500_000,
  intervalDays: 30,
};

const CONVERT = {
  id: 'plan_convert',
  name: 'CONVERT',
  amount: 1_500_000,
  setupAmount: 3_000_000,
  intervalDays: 30,
};

const AUTOPILOT = {
  id: 'plan_autopilot',
  name: 'AUTOPILOT',
  amount: 3_000_000,
  setupAmount: 6_000_000,
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

  /*
   * NorthForge does not levy GST. The total must therefore equal the sum of
   * the line items EXACTLY — not approximately, and not by a formula that
   * would quietly add 18% back if someone changed a constant.
   */
  it('charges no tax, so the total is exactly the line items', () => {
    const totals = totalize(billableLines(LEAD, { includeSetup: true }));
    expect(totals.subtotal).toBe(2_250_000);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(2_250_000);
    expect(TAX_RATE).toBe(0);
  });

  it('verifies 0% GST on new invoices across all plan tiers (LEAD, CONVERT, AUTOPILOT)', () => {
    // LEAD: ₹7,500/mo + ₹15,000 setup
    const leadNoSetup = totalize(billableLines(LEAD, { includeSetup: false }));
    expect(leadNoSetup).toEqual({ subtotal: 750_000, tax: 0, total: 750_000 });

    const leadWithSetup = totalize(billableLines(LEAD, { includeSetup: true }));
    expect(leadWithSetup).toEqual({ subtotal: 2_250_000, tax: 0, total: 2_250_000 });

    // CONVERT: ₹15,000/mo + ₹30,000 setup
    const convertNoSetup = totalize(billableLines(CONVERT, { includeSetup: false }));
    expect(convertNoSetup).toEqual({ subtotal: 1_500_000, tax: 0, total: 1_500_000 });

    const convertWithSetup = totalize(billableLines(CONVERT, { includeSetup: true }));
    expect(convertWithSetup).toEqual({ subtotal: 4_500_000, tax: 0, total: 4_500_000 });

    // AUTOPILOT: ₹30,000/mo + ₹60,000 setup
    const autopilotNoSetup = totalize(billableLines(AUTOPILOT, { includeSetup: false }));
    expect(autopilotNoSetup).toEqual({ subtotal: 3_000_000, tax: 0, total: 3_000_000 });

    const autopilotWithSetup = totalize(billableLines(AUTOPILOT, { includeSetup: true }));
    expect(autopilotWithSetup).toEqual({ subtotal: 9_000_000, tax: 0, total: 9_000_000 });
  });

  it('verifies 0% GST on invoices with add-ons (employee seats, second brain)', () => {
    // LEAD with 2 employee seats (+₹600 each = ₹1,200) and Second Brain (+₹2,000)
    const lines = billableLines(LEAD, {
      includeSetup: false,
      extraLines: [
        { label: 'Employee seats (2 extra)', amount: 120_000 },
        { label: 'Company Second Brain add-on', amount: 200_000 },
      ],
    });
    const totals = totalize(lines);
    expect(totals.subtotal).toBe(1_070_000);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(1_070_000);
  });

  it('never drifts from the line items, including an odd amount', () => {
    const totals = totalize([{ label: 'Odd amount', amount: 33_333 }]);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(33_333);
  });

  it('still applies a rate when one is passed explicitly (historical rows)', () => {
    // An invoice raised before GST was removed is read back at 18%; the
    // function must still be able to reproduce that figure.
    const totals = totalize([{ label: 'Legacy', amount: 100_000 }], 0.18);
    expect(totals.tax).toBe(18_000);
    expect(totals.total).toBe(118_000);
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
