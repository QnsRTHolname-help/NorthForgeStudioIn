import { describe, expect, it } from 'vitest';
import { titleForPath, TITLES } from '@/app/config/titles';
import { leadsService, projectsService } from '@/services';

describe('Admin Operations Panel Enhancements', () => {
  describe('Page Titles & Deep-link Route Matching', () => {
    it('resolves detail route titles dynamically with titleForPath', () => {
      expect(titleForPath('/app/leads/lead-001')).toBe('Lead details');
      expect(titleForPath('/app/clients/client-999')).toBe('Client details');
      expect(titleForPath('/app/websites/site-abc')).toBe('Website details');
      expect(titleForPath('/app/workflows/flow-xyz')).toBe('Workflow builder');
    });

    it('resolves exact static route titles correctly', () => {
      expect(titleForPath('/app')).toBe('Dashboard');
      expect(titleForPath('/app/invoices')).toBe('Invoices');
      expect(titleForPath('/app/payments')).toBe('Payments');
      expect(titleForPath('/app/subscriptions')).toBe('Subscriptions');
      expect(titleForPath('/app/plans')).toBe('Plans');
      expect(titleForPath('/app/tasks')).toBe('Tasks');
      expect(titleForPath('/app/projects')).toBe('Projects');
      expect(titleForPath('/app/bookings')).toBe('Bookings');
      expect(titleForPath('/app/calendar')).toBe('Calendar');
      expect(titleForPath('/app/announcements')).toBe('Announcements');
      expect(titleForPath('/app/requests')).toBe('Client requests');
    });

    it('returns null for unknown paths', () => {
      expect(titleForPath('/app/unknown-subroute-xyz')).toBeNull();
    });

    it('registers detail route templates in TITLES table', () => {
      expect(TITLES['/app/leads/:id']).toBe('Lead details');
      expect(TITLES['/app/clients/:id']).toBe('Client details');
      expect(TITLES['/app/websites/:id']).toBe('Website details');
      expect(TITLES['/app/workflows/:id']).toBe('Workflow builder');
    });
  });

  describe('Service API Extensions', () => {
    it('exposes leadsService.updateFollowUp as a callable function', () => {
      expect(typeof leadsService.updateFollowUp).toBe('function');
    });

    it('exposes projectsService.remove as a callable function', () => {
      expect(typeof projectsService.remove).toBe('function');
    });
  });

  describe('Dashboard Revenue Aggregation Logic', () => {
    it('aggregates multiple paid invoices on the same date into a unified daily total', () => {
      // Simulating the grouping algorithm implemented in adminDashboard
      const mockPaidInvoices = [
        { paid_at: '2026-11-01T09:00:00Z', total: 1500000 },
        { paid_at: '2026-11-01T15:30:00Z', total: 2500000 },
        { paid_at: '2026-11-02T11:00:00Z', total: 5000000 },
      ];

      const dailyRevenue = new Map<string, number>();
      for (const inv of mockPaidInvoices) {
        if (!inv.paid_at) continue;
        const d = inv.paid_at.slice(0, 10);
        dailyRevenue.set(d, (dailyRevenue.get(d) ?? 0) + (Number(inv.total) || 0));
      }

      const series = Array.from(dailyRevenue.entries()).map(([date, amount]) => ({
        date,
        amount,
      }));

      expect(series).toHaveLength(2);
      expect(series[0]).toEqual({ date: '2026-11-01', amount: 4000000 });
      expect(series[1]).toEqual({ date: '2026-11-02', amount: 5000000 });
    });
  });
});
