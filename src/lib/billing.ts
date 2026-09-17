import { BILLING_INTERVAL_DAYS } from '@shared/catalog';

/**
 * BILLING MATH (spec §123–124) — one place, integer paise, unit-tested.
 *
 * Why this file exists: invoices were assembled inside the service layer from
 * whatever number happened to be on hand. The plan's MONTHLY fee was billed as
 * the whole invoice — the one-time setup fee in the catalog was never charged,
 * and Subtotal/GST/Total were three numbers that could drift apart from the
 * line items shown on the same page.
 *
 * Rules enforced here:
 *   1. Every invoice is built from LINE ITEMS. Subtotal is their sum.
 *   2. GST is 18% of the subtotal, rounded ONCE, in paise.
 *   3. Total is always subtotal + tax — never an independently supplied number.
 *   4. Money is integer paise throughout; only the UI divides by 100.
 */

/** Indian GST on services (9% CGST + 9% SGST for intra-state supply). */
export const GST_RATE = 0.18;

export const GST_LABEL = 'GST @ 18%';

export interface InvoiceLine {
  label: string;
  amount: number;
  description?: string;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/** Minimal shape needed to price an invoice from the catalog. */
export interface BillablePlan {
  id?: string;
  name: string;
  amount: number | null;
  setupAmount?: number | null;
  intervalDays?: number;
}

/**
 * The line items for one billing cycle.
 *
 * `includeSetup` is what the operator chooses when a client has never been
 * billed: the first invoice carries the one-time build fee plus the first
 * month of management. Later cycles are management only.
 */
export function billableLines(
  plan: BillablePlan,
  options: { includeSetup?: boolean; extraLines?: InvoiceLine[]; intervalDays?: number } = {},
): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  const intervalDays = options.intervalDays ?? plan.intervalDays ?? BILLING_INTERVAL_DAYS;

  const setup = plan.setupAmount ?? 0;
  if (options.includeSetup && setup > 0) {
    lines.push({
      label: `${plan.name} — one-time setup`,
      amount: setup,
      description: 'Discovery, build, configuration and go-live',
    });
  }

  if (plan.amount && plan.amount > 0) {
    lines.push({
      label: `${plan.name} — management`,
      amount: plan.amount,
      description: `${intervalDays}-day management cycle`,
    });
  }

  for (const line of options.extraLines ?? []) {
    if (line.label.trim() && Number.isFinite(line.amount) && line.amount !== 0) {
      lines.push({ label: line.label.trim(), amount: Math.round(line.amount), description: line.description });
    }
  }

  return lines;
}

/** Subtotal + 18% GST = total. Always computed from the lines. */
export function totalize(lines: InvoiceLine[], taxRate = GST_RATE): InvoiceTotals {
  const subtotal = lines.reduce((sum, line) => sum + Math.round(line.amount), 0);
  const tax = Math.round(subtotal * taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

/** Human label for the full price of a plan. */
export function planPriceSummary(plan: BillablePlan): string {
  const parts: string[] = [];
  if (plan.setupAmount && plan.setupAmount > 0) parts.push(`setup ₹${(plan.setupAmount / 100).toLocaleString('en-IN')}`);
  if (plan.amount && plan.amount > 0) parts.push(`then ₹${(plan.amount / 100).toLocaleString('en-IN')}/month`);
  return parts.length ? parts.join(' + ') : 'Custom quote';
}

/**
 * Invoice numbers are human reference numbers, not a ledger id: the row id is
 * the identity. The random suffix keeps two invoices raised in the same
 * millisecond (double-click, script) from colliding on the unique index.
 */
export function nextInvoiceNumber(date = new Date(), suffix = Math.random().toString(36).slice(2, 6)): string {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `NF-${stamp}-${suffix.toUpperCase()}`;
}

/** Outstanding money: draft and void invoices are not owed. */
export function isOwed(status: string): boolean {
  return status === 'open' || status === 'uncollectible';
}

export function sumOwed(invoices: { status: string; total: number }[]): number {
  return invoices.filter((invoice) => isOwed(invoice.status)).reduce((sum, invoice) => sum + invoice.total, 0);
}
