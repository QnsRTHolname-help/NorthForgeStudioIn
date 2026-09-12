import { ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/ui/Card';
import { Reveal } from '@/components/motion';
import { DemoBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface DemoLead {
  id: string;
  business: string;
  source: string;
  status: string;
  score: number;
  date: string;
  nextAction: string;
}

const COLUMNS: { status: string; label: string; leads: DemoLead[] }[] = [
  {
    status: 'new',
    label: 'New',
    leads: [
      { id: 'd1', business: 'Bright Smiles Clinic', source: 'Website form', status: 'new', score: 38, date: 'Today, 09:12', nextAction: 'Reply with availability' },
      { id: 'd2', business: 'Adiga Constructions', source: 'WhatsApp', status: 'new', score: 72, date: 'Today, 08:40', nextAction: 'Call before 11:00' },
    ],
  },
  {
    status: 'qualified',
    label: 'Qualified',
    leads: [
      { id: 'd3', business: 'Pai Clinic', source: 'Referral', status: 'qualified', score: 91, date: 'Yesterday', nextAction: 'Send proposal' },
      { id: 'd4', business: 'Rao Legal', source: 'Phone', status: 'qualified', score: 63, date: 'Yesterday', nextAction: 'Confirm scope' },
    ],
  },
  {
    status: 'contacted',
    label: 'Contacted',
    leads: [{ id: 'd5', business: 'Kamath Caterers', source: 'Website form', status: 'contacted', score: 51, date: '2 days ago', nextAction: 'Follow-up tomorrow' }],
  },
  {
    status: 'proposal',
    label: 'Proposal',
    leads: [{ id: 'd6', business: 'Faiz Traders', source: 'Referral', status: 'proposal', score: 84, date: '3 days ago', nextAction: 'Chase decision' }],
  },
  {
    status: 'won',
    label: 'Won / Lost',
    leads: [
      { id: 'd7', business: 'Dsouza Boutique', source: 'Website form', status: 'won', score: 88, date: 'Last week', nextAction: 'Onboarding kickoff' },
      { id: 'd8', business: 'Bhat Motors', source: 'Outreach', status: 'lost', score: 24, date: 'Last week', nextAction: 'Nurture next quarter' },
    ],
  },
];

const TONES: Record<string, string> = {
  new: 'text-info',
  qualified: 'text-brand',
  contacted: 'text-brand-violet',
  proposal: 'text-warning',
  won: 'text-success',
  lost: 'text-faint',
};

/**
 * CRM / lead showcase (spec §24).
 *
 * Uses the same visual language as the real pipeline in the portal and the
 * admin OS, so what a prospect sees here is what they get after signup.
 * Cards are an illustrative example and are labelled as such.
 */
export function CrmShowcase() {
  return (
    <section className="nf-shell py-20 lg:py-28">
      <SectionHeader
        eyebrow="Lead engine"
        title="Every enquiry, in one pipeline, with a next action."
        description="Nothing sits in an inbox waiting to be noticed. Each lead carries its source, a score, and the single next thing that should happen."
        action={<DemoBadge />}
      />

      <div className="nf-scroll-x mt-12 pb-2">
        <div className="flex min-w-[960px] gap-3">
          {COLUMNS.map((column, index) => (
            <Reveal key={column.status} delay={index * 0.05} className="flex-1">
              <div className="flex h-full flex-col rounded-lg border border-line bg-sunken/30">
                <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                  <span className="text-2xs font-medium uppercase tracking-wider text-muted">{column.label}</span>
                  <span className="nf-num text-2xs text-faint">{column.leads.length}</span>
                </header>
                <ul className="flex-1 space-y-2 p-2.5">
                  {column.leads.map((lead) => (
                    <li key={lead.id} className="group rounded border border-line bg-surface p-3 transition-colors duration-200 hover:border-brand/35">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium leading-snug text-fg">{lead.business}</p>
                        <span className={cn('nf-num shrink-0 text-xs font-semibold', TONES[lead.status])}>{lead.score}</span>
                      </div>
                      <p className="mt-1.5 text-2xs uppercase tracking-wider text-faint">{lead.source}</p>
                      <p className="mt-2.5 flex items-start gap-1.5 border-t border-line pt-2.5 text-xs text-muted">
                        <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-brand" aria-hidden />
                        {lead.nextAction}
                      </p>
                      <p className="mt-1.5 text-2xs text-faint">{lead.date}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-faint">
        Illustrative example of the pipeline layout. Your own enquiries appear here once the system is live.
      </p>
    </section>
  );
}
