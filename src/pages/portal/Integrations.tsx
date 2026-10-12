import { CalendarDays, CheckCircle2, FileSpreadsheet, Mail, MessageCircle, Plug, Slack } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { usePageMeta } from '@/hooks/usePageMeta';

const INTEGRATIONS = [
  {
    name: 'WhatsApp',
    description: 'Customer messages, enquiry acknowledgements, reminders and follow-ups.',
    status: 'Core',
    icon: MessageCircle,
  },
  {
    name: 'Gmail / Email',
    description: 'Bring important customer email summaries into the owner dashboard.',
    status: 'Planned',
    icon: Mail,
  },
  {
    name: 'Google Calendar',
    description: 'Sync appointments, site visits, client meetings and reminder workflows.',
    status: 'Planned',
    icon: CalendarDays,
  },
  {
    name: 'Google Sheets',
    description: 'Connect legacy lead sheets or export structured records when needed.',
    status: 'Available by setup',
    icon: FileSpreadsheet,
  },
  {
    name: 'Slack',
    description: 'Route internal alerts for startup or overseas teams that already work in Slack.',
    status: 'Optional',
    icon: Slack,
  },
];

export default function Integrations() {
  usePageMeta({ title: 'Integrations', noIndex: true });

  return (
    <div className="space-y-5">
      <PortalHeader
        title="Integrations"
        description="Connect the tools your business already uses so NorthForge becomes the control center."
      />

      <section className="nf-os-hero p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="nf-os-icon h-11 w-11 shrink-0">
            <Plug className="h-5 w-5" aria-hidden />
          </span>
          <div className="max-w-3xl">
            <span className="nf-eyebrow text-brand">Ecosystem layer</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Pull the important signals into NorthForge.</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              WhatsApp stays central, then email, calendar, sheets and team tools connect around the owner's daily workflow.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((integration) => (
          <Panel key={integration.name} className="nf-os-tile" title={integration.name} bodyClassName="space-y-4">
            <div className="flex items-start gap-3">
              <span className="nf-os-icon h-10 w-10 shrink-0">
                <integration.icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <Badge tone={integration.status === 'Core' ? 'success' : 'neutral'}>{integration.status}</Badge>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{integration.description}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Managed by NorthForge
            </Button>
          </Panel>
        ))}
      </div>

      <Panel title="Integration principle">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-[13px] leading-relaxed text-muted">
            The first goal is not to replace every app. It is to pull the important signals into one dashboard and make
            the next action obvious: reply, assign, book, follow up, request payment, or ask NorthForge to automate it.
          </p>
        </div>
      </Panel>
    </div>
  );
}
