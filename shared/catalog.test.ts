import { describe, expect, it } from 'vitest';
import {
  ADD_ONS,
  BILLING_INTERVAL_DAYS,
  EMPLOYEE_SEAT_RATES,
  PLANS,
  PLAN_SCOPE_ROWS,
  PSYCHOLOGICAL_PRICING,
  SECOND_BRAIN_RATE,
  SERVICES,
  SERVICE_GROUPS,
  addOnAmountForPlan,
  addOnAmountLabel,
  addOnsForPlan,
  getDiscountedSetupAmount,
  getPlan,
  getPlanById,
  getQuarterlySavings,
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

  it('prices add-ons with agreed amounts, tier rates, and labels', () => {
    for (const addOn of ADD_ONS) {
      if (addOn.amount === null) continue;
      expect(Number.isInteger(addOn.amount)).toBe(true);
      expect(addOn.amount).toBeGreaterThan(0);
    }
    const seats = ADD_ONS.find((addOn) => addOn.slug === 'extra-employee-seats')!;
    expect(seats.unit).toBe('per seat / month');
    expect(seats.amount).toBe(50_000);
    expect(EMPLOYEE_SEAT_RATES.lead).toBe(60_000);
    expect(EMPLOYEE_SEAT_RATES.convert).toBe(50_000);
    expect(EMPLOYEE_SEAT_RATES.autopilot).toBe(50_000);
    expect(addOnAmountForPlan('extra-employee-seats', 'lead')).toBe(60_000);
    expect(addOnAmountForPlan('extra-employee-seats', 'convert')).toBe(50_000);
    expect(addOnAmountForPlan('extra-employee-seats', 'autopilot')).toBe(50_000);
    expect(addOnAmountLabel(seats)).toBe('₹500 per seat / month');
    expect(addOnAmountLabel(seats, 'lead')).toBe('₹600 per seat / month');
    expect(addOnAmountLabel(seats, 'convert')).toBe('₹500 per seat / month');
    expect(addOnAmountLabel(seats, 'autopilot')).toBe('₹500 per seat / month');

    const secondBrain = ADD_ONS.find((addOn) => addOn.slug === 'company-second-brain')!;
    expect(secondBrain.amount).toBe(200_000);
    expect(SECOND_BRAIN_RATE).toBe(200_000);
    expect(addOnAmountForPlan('company-second-brain', 'lead')).toBe(200_000);
    expect(addOnAmountLabel(secondBrain)).toBe('₹2,000 per month');
    expect(addOnAmountLabel(secondBrain, 'lead')).toBe('₹2,000 per month');

    const voice = ADD_ONS.find((addOn) => addOn.slug === 'ai-voice-receptionist')!;
    expect(voice.amount).toBeNull();
    expect(addOnAmountLabel(voice)).toBe('Quoted per month');
  });

  it('calculates psychological pricing discounts and quarterly retention savings', () => {
    const lead = getPlan('lead')!;
    const convert = getPlan('convert')!;
    const autopilot = getPlan('autopilot')!;

    // Founder promo discount (₹5,000 off setup fee)
    expect(getDiscountedSetupAmount(lead, 'FOUNDER5K')).toBe(1_000_000); // 15k -> 10k
    expect(getDiscountedSetupAmount(convert, 'FOUNDER5K')).toBe(2_500_000); // 30k -> 25k
    expect(getDiscountedSetupAmount(autopilot, 'founder5k')).toBe(5_500_000); // 60k -> 55k
    expect(getDiscountedSetupAmount(lead, 'INVALID')).toBe(1_500_000);

    // Quarterly retention savings (15% off)
    const leadQuarterly = getQuarterlySavings(lead)!;
    expect(leadQuarterly.savings).toBe(337_500); // 15% of 22,500 = 3,375
    expect(leadQuarterly.quarterlyTotal).toBe(1_912_500); // 19,125

    const convertQuarterly = getQuarterlySavings(convert)!;
    expect(convertQuarterly.savings).toBe(675_000); // 15% of 45,000 = 6,750
    expect(convertQuarterly.quarterlyTotal).toBe(3_825_000); // 38,250

    expect(PSYCHOLOGICAL_PRICING.monthlyCohortSpotsRemaining).toBe(3);
    expect(PSYCHOLOGICAL_PRICING.rapidDeploymentHours).toBe(48);
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
