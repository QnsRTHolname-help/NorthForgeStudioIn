import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar, ListShell } from '@/components/admin/AdminHeader';
import { DataTable } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Data';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { clientsService } from '@/services';
import { formatDate, titleCase } from '@/lib/format';

const STATUSES = ['lead', 'onboarding', 'active', 'paused', 'churned'];

/** Clients (spec §113): the account book, with onboarding state visible. */
export default function Clients() {
  usePageMeta({ title: 'Clients', noIndex: true });
  const navigate = useNavigate();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const state = useAsync(
    () => clientsService.list({ q: query || undefined, status: status || undefined, page, pageSize: 25 }),
    [query, status, page],
  );

  const rows = state.data?.items ?? [];

  return (
    <div>
      <AdminHeader
        title="Clients"
        description="Every business NorthForge works with, and where each one is in the journey."
        crumbs={[{ label: 'Clients' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New client
          </Button>
        }
      />

      <ListToolbar
        search={query}
        onSearch={(value) => {
          setQuery(value);
          setPage(1);
        }}
        searchPlaceholder="Search business, contact, email…"
        filters={[
          {
            label: 'Status',
            value: status,
            onChange: (value) => {
              setStatus(value);
              setPage(1);
            },
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
        {rows.length ? (
          <ListShell>
            <DataTable
              rows={rows}
              onRowClick={(client) => navigate(`/app/clients/${client.id}`)}
              columns={[
                {
                  key: 'business',
                  header: 'Business',
                  cell: (client) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{client.businessName}</p>
                      <p className="truncate text-xs text-muted">{client.contactName}</p>
                    </div>
                  ),
                  sortValue: (client) => client.businessName,
                },
                { key: 'type', header: 'Type', cell: (client) => client.businessType ?? '—', hideBelow: 'lg' },
                { key: 'city', header: 'Location', cell: (client) => client.city ?? '—', hideBelow: 'lg' },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (client) => (
                    <Badge tone={client.status === 'active' ? 'success' : client.status === 'churned' ? 'danger' : 'warning'}>
                      {titleCase(client.status)}
                    </Badge>
                  ),
                },
                {
                  key: 'onboarding',
                  header: 'Onboarding',
                  cell: (client) => (
                    <span className="text-muted">
                      {client.onboardingCompleted ? 'Complete' : `Step ${client.onboardingStep} of 5`}
                    </span>
                  ),
                  hideBelow: 'md',
                },
                { key: 'createdAt', header: 'Since', cell: (client) => formatDate(client.createdAt), hideBelow: 'lg' },
              ]}
            />
            <div className="border-t border-line px-4 py-3">
              <Pagination page={page} pageSize={25} total={state.data?.total ?? 0} onPageChange={setPage} />
            </div>
          </ListShell>
        ) : (
          <EmptyState
            title="No clients match those filters"
            description="Add a client to start tracking their website, project, billing and requests."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                New client
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Modal open={creating} onClose={() => setCreating(false)} title="New client">
        <ClientForm
          onDone={async () => {
            setCreating(false);
            toast.success('Client created');
            await state.refetch().catch(() => undefined);
          }}
        />
      </Modal>
    </div>
  );
}

export function ClientForm({
  client,
  onDone,
}: {
  client?: import('@/types').Client;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    businessName: client?.businessName ?? '',
    contactName: client?.contactName ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    businessType: client?.businessType ?? '',
    city: client?.city ?? '',
    state: client?.state ?? '',
    websiteUrl: client?.websiteUrl ?? '',
    status: client?.status ?? 'lead',
    notes: client?.notes ?? '',
  });

  const mutation = useMutation(
    async () => {
      const payload = {
        businessName: form.businessName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        businessType: form.businessType.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
        status: form.status as import('@/types').Client['status'],
        notes: form.notes.trim() || null,
      };
      return client ? clientsService.update(client.id, payload) : clientsService.create(payload);
    },
    { onSuccess: onDone },
  );

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await mutation.mutate().catch(() => undefined);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Business name" required value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />
        <Input label="Contact name" required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
        <Input label="Email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Input label="Business type" value={form.businessType} onChange={(event) => setForm({ ...form, businessType: event.target.value })} placeholder="e.g. Dental clinic" />
        <Input label="Website URL" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://" />
        <Input label="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
        <Input label="State" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
      </div>
      <Select
        label="Status"
        value={form.status}
        onChange={(event) => setForm({ ...form, status: event.target.value as import('@/types').Client['status'] })}
        options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
      />
      <Textarea label="Notes" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.pending}>
          {client ? 'Save changes' : 'Create client'}
        </Button>
      </div>
    </form>
  );
}
