import { describe, expect, it } from 'vitest';
import { qualifyLead } from './lead-score';

/**
 * Lead scoring is a deterministic, explainable heuristic — not a model.
 * The score must be reproducible and must always say WHY, because the UI
 * shows that reason to the person deciding whether to trust it.
 */
describe('qualifyLead', () => {
  it('is deterministic — the same input always scores the same', () => {
    const input = {
      message: 'We need a website with online booking, budget around 50k, need it this month.',
      source: 'website' as const,
      businessName: 'Test Clinic',
      email: 'owner@testclinic.in',
      phone: '9000000000',
    };
    const first = qualifyLead(input);
    const second = qualifyLead(input);
    expect(first.score).toBe(second.score);
    expect(first.signals).toEqual(second.signals);
  });

  it('scores an enquiry with budget, urgency and contact details above a thin one', () => {
    const rich = qualifyLead({
      message: 'Interested in automation for my clinic. Budget is 50,000. Need it urgently this month.',
      source: 'whatsapp',
      businessName: 'Test Clinic',
      email: 'owner@testclinic.in',
      phone: '9000000000',
    });
    const thin = qualifyLead({ message: 'hi', source: 'other' });
    expect(rich.score).toBeGreaterThan(thin.score);
  });

  it('always explains itself', () => {
    const result = qualifyLead({ message: 'price please', source: 'referral', email: 'a@b.in' });
    expect(Array.isArray(result.signals)).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('never returns a score outside 0–100', () => {
    const samples = [
      qualifyLead({ message: '', source: 'other' }),
      qualifyLead({
        message: 'urgent budget 1000000 need appointment booking whatsapp automation immediately',
        source: 'whatsapp',
        businessName: 'Big Co',
        email: 'ceo@bigco.in',
        phone: '9000000000',
      }),
    ];
    for (const sample of samples) {
      expect(sample.score).toBeGreaterThanOrEqual(0);
      expect(sample.score).toBeLessThanOrEqual(100);
    }
  });

  it('survives an empty message without throwing', () => {
    expect(() => qualifyLead({ message: '', source: 'website' })).not.toThrow();
  });
});
