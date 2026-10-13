import { describe, expect, it } from 'vitest';
import {
  BUSINESS_PRESETS,
  FLAGSHIP_PRESET,
  getAllPresets,
  getPresetById,
  getPresetByBusinessType,
} from './businessPresets';
import {
  DASHBOARD_THEMES,
  getDefaultThemeForPlan,
  getThemeById,
  getThemesForPlan,
  isValidThemeForPlan,
  normalizePlanTier,
} from './dashboardThemes';
import {
  ADD_ONS,
  EMPLOYEE_SEAT_RATES,
  PSYCHOLOGICAL_PRICING,
  SECOND_BRAIN_RATE,
  addOnAmountForPlan,
  addOnAmountLabel,
  getDiscountedSetupAmount,
  getPlan,
  getQuarterlySavings,
} from '@shared/catalog';

describe('NorthForge Ecosystem Architecture (R6)', () => {
  describe('Business-Specific Dashboard Presets', () => {
    it('defines exactly 10 business presets with Interior Design as the flagship', () => {
      expect(BUSINESS_PRESETS).toHaveLength(10);
      expect(FLAGSHIP_PRESET.id).toBe('interior_design');
      expect(FLAGSHIP_PRESET.name).toBe('Interior Design');
      expect(FLAGSHIP_PRESET.isFlagship).toBe(true);
      expect(getAllPresets()).toHaveLength(10);

      const ids = BUSINESS_PRESETS.map((p) => p.id);
      expect(ids).toEqual([
        'interior_design',
        'architecture',
        'startup',
        'consulting',
        'real_estate',
        'creative_studio',
        'ecommerce',
        'legal',
        'fitness',
        'healthcare',
      ]);
    });

    it('equips all presets with tailored modules including clients, projects, calendar, tasks, bookings, and employee activity', () => {
      const requiredModules = ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'];
      for (const preset of BUSINESS_PRESETS) {
        expect(preset.name).toBeTruthy();
        expect(preset.tagline).toBeTruthy();
        expect(preset.description).toBeTruthy();
        for (const mod of requiredModules) {
          expect(preset.tailoredModules).toContain(mod);
        }
      }
    });

    it('configures pipeline stages and appointment types for each business niche', () => {
      // Flagship Interior Design checks
      expect(FLAGSHIP_PRESET.pipelineStages.length).toBeGreaterThanOrEqual(5);
      const stageNames = FLAGSHIP_PRESET.pipelineStages.map((s) => s.name);
      expect(stageNames).toContain('3D Design & Space Planning');
      expect(stageNames).toContain('Site Survey & Measurements');
      expect(stageNames).toContain('Client Approval & Signoff');

      // Architecture checks
      const arch = getPresetById('architecture')!;
      expect(arch).toBeDefined();
      expect(arch.pipelineStages.map((s) => s.name)).toContain('Municipal & Sanction Drawings');

      // Startup checks
      const startup = getPresetById('startup')!;
      expect(startup).toBeDefined();
      expect(startup.pipelineStages.map((s) => s.name)).toContain('Sprint Backlog');
    });

    it('integrates Gmail, WhatsApp, Calendar, and Slack across all presets', () => {
      const expectedIntegrations = ['gmail', 'whatsapp', 'calendar', 'slack'];
      for (const preset of BUSINESS_PRESETS) {
        const integrationIds = preset.integrations.map((i) => i.id);
        for (const expected of expectedIntegrations) {
          expect(integrationIds).toContain(expected);
        }
      }
    });

    it('infers preset from businessType keywords and defaults safely to Interior Design flagship', () => {
      expect(getPresetByBusinessType('Luxury Interior Decorator').id).toBe('interior_design');
      expect(getPresetByBusinessType('Architectural Studio').id).toBe('architecture');
      expect(getPresetByBusinessType('B2B SaaS Startup').id).toBe('startup');
      expect(getPresetByBusinessType('Strategy Consulting Partners').id).toBe('consulting');
      expect(getPresetByBusinessType('Commercial Real Estate Agency').id).toBe('real_estate');
      expect(getPresetByBusinessType('Brand Creative Agency').id).toBe('creative_studio');
      expect(getPresetByBusinessType('D2C E-commerce Brand').id).toBe('ecommerce');
      expect(getPresetByBusinessType('Corporate Legal Counsel').id).toBe('legal');
      expect(getPresetByBusinessType('Boutique Fitness Studio').id).toBe('fitness');
      expect(getPresetByBusinessType('Dental Healthcare Clinic').id).toBe('healthcare');

      // Fallback for null / unknown strings
      expect(getPresetByBusinessType(null).id).toBe('interior_design');
      expect(getPresetByBusinessType('').id).toBe('interior_design');
      expect(getPresetByBusinessType('Unrecognized Custom Business').id).toBe('interior_design');
    });
  });

  describe('Plan-Specific Dashboard Themes', () => {
    it('defines exactly 7 plan-curated dashboard themes', () => {
      expect(DASHBOARD_THEMES).toHaveLength(7);
      expect(new Set(DASHBOARD_THEMES.map((t) => t.id)).size).toBe(7);
    });

    it('grants Basic & Premium themes to LEAD (₹7,500/mo)', () => {
      const leadThemes = getThemesForPlan('lead');
      expect(leadThemes).toHaveLength(2);
      expect(leadThemes.map((t) => t.name)).toEqual(['Basic', 'Premium']);
      expect(leadThemes.map((t) => t.id)).toEqual(['lead-basic', 'lead-premium']);
      expect(getDefaultThemeForPlan('lead').id).toBe('lead-basic');
    });

    it('grants Apple & Premium themes to CONVERT (₹15,000/mo)', () => {
      const convertThemes = getThemesForPlan('convert');
      expect(convertThemes).toHaveLength(2);
      expect(convertThemes.map((t) => t.name)).toEqual(['Apple', 'Premium']);
      expect(convertThemes.map((t) => t.id)).toEqual(['convert-apple', 'convert-premium']);
      expect(getDefaultThemeForPlan('convert').id).toBe('convert-apple');
    });

    it('grants Cream White, Cream Peach & Cream Burberry themes to AUTOPILOT (₹30,000/mo)', () => {
      const autopilotThemes = getThemesForPlan('autopilot');
      expect(autopilotThemes).toHaveLength(3);
      expect(autopilotThemes.map((t) => t.name)).toEqual(['Cream White', 'Cream Peach', 'Cream Burberry']);
      expect(autopilotThemes.map((t) => t.id)).toEqual([
        'autopilot-cream-white',
        'autopilot-cream-peach',
        'autopilot-cream-burberry',
      ]);
      expect(getDefaultThemeForPlan('autopilot').id).toBe('autopilot-cream-white');
    });

    it('validates theme permissions according to subscription tier', () => {
      expect(isValidThemeForPlan('lead-basic', 'lead')).toBe(true);
      expect(isValidThemeForPlan('lead-premium', 'lead')).toBe(true);
      expect(isValidThemeForPlan('convert-apple', 'lead')).toBe(false);
      expect(isValidThemeForPlan('autopilot-cream-burberry', 'lead')).toBe(false);

      expect(isValidThemeForPlan('convert-apple', 'convert')).toBe(true);
      expect(isValidThemeForPlan('convert-premium', 'convert')).toBe(true);
      expect(isValidThemeForPlan('lead-basic', 'convert')).toBe(false);

      expect(isValidThemeForPlan('autopilot-cream-burberry', 'autopilot')).toBe(true);
      expect(isValidThemeForPlan('autopilot-cream-peach', 'autopilot')).toBe(true);
      expect(isValidThemeForPlan('autopilot-cream-white', 'autopilot')).toBe(true);
      expect(isValidThemeForPlan('lead-basic', 'autopilot')).toBe(false);

      expect(getThemeById('autopilot-cream-burberry')?.accentColor).toBe('#b91c1c');
      expect(normalizePlanTier('plan_autopilot')).toBe('autopilot');
    });
  });

  describe('Add-on Pricing & Plan Tier Allocations', () => {
    it('enforces agreed employee slot rates: +₹600 on Lead, +₹500 on Convert/Autopilot', () => {
      expect(EMPLOYEE_SEAT_RATES.lead).toBe(60_000);
      expect(EMPLOYEE_SEAT_RATES.convert).toBe(50_000);
      expect(EMPLOYEE_SEAT_RATES.autopilot).toBe(50_000);

      expect(addOnAmountForPlan('extra-employee-seats', 'lead')).toBe(60_000);
      expect(addOnAmountForPlan('extra-employee-seats', 'convert')).toBe(50_000);
      expect(addOnAmountForPlan('extra-employee-seats', 'autopilot')).toBe(50_000);

      const seatAddOn = ADD_ONS.find((a) => a.slug === 'extra-employee-seats')!;
      expect(addOnAmountLabel(seatAddOn, 'lead')).toBe('₹600 per seat / month');
      expect(addOnAmountLabel(seatAddOn, 'convert')).toBe('₹500 per seat / month');
      expect(addOnAmountLabel(seatAddOn, 'autopilot')).toBe('₹500 per seat / month');
    });

    it('enforces Company Second Brain: ₹2,000/mo add-on on Lead, included on Convert/Autopilot', () => {
      expect(SECOND_BRAIN_RATE).toBe(200_000);
      expect(addOnAmountForPlan('company-second-brain', 'lead')).toBe(200_000);
      expect(addOnAmountForPlan('company-second-brain', 'convert')).toBe(0); // included
      expect(addOnAmountForPlan('company-second-brain', 'autopilot')).toBe(0); // included

      const secondBrainAddOn = ADD_ONS.find((a) => a.slug === 'company-second-brain')!;
      expect(addOnAmountLabel(secondBrainAddOn)).toBe('₹2,000 per month');
      expect(secondBrainAddOn.availableOn).toEqual(['lead']);
    });
  });

  describe('Psychological Pricing Hooks & Calculations', () => {
    it('applies first-time Founder Beta setup discount of ₹5,000', () => {
      const lead = getPlan('lead')!;
      const convert = getPlan('convert')!;
      const autopilot = getPlan('autopilot')!;

      // With valid code FOUNDER5K (case-insensitive)
      expect(getDiscountedSetupAmount(lead, 'FOUNDER5K')).toBe(1_000_000); // ₹15,000 -> ₹10,000
      expect(getDiscountedSetupAmount(convert, 'founder5k')).toBe(2_500_000); // ₹30,000 -> ₹25,000
      expect(getDiscountedSetupAmount(autopilot, 'FOUNDER5K')).toBe(5_500_000); // ₹60,000 -> ₹55,000

      // Without code or invalid code
      expect(getDiscountedSetupAmount(lead, undefined)).toBe(1_500_000);
      expect(getDiscountedSetupAmount(lead, 'WRONG_CODE')).toBe(1_500_000);
    });

    it('calculates 15% quarterly commitment retention savings', () => {
      const lead = getPlan('lead')!;
      const convert = getPlan('convert')!;
      const autopilot = getPlan('autopilot')!;

      const leadSavings = getQuarterlySavings(lead)!;
      expect(leadSavings.savings).toBe(337_500); // 15% of 22,500 = ₹3,375
      expect(leadSavings.quarterlyTotal).toBe(1_912_500); // ₹19,125

      const convertSavings = getQuarterlySavings(convert)!;
      expect(convertSavings.savings).toBe(675_000); // 15% of 45,000 = ₹6,750
      expect(convertSavings.quarterlyTotal).toBe(3_825_000); // ₹38,250

      const autopilotSavings = getQuarterlySavings(autopilot)!;
      expect(autopilotSavings.savings).toBe(1_350_000); // 15% of 90,000 = ₹13,500
      expect(autopilotSavings.quarterlyTotal).toBe(7_650_000); // ₹76,500
    });

    it('publishes scarcity and velocity parameters', () => {
      expect(PSYCHOLOGICAL_PRICING.monthlyCohortSpotsRemaining).toBe(3);
      expect(PSYCHOLOGICAL_PRICING.rapidDeploymentHours).toBe(48);
      expect(PSYCHOLOGICAL_PRICING.quarterlyDiscountPercent).toBe(15);
      expect(PSYCHOLOGICAL_PRICING.quarterlyFreeSeats).toBe(1);
    });
  });
});
