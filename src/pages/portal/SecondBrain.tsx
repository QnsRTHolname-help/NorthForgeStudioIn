import { useState } from 'react';
import { BrainCircuit, FileText, MessageSquareText, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { PLANS } from '@shared/catalog';
import { Panel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { useToast } from '@/app/providers/ToastProvider';
import { requestsService } from '@/services';

const KNOWLEDGE_AREAS = [
  { label: 'Customers', detail: 'Preferences, conversations, requirements and decision history.', icon: MessageSquareText },
  { label: 'Projects', detail: 'Scope, approvals, files, milestones, site notes and handover context.', icon: FileText },
  { label: 'Sales', detail: 'Lead quality, objections, proposal notes and follow-up patterns.', icon: Sparkles },
  { label: 'Search', detail: 'Ask for the detail instead of digging across old files and chats.', icon: Search },
];

/** How the plan matrix's wording is presented. Anything unrecognised stays neutral. */
const AVAILABILITY_TONE: Record<string, 'success' | 'brand' | 'neutral'> = {
  Included: 'success',
  Custom: 'brand',
};

export default function SecondBrain() {
  usePageMeta({ title: 'Second Brain', noIndex: true });
  const toast = useToast();
  const [requestedLocally, setRequestedLocally] = useState(false);

  const requests = useAsync(() => requestsService.list(), []);
  const existingActivation = requests.data?.items?.find((r) =>
    r.title.toLowerCase().includes('second brain') || r.description.toLowerCase().includes('second brain'),
  );
  const isRequested = Boolean(existingActivation || requestedLocally);

  const activateMutation = useMutation(
    async () => {
      const res = await requestsService.create({
        title: 'Company Second Brain Activation',
        description: 'Requesting activation and setup of the Company Second Brain knowledge layer for customer, project, and operating intelligence.',
        type: 'automation',
        priority: 'high',
      });
      setRequestedLocally(true);
      return res;
    },
    {
      onSuccess: () => {
        toast.success('Activation request submitted!', 'Our team has received your request and will begin setting up your Second Brain.');
        void requests.refetch().catch(() => undefined);
      },
      onError: (err) => {
        toast.error('Could not submit request', (err as Error).message || 'Please try again.');
      },
    },
  );

  return (
    <div className="space-y-5">
      <PortalHeader
        title="Company Second Brain"
        description="A growing business memory for customer, project, sales and operating knowledge."
        action={
          isRequested ? (
            <Badge tone="info" className="py-1.5 px-3 text-xs font-medium">
              Activation in progress ✓
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                loading={activateMutation.pending}
                onClick={() => activateMutation.mutate().catch(() => undefined)}
                arrow
              >
                Request activation
              </Button>
              <LinkButton
                to="/portal/requests?new=1&action=activation&title=Company+Second+Brain+Activation&type=automation"
                variant="secondary"
                size="sm"
              >
                Customise request
              </LinkButton>
            </div>
          )
        }
      />

      <section className="nf-os-hero p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="nf-os-icon h-11 w-11 shrink-0">
            <BrainCircuit className="h-5 w-5" aria-hidden />
          </span>
          <div className="max-w-3xl">
            <span className="nf-eyebrow text-brand">Business memory</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">The context layer that makes the assistant useful over time.</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Customer details, project decisions, sales notes and operating knowledge become easier to find and reuse.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel title="Status" description="Availability is read from your plan — this page never invents an entitlement.">
          <div className="flex items-start gap-3">
            <span className="nf-os-icon h-11 w-11 shrink-0">
              <BrainCircuit className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <Badge tone={isRequested ? 'info' : 'neutral'}>
                {isRequested ? 'Activation requested · In progress' : 'Setup required'}
              </Badge>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                {isRequested
                  ? 'Your activation request has been logged. Our engineering team is scoping your business knowledge sources.'
                  : 'The Second Brain is configured with you before it answers anything: the memory is built from the records your business approves, and it says what it is missing rather than guessing.'}
              </p>
              {!isRequested ? (
                <div className="mt-4">
                  <Button
                    size="sm"
                    loading={activateMutation.pending}
                    onClick={() => activateMutation.mutate().catch(() => undefined)}
                  >
                    Confirm & Send Activation Request
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {PLANS.filter((plan) => plan.amount !== null).map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between gap-3 rounded border border-line px-3 py-2"
              >
                <span className="text-[13px] font-medium text-fg">{plan.name}</span>
                <Badge tone={AVAILABILITY_TONE[plan.scope['Second Brain']] ?? 'neutral'}>
                  {plan.scope['Second Brain']}
                </Badge>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="What it remembers" bodyClassName="grid gap-3 sm:grid-cols-2">
          {KNOWLEDGE_AREAS.map((area) => (
            <div key={area.label} className="nf-os-tile p-3">
              <span className="nf-os-icon">
                <area.icon className="h-4 w-4" aria-hidden />
              </span>
              <p className="mt-2 text-[13px] font-medium text-fg">{area.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{area.detail}</p>
            </div>
          ))}
        </Panel>
      </div>

      <Panel title="Trust rules">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-[13px] leading-relaxed text-muted">
            The Second Brain should answer from approved business records only. It should not invent client details,
            pricing, project status, employee activity or promises. If something is missing, it should say what it needs.
          </p>
        </div>
      </Panel>
    </div>
  );
}
