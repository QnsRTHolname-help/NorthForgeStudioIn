import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock } from 'lucide-react';
import { KpiCard, Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { bookingsService, tasksService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';

export default function Calendar() {
  usePageMeta({ title: 'Calendar', noIndex: true });
  const bookings = useAsync(() => bookingsService.list(true), []);
  const tasks = useAsync(() => tasksService.list(), []);

  const openTasks = (tasks.data?.items ?? []).filter((task) => task.status !== 'done' && task.dueDate);
  /*
   * Counted from the rows on screen, not asserted: the previous "Automated
   * reminders: Active" card claimed a workflow state this page never read.
   */
  const overdue = openTasks.filter((task) => new Date(task.dueDate as string).getTime() < Date.now());
  const events = [
    ...(bookings.data?.items ?? []).map((booking) => ({
      id: `booking-${booking.id}`,
      kind: 'Booking',
      title: booking.customerName,
      detail: booking.service ?? 'Appointment',
      at: booking.startsAt,
      to: '/portal/bookings',
      tone: booking.status === 'confirmed' ? 'success' : booking.status === 'cancelled' ? 'danger' : 'warning',
    })),
    ...openTasks.map((task) => ({
      id: `task-${task.id}`,
      kind: 'Task',
      title: task.title,
      detail: titleCase(task.priority),
      at: task.dueDate ?? '',
      to: '/portal/tasks',
      tone: task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral',
    })),
  ]
    .filter((event) => event.at)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-5">
      <PortalHeader
        title="Calendar"
        description="The daily view for appointments, follow-ups, project deadlines and owner tasks."
        action={
          <>
            <LinkButton to="/portal/bookings" variant="secondary" size="sm">
              Bookings
            </LinkButton>
            <LinkButton to="/portal/tasks" size="sm">
              Tasks
            </LinkButton>
          </>
        }
      />

      <section className="nf-os-hero p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="nf-eyebrow text-brand">Morning control room</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Appointments, deadlines and reminders in one calm timeline.</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              This is the view an owner can open first thing and know what the day is asking from the business.
            </p>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[520px]">
            <KpiCard label="Upcoming bookings" value={(bookings.data?.items ?? []).length} icon={<CalendarDays className="h-4 w-4" />} />
            <KpiCard label="Task deadlines" value={openTasks.length} icon={<CheckCircle2 className="h-4 w-4" />} />
            <KpiCard
              label="Overdue"
              value={overdue.length}
              hint={overdue.length ? 'Past their due date' : 'Nothing past its due date'}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>

      <AsyncBoundary
        loading={bookings.loading || tasks.loading}
        error={bookings.error ?? tasks.error}
        data={{ bookings: bookings.data, tasks: tasks.data }}
        onRetry={() => {
          void bookings.refetch().catch(() => undefined);
          void tasks.refetch().catch(() => undefined);
        }}
      >
        {events.length ? (
          <Panel title="Upcoming schedule" description="Sorted by the next thing that needs attention." bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {events.map((event) => (
                <li key={event.id}>
                  <Link to={event.to} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken/50">
                    <span className="nf-os-icon mt-0.5 h-8 w-8 shrink-0">
                      <Clock className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-fg">{event.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{event.detail}</span>
                      <span className="mt-1 block text-2xs uppercase tracking-wider text-faint">{formatDateTime(event.at)}</span>
                    </span>
                    <Badge tone={event.tone as 'success' | 'danger' | 'warning' | 'neutral'}>{event.kind}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No upcoming schedule yet"
            description="Bookings and dated tasks will appear here so the day starts from one clear calendar."
            action={
              <LinkButton to="/portal/bookings" variant="secondary" size="sm">
                Add a booking
              </LinkButton>
            }
          />
        )}
      </AsyncBoundary>
    </div>
  );
}
