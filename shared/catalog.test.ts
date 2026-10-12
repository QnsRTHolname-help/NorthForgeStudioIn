import { describe, expect, it } from 'vitest';
import {
  ADD_ONS,
  BILLING_INTERVAL_DAYS,
  PLANS,
  PLAN_SCOPE_ROWS,
  SERVICES,
  SERVICE_GROUPS,
  addOnAmountLabel,
  addOnsForPlan,
  getPlan,
  getPlanById,
  planAmountLabel,
  planSeatLabel,
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

  /*
   * Employee seats are quoted in the marketing copy ("30 users"), rendered in
   * the portal and enforced as `limits.users`. The scope row and the limit were
   * once allowed to drift (AUTOPILOT advertised 30 while the limit said 25) —
   * a client would have been sold seats the product would not hand over.
   */
  it('grants the seat allowance it advertises', () => {
    expect(getPlan('lead')!.limits.users).toBe(3);
    expect(getPlan('convert')!.limits.users).toBe(15);
    expect(getPlan('autopilot')!.limits.users).toBe(30);
    expect(getPlan('custom')!.limits.users).toBe(-1);
  });

  it('keeps the seat count in the scope matrix in step with the enforced limit', () => {
    for (const plan of PLANS.filter((p) => p.amount !== null)) {
      const quoted = Number(plan.scope['Employee portal']?.match(/\d+/)?.[0]);
      expect(quoted, `${plan.name} should quote its seat allowance in "Employee portal"`).toBe(
        plan.limits.users,
      );
    }
  });

  it('reads a seat allowance the way the portal shows it', () => {
    expect(planSeatLabel(getPlan('lead')!)).toBe('3 seats');
    expect(planSeatLabel(getPlan('autopilot')!)).toBe('30 seats');
    expect(planSeatLabel(getPlan('custom')!)).toBe('Scoped by agreement');
  });

  it('publishes add-ons with unique ids and slugs, on plans that exist', () => {
    expect(ADD_ONS.length).toBeGreaterThan(0);
    expect(new Set(ADD_ONS.map((addOn) => addOn.id)).size).toBe(ADD_ONS.length);
    expect(new Set(ADD_ONS.map((addOn) => addOn.slug)).size).toBe(ADD_ONS.length);

    const slugs = new Set(PLANS.map((plan) => plan.slug));
    for (const addOn of ADD_ONS) {
      expect(addOn.availableOn.length, `${addOn.name} is offered on nothing`).toBeGreaterThan(0);
      for (const slug of addOn.availableOn) {
        expect(slugs.has(slug), `${addOn.name} is offered on unknown plan "${slug}"`).toBe(true);
      }
    }
  });

  it('never prices an add-on it has not agreed, and says so instead', () => {
    for (const addOn of ADD_ONS) {
      if (addOn.amount === null) continue;
      expect(Number.isInteger(addOn.amount)).toBe(true);
      expect(addOn.amount).toBeGreaterThan(0);
    }
    const seats = ADD_ONS.find((addOn) => addOn.slug === 'extra-employee-seats')!;
    expect(seats.unit).toBe('per seat / month');
    expect(addOnAmountLabel(seats)).toBe('Quoted per seat / month');
  });

  it('offers the seat add-on on every plan that meters seats', () => {
    for (const plan of PLANS.filter((p) => p.amount !== null)) {
      expect(addOnsForPlan(plan.slug).map((addOn) => addOn.slug)).toContain('extra-employee-seats');
    }
    expect(addOnsForPlan('does-not-exist')).toEqual([]);
  });

  /* An add-on sold where the matrix says it is included is a double charge. */
  it('sells an add-on exactly where the scope matrix marks it as one', () => {
    const scopeRowFor: Record<string, string> = {
      'company-second-brain': 'Second Brain',
      'ai-voice-receptionist': 'Voice AI',
    };

    for (const [slug, row] of Object.entries(scopeRowFor)) {
      const offered = ADD_ONS.find((addOn) => addOn.slug === slug)!.availableOn;
      for (const plan of PLANS.filter((p) => p.amount !== null)) {
        expect(offered.includes(plan.slug), `${plan.name} / ${row}`).toBe(plan.scope[row] === 'Add-on');
      }
    }
  });
});
