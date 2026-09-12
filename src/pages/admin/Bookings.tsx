import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { Drawer, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { bookingsService, clientsService } from '@/services';
import { formatDate, formatDateTime, formatDuration, titleCase } from '@/lib/format';
import type { Booking } from '@/types';

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

/** Bookings (spec §113): all appointments across every client. */
export default function Bookings() {
  usePageMeta({ title: 'Bookings', noIndex: true });
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Booking | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<Booking | null>(null);

  const state = useAsync(() => bookingsService.list(false), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? 'Unassigned';

  const items = (state.data?.items ?? []).filter((booking) => {
    const matchesQuery =
      !query ||
      booking.customerName.toLowerCase().includes(query.toLowerCase()) ||
      (booking.service ?? '').toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!status || booking.status === status);
  });

  const upcoming = items.filter(
    (booking) => new Date(booking.startsAt) >= new Date() && booking.status !== 'cancelled',
  );

  const cancel = useMutation((booking: Booking) => bookingsService.update(booking.id, { status: 'cancelled' }), {
    onSuccess: async () => {
      toast.success('Booking cancelled');
      setConfirmCancel(null);
      setDetail(null);
      await state.refetch().catch(() => undefined);
    },
  });

  return (
    <div>
      <AdminHeader
        title="Bookings"
        description="Every appointment booked through a client system."
        crumbs={[{ label: 'Bookings' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            Add booking
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Total bookings" value={items.length} />
        <KpiCard label="Upcoming" value={upcoming.length} />
        <KpiCard label="Reminders sent" value={items.filter((booking) => booking.reminderSent).length} />
      </div>

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search customer or service…"
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
              {items.map((booking) => (
                <li key={booking.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(booking)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line bg-sunken text-faint">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-fg">{booking.customerName}</span>
                      <span className="block truncate text-2xs text-muted">
                        {clientName(booking.clientId)} · {booking.service ?? 'Appointment'}
                      </span>
                    </span>
                    <span className="shrink-0 text-2xs text-faint">{formatDateTime(booking.startsAt)}</span>
                    <Badge
                      tone={
                        booking.status === 'confirmed'
                          ? 'success'
                          : booking.status === 'cancelled' || booking.status === 'no_show'
                            ? 'danger'
                            : booking.status === 'completed'
                              ? 'neutral'
                              : 'warning'
                      }
                    >
                      {titleCase(booking.status)}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No bookings yet"
            description="Appointments created through client websites or WhatsApp appear here."
            icon={<CalendarDays className="h-4 w-4" />}
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Add booking
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title="Booking details" width="md">
        {detail ? (
          <div className="space-y-5">
            <div>
              <p className="text-[17px] font-semibold text-fg">{detail.customerName}</p>
              <p className="text-[13px] text-muted">
                {clientName(detail.clientId)} · {detail.service ?? 'Appointment'}
              </p>
            </div>

            <div>
              <p className="nf-eyebrow mb-2">When</p>
              <Row label="Date" value={formatDate(detail.startsAt)} />
              <Row label="Starts" value={formatDateTime(detail.startsAt)} />
              <Row label="Duration" value={formatDuration(detail.durationMins)} />
            </div>

            <div>
              <p className="nf-eyebrow mb-2">Contact</p>
              <Row label="Phone" value={detail.customerPhone ?? '—'} />
              <Row label="Email" value={detail.email ?? '—'} />
              <Row label="Reminder" value={detail.reminderSent ? 'Sent' : 'Not sent'} />
            </div>

            {detail.notes ? (
              <div>
                <p className="nf-eyebrow mb-2">Notes</p>
                <p className="rounded border border-line bg-sunken/40 p-3 text-[13px] leading-relaxed text-fg">{detail.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="nf-eyebrow mb-2">Update status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.filter((option) => option !== detail.status).map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await bookingsService.update(detail.id, { status: option as Booking['status'] });
                        toast.success(`Marked ${option.replace('_', ' ')}`);
                        await state.refetch().catch(() => undefined);
                        setDetail(null);
                      } catch {
                        /* surfaced by toast */
                      }
                    }}
                  >
                    {titleCase(option)}
                  </Button>
                ))}
              </div>
            </div>

            <Link to="/app/calendar" className="inline-block text-[13px] text-brand hover:underline">
              View in calendar →
            </Link>
          </div>
        ) : null}
      </Drawer>

      <Drawer open={creating} onClose={() => setCreating(false)} title="Add a booking" width="md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              await bookingsService.create({
                customerName: String(data.get('customerName') ?? ''),
                customerPhone: String(data.get('customerPhone') ?? '') || undefined,
                email: String(data.get('email') ?? '') || undefined,
                service: String(data.get('service') ?? '') || undefined,
                startsAt: new Date(String(data.get('startsAt') ?? '')).toISOString(),
                durationMins: Number(data.get('durationMins') ?? 30),
                notes: String(data.get('notes') ?? '') || undefined,
                clientId: String(data.get('clientId') ?? '') || undefined,
              });
              toast.success('Booking created');
              setCreating(false);
              await state.refetch().catch(() => undefined);
            } catch {
              /* surfaced by toast */
            }
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
            options={[{ value: '', label: 'Unassigned' }, ...(clients.data?.items ?? []).map((client) => ({ value: client.id, label: client.businessName }))]}
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
          <Button type="submit">Create booking</Button>
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel this booking?"
        confirmLabel="Cancel booking"
        destructive
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => {
          if (confirmCancel) void cancel.mutate(confirmCancel).catch(() => undefined);
        }}
      />
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
