import { describe, expect, it } from 'vitest';
import {
  BILLING_INTERVAL_DAYS,
  PLANS,
  PLAN_SCOPE_ROWS,
  SERVICES,
  SERVICE_GROUPS,
  getPlan,
  getPlanById,
  planAmountLabel,
  planSetupLabel,
  recommendedPlan,
  servicesByGroup,
} from './catalog';

/**
 * The catalog is the single source of truth for money (spec §105).
 * These tests exist so a price can never silently drift between the
 * homepage, the portal, an invoice and the admin screens.
 */
describe('catalog', () => {
  it('stores every amount as whole paise, never a float', () => {
    for (const plan of PLANS) {
      if (plan.amount === null) continue;
      expect(Number.isInteger(plan.amount)).toBe(true);
      expect(plan.amount).toBeGreaterThan(0);
    }
    for (const plan of PLANS) {
      if (plan.setupAmount === null) continue;
      expect(Number.isInteger(plan.setupAmount)).toBe(true);
      expect(plan.setupAmount).toBeGreaterThan(0);
    }
  });

  it('publishes the agreed commercial model', () => {
    const lead = getPlan('lead')!;
    const convert = getPlan('convert')!;
    const autopilot = getPlan('autopilot')!;

    expect(lead.amount).toBe(750_000);
    expect(lead.setupAmount).toBe(1_500_000);
    expect(convert.amount).toBe(1_500_000);
    expect(convert.setupAmount).toBe(3_000_000);
    expect(autopilot.amount).toBe(3_000_000);
    expect(autopilot.setupAmount).toBe(6_000_000);
  });

  it('formats money for display without inventing precision', () => {
    expect(planAmountLabel(getPlan('convert')!)).toBe('₹15,000');
    expect(planSetupLabel(getPlan('convert')!)).toBe('₹30,000 setup');
    expect(planAmountLabel(getPlan('custom')!)).toBe('Custom');
  });

  it('marks exactly one plan as recommended', () => {
    expect(PLANS.filter((plan) => plan.recommended)).toHaveLength(1);
    expect(recommendedPlan().slug).toBe('convert');
  });

  it('gives every priced plan a complete scope matrix', () => {
    for (const plan of PLANS.filter((p) => p.amount !== null)) {
      for (const row of PLAN_SCOPE_ROWS) {
        expect(plan.scope[row], `${plan.name} is missing "${row}"`).toBeTruthy();
      }
    }
  });

  it('keeps plan limits honest: only the custom plan is unmetered', () => {
    for (const plan of PLANS) {
      const custom = plan.amount === null;
      expect(plan.limits.workflows === -1).toBe(custom);
      expect(plan.limits.integrations === -1).toBe(custom);
    }
  });

  it('only groups services into categories that exist', () => {
    const keys = new Set(SERVICE_GROUPS.map((group) => group.key));
    for (const service of SERVICES) {
      expect(keys.has(service.group as never), `${service.name} has unknown group ${service.group}`).toBe(true);
    }
    for (const group of SERVICE_GROUPS) {
      expect(servicesByGroup(group.key as never).length).toBeGreaterThan(0);
    }
  });

  it('resolves plans by id and slug, and returns null for nonsense', () => {
    expect(getPlanById('plan_convert')?.slug).toBe('convert');
    expect(getPlanById(null)).toBeNull();
    expect(getPlan('does-not-exist')).toBeNull();
  });

  it('bills monthly', () => {
    expect(BILLING_INTERVAL_DAYS).toBe(30);
    for (const plan of PLANS) expect(plan.intervalDays).toBe(BILLING_INTERVAL_DAYS);
  });
});
