import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, ListTodo, Plus, Sparkles, TimerReset, Trophy } from 'lucide-react';
import { KpiCard, Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { Drawer } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Tabs';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { tasksService } from '@/services';
import { cn } from '@/lib/cn';
import { formatDate, titleCase } from '@/lib/format';
import type { Task } from '@/types';

const STATUSES: Task['status'][] = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];

export default function Tasks() {
  usePageMeta({ title: 'Tasks', noIndex: true });
  const toast = useToast();
  const { session } = useAuth();
  const [status, setStatus] = useState<'open' | Task['status']>('open');
  const [creating, setCreating] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const state = useAsync(() => tasksService.list(), []);
  const allTasks = state.data?.items ?? [];
  const completedTasks = allTasks.filter((task) => task.status === 'done');
  const totalTasks = allTasks.length;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  const items = useMemo(() => {
    return status === 'open' ? allTasks.filter((task) => task.status !== 'done') : allTasks.filter((task) => task.status === status);
  }, [allTasks, status]);

  const toggle = useMutation(
    (task: Task) => tasksService.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' }),
    {
      onSuccess: async () => {
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const handleToggleTask = async (task: Task) => {
    const willComplete = task.status !== 'done';
    setAnimatingId(task.id);
    setTimeout(() => setAnimatingId(null), 600);
    if (willComplete) {
      toast.success('Task completed! Great momentum.');
    }
    await toggle.mutate(task).catch(() => undefined);
  };

  const openTasks = allTasks.filter((task) => task.status !== 'done');
  const dueSoon = openTasks.filter((task) => task.dueDate && new Date(task.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  return (
    <div className="space-y-5">
      <PortalHeader
        title="Tasks"
        description="Your daily todo list across owner work, project work, follow-ups and team handoffs."
        action={
          <Button size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New task
          </Button>
        }
      />

      <section className="nf-os-hero p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="nf-eyebrow text-brand">Daily command queue</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Start the day with the work that actually needs attention.</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Keep owner tasks, project todos and internal handoffs in one quiet list instead of scattered chats.
            </p>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[480px]">
            <KpiCard label="Open tasks" value={openTasks.length} hint="Everything not marked done" icon={<ListTodo className="h-4 w-4" />} />
            <KpiCard label="Due soon" value={dueSoon.length} hint="Due in the next 7 days" icon={<TimerReset className="h-4 w-4" />} />
            <KpiCard label="Completed" value={completedTasks.length} icon={<CheckCircle2 className="h-4 w-4" />} />
          </div>
        </div>

        {/* Dopamine progress celebration bar */}
        {totalTasks > 0 ? (
          <div className="mt-5 border-t border-line/60 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {completionPercent === 100 ? (
                  <Trophy className="h-4 w-4 text-warning animate-bounce" />
                ) : (
                  <Sparkles className="h-4 w-4 text-brand" />
                )}
                <span className="text-[13px] font-semibold text-fg">
                  Daily Momentum: {completionPercent}% completed ({completedTasks.length}/{totalTasks})
                </span>
              </div>
              <span className="text-xs text-muted">
                {completionPercent === 100
                  ? 'All tasks completed! Day is won.'
                  : completionPercent >= 50
                    ? 'Over halfway through! Exceptional execution today.'
                    : 'Start and end your day with clean, focused progress.'}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sunken/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-success transition-all duration-500 ease-out"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          options={[
            { value: 'open', label: 'Open' },
            ...STATUSES.map((value) => ({ value, label: titleCase(value) })),
          ]}
          size="sm"
          ariaLabel="Task status"
        />
        <span className="text-[13px] text-muted">{items.length} shown</span>
      </div>

      <AsyncBoundary loading={state.loading} error={state.error} data={state.data} onRetry={() => state.refetch().catch(() => undefined)}>
        {items.length ? (
          <Panel bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {items.map((task) => (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken/40">
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleTask(task);
                    }}
                    className={cn(
                      'nf-os-icon relative mt-0.5 h-8 w-8 shrink-0 text-faint transition-all duration-300 hover:text-brand active:scale-95',
                      animatingId === task.id && 'text-success',
                    )}
                    aria-label={task.status === 'done' ? 'Mark task open' : 'Mark task done'}
                  >
                    {/* Ripple pulse on click */}
                    {animatingId === task.id ? (
                      <span className="absolute inset-0 rounded-full bg-success/25 animate-ping pointer-events-none" />
                    ) : null}
                    <span
                      className={cn(
                        'inline-flex items-center justify-center transition-transform duration-300 ease-out',
                        animatingId === task.id ? 'scale-125' : 'hover:scale-110',
                      )}
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 text-success transition-colors" />
                      ) : (
                        <Circle className="h-4 w-4 transition-colors" />
                      )}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[13px] font-medium transition-all duration-200', task.status === 'done' ? 'text-faint line-through' : 'text-fg')}>
                      {task.title}
                    </p>
                    {task.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{task.description}</p> : null}
                    <p className="mt-1 text-2xs text-faint">{task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <Badge tone={task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'}>{titleCase(task.priority)}</Badge>
                    <Badge tone={task.status === 'done' ? 'success' : 'info'}>{titleCase(task.status)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No tasks here"
            description="Add owner tasks, project todos, follow-up reminders or internal handoffs so the day starts in one place."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Add task
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Drawer open={creating} onClose={() => setCreating(false)} title="New task" width="md">
        <TaskForm
          clientId={session?.client?.id ?? null}
          onDone={async () => {
            toast.success('Task created');
            setCreating(false);
            await state.refetch().catch(() => undefined);
          }}
        />
      </Drawer>
    </div>
  );
}

function TaskForm({ clientId, onDone }: { clientId: string | null; onDone: () => void }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo' as Task['status'],
    priority: 'medium' as Task['priority'],
    dueDate: '',
  });

  const create = useMutation(() =>
    tasksService.create({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
      clientId: clientId ?? undefined,
    }),
  );

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await create.mutate().then(onDone).catch(() => undefined);
      }}
      className="space-y-4"
    >
      <Input label="Title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      <Textarea label="Details" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Task['status'] })} options={STATUSES.map((value) => ({ value, label: titleCase(value) }))} />
        <Select label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Task['priority'] })} options={PRIORITIES.map((value) => ({ value, label: titleCase(value) }))} />
      </div>
      <Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
      {create.error ? <p className="text-xs text-danger">{create.error}</p> : null}
      <Button type="submit" loading={create.pending} disabled={!form.title.trim()}>
        Create task
      </Button>
    </form>
  );
}
