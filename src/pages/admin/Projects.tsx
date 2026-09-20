import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Loader';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { ClientSelect } from '@/components/admin/ClientSelect';
import { projectsService, clientsService, milestonesService } from '@/services';
import { formatDate, titleCase } from '@/lib/format';
import type { Project } from '@/types';

const STAGES = ['discovery', 'design', 'development', 'review', 'launch', 'optimization'];
const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

/** Projects (spec §113): delivery board with stage and progress. */
export default function Projects() {
  usePageMeta({ title: 'Projects', noIndex: true });
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const state = useAsync(() => projectsService.list(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 1000 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? '—';

  const items = (state.data?.items ?? []).filter((project) => {
    const matchesQuery = !query || project.name.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = !status || project.status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <div>
      <AdminHeader
        title="Projects"
        description="Every build in flight, with stage, progress and due date."
        crumbs={[{ label: 'Projects' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New project
          </Button>
        }
      />

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search projects…"
        filters={[
          {
            label: 'Status',
            value: status,
            onChange: setStatus,
            options: [{ value: '', label: 'All statuses' }, ...STATUSES.map((value) => ({ value, label: titleCase(value) }))],
          },
        ]}
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((project) => (
              <div key={project.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-fg">{project.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{clientName(project.clientId)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone={project.status === 'completed' ? 'success' : project.status === 'on_hold' ? 'danger' : 'info'}>
                      {titleCase(project.status)}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-2xs uppercase tracking-wider text-faint">{titleCase(project.stage)}</span>
                    <span className="nf-num text-[13px] font-semibold text-fg">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} tone={project.status === 'completed' ? 'success' : 'brand'} />
                </div>

                <p className="mt-3 text-2xs text-faint">
                  {formatDate(project.startDate)} → {formatDate(project.dueDate)}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {STAGES.filter((stage) => stage !== project.stage).slice(0, 3).map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={async () => {
                        try {
                          await projectsService.update(project.id, { stage: stage as Project['stage'] });
                          toast.success(`Moved to ${stage}`);
                          await state.refetch().catch(() => undefined);
                        } catch {
                          /* handled by toast in mutation layer */
                        }
                      }}
                      className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted transition-colors hover:border-brand/40 hover:text-fg"
                    >
                      → {titleCase(stage)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditing(project)}
                    className="ml-auto text-2xs text-brand hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create a project to track delivery stage, progress and due dates."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                New project
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Modal open={creating} onClose={() => setCreating(false)} title="New project">
        <ProjectForm
          onDone={async () => {
            setCreating(false);
            await state.refetch().catch(() => undefined);
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit project">
        {editing ? (
          <div className="space-y-5">
            <ProjectForm
              project={editing}
              onDone={async () => {
                setEditing(null);
                await state.refetch().catch(() => undefined);
              }}
            />
            <MilestoneEditor project={editing} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function ProjectForm({
  project,
  onDone,
}: {
  project?: Project;
  onDone: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: project?.name ?? '',
    clientId: project?.clientId ?? '',
    stage: project?.stage ?? 'discovery',
    status: project?.status ?? 'planning',
    progress: String(project?.progress ?? 0),
    startDate: project?.startDate?.slice(0, 10) ?? '',
    dueDate: project?.dueDate?.slice(0, 10) ?? '',
    notes: project?.notes ?? '',
  });

  const mutation = useMutation(
    async () => {
      const payload = {
        name: form.name.trim(),
        clientId: form.clientId || undefined,
        stage: form.stage as Project['stage'],
        status: form.status as Project['status'],
        progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        notes: form.notes.trim() || null,
      };
      return project ? projectsService.update(project.id, payload) : projectsService.create(payload);
    },
    {
      onSuccess: () => {
        toast.success(project ? 'Project updated' : 'Project created');
        onDone();
      },
    },
  );

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await mutation.mutate().catch(() => undefined);
      }}
      className="space-y-4"
    >
      <Input label="Project name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <ClientSelect
        label="Client"
        value={form.clientId}
        onChange={(clientId) => setForm({ ...form, clientId })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Stage" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as Project['stage'] })} options={STAGES.map((value) => ({ value, label: titleCase(value) }))} />
        <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Project['status'] })} options={STATUSES.map((value) => ({ value, label: titleCase(value) }))} />
        <Input label="Progress (%)" type="number" min={0} max={100} value={form.progress} onChange={(event) => setForm({ ...form, progress: event.target.value })} />
        <Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
        <Input label="Start date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
      </div>
      <Textarea label="Notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.pending}>
          {project ? 'Save changes' : 'Create project'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Milestones editor (spec §25). Lives inside the edit-project modal.
 * Clients see the same milestones read-only on /portal/project; completion
 * is stamped server-side and recorded in the activity trail by triggers.
 */
export function MilestoneEditor({ project }: { project: Project }) {
  const toast = useToast();
  const state = useAsync(() => milestonesService.listByProject(project.id), [project.id]);
  const items = state.data?.items ?? [];

  const create = useMutation(
    (input: { title: string; dueDate: string | null }) =>
      milestonesService.create({
        projectId: project.id,
        clientId: project.clientId,
        title: input.title,
        dueDate: input.dueDate,
        sortOrder: items.length,
      }),
    {
      onSuccess: async () => {
        toast.success('Milestone added');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const update = useMutation(
    (input: { id: string; status?: string }) => milestonesService.update(input.id, { status: input.status }),
    {
      onSuccess: async () => {
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const remove = useMutation((id: string) => milestonesService.remove(id), {
    onSuccess: async () => {
      toast.success('Milestone removed');
      await state.refetch().catch(() => undefined);
    },
  });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    event.currentTarget.reset();
    await create
      .mutate({
        title: String(form.get('title') ?? ''),
        dueDate: String(form.get('dueDate') ?? '') || null,
      })
      .catch(() => undefined);
  };

  return (
    <div className="border-t border-line pt-4">
      <p className="text-[13px] font-semibold text-fg">Milestones</p>
      <p className="mt-0.5 text-xs text-muted">Visible to the client in their portal project page.</p>

      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((milestone) => (
            <li key={milestone.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-line px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] text-fg">{milestone.title}</p>
                <p className="text-2xs text-faint">
                  {milestone.completedAt
                    ? `Completed ${formatDate(milestone.completedAt)}`
                    : milestone.dueDate
                      ? `Due ${formatDate(milestone.dueDate)}`
                      : 'No due date'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={milestone.status}
                  aria-label={`Status for ${milestone.title}`}
                  onChange={(event) => {
                    void update.mutate({ id: milestone.id, status: event.target.value }).catch(() => undefined);
                  }}
                  className="rounded border border-line bg-surface px-1.5 py-1 text-2xs text-fg"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={remove.pending}
                  onClick={() => {
                    void remove.mutate(milestone.id).catch(() => undefined);
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-faint">No milestones yet — add the delivery phases below.</p>
      )}

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Input label="New milestone" name="title" required placeholder="e.g. Design sign-off" />
        </div>
        <div className="w-40">
          <Input label="Due (optional)" name="dueDate" type="date" />
        </div>
        <Button size="sm" type="submit" loading={create.pending} iconLeft={<Plus className="h-3.5 w-3.5" />}>
          Add
        </Button>
      </form>
      {create.error ? <p className="mt-1 text-xs text-danger">{create.error}</p> : null}
    </div>
  );
}
