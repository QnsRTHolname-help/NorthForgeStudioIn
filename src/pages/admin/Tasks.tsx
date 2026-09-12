import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Form';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { tasksService, projectsService } from '@/services';
import { formatDate, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Task } from '@/types';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/** Tasks (spec §113): the agency's own work queue. */
export default function Tasks() {
  usePageMeta({ title: 'Tasks', noIndex: true });
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const state = useAsync(() => tasksService.list(status || undefined), [status]);
  const projects = useAsync(() => projectsService.list(), []);

  const items = (state.data?.items ?? []).filter((task) =>
    !query ? true : task.title.toLowerCase().includes(query.toLowerCase()),
  );

  const toggleDone = useMutation(
    (task: Task) => tasksService.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    {
      onSuccess: async () => {
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const remove = useMutation((id: string) => tasksService.remove(id), {
    onSuccess: async () => {
      toast.success('Task deleted');
      setDeleting(null);
      await state.refetch().catch(() => undefined);
    },
  });

  return (
    <div>
      <AdminHeader
        title="Tasks"
        description="Internal delivery work — what needs doing, by when, and for which client."
        crumbs={[{ label: 'Tasks' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New task
          </Button>
        }
      />

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search tasks…"
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
          <Panel bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {items.map((task) => (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <Checkbox
                    checked={task.status === 'done'}
                    onChange={() => {
                      void toggleDone.mutate(task).catch(() => undefined);
                    }}
                    label=""
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-[13px]',
                        task.status === 'done' ? 'text-faint line-through' : 'text-fg',
                      )}
                    >
                      {task.title}
                    </p>
                    {task.description ? (
                      <p className="mt-0.5 line-clamp-2 text-2xs text-muted">{task.description}</p>
                    ) : null}
                    <p className="mt-1 text-2xs text-faint">
                      {task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}
                      {task.projectId ? ' · linked to a project' : ''}
                      {task.isDemo ? ' · demo' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'}>
                      {titleCase(task.priority)}
                    </Badge>
                    <Badge tone={task.status === 'done' ? 'success' : 'info'}>{titleCase(task.status)}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete task"
                      onClick={() => setDeleting(task)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No tasks here"
            description={status === 'done' ? 'Nothing completed yet.' : 'The queue is clear. Add a task to track work.'}
            icon={<Check className="h-4 w-4" />}
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                New task
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Modal open={creating} onClose={() => setCreating(false)} title="New task">
        <TaskForm
          projects={(projects.data?.items ?? []).map((project) => ({ id: project.id, name: project.name }))}
          onDone={async () => {
            setCreating(false);
            await state.refetch().catch(() => undefined);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this task?"
        description="The task is removed from the queue. This cannot be undone."
        confirmLabel="Delete task"
        destructive
        pending={remove.pending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void remove.mutate(deleting.id).catch(() => undefined);
        }}
      />
    </div>
  );
}

function TaskForm({ projects, onDone }: { projects: { id: string; name: string }[]; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    projectId: '',
    dueDate: '',
    clientId: '',
  });

  const mutation = useMutation(
    () =>
      tasksService.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: form.status as Task['status'],
        priority: form.priority as Task['priority'],
        projectId: form.projectId || undefined,
        clientId: form.clientId || undefined,
        dueDate: form.dueDate || undefined,
      }),
    {
      onSuccess: () => {
        toast.success('Task created');
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
      <Input label="Title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      <Textarea label="Description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={STATUSES.map((value) => ({ value, label: titleCase(value) }))} />
        <Select label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} options={PRIORITIES.map((value) => ({ value, label: titleCase(value) }))} />
        <Select label="Project" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} options={[{ value: '', label: 'No project' }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
        <Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
      </div>
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.pending} disabled={!form.title.trim()}>
          Create task
        </Button>
      </div>
    </form>
  );
}
