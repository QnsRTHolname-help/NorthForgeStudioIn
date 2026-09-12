import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Workflow as WorkflowIcon } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { automationService } from '@/services';
import { formatDateTime, formatNumber, titleCase } from '@/lib/format';

const TRIGGERS = [
  { value: 'lead.created', label: 'Lead created' },
  { value: 'lead.qualified', label: 'Lead qualified by AI' },
  { value: 'form.submitted', label: 'Form submitted' },
  { value: 'booking.created', label: 'Booking created' },
  { value: 'invoice.paid', label: 'Invoice paid' },
  { value: 'schedule.daily', label: 'Daily schedule' },
];

/** Workflows (spec §113): list, create, pause or resume. */
export default function Workflows() {
  usePageMeta({ title: 'Workflows', noIndex: true });
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const state = useAsync(() => automationService.workflows(), []);
  const items = state.data?.items ?? [];

  const setStatus = useMutation(
    async ({ id, status }: { id: string; status: string }) => automationService.updateWorkflow(id, { status: status as never }),
    {
      onSuccess: async () => {
        toast.success('Workflow updated');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AdminHeader
        title="Workflows"
        description="Automations that run without anyone remembering to run them."
        crumbs={[{ label: 'Automation', to: '/app/workflows' }, { label: 'Workflows' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New workflow
          </Button>
        }
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((workflow) => (
              <div key={workflow.id} className="flex flex-col rounded-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/app/workflows/${workflow.id}`} className="block truncate text-[14px] font-medium text-fg hover:underline">
                      {workflow.name}
                    </Link>
                    <p className="mt-0.5 text-2xs uppercase tracking-wider text-faint">{workflow.trigger}</p>
                  </div>
                  <Badge tone={workflow.status === 'active' ? 'success' : workflow.status === 'error' ? 'danger' : 'neutral'}>
                    {titleCase(workflow.status)}
                  </Badge>
                </div>

                {workflow.description ? (
                  <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted">{workflow.description}</p>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-2xs text-faint">
                    {workflow.nodes.length} steps · {formatNumber(workflow.runs)} runs
                  </span>
                  <div className="flex gap-1.5">
                    {workflow.status === 'active' ? (
                      <Button size="sm" variant="secondary" onClick={() => void setStatus.mutate({ id: workflow.id, status: 'paused' }).catch(() => undefined)}>
                        Pause
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void setStatus.mutate({ id: workflow.id, status: 'active' }).catch(() => undefined)}>
                        Activate
                      </Button>
                    )}
                    <Link
                      to={`/app/workflows/${workflow.id}`}
                      className="nf-focus inline-flex h-8 items-center rounded border border-line px-2.5 text-xs font-medium text-fg transition-colors hover:bg-sunken"
                    >
                      Edit
                    </Link>
                  </div>
                </div>

                <p className="mt-2 text-2xs text-faint">Last run {formatDateTime(workflow.lastRunAt)}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No workflows yet"
            description="Build an automation to respond to enquiries, notify the team or schedule follow-ups."
            icon={<WorkflowIcon className="h-4 w-4" />}
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                New workflow
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Panel className="mt-6" title="Status legend">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatusIndicator status="active" tone="success" />
          <StatusIndicator status="paused" tone="neutral" />
          <StatusIndicator status="error" tone="danger" />
        </div>
      </Panel>

      <Modal open={creating} onClose={() => setCreating(false)} title="New workflow">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await automationService.createWorkflow({
                name: String(data.get('name') ?? ''),
                description: String(data.get('description') ?? ''),
                trigger: String(data.get('trigger') ?? 'lead.created'),
                status: 'draft',
              });
              toast.success('Workflow created', 'Add steps in the builder.');
              setCreating(false);
              await state.refetch().catch(() => undefined);
            } catch {
              /* error surfaced by the toast layer */
            }
          }}
          className="space-y-4"
        >
          <Input label="Name" name="name" required placeholder="Website enquiry → qualify → respond" />
          <Select label="Trigger" name="trigger" defaultValue="lead.created" options={TRIGGERS} />
          <Textarea label="Description" name="description" rows={3} placeholder="What this automation does." />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit">
              Create workflow
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
