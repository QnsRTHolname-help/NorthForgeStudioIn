import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { calendarService } from '@/services';
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
};

/**
 * Calendar (spec §113): bookings, task due dates and project deadlines in
 * one month view. Uses the real /api/calendar aggregation endpoint.
 */
export default function Calendar() {
  usePageMeta({ title: 'Calendar', noIndex: true });
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const from = new Date(cursor.getFullYear(), cursor.getMonth(), -6).toISOString();
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 7).toISOString();

  const state = useAsync(() => calendarService.events(from, to), [from, to]);
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
            <Badge tone="warning">{monthEvents.filter((event) => event.kind === 'task').length} tasks</Badge>
            <Badge tone="danger">{monthEvents.filter((event) => event.kind === 'deadline').length} deadlines</Badge>
          </div>
        </Panel>
      </div>
    </div>
  );
}
