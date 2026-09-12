import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar, ListShell } from '@/components/admin/AdminHeader';
import { DataTable } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { websitesService, clientsService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import type { Website } from '@/types';

const STATUSES = ['draft', 'building', 'review', 'live', 'paused', 'offline'];

/** Websites (spec §113): every site NorthForge builds and hosts. */
export default function Websites() {
  usePageMeta({ title: 'Websites', noIndex: true });
  const navigate = useNavigate();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);

  const state = useAsync(() => websitesService.list(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const clientName = (id: string) => clients.data?.items.find((client) => client.id === id)?.businessName ?? '—';

  const items = (state.data?.items ?? []).filter((site) => {
    const matchesQuery =
      !query ||
      site.name.toLowerCase().includes(query.toLowerCase()) ||
      (site.domain ?? '').toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!status || site.status === status);
  });

  return (
    <div>
      <AdminHeader
        title="Websites"
        description="Sites we build and host, with deployment, SSL and maintenance state."
        crumbs={[{ label: 'Websites' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New website
          </Button>
        }
      />

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search name or domain…"
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
          <ListShell>
            <DataTable
              rows={items}
              onRowClick={(site) => navigate(`/app/websites/${site.id}`)}
              columns={[
                {
                  key: 'name',
                  header: 'Website',
                  cell: (site) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{site.name}</p>
                      <p className="truncate text-xs text-muted">{site.domain ?? 'No domain yet'}</p>
                    </div>
                  ),
                  sortValue: (site) => site.name,
                },
                { key: 'clientId', header: 'Client', cell: (site) => clientName(site.clientId), hideBelow: 'md' },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (site) => (
                    <Badge tone={site.status === 'live' ? 'success' : site.status === 'offline' ? 'danger' : 'warning'}>
                      {titleCase(site.status)}
                    </Badge>
                  ),
                },
                {
                  key: 'deployment',
                  header: 'Deployment',
                  cell: (site) => (
                    <StatusIndicator status={site.deployment} tone={site.deployment === 'live' ? 'success' : 'neutral'} />
                  ),
                  hideBelow: 'lg',
                },
                { key: 'ssl', header: 'SSL', cell: (site) => (site.ssl ? 'Active' : 'Off'), hideBelow: 'lg' },
                { key: 'hosting', header: 'Hosting', cell: (site) => site.hosting ?? 'NorthForge', hideBelow: 'lg' },
                { key: 'lastDeployedAt', header: 'Last deploy', cell: (site) => formatDateTime(site.lastDeployedAt), hideBelow: 'lg' },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  hideBelow: 'sm',
                  cell: (site) =>
                    site.url ? (
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 text-2xs text-brand hover:underline"
                      >
                        Visit <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : null,
                },
              ]}
            />
          </ListShell>
        ) : (
          <EmptyState
            title="No websites yet"
            description="Add a website record to track its domain, deployment, SSL and analytics."
            action={
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                New website
              </Button>
            }
          />
        )}
      </AsyncBoundary>

      <Modal open={creating} onClose={() => setCreating(false)} title="New website">
        <WebsiteForm
          clients={(clients.data?.items ?? []).map((client) => ({ id: client.id, name: client.businessName }))}
          onDone={async () => {
            setCreating(false);
            toast.success('Website created');
            await state.refetch().catch(() => undefined);
          }}
        />
      </Modal>
    </div>
  );
}

export function WebsiteForm({
  website,
  clients,
  onDone,
}: {
  website?: Website;
  clients: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: website?.name ?? '',
    clientId: website?.clientId ?? '',
    domain: website?.domain ?? '',
    url: website?.url ?? '',
    status: website?.status ?? 'draft',
    deployment: website?.deployment ?? 'pending',
    hosting: website?.hosting ?? 'NorthForge managed',
    framework: website?.framework ?? '',
    ssl: website?.ssl ?? true,
    maintenance: website?.maintenance ?? false,
  });

  const mutation = useMutation(
    async () => {
      const payload = {
        name: form.name.trim(),
        clientId: form.clientId || undefined,
        domain: form.domain.trim() || null,
        url: form.url.trim() || null,
        status: form.status as Website['status'],
        deployment: form.deployment as Website['deployment'],
        hosting: form.hosting.trim() || null,
        framework: form.framework.trim() || null,
        ssl: form.ssl,
        maintenance: form.maintenance,
      };
      return website ? websitesService.update(website.id, payload) : websitesService.create(payload);
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
      <Input label="Website name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <Select
        label="Client"
        value={form.clientId}
        onChange={(event) => setForm({ ...form, clientId: event.target.value })}
        options={[{ value: '', label: 'Unassigned' }, ...clients.map((client) => ({ value: client.id, label: client.name }))]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Domain" value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="example.com" />
        <Input label="URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com" />
        <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Website['status'] })} options={STATUSES.map((value) => ({ value, label: titleCase(value) }))} />
        <Select
          label="Deployment"
          value={form.deployment}
          onChange={(event) => setForm({ ...form, deployment: event.target.value as Website['deployment'] })}
          options={['pending', 'building', 'live', 'failed'].map((value) => ({ value, label: titleCase(value) }))}
        />
        <Input label="Hosting" value={form.hosting} onChange={(event) => setForm({ ...form, hosting: event.target.value })} />
        <Input label="Framework" value={form.framework} onChange={(event) => setForm({ ...form, framework: event.target.value })} placeholder="React + Vite" />
      </div>
      <div className="flex flex-wrap gap-5 border-t border-line pt-4">
        <label className="flex items-center gap-2 text-[13px] text-fg">
          <input type="checkbox" checked={form.ssl} onChange={(event) => setForm({ ...form, ssl: event.target.checked })} className="h-3.5 w-3.5 accent-[rgb(var(--nf-blue))]" />
          SSL enabled
        </label>
        <label className="flex items-center gap-2 text-[13px] text-fg">
          <input type="checkbox" checked={form.maintenance} onChange={(event) => setForm({ ...form, maintenance: event.target.checked })} className="h-3.5 w-3.5 accent-[rgb(var(--nf-blue))]" />
          Maintenance mode
        </label>
      </div>
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.pending}>
          {website ? 'Save changes' : 'Create website'}
        </Button>
      </div>
    </form>
  );
}
