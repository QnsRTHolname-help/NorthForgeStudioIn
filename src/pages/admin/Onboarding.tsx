import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Drawer } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Loader';
import { Timeline } from '@/components/ui/Data';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { clientsService } from '@/services';
import { formatRelative, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Client } from '@/types';

const STEPS = [
  { key: 'discovery', label: 'Discovery', hint: 'Business, customers, goals and current tools.' },
  { key: 'design', label: 'Design', hint: 'Visual direction and page structure approved.' },
  { key: 'build', label: 'Build', hint: 'Website, hosting, SSL and domain connected.' },
  { key: 'connect', label: 'Connect', hint: 'AI, WhatsApp, automation and analytics wired up.' },
  { key: 'launch', label: 'Launch', hint: 'Deployed, verified and handed over.' },
];

/**
 * Onboarding board (spec §113).
 *
 * Drafts are per-client and stored server-side, so progress survives a
 * refresh and is visible to everyone on the team.
 */
export default function Onboarding() {
  usePageMeta({ title: 'Onboarding', noIndex: true });
  const toast = useToast();
  const [selected, setSelected] = useState<Client | null>(null);
  const state = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const items = state.data?.items ?? [];

  const inProgress = items.filter((client) => !client.onboardingCompleted);
  const completed = items.filter((client) => client.onboardingCompleted);

  return (
    <div>
      <AdminHeader
        title="Onboarding"
        description="Where each new client is in the five-step journey, and what is blocking them."
        crumbs={[{ label: 'Onboarding' }]}
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg">
                In progress <span className="ml-1 text-faint">({inProgress.length})</span>
              </h2>
              {inProgress.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {inProgress.map((client) => (
                    <OnboardingCard key={client.id} client={client} onOpen={() => setSelected(client)} />
                  ))}
                </div>
              ) : (
                <EmptyState compact title="Nothing in progress" description="Every client has completed onboarding." icon={<Check className="h-4 w-4" />} />
              )}
            </section>

            {completed.length ? (
              <section>
                <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-fg">
                  Completed <span className="ml-1 text-faint">({completed.length})</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {completed.map((client) => (
                    <OnboardingCard key={client.id} client={client} onOpen={() => setSelected(client)} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState title="No clients yet" description="Onboarding starts when a client is added." />
        )}
      </AsyncBoundary>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Onboarding" width="md">
        {selected ? (
          <OnboardingPanel
            client={selected}
            onSaved={async () => {
              toast.success('Onboarding updated');
              await state.refetch().catch(() => undefined);
            }}
          />
        ) : null}
      </Drawer>

      <Panel className="mt-6" title="What each step means">
        <Timeline
          items={STEPS.map((step) => ({
            id: step.key,
            label: step.label,
            detail: step.hint,
            state: 'done' as const,
          }))}
        />
      </Panel>
    </div>
  );
}

function OnboardingCard({ client, onOpen }: { client: Client; onOpen: () => void }) {
  const percent = client.onboardingCompleted ? 100 : client.onboardingStep * 20;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-fg">{client.businessName}</p>
          <p className="truncate text-xs text-muted">{client.contactName}</p>
        </div>
        <Badge tone={client.onboardingCompleted ? 'success' : 'warning'}>
          {client.onboardingCompleted ? 'Live' : titleCase(client.status)}
        </Badge>
      </div>

      <div className="mt-4">
        <Progress value={percent} tone={client.onboardingCompleted ? 'success' : 'brand'} />
      </div>
      <p className="mt-2 text-2xs uppercase tracking-wider text-faint">
        {client.onboardingCompleted ? 'Onboarding complete' : `Step ${client.onboardingStep} of 5`}
      </p>
      <p className="mt-1 text-2xs text-faint">Updated {formatRelative(client.updatedAt)}</p>
    </button>
  );
}

function OnboardingPanel({ client, onSaved }: { client: Client; onSaved: () => void }) {
  const draft = useAsync(() => clientsService.onboarding(client.id), [client.id]);
  const [step, setStep] = useState(client.onboardingStep);

  const save = useMutation(
    () => clientsService.saveOnboarding(client.id, { currentStep: step, completed: step >= 5, data: draft.data?.draft?.data ?? {} }),
    { onSuccess: onSaved },
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[15px] font-semibold text-fg">{client.businessName}</p>
        <p className="text-[13px] text-muted">{client.email}</p>
      </div>

      <ol className="space-y-2">
        {STEPS.map((stepItem, index) => {
          const state = index + 1 < step ? 'done' : index + 1 === step ? 'current' : 'upcoming';
          return (
            <li key={stepItem.key}>
              <button
                type="button"
                onClick={() => setStep(index + 1)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  state === 'current'
                    ? 'border-brand bg-brand/[0.05]'
                    : state === 'done'
                      ? 'border-success/30 bg-success/[0.04]'
                      : 'border-line hover:border-line-strong',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-2xs',
                    state === 'done'
                      ? 'border-success bg-success text-white'
                      : state === 'current'
                        ? 'border-brand text-brand'
                        : 'border-line text-faint',
                  )}
                  aria-hidden
                >
                  {state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-fg">{stepItem.label}</span>
                  <span className="block text-xs text-muted">{stepItem.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <Link to={`/app/clients/${client.id}`} className="text-[13px] text-brand hover:underline">
          Open client record →
        </Link>
        <Button size="sm" loading={save.pending} onClick={() => void save.mutate().catch(() => undefined)}>
          Save progress
        </Button>
      </div>
    </div>
  );
}
