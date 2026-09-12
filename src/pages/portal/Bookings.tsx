import { useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { Drawer, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Tabs';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { bookingsService } from '@/services';
import { formatDate, formatDateTime, formatDuration, titleCase } from '@/lib/format';
import type { Booking } from '@/types';

/** Bookings (spec §112): appointments captured by the system, plus manual add. */
export default function Bookings() {
  usePageMeta({ title: 'Bookings', noIndex: true });
  const toast = useToast();
  const { session } = useAuth();
  const [view, setView] = useState<'upcoming' | 'all'>('upcoming');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);

  const state = useAsync(() => bookingsService.list(view === 'upcoming'), [view]);
  const items = state.data?.items ?? [];

  const cancel = useMutation(
    async (booking: Booking) => bookingsService.update(booking.id, { status: 'cancelled' }),
    {
      onSuccess: async () => {
        toast.success('Booking cancelled');
        setConfirmCancel(null);
        setDetail(null);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const upcoming = items.filter((booking) => new Date(booking.startsAt) >= new Date() && booking.status !== 'cancelled');

  return (
    <div>
      <PortalHeader
        title="Bookings"
        description="Appointments your customers have booked through your website or WhatsApp."
        action={
          <Button size="sm" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            Add booking
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={view}
          onChange={(value) => setView(value as 'upcoming' | 'all')}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'all', label: 'All' },
          ]}
          size="sm"
          ariaLabel="Booking range"
        />
        <span className="text-[13px] text-muted">{upcoming.length} upcoming</span>
      </div>

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard label="Upcoming" value={upcoming.length} />
              <KpiCard label="Total recorded" value={items.length} />
              <KpiCard
                label="Reminders sent"
                value={items.filter((booking) => booking.reminderSent).length}
                hint="Automatic reminders"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setDetail(booking)}
                  className="group rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-brand/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-fg">{booking.customerName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{booking.service ?? 'Appointment'}</p>
                    </div>
                    <Badge
                      tone={
                        booking.status === 'confirmed'
                          ? 'success'
                          : booking.status === 'cancelled'
                            ? 'danger'
                            : booking.status === 'completed'
                              ? 'neutral'
                              : 'warning'
                      }
                    >
                      {titleCase(booking.status)}
                    </Badge>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[13px] text-fg">
                    <CalendarDays className="h-3.5 w-3.5 text-brand" aria-hidden />
                    {formatDateTime(booking.startsAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    {formatDuration(booking.durationMins)}
                    {booking.customerPhone ? ` · ${booking.customerPhone}` : ''}
                  </p>
                  {booking.reminderSent ? (
                    <p className="mt-2 text-2xs uppercase tracking-wider text-success">Reminder sent</p>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title={view === 'upcoming' ? 'No upcoming bookings' : 'No bookings recorded'}
            description="Bookings made through your website or WhatsApp appear here automatically, with reminders sent before each one."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Add one manually
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Drawer open={creating} onClose={() => setCreating(false)} title="Add a booking" width="md">
        <BookingForm
          clientId={session?.client?.id ?? null}
          onDone={async () => {
            setCreating(false);
            await state.refetch().catch(() => undefined);
          }}
        />
      </Drawer>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title="Booking details" width="md">
        {detail ? (
          <div className="space-y-5">
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-fg">{detail.customerName}</h3>
              <p className="text-[13px] text-muted">{detail.service ?? 'Appointment'}</p>
            </div>
            <div>
              <p className="nf-eyebrow mb-1.5">When</p>
              <MetricRow label="Date" value={formatDate(detail.startsAt)} />
              <MetricRow label="Time" value={formatDateTime(detail.startsAt)} />
              <MetricRow label="Duration" value={formatDuration(detail.durationMins)} />
            </div>
            <div>
              <p className="nf-eyebrow mb-1.5">Contact</p>
              <MetricRow label="Phone" value={detail.customerPhone ?? '—'} />
              <MetricRow label="Email" value={detail.email ?? '—'} />
            </div>
            {detail.notes ? (
              <div>
                <p className="nf-eyebrow mb-1.5">Notes</p>
                <p className="rounded border border-line bg-sunken/40 p-3 text-[13px] leading-relaxed text-fg">
                  {detail.notes}
                </p>
              </div>
            ) : null}
            {detail.status !== 'cancelled' && detail.status !== 'completed' ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmCancel(detail)}>
                Cancel booking
              </Button>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel this booking?"
        description="The slot is freed up and any reminder for it is stopped."
        confirmLabel="Cancel booking"
        destructive
        pending={cancel.pending}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => {
          if (confirmCancel) void cancel.mutate(confirmCancel).catch(() => undefined);
        }}
      />
    </div>
  );
}

function BookingForm({ clientId, onDone }: { clientId: string | null; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    email: '',
    service: '',
    startsAt: '',
    durationMins: '30',
    notes: '',
  });

  const mutation = useMutation(
    async () =>
      bookingsService.create({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        email: form.email.trim() || undefined,
        service: form.service.trim() || undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        durationMins: Number(form.durationMins) || 30,
        notes: form.notes.trim() || undefined,
        clientId: clientId ?? undefined,
      }),
    {
      onSuccess: () => {
        toast.success('Booking added');
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
      <Input
        label="Customer name"
        required
        value={form.customerName}
        onChange={(event) => setForm({ ...form, customerName: event.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Phone"
          value={form.customerPhone}
          onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date and time"
          type="datetime-local"
          required
          value={form.startsAt}
          onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
        />
        <Select
          label="Duration"
          value={form.durationMins}
          onChange={(event) => setForm({ ...form, durationMins: event.target.value })}
          options={[
            { value: '15', label: '15 minutes' },
            { value: '30', label: '30 minutes' },
            { value: '45', label: '45 minutes' },
            { value: '60', label: '1 hour' },
            { value: '90', label: '1.5 hours' },
          ]}
        />
      </div>
      <Input
        label="Service"
        value={form.service}
        onChange={(event) => setForm({ ...form, service: event.target.value })}
      />
      <Textarea
        label="Notes"
        rows={3}
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
      />
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <Button type="submit" loading={mutation.pending} disabled={!form.customerName || !form.startsAt}>
        Add booking
      </Button>
    </form>
  );
}
