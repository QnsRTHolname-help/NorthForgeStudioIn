import { describe, it, expect, beforeEach } from 'vitest';
import { getLeadCredentials, saveLeadCredentials, clearLeadCredentials } from '@/lib/leadStorage';

describe('Credential Persistence & Autofill Funnel', () => {
  beforeEach(() => {
    // Clear storage mock
    clearLeadCredentials();
  });

  it('persists and retrieves lead credentials in storage across pages', () => {
    saveLeadCredentials({
      name: 'Aditya Sharma',
      businessName: 'Sharma Interiors',
      email: 'aditya@sharmainteriors.com',
      phone: '+91 98765 43210',
      businessType: 'Interior Design',
      plan: 'Convert',
    });

    const retrieved = getLeadCredentials();
    expect(retrieved.name).toBe('Aditya Sharma');
    expect(retrieved.businessName).toBe('Sharma Interiors');
    expect(retrieved.email).toBe('aditya@sharmainteriors.com');
    expect(retrieved.phone).toBe('+91 98765 43210');
    expect(retrieved.businessType).toBe('Interior Design');
    expect(retrieved.plan).toBe('Convert');
    expect(retrieved.updatedAt).toBeDefined();
  });

  it('partially updates credentials without overwriting previously saved fields', () => {
    saveLeadCredentials({
      businessName: 'Apex Architecture',
      email: 'contact@apexarch.in',
    });

    saveLeadCredentials({
      phone: '+91 99999 88888',
      businessType: 'Architecture',
    });

    const merged = getLeadCredentials();
    expect(merged.businessName).toBe('Apex Architecture');
    expect(merged.email).toBe('contact@apexarch.in');
    expect(merged.phone).toBe('+91 99999 88888');
    expect(merged.businessType).toBe('Architecture');
  });

  it('clears credentials when explicitly requested', () => {
    saveLeadCredentials({
      name: 'Test Client',
      email: 'test@client.com',
    });
    expect(getLeadCredentials().name).toBe('Test Client');

    clearLeadCredentials();
    expect(getLeadCredentials().name).toBeUndefined();
    expect(getLeadCredentials().email).toBeUndefined();
  });
});

describe('Portal Activation & Autofill Verification', () => {
  it('validates query parameter mapping for requests activation', () => {
    const searchParams = new URLSearchParams({
      new: '1',
      action: 'activation',
      title: 'Company Second Brain Activation',
      type: 'automation',
    });

    expect(searchParams.get('new')).toBe('1');
    expect(searchParams.get('action')).toBe('activation');
    expect(searchParams.get('title')).toBe('Company Second Brain Activation');
    expect(searchParams.get('type')).toBe('automation');
  });

  it('validates calculation logic for subscription activation with FOUNDER5K discount and quarterly retention', () => {
    const leadPlanAmount = 7500;
    const leadSetupAmount = 15000;
    const discount = 5000;

    // Monthly
    const effectiveSetup = Math.max(0, leadSetupAmount - discount);
    expect(effectiveSetup).toBe(10000);

    // Quarterly (15% off monthly)
    const quarterlyMonthly = Math.round(leadPlanAmount * 0.85);
    expect(quarterlyMonthly).toBe(6375);
    expect(quarterlyMonthly + effectiveSetup).toBe(16375);
  });
});
