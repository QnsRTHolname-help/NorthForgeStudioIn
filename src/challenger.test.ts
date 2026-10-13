import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// R1 imports
import { contactService } from '@/services/public';
import { resolvePublicOrigin, canonicalUrl, CANONICAL_SITE_URL } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { ApiError } from '@/types';

// R2 imports
import { formatMoney } from '@/lib/format';
import { totalize, billableLines, TAX_RATE } from '@/lib/billing';

// R3 imports
import { ERASURE_WINDOW, STANDARD_DELETION_NOTICE } from '@/config/deleteAccount';

// R4 imports
import { PORTAL_SECTIONS, PRIMARY_ITEMS, SECONDARY_ITEMS } from '@/config/portalNavigation';

// R5 imports
import { ticketsService } from '@/services/index';
import { isEmailMfaEnabled } from '@/services/emailMfa';

// R6 imports
import { FLAGSHIP_PRESET, getAllPresets } from '@/config/businessPresets';
import { getThemesForPlan, isValidThemeForPlan } from '@/config/dashboardThemes';
import {
  EMPLOYEE_SEAT_RATES,
  SECOND_BRAIN_RATE,
  addOnAmountForPlan,
  getDiscountedSetupAmount,
  getQuarterlySavings,
  getPlan,
} from '@shared/catalog';

describe('Adversarial Challenge: NorthForge OS Ecosystem (R1-R6)', () => {
  /* ═══════════════════════════════════════════════════════════════════════
   * R1. Public Contact Page, Resilient Auth & Canonical Origin
   * ═══════════════════════════════════════════════════════════════════════ */
  describe('Challenge R1: Public Contact & Canonical Origin', () => {
    it('rejects empty or whitespace-only name/businessName/email/phone with 400 validation error', async () => {
      const invalidPayloads = [
        { name: '', businessName: 'Test Inc', email: 'test@example.com', phone: '+919876543210', businessType: 'Other' },
        { name: '   ', businessName: 'Test Inc', email: 'test@example.com', phone: '+919876543210', businessType: 'Other' },
        { name: 'A', businessName: 'Test Inc', email: 'test@example.com', phone: '+919876543210', businessType: 'Other' },
        { name: 'Valid Name', businessName: ' ', email: 'test@example.com', phone: '+919876543210', businessType: 'Other' },
        { name: 'Valid Name', businessName: 'Test Inc', email: 'invalid-email-format', phone: '+919876543210', businessType: 'Other' },
        { name: 'Valid Name', businessName: 'Test Inc', email: 'test@domain', phone: '+919876543210', businessType: 'Other' },
        { name: 'Valid Name', businessName: 'Test Inc', email: 'test@example.com', phone: '123', businessType: 'Other' },
        { name: 'Valid Name', businessName: 'Test Inc', email: 'test@example.com', phone: '+919876543210', businessType: '' },
      ];

      for (const payload of invalidPayloads) {
        let caughtError: unknown = null;
        try {
          await contactService.submit(payload);
        } catch (err) {
          caughtError = err;
        }
        expect(caughtError).toBeInstanceOf(ApiError);
        expect((caughtError as ApiError).code).toBe('validation');
        expect((caughtError as ApiError).status).toBe(400);
      }
    });

    it('silently absorbs honeypot spam bot submissions without calling RPC', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc');
      const honeypotPayload = {
        name: 'Spam Bot',
        businessName: 'Spam LLC',
        email: 'spambot@example.com',
        phone: '+919876543210',
        businessType: 'Retail',
        website: 'http://buy-viagra-now.com', // Honeypot populated!
      };

      const result = await contactService.submit(honeypotPayload);
      expect(result.received).toBe(true);
      expect(result.reference).toBeNull();
      expect(rpcSpy).not.toHaveBeenCalled();
      rpcSpy.mockRestore();
    });

    it('recovers from RPC missing error (42883 / PGRST202) by falling back to enquiries table insert', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: { code: '42883', message: 'function app_submit_enquiry does not exist' } as any,
      } as any);

      const insertSpy = vi.fn().mockResolvedValue({ error: null });
      const fromSpy = vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'enquiries') {
          return { insert: insertSpy } as any;
        }
        return {} as any;
      }) as any);

      const validPayload = {
        name: 'Aditi Sharma',
        businessName: 'Sharma Interiors',
        email: 'aditi@sharmainteriors.com',
        phone: '+919876543210',
        businessType: 'Interior design',
        message: 'Looking for a 3D pipeline setup',
      };

      const result = await contactService.submit(validPayload);
      expect(result.received).toBe(true);
      expect(result.reference).toMatch(/^eq_[0-9a-f]{12}$/);
      expect(insertSpy).toHaveBeenCalled();

      rpcSpy.mockRestore();
      fromSpy.mockRestore();
    });

    it('canonical origin stress test: guarantees NEVER returning localhost or 127.0.0.1 for email links', () => {
      const localCombinations = [
        ['http://localhost:5173', 'http://localhost:5173'],
        ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
        ['http://0.0.0.0:8000', 'http://localhost:5173'],
        ['http://[::1]:8080', 'http://127.0.0.1'],
        ['localhost:5173', 'localhost:5173'],
        ['http://dev.localhost', 'http://subdomain.localhost'],
        ['', 'http://localhost:5173'],
        [null, 'http://localhost:5173'],
        [undefined, 'http://localhost:5173'],
        ['', ''],
        [null, null],
        [undefined, undefined],
      ];

      for (const [configured, browser] of localCombinations) {
        const resolved = resolvePublicOrigin(configured, browser);
        expect(resolved).toBe(CANONICAL_SITE_URL);
        expect(resolved).not.toContain('localhost');
        expect(resolved).not.toContain('127.0.0.1');
        expect(resolved).not.toContain('0.0.0.0');
        expect(resolved).not.toContain('[::1]');
      }

      // Canonical URL with leading and non-leading slashes
      expect(canonicalUrl('auth/callback')).toBe(`${CANONICAL_SITE_URL}/auth/callback`);
      expect(canonicalUrl('/auth/callback')).toBe(`${CANONICAL_SITE_URL}/auth/callback`);
      expect(canonicalUrl('/reset-password')).toBe(`${CANONICAL_SITE_URL}/reset-password`);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * R2. Subscription Calculations, GST Removal & Lakhs Formatting Fix
   * ═══════════════════════════════════════════════════════════════════════ */
  describe('Challenge R2: Currency Formatting, Lakhs & 0% GST Totalization', () => {
    it('stress tests exact rupee values across standard and edge thresholds', () => {
      // 0 paise
      expect(formatMoney(0)).toBe('₹0');
      // ₹7,500 = 750,000 paise
      expect(formatMoney(750_000)).toBe('₹7,500');
      // ₹10,000 = 1,000,000 paise
      expect(formatMoney(1_000_000)).toBe('₹10,000');
      // ₹15,000 = 1,500,000 paise
      expect(formatMoney(1_500_000)).toBe('₹15,000');
      // ₹30,000 = 3,000,000 paise
      expect(formatMoney(3_000_000)).toBe('₹30,000');
      // ₹1,00,000 (1 Lakh) = 10,000,000 paise
      expect(formatMoney(10_000_000)).toBe('₹1,00,000');
      // ₹10,00,000 (10 Lakhs) = 100,000,000 paise
      expect(formatMoney(100_000_000)).toBe('₹10,00,000');
      // ₹1,00,00,000 (1 Crore) = 1,000,000,000 paise
      expect(formatMoney(1_000_000_000)).toBe('₹1,00,00,000');
    });

    it('stress tests compact notation across exact thresholds and boundaries', () => {
      // Below 1 Lakh should NOT render as L or Cr
      expect(formatMoney(0, { compact: true })).toBe('₹0');
      expect(formatMoney(750_000, { compact: true })).toBe('₹7,500');
      expect(formatMoney(1_000_000, { compact: true })).toBe('₹10,000');
      expect(formatMoney(9_999_900, { compact: true })).toBe('₹99,999');

      // Exactly 1 Lakh (10,000,000 paise)
      expect(formatMoney(10_000_000, { compact: true })).toBe('₹1.00 L');
      // 1.5 Lakhs (15,000,000 paise)
      expect(formatMoney(15_000_000, { compact: true })).toBe('₹1.50 L');
      // 10 Lakhs (100,000,000 paise)
      expect(formatMoney(100_000_000, { compact: true })).toBe('₹10.00 L');
      // 99 Lakhs (990,000,000 paise)
      expect(formatMoney(990_000_000, { compact: true })).toBe('₹99.00 L');

      // Exactly 1 Crore (1,000,000,000 paise)
      expect(formatMoney(1_000_000_000, { compact: true })).toBe('₹1.00 Cr');
      // 2.5 Crores (2,500,000,000 paise)
      expect(formatMoney(2_500_000_000, { compact: true })).toBe('₹2.50 Cr');
    });

    it('stress tests negative numbers in default and compact modes', () => {
      expect(formatMoney(-0)).toBe('₹0');
      expect(formatMoney(-750_000)).toBe('-₹7,500');
      expect(formatMoney(-1_000_000)).toBe('-₹10,000');
      expect(formatMoney(-10_000_000)).toBe('-₹1,00,000');
      expect(formatMoney(-100_000_000)).toBe('-₹10,00,000');
      expect(formatMoney(-1_000_000_000)).toBe('-₹1,00,00,000');

      // Compact negatives
      expect(formatMoney(-750_000, { compact: true })).toBe('-₹7,500');
      expect(formatMoney(-10_000_000, { compact: true })).toBe('-₹1.00 L');
      expect(formatMoney(-100_000_000, { compact: true })).toBe('-₹10.00 L');
      expect(formatMoney(-1_000_000_000, { compact: true })).toBe('-₹1.00 Cr');
    });

    it('verifies 0% GST totalization across all plans, setups, and add-on combinations', () => {
      expect(TAX_RATE).toBe(0);

      const leadPlan = getPlan('lead')!;
      const convertPlan = getPlan('convert')!;
      const autopilotPlan = getPlan('autopilot')!;

      // LEAD: ₹7,500/mo management
      const leadLines = billableLines(leadPlan, { includeSetup: false });
      const leadTotals = totalize(leadLines);
      expect(leadTotals.subtotal).toBe(750_000);
      expect(leadTotals.tax).toBe(0);
      expect(leadTotals.total).toBe(750_000);

      // LEAD with setup: ₹7,500 + ₹15,000 = ₹22,500
      const leadSetupLines = billableLines(leadPlan, { includeSetup: true });
      const leadSetupTotals = totalize(leadSetupLines);
      expect(leadSetupTotals.subtotal).toBe(2_250_000);
      expect(leadSetupTotals.tax).toBe(0);
      expect(leadSetupTotals.total).toBe(2_250_000);

      // CONVERT with setup: ₹15,000 + ₹30,000 = ₹45,000
      const convertSetupLines = billableLines(convertPlan, { includeSetup: true });
      const convertSetupTotals = totalize(convertSetupLines);
      expect(convertSetupTotals.subtotal).toBe(4_500_000);
      expect(convertSetupTotals.tax).toBe(0);
      expect(convertSetupTotals.total).toBe(4_500_000);

      // AUTOPILOT with setup: ₹30,000 + ₹60,000 = ₹90,000
      const autoSetupLines = billableLines(autopilotPlan, { includeSetup: true });
      const autoSetupTotals = totalize(autoSetupLines);
      expect(autoSetupTotals.subtotal).toBe(9_000_000);
      expect(autoSetupTotals.tax).toBe(0);
      expect(autoSetupTotals.total).toBe(9_000_000);

      // With add-ons: Lead + 5 seats (+₹600 each = ₹3,000) + Second Brain (+₹2,000)
      const seatRate = addOnAmountForPlan('extra-employee-seats', 'lead')!;
      const brainRate = addOnAmountForPlan('company-second-brain', 'lead')!;
      const addonLines = billableLines(leadPlan, {
        includeSetup: false,
        extraLines: [
          { label: '5 Extra Seats', amount: seatRate * 5 },
          { label: 'Second Brain', amount: brainRate },
        ],
      });
      const addonTotals = totalize(addonLines);
      expect(addonTotals.subtotal).toBe(750_000 + 300_000 + 200_000); // ₹12,500
      expect(addonTotals.tax).toBe(0);
      expect(addonTotals.total).toBe(1_250_000);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * R3. Client Account Deletion & Immediate "Wipe Data" Flow
   * ═══════════════════════════════════════════════════════════════════════ */
  describe('Challenge R3: Account Deletion, 6 Business Days Notice & Wipe RPC', () => {
    it('verifies the 6 business days notice is strictly present in deleteAccount configuration', () => {
      expect(ERASURE_WINDOW).toBe('6 business days');
      expect(STANDARD_DELETION_NOTICE).toBe('Standard account deletion completes in 6 business days.');
      expect(STANDARD_DELETION_NOTICE).toContain('6 business days');
    });

    it('verifies DeleteAccountPanel and Settings UI contain 6 business days and Wipe Data button', () => {
      const panelPath = path.resolve(__dirname, 'components/portal/DeleteAccountPanel.tsx');
      const panelContent = fs.readFileSync(panelPath, 'utf-8');

      expect(panelContent).toContain('ERASURE_WINDOW');
      expect(panelContent).toContain('6 business days');
      expect(panelContent).toContain('Wipe Data');
      expect(panelContent).toContain('data-testid="wipe-data-button"');
      expect(panelContent).toContain('role="dialog"');
      expect(panelContent).toContain('app_delete_own_account');

      const settingsPath = path.resolve(__dirname, 'pages/portal/Settings.tsx');
      const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
      expect(settingsContent).toContain('<DeleteAccountPanel />');
    });

    it('verifies authService.deleteAccount executes the correct RPC "app_delete_own_account"', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({
        error: null,
      });

      const { authService } = await import('@/services/public');
      const result = await authService.deleteAccount();
      expect(result.deleted).toBe(true);
      expect(rpcSpy).toHaveBeenCalledWith('app_delete_own_account');
      expect(signOutSpy).toHaveBeenCalled();

      rpcSpy.mockRestore();
      signOutSpy.mockRestore();
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * R4. Layout Fixes: Mobile Bottom Bar, Bottom Spacing & Services Pages
   * ═══════════════════════════════════════════════════════════════════════ */
  describe('Challenge R4: PortalLayout Responsive CSS Spacing & Services Alignment', () => {
    it('verifies PortalLayout main tag has mobile pb-20 and desktop lg:pb-8', () => {
      const layoutPath = path.resolve(__dirname, 'layouts/PortalLayout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      // Check main element classes
      expect(layoutContent).toContain('pb-20');
      expect(layoutContent).toContain('lg:pb-8');
      expect(layoutContent).toContain('MobileActionBarContainer');
      expect(layoutContent).not.toContain('pb-40');
      expect(layoutContent).not.toContain('pb-32');
    });

    it('verifies MobileActionBar fixed position, z-index and safe-area inset', () => {
      const barPath = path.resolve(__dirname, 'components/portal/MobileActionBar.tsx');
      const barContent = fs.readFileSync(barPath, 'utf-8');

      expect(barContent).toContain('fixed inset-x-0 bottom-0 z-40');
      expect(barContent).toContain('lg:hidden');
      expect(barContent).toContain('safe-area-inset-bottom');
      expect(PRIMARY_ITEMS.length).toBe(4);
      expect(SECONDARY_ITEMS.length).toBeGreaterThan(0);
    });

    it('verifies portal navigation registers /portal/services and services pages exist', () => {
      const allItems = PORTAL_SECTIONS.flatMap((s) => s.items);
      const servicesItem = allItems.find((i) => i.to === '/portal/services');
      expect(servicesItem).toBeDefined();
      expect(servicesItem?.label).toBe('Services');

      const portalServicesPath = path.resolve(__dirname, 'pages/portal/Services.tsx');
      expect(fs.existsSync(portalServicesPath)).toBe(true);

      const adminServicesPath = path.resolve(__dirname, 'pages/admin/Services.tsx');
      expect(fs.existsSync(adminServicesPath)).toBe(true);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * R5. Admin-to-Client Messaging & Client Gmail 2FA
   * ═══════════════════════════════════════════════════════════════════════ */
  describe('Challenge R5: Ticket Messaging Casting Recovery & 2FA Routing', () => {
    it('handles Postgres 22P02 casting error gracefully without crashing', async () => {
      const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: null,
        error: {
          code: '22P02',
          message: 'invalid input syntax for type json: "tc_123"',
        } as any,
      } as any);

      const mockTicket = {
        id: 'tc_123',
        client_id: 'cl_1',
        subject: 'Inquiry',
        status: 'open',
        priority: 'medium',
        category: 'support',
        messages: [{ id: 'm1', body: 'Hello', authorRole: 'client' }],
        created_at: '2026-10-13T00:00:00Z',
        updated_at: '2026-10-13T00:00:00Z',
      };

      const selectSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockTicket, error: null }),
        }),
      });

      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...mockTicket,
                messages: [...mockTicket.messages, { id: 'm2', body: 'Admin reply', authorRole: 'admin' }],
              },
              error: null,
            }),
          }),
        }),
      });

      const fromSpy = vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'tickets') return { select: selectSpy, update: updateSpy } as any;
        return {} as any;
      }) as any);

      const result = await ticketsService.message('tc_123', { body: 'Admin reply' });
      expect(result.ticket.id).toBe('tc_123');
      expect(result.ticket.messages).toHaveLength(2);
      expect(result.ticket.messages[1].body).toBe('Admin reply');

      rpcSpy.mockRestore();
      fromSpy.mockRestore();
    });

    it('verifies 2FA routing: Login handles AUTH_EMAIL_MFA_REQUIRED by navigating to /email-mfa', () => {
      const loginPath = path.resolve(__dirname, 'pages/public/Login.tsx');
      const loginContent = fs.readFileSync(loginPath, 'utf-8');

      expect(loginContent).toContain('AUTH_EMAIL_MFA_REQUIRED');
      expect(loginContent).toContain("navigate('/email-mfa'");

      const emailMfaPath = path.resolve(__dirname, 'pages/public/EmailMfa.tsx');
      const emailMfaContent = fs.readFileSync(emailMfaPath, 'utf-8');

      expect(emailMfaContent).toContain('OtpInput');
      expect(emailMfaContent).toContain('emailMfaService.verifyCode');
      expect(emailMfaContent).toContain('/portal');
      expect(emailMfaContent).toContain('/app');
    });

    it('verifies isEmailMfaEnabled fails open on database error to never lock out users', async () => {
      const fromSpy = vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '42P01', message: 'relation does not exist' },
            }),
          }),
        }),
      } as any);

      const enabled = await isEmailMfaEnabled('any-user-id');
      expect(enabled).toBe(false);
      fromSpy.mockRestore();
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * R6. Ecosystem Presets, Theme Switcher & Psychological Pricing
   * ═══════════════════════════════════════════════════════════════════════ */
  describe('Challenge R6: Complete Presets, Themes & Pricing Architecture', () => {
    it('verifies all 10 presets have complete non-null schemas and required modules', () => {
      const presets = getAllPresets();
      expect(presets).toHaveLength(10);
      expect(FLAGSHIP_PRESET.id).toBe('interior_design');

      const requiredModules = ['clients', 'projects', 'calendar', 'tasks', 'bookings', 'employee_activity'];
      const requiredIntegrations = ['gmail', 'whatsapp', 'calendar', 'slack'];

      for (const preset of presets) {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.tagline).toBeTruthy();
        expect(preset.description).toBeTruthy();

        // Check modules
        for (const mod of requiredModules) {
          expect(preset.tailoredModules).toContain(mod);
        }

        // Check pipeline stages
        expect(preset.pipelineStages.length).toBeGreaterThanOrEqual(4);
        for (const stage of preset.pipelineStages) {
          expect(stage.id).toBeTruthy();
          expect(stage.name).toBeTruthy();
          expect(stage.description).toBeTruthy();
        }

        // Check appointment types
        expect(preset.appointmentTypes.length).toBeGreaterThanOrEqual(2);
        for (const appt of preset.appointmentTypes) {
          expect(appt.name).toBeTruthy();
          expect(appt.durationMins).toBeGreaterThan(0);
        }

        // Check integrations
        const intIds = preset.integrations.map((i) => i.id);
        for (const reqInt of requiredIntegrations) {
          expect(intIds).toContain(reqInt);
        }

        // Check KPIs
        expect(preset.kpis.primary).toBeTruthy();
        expect(preset.kpis.secondary).toBeTruthy();
        expect(preset.kpis.tertiary).toBeTruthy();
      }
    });

    it('verifies theme switcher strictly resolves ONLY plan-allowed themes and blocks cross-tier leaking', () => {
      // LEAD: Basic & Premium only
      const leadThemes = getThemesForPlan('lead');
      expect(leadThemes.map((t) => t.id)).toEqual(['lead-basic', 'lead-premium']);
      expect(isValidThemeForPlan('lead-basic', 'lead')).toBe(true);
      expect(isValidThemeForPlan('lead-premium', 'lead')).toBe(true);
      expect(isValidThemeForPlan('convert-apple', 'lead')).toBe(false);
      expect(isValidThemeForPlan('autopilot-cream-burberry', 'lead')).toBe(false);

      // CONVERT: Apple & Premium only
      const convertThemes = getThemesForPlan('convert');
      expect(convertThemes.map((t) => t.id)).toEqual(['convert-apple', 'convert-premium']);
      expect(isValidThemeForPlan('convert-apple', 'convert')).toBe(true);
      expect(isValidThemeForPlan('convert-premium', 'convert')).toBe(true);
      expect(isValidThemeForPlan('lead-basic', 'convert')).toBe(false);
      expect(isValidThemeForPlan('autopilot-cream-peach', 'convert')).toBe(false);

      // AUTOPILOT: Cream White, Cream Peach & Cream Burberry only
      const autoThemes = getThemesForPlan('autopilot');
      expect(autoThemes.map((t) => t.id)).toEqual([
        'autopilot-cream-white',
        'autopilot-cream-peach',
        'autopilot-cream-burberry',
      ]);
      expect(isValidThemeForPlan('autopilot-cream-white', 'autopilot')).toBe(true);
      expect(isValidThemeForPlan('autopilot-cream-peach', 'autopilot')).toBe(true);
      expect(isValidThemeForPlan('autopilot-cream-burberry', 'autopilot')).toBe(true);
      expect(isValidThemeForPlan('lead-premium', 'autopilot')).toBe(false);
      expect(isValidThemeForPlan('convert-apple', 'autopilot')).toBe(false);
    });

    it('verifies exact plan pricing, setup fees, employee seats, and second brain rules', () => {
      const lead = getPlan('lead')!;
      const convert = getPlan('convert')!;
      const autopilot = getPlan('autopilot')!;

      // Lead: ₹7,500/mo, ₹15,000 setup, 3 users
      expect(lead.amount).toBe(750_000);
      expect(lead.setupAmount).toBe(1_500_000);
      expect(lead.limits.users).toBe(3);

      // Convert: ₹15,000/mo, ₹30,000 setup, 15 users
      expect(convert.amount).toBe(1_500_000);
      expect(convert.setupAmount).toBe(3_000_000);
      expect(convert.limits.users).toBe(15);

      // Autopilot: ₹30,000/mo, ₹60,000 setup, 30 users
      expect(autopilot.amount).toBe(3_000_000);
      expect(autopilot.setupAmount).toBe(6_000_000);
      expect(autopilot.limits.users).toBe(30);

      // Employee seats: ₹600 for Lead, ₹500 for Convert/Autopilot
      expect(EMPLOYEE_SEAT_RATES.lead).toBe(60_000);
      expect(EMPLOYEE_SEAT_RATES.convert).toBe(50_000);
      expect(EMPLOYEE_SEAT_RATES.autopilot).toBe(50_000);

      // Second Brain: ₹2,000 on Lead, included (0) on Convert and Autopilot
      expect(SECOND_BRAIN_RATE).toBe(200_000);
      expect(addOnAmountForPlan('company-second-brain', 'lead')).toBe(200_000);
      expect(addOnAmountForPlan('company-second-brain', 'convert')).toBe(0);
      expect(addOnAmountForPlan('company-second-brain', 'autopilot')).toBe(0);
    });

    it('verifies psychological pricing calculations: FOUNDER5K discount and 15% quarterly savings', () => {
      const lead = getPlan('lead')!;
      const convert = getPlan('convert')!;
      const autopilot = getPlan('autopilot')!;

      // Setup discount of ₹5,000
      expect(getDiscountedSetupAmount(lead, 'FOUNDER5K')).toBe(1_000_000); // 15k -> 10k
      expect(getDiscountedSetupAmount(convert, 'founder5k')).toBe(2_500_000); // 30k -> 25k
      expect(getDiscountedSetupAmount(autopilot, 'FOUNDER5K')).toBe(5_500_000); // 60k -> 55k

      // Invalid promo code preserves standard setup
      expect(getDiscountedSetupAmount(lead, 'INVALID')).toBe(1_500_000);

      // Quarterly savings
      const leadQuarterly = getQuarterlySavings(lead)!;
      expect(leadQuarterly.savings).toBe(337_500); // 15% of 22,500 = ₹3,375
      expect(leadQuarterly.quarterlyTotal).toBe(1_912_500);

      const convertQuarterly = getQuarterlySavings(convert)!;
      expect(convertQuarterly.savings).toBe(675_000); // 15% of 45,000 = ₹6,750
      expect(convertQuarterly.quarterlyTotal).toBe(3_825_000);

      const autoQuarterly = getQuarterlySavings(autopilot)!;
      expect(autoQuarterly.savings).toBe(1_350_000); // 15% of 90,000 = ₹13,500
      expect(autoQuarterly.quarterlyTotal).toBe(7_650_000);
    });
  });
});
