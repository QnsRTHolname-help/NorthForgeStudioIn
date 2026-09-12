import type { LeadSource } from '@shared/types';

/**
 * Deterministic lead scoring.
 *
 * A real, explainable heuristic — not a random number dressed up as a
 * prediction. It returns the reason alongside the score so the UI can always
 * explain WHY a lead scored the way it did.
 */

interface QualifyInput {
  message: string;
  source: LeadSource;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface Qualification {
  score: number;
  intent: string;
  summary: string;
  qualification: string;
  signals: string[];
}

const URGENT = /\b(urgent|asap|immediately|today|tomorrow|right away|as soon as)\b/i;
const BUDGET = /\b(budget|quote|price|cost|pricing|how much|package|plan)\b/i;
const TIMELINE = /\b(this week|next week|this month|soon|deadline|launch|start)\b/i;
const AUTHORITY = /\b(i own|i am the owner|founder|director|manager|my business|we are|we're)\b/i;
const WEBSITE_NEED = /\b(website|site|web app|redesign|rebuild|landing page|online)\b/i;
const AUTOMATION_NEED = /\b(automate|automation|follow[- ]?up|workflow|crm|leads?|enquir|whatsapp|booking|appointments?)\b/i;
const AI_NEED = /\b(ai|chatbot|assistant|bot)\b/i;

export function qualifyLead(input: QualifyInput): Qualification {
  const text = `${input.message ?? ''}`.toLowerCase();
  const signals: string[] = [];
  let score = 20;

  if (input.email) {
    score += 10;
    signals.push('Email provided');
  }
  if (input.phone) {
    score += 10;
    signals.push('Phone or WhatsApp provided');
  }
  if (input.businessName) {
    score += 8;
    signals.push('Business named');
  }
  if (BUDGET.test(text)) {
    score += 18;
    signals.push('Asks about pricing or budget');
  }
  if (URGENT.test(text)) {
    score += 15;
    signals.push('Urgent language');
  }
  if (TIMELINE.test(text)) {
    score += 12;
    signals.push('Mentions a timeline');
  }
  if (AUTHORITY.test(text)) {
    score += 10;
    signals.push('Speaks as a decision maker');
  }
  if (WEBSITE_NEED.test(text)) {
    score += 6;
    signals.push('Website requirement');
  }
  if (AUTOMATION_NEED.test(text)) {
    score += 8;
    signals.push('Automation or lead-capture requirement');
  }
  if (AI_NEED.test(text)) {
    score += 5;
    signals.push('AI requirement');
  }
  if (input.source === 'referral') {
    score += 10;
    signals.push('Referred');
  }
  if (input.source === 'whatsapp') {
    score += 4;
    signals.push('Arrived on WhatsApp');
  }

  const messageLength = (input.message ?? '').trim().length;
  if (messageLength > 220) {
    score += 6;
    signals.push('Detailed enquiry');
  } else if (messageLength < 25) {
    score -= 6;
    signals.push('Very short enquiry');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const intent = AI_NEED.test(text)
    ? 'AI assistant enquiry'
    : AUTOMATION_NEED.test(text)
      ? 'Automation enquiry'
      : BUDGET.test(text)
        ? 'Pricing enquiry'
        : WEBSITE_NEED.test(text)
          ? 'Website enquiry'
          : 'General enquiry';

  const band =
    score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';

  const summary = `${input.businessName ? `${input.businessName}: ` : ''}${intent}. ${signals.length ? `Signals: ${signals.slice(0, 3).join(', ')}.` : 'Limited detail provided.'}`;

  const qualification =
    band === 'high'
      ? 'Strong fit. Contains clear intent, contact details and a timeline — prioritise a same-day response.'
      : band === 'medium'
        ? 'Possible fit. Enough signal to follow up within one business day; confirm scope and timeline.'
        : 'Early stage. Low detail so far — nurture with an automated follow-up and re-score after a reply.';

  return { score, intent, summary, qualification, signals };
}
