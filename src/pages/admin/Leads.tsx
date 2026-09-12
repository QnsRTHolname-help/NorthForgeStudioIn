import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
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
import { leadsService, clientsService } from '@/services';
import { formatDateTime, formatMoney, titleCase } from '@/lib/format';
import type { Lead } from '@/types';

const STATUSES = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'];
const SOURCES = ['website', 'whatsapp', 'referral', 'outreach', 'manual', 'call', 'other'];

/**
 * Lead management (spec §113).
 * Search, filter, sort and act — the table is the product here, so it is
 * dense, keyboard reachable, and collapses to cards on narrow screens.
 */
export default function Leads() {
  usePageMeta({ title: 'Leads', noIndex: true });
  const navigate = useNavigate();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [qualifying, setQualifying] = useState<string | null>(null);

  const state = useAsync(
    () => leadsService.list({ q: query || undefined, status: status || undefined, source: source || undefined, page, pageSize: 25 }),
    [query, status, source, page],
  );

  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const rows = state.data?.items ?? [];
  const total = state.data?.total ?? 0;

  const qualify = useMutation(
    async (id: string) => {
      setQualifying(id);
      const result = await leadsService.qualify(id);
      return result;
    },
    {
      onSuccess: async () => {
        toast.success('Lead qualified by AI');
        setQualifying(null);
        await state.refetch().catch(() => undefined);
      },
      onError: () => setQualifying(null),
    },
  );

  return (
    <div>
      <AdminHeader
        title="Leads"
        description="Every enquiry captured by the system, with source, score and next action."
        crumbs={[{ label: 'Leads' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            Add lead
          </Button>
        }
      />

      <ListToolbar
        search={query}
        onSearch={(value) => {
          setQuery(value);
          setPage(1);
        }}
        searchPlaceholder="Search name, business, email, phone…"
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
          {
            label: 'Source',
            value: source,
            onChange: (value) => {
              setSource(value);
              setPage(1);
            },
            options: [{ value: '', label: 'All sources' }, ...SOURCES.map((value) => ({ value, label: titleCase(value) }))],
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
              onRowClick={(lead) => navigate(`/app/leads/${lead.id}`)}
              rowActions={(lead) => (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void qualify.mutate(lead.id).catch(() => undefined)}
                    iconLeft={<Sparkles className="h-3.5 w-3.5" />}
                  >
                    {qualifying === lead.id ? 'Working…' : 'Qualify'}
                  </Button>
                </div>
              )}
              columns={[
                {
                  key: 'contact',
                  header: 'Contact',
                  cell: (lead) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{lead.contactName}</p>
                      {lead.businessName ? <p className="truncate text-xs text-muted">{lead.businessName}</p> : null}
                    </div>
                  ),
                  sortValue: (lead) => lead.contactName,
                },
                { key: 'source', header: 'Source', cell: (lead) => titleCase(lead.source), hideBelow: 'md' },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (lead) => (
                    <Badge tone={lead.status === 'won' ? 'success' : lead.status === 'lost' ? 'danger' : lead.status === 'new' ? 'info' : 'neutral'}>
                      {titleCase(lead.status)}
                    </Badge>
                  ),
                },
                { key: 'score', header: 'Score', cell: (lead) => <span className="nf-num">{lead.score}</span>, align: 'right', sortValue: (lead) => lead.score, hideBelow: 'sm' },
                { key: 'intent', header: 'Intent', cell: (lead) => <span className="text-muted">{lead.intent ?? '—'}</span>, hideBelow: 'lg' },
                { key: 'value', header: 'Value', cell: (lead) => (lead.value ? formatMoney(lead.value) : '—'), align: 'right', hideBelow: 'lg' },
                { key: 'clientId', header: 'Client', cell: (lead) => <span className="text-muted">{lead.clientId ? 'Assigned' : 'Unassigned'}</span>, hideBelow: 'lg' },
                { key: 'createdAt', header: 'Created', cell: (lead) => formatDateTime(lead.createdAt), hideBelow: 'lg' },
              ]}
            />
            <div className="border-t border-line px-4 py-3">
              <Pagination page={page} pageSize={25} total={total} onPageChange={setPage} />
            </div>
          </ListShell>
        ) : (
          <EmptyState
            title="No leads match those filters"
            description="Clear the filters, or add a lead manually if someone enquired outside the system."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                Add lead
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add a lead">
        <LeadForm
          clients={(clients.data?.items ?? []).map((client) => ({ id: client.id, name: client.businessName }))}
          onDone={async () => {
            setCreating(false);
            await state.refetch().catch(() => undefined);
          }}
        />
      </Modal>
    </div>
  );
}

export function LeadForm({
  clients,
  lead,
  onDone,
}: {
  clients: { id: string; name: string }[];
  lead?: Lead;
  onDone: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    contactName: lead?.contactName ?? '',
    businessName: lead?.businessName ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    source: lead?.source ?? 'manual',
    status: lead?.status ?? 'new',
    value: lead?.value ? String(lead.value / 100) : '',
    message: lead?.message ?? '',
    nextAction: lead?.nextAction ?? '',
    clientId: lead?.clientId ?? '',
  });

  const mutation = useMutation(
    async () => {
      const payload = {
        contactName: form.contactName.trim(),
        businessName: form.businessName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: form.source as Lead['source'],
        status: form.status as Lead['status'],
        value: form.value ? Math.round(Number(form.value) * 100) : null,
        message: form.message.trim() || undefined,
        nextAction: form.nextAction.trim() || undefined,
        clientId: form.clientId || null,
      };
      return lead ? leadsService.update(lead.id, payload) : leadsService.create(payload);
    },
    {
      onSuccess: () => {
        toast.success(lead ? 'Lead updated' : 'Lead added');
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Contact name"
          required
          value={form.contactName}
          onChange={(event) => setForm({ ...form, contactName: event.target.value })}
        />
        <Input
          label="Business name"
          value={form.businessName}
          onChange={(event) => setForm({ ...form, businessName: event.target.value })}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <Select
          label="Source"
          value={form.source}
          onChange={(event) => setForm({ ...form, source: event.target.value as Lead['source'] })}
          options={SOURCES.map((value) => ({ value, label: titleCase(value) }))}
        />
        <Select
          label="Status"
          value={form.status}
          onChange={(event) => setForm({ ...form, status: event.target.value as Lead['status'] })}
          options={STATUSES.map((value) => ({ value, label: titleCase(value) }))}
        />
        <Input
          label="Estimated value (₹)"
          value={form.value}
          onChange={(event) => setForm({ ...form, value: event.target.value })}
          hint="Rupees — stored in paise."
        />
        <Select
          label="Assign to client"
          value={form.clientId}
          onChange={(event) => setForm({ ...form, clientId: event.target.value })}
          options={[{ value: '', label: 'Unassigned' }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
        />
      </div>
      <Textarea
        label="Message"
        rows={3}
        value={form.message}
        onChange={(event) => setForm({ ...form, message: event.target.value })}
      />
      <Input
        label="Next action"
        value={form.nextAction}
        onChange={(event) => setForm({ ...form, nextAction: event.target.value })}
        placeholder="e.g. Call back Thursday 11:00"
      />
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.pending}>
          {lead ? 'Save changes' : 'Add lead'}
        </Button>
      </div>
    </form>
  );
}
