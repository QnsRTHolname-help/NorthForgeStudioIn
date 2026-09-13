import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Drawer } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { bookingsService, calendarService, clientsService } from '@/services';
import { formatTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const KIND_TONE: Record<string, string> = {
  booking: 'bg-brand',
  task: 'bg-warning',
  deadline: 'bg-danger',
  follow_up: 'bg-info',
};

/**
 * Calendar (spec §113): bookings, task due dates and project deadlines in
 * one month view. Uses the real /api/calendar aggregation endpoint.
 */
export default function Calendar() {
  usePageMeta({ title: 'Calendar', noIndex: true });
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const from = new Date(cursor.getFullYear(), cursor.getMonth(), -6).toISOString();
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 7).toISOString();

  const state = useAsync(() => calendarService.events(from, to), [from, to]);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);

  const createBooking = useMutation(
    (input: Parameters<typeof bookingsService.create>[0]) => bookingsService.create(input),
    {
      onSuccess: async () => {
        toast.success('Booking added');
        setCreating(false);
        await state.refetch().catch(() => undefined);
      },
    },
  );
  const events = useMemo(() => state.data?.events ?? [], [state.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const event of events) {
      const key = event.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];

    for (let index = 0; index < 42; index += 1) {
      const day = index - startOffset + 1;
      const date = new Date(year, month, day);
      cells.push({ date, inMonth: day >= 1 && day <= daysInMonth });
      if (index >= startOffset + daysInMonth - 1 && cells.length % 7 === 0) break;
    }
    return cells;
  }, [cursor]);

  const monthEvents = events.filter((event) => {
    const date = new Date(event.date);
    return date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear();
  });

  return (
    <div>
      <AdminHeader
        title="Calendar"
        description="Bookings, task due dates and project deadlines in one view."
        crumbs={[{ label: 'Calendar' }]}
        action={
          <div className="flex items-center gap-2">
            <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
              Add booking
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[130px] text-center text-[13px] font-medium text-fg">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Next month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        <Panel bodyClassName="p-0">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-2xs uppercase tracking-wider text-faint">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {grid.map((cell) => {
              const key = cell.date.toISOString().slice(0, 10);
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[92px] border-b border-r border-line p-1.5 last:border-r-0',
                    !cell.inMonth && 'bg-sunken/20',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'nf-num text-2xs',
                        isToday ? 'rounded bg-brand px-1 text-white' : cell.inMonth ? 'text-muted' : 'text-faint',
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    {dayEvents.length ? (
                      <span className="nf-num text-2xs text-faint">{dayEvents.length}</span>
                    ) : null}
                  </div>

                  <ul className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <li key={event.id}>
                        <Link
                          to={event.href}
                          className="flex items-center gap-1 rounded px-1 py-0.5 text-2xs text-fg transition-colors hover:bg-sunken"
                          title={event.title}
                        >
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', KIND_TONE[event.kind] ?? 'bg-faint')} aria-hidden />
                          <span className="truncate">{event.title}</span>
                        </Link>
                      </li>
                    ))}
                    {dayEvents.length > 3 ? (
                      <li className="px-1 text-2xs text-faint">+{dayEvents.length - 3} more</li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </Panel>
      </AsyncBoundary>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="This month">
          {monthEvents.length ? (
            <ul className="space-y-2">
              {monthEvents.slice(0, 10).map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 px-3 py-2">
                  <Link to={event.href} className="flex min-w-0 items-center gap-2 text-[13px] text-fg hover:underline">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', KIND_TONE[event.kind] ?? 'bg-faint')} aria-hidden />
                    <span className="truncate">{event.title}</span>
                  </Link>
                  <span className="shrink-0 text-2xs text-faint">
                    {formatTime(event.date)} · {titleCase(event.kind)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Nothing scheduled this month" description="Bookings, tasks and deadlines appear here." />
          )}
        </Panel>

        <Panel title="Legend">
          <ul className="space-y-2.5">
            {[
              { kind: 'booking', label: 'Booking', description: 'An appointment booked through a client system.' },
              { kind: 'follow_up', label: 'Lead follow-up', description: 'A scheduled follow-up set on a lead.' },
              { kind: 'task', label: 'Task due', description: 'An internal task with a due date.' },
              { kind: 'deadline', label: 'Project deadline', description: 'A project target completion date.' },
            ].map((entry) => (
              <li key={entry.kind} className="flex items-start gap-2.5">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', KIND_TONE[entry.kind])} aria-hidden />
                <span>
                  <span className="block text-[13px] text-fg">{entry.label}</span>
                  <span className="block text-xs text-muted">{entry.description}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
            <Badge tone="info">{monthEvents.filter((event) => event.kind === 'booking').length} bookings</Badge>
            <Badge tone="info">{monthEvents.filter((event) => event.kind === 'follow_up').length} follow-ups</Badge>
            <Badge tone="warning">{monthEvents.filter((event) => event.kind === 'task').length} tasks</Badge>
            <Badge tone="danger">{monthEvents.filter((event) => event.kind === 'deadline').length} deadlines</Badge>
          </div>
        </Panel>
      </div>

      <Drawer open={creating} onClose={() => setCreating(false)} title="Add a booking" width="md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            await createBooking
              .mutate({
                customerName: String(data.get('customerName') ?? ''),
                customerPhone: String(data.get('customerPhone') ?? '') || undefined,
                email: String(data.get('email') ?? '') || undefined,
                service: String(data.get('service') ?? '') || undefined,
                startsAt: new Date(String(data.get('startsAt') ?? '')).toISOString(),
                durationMins: Number(data.get('durationMins') ?? 30),
                notes: String(data.get('notes') ?? '') || undefined,
                clientId: String(data.get('clientId') ?? '') || undefined,
              })
              .catch(() => undefined);
          }}
          className="space-y-4"
        >
          <Input label="Customer name" name="customerName" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" name="customerPhone" />
            <Input label="Email" type="email" name="email" />
          </div>
          <Select
            label="Client"
            name="clientId"
            options={[
              { value: '', label: 'Unassigned' },
              ...(clients.data?.items ?? []).map((client) => ({ value: client.id, label: client.businessName })),
            ]}
          />
          <Input label="Service" name="service" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Starts at" name="startsAt" type="datetime-local" required />
            <Select
              label="Duration"
              name="durationMins"
              defaultValue="30"
              options={[
                { value: '15', label: '15 minutes' },
                { value: '30', label: '30 minutes' },
                { value: '60', label: '1 hour' },
                { value: '90', label: '1.5 hours' },
              ]}
            />
          </div>
          <Textarea label="Notes" name="notes" rows={3} />
          {createBooking.error ? <p className="text-xs text-danger">{createBooking.error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={createBooking.pending}>
              Create booking
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
