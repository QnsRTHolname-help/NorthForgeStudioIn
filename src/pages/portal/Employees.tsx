import { Link } from 'react-router-dom';
import { Activity, LockKeyhole, Plus, UserRoundCheck, UsersRound } from 'lucide-react';
import { ADD_ONS, addOnAmountLabel, addOnsForPlan, getPlanById, planSeatLabel } from '@shared/catalog';
import { KpiCard, Panel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';

export default function Employees() {
  usePageMeta({ title: 'Employees', noIndex: true });
  const { client } = useAuth();

  /*
   * Seats are a commercial fact, so they are read from the catalog rather than
   * typed into this screen: the plan assigns the allowance, the add-ons raise
   * it. Nothing here can drift from what the client was sold.
   */
  const plan = getPlanById(client?.planId ?? null);
  const addOns = plan ? addOnsForPlan(plan.slug) : ADD_ONS;

  return (
    <div className="space-y-5">
      <PortalHeader
        title="Employees"
        description="Give team members focused access without cluttering the owner dashboard."
        action={
          <Button size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} disabled>
            Invite employee
          </Button>
        }
      />

      <section className="nf-os-hero p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="nf-eyebrow text-brand">Team operating layer</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Owner clarity without hiding employee work.</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              The portal design keeps employees focused on assigned work while the owner sees progress, contribution and blockers.
            </p>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[560px]">
            <KpiCard
              label="Included seats"
              value={plan ? planSeatLabel(plan) : 'Not set'}
              hint={client?.planId ? undefined : 'Your plan is assigned during onboarding'}
              icon={<UsersRound className="h-4 w-4" />}
            />
            <KpiCard label="Access model" value="Invite links" hint="Individual accounts, not shared passwords" icon={<LockKeyhole className="h-4 w-4" />} />
            <KpiCard label="Activity trail" value="Planned" hint="Updates, files and task changes" icon={<Activity className="h-4 w-4" />} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Panel title="Employee portal design" description="What this will unlock for clients.">
          <ul className="space-y-3 text-[13px] leading-relaxed text-muted">
            {[
              'Employees see only assigned projects, tasks and client work.',
              'Employees can upload notes, photos, files and status updates.',
              'Owners see contribution and progress without mixing employee clutter into the main dashboard.',
              'NorthForge keeps an activity trail so work does not disappear into WhatsApp chats.',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="nf-os-icon h-7 w-7 shrink-0">
                  <UserRoundCheck className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Build order" description="The employee system should be safe before it is powerful.">
          <ol className="space-y-3">
            {[
              ['1', 'Owner invites employee', 'A unique invite link creates an individual account.'],
              ['2', 'Assign project or task', 'The employee sees only what belongs to them.'],
              ['3', 'Employee updates work', 'Notes, photos, files and task movement flow back to the owner.'],
              ['4', 'Owner reviews activity', 'The main dashboard stays clean but shows who changed what.'],
            ].map(([step, title, detail]) => (
              <li key={step} className="nf-os-tile flex gap-3 p-3">
                <span className="nf-num text-sm font-semibold text-brand">{step}</span>
                <span>
                  <span className="block text-[13px] font-medium text-fg">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel
        title={plan ? `Add-ons for the ${plan.name} plan` : 'Add-ons'}
        description="Seats and capabilities that sit on top of your plan. Request one and we confirm the price before anything is charged."
        bodyClassName="space-y-3"
      >
        {addOns.map((addOn) => (
          <div key={addOn.id} className="nf-os-tile flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-fg">{addOn.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{addOn.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
              <Badge tone={addOn.amount === null ? 'neutral' : 'success'}>{addOnAmountLabel(addOn)}</Badge>
              <LinkButton
                to={`/portal/requests?new=1&action=activation&type=automation&title=${encodeURIComponent('Activation: ' + addOn.name)}&description=${encodeURIComponent('Requesting activation for add-on: ' + addOn.name + ' (' + addOnAmountLabel(addOn) + '). ' + addOn.description)}`}
                variant="secondary"
                size="sm"
              >
                Request activation
              </LinkButton>
            </div>
          </div>
        ))}
        {!plan ? (
          <p className="text-xs leading-relaxed text-faint">
            Once your plan is assigned, this list shows only what applies to you.
          </p>
        ) : null}
      </Panel>

      <Panel title="Current workaround">
        <p className="text-[13px] leading-relaxed text-muted">
          Until employee accounts are implemented, use project notes, files and tasks to keep team work visible.
          Priority automation requests can be raised from{' '}
          <Link to="/portal/requests" className="text-brand hover:underline">
            Requests
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="warning">Implementation pending</Badge>
          <LinkButton to="/portal/tasks" variant="secondary" size="sm">
            Open tasks
          </LinkButton>
        </div>
      </Panel>
    </div>
  );
}
