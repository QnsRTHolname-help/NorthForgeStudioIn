import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState, NotFoundState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { automationService } from '@/services';
import { titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const NODE_TYPES = [
  { value: 'trigger', label: 'Trigger' },
  { value: 'condition', label: 'Condition' },
  { value: 'action', label: 'Action' },
  { value: 'delay', label: 'Delay' },
  { value: 'ai', label: 'AI step' },
  { value: 'message', label: 'Send message' },
];

const NODE_TONES: Record<string, string> = {
  trigger: 'border-l-info',
  condition: 'border-l-warning',
  action: 'border-l-brand',
  delay: 'border-l-faint',
  ai: 'border-l-brand-violet',
  message: 'border-l-success',
};

/**
 * Workflow builder (spec §113).
 *
 * A vertical step list rather than a drag-and-drop canvas: it is keyboard
 * operable, works on a phone, and the order in the list is the order the
 * engine executes.
 */
export default function WorkflowBuilder() {
  const { id = '' } = useParams();
  usePageMeta({ title: 'Workflow builder', noIndex: true });
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const state = useAsync(() => automationService.workflow(id), [id]);
  const workflow = state.data?.workflow ?? null;

  const addNode = useMutation(
    (input: { type: string; label: string }) => automationService.addNode(id, { ...input, config: {} }),
    {
      onSuccess: async () => {
        toast.success('Step added');
        setAdding(false);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const removeNode = useMutation((nodeId: string) => automationService.deleteNode(id, nodeId), {
    onSuccess: async () => {
      toast.success('Step removed');
      await state.refetch().catch(() => undefined);
    },
  });

  const setStatus = useMutation(
    (status: string) => automationService.updateWorkflow(id, { status: status as never }),
    {
      onSuccess: async () => {
        toast.success('Workflow updated');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {workflow ? (
          <>
            <AdminHeader
              title={workflow.name}
              description={workflow.description ?? 'Automation workflow'}
              crumbs={[{ label: 'Workflows', to: '/app/workflows' }, { label: workflow.name }]}
              demo={workflow.isDemo}
              action={
                <>
                  {workflow.status === 'active' ? (
                    <Button variant="secondary" size="md" onClick={() => void setStatus.mutate('paused').catch(() => undefined)}>
                      Pause
                    </Button>
                  ) : (
                    <Button size="md" onClick={() => void setStatus.mutate('active').catch(() => undefined)}>
                      Activate
                    </Button>
                  )}
                  <Button variant="secondary" size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
                    Add step
                  </Button>
                </>
              }
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <Panel title="Steps" description="Executed top to bottom.">
                {workflow.nodes.length ? (
                  <ol className="space-y-2">
                    {workflow.nodes.map((node, index) => (
                      <li
                        key={node.id}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border border-line border-l-2 bg-sunken/30 p-3',
                          NODE_TONES[node.type] ?? 'border-l-line',
                        )}
                      >
                        <span className="nf-num w-6 shrink-0 text-2xs text-faint">{String(index + 1).padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-fg">{node.label}</p>
                          <p className="text-2xs uppercase tracking-wider text-faint">{titleCase(node.type)}</p>
                        </div>
                        {Object.keys(node.config ?? {}).length ? (
                          <Badge tone="neutral">{Object.keys(node.config).length} config</Badge>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${node.label}`}
                          onClick={() => void removeNode.mutate(node.id).catch(() => undefined)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyState
                    compact
                    title="No steps yet"
                    description="Add a trigger, then the actions that follow it."
                    action={
                      <Button size="sm" onClick={() => setAdding(true)}>
                        Add first step
                      </Button>
                    }
                  />
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Configuration">
                  <Row label="Trigger" value={workflow.trigger} />
                  <Row label="Status" value={<Badge tone={workflow.status === 'active' ? 'success' : 'neutral'}>{titleCase(workflow.status)}</Badge>} />
                  <Row label="Runs" value={String(workflow.runs)} />
                  <Row label="Steps" value={String(workflow.nodes.length)} />
                </Panel>

                <Panel title="How runs behave">
                  <p className="text-[13px] leading-relaxed text-muted">
                    Each run is recorded. A step that fails stops the run and marks the workflow as errored rather than
                    silently skipping — you will always know when an automation did not complete.
                  </p>
                </Panel>

                <Link to="/app/workflows" className="inline-flex items-center gap-1.5 text-[13px] text-brand hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All workflows
                </Link>
              </div>
            </div>
          </>
        ) : (
          <NotFoundState
            title="Workflow not found"
            description="It may have been deleted."
            action={
              <Link to="/app/workflows" className="nf-focus inline-flex h-9 items-center rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-elevated">
                Back to workflows
              </Link>
            }
          />
        )}
      </AsyncBoundary>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a step">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            await addNode
              .mutate({ type: String(data.get('type') ?? 'action'), label: String(data.get('label') ?? '') })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Select label="Step type" name="type" defaultValue="action" options={NODE_TYPES} />
          <Input label="Label" name="label" required placeholder="e.g. Send WhatsApp acknowledgement" />
          {addNode.error ? <p className="text-xs text-danger">{addNode.error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={addNode.pending}>
              Add step
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
