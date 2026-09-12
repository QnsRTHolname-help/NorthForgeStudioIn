import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { DataTable } from '@/components/ui/Table';
import { Drawer } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Form';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { leadsService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import type { Lead } from '@/types';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

/**
 * Client enquiries (spec §112).
 *
 * The client sees only their own leads — the API enforces that; the UI
 * simply never asks for anything else.
 */
export default function Leads() {
  usePageMeta({ title: 'Enquiries', noIndex: true });
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Lead | null>(null);

  const state = useAsync(() => leadsService.list({ status: status || undefined, q: query || undefined, pageSize: 100 }), [status, query]);
  const rows = useMemo(() => state.data?.items ?? [], [state.data]);

  const totals = useMemo(
    () => ({
      total: rows.length,
      new: rows.filter((lead) => lead.status === 'new').length,
      won: rows.filter((lead) => lead.status === 'won').length,
    }),
    [rows],
  );

  return (
    <div>
      <PortalHeader
        title="Enquiries"
        description="Everyone who has contacted your business through the system, with what should happen next."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:max-w-xs sm:flex-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search enquiries…"
            aria-label="Search enquiries"
            containerClassName="gap-0"
          />
        </div>
        <Segmented value={status} onChange={setStatus} options={FILTERS} size="sm" ariaLabel="Filter by status" />
      </div>

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {rows.length ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <Panel><MetricRow label="Total enquiries" value={totals.total} /></Panel>
              <Panel><MetricRow label="Still new" value={totals.new} tone={totals.new ? 'warning' : undefined} /></Panel>
              <Panel><MetricRow label="Converted" value={totals.won} tone={totals.won ? 'success' : undefined} /></Panel>
            </div>

            <DataTable
              rows={rows}
              onRowClick={(lead) => setSelected(lead)}
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
                { key: 'source', header: 'Source', cell: (lead) => titleCase(lead.source), hideBelow: 'sm' },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (lead) => <Badge tone={lead.status === 'won' ? 'success' : lead.status === 'new' ? 'info' : 'neutral'}>{titleCase(lead.status)}</Badge>,
                },
                { key: 'score', header: 'Score', cell: (lead) => <span className="nf-num">{lead.score}</span>, align: 'right', hideBelow: 'md' },
                {
                  key: 'nextAction',
                  header: 'Next action',
                  cell: (lead) => <span className="text-muted">{lead.nextAction ?? '—'}</span>,
                  hideBelow: 'lg',
                },
                { key: 'createdAt', header: 'Received', cell: (lead) => formatDateTime(lead.createdAt), hideBelow: 'lg' },
              ]}
            />
          </>
        ) : (
          <EmptyState
            title="No enquiries yet"
            description="As soon as someone contacts your business through the website or WhatsApp, they appear here with a suggested next action."
          />
        )}
      </AsyncBoundary>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Enquiry details" width="md">
        {selected ? <LeadDetail lead={selected} /> : null}
      </Drawer>
    </div>
  );
}

function LeadDetail({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[17px] font-semibold tracking-tight text-fg">{lead.contactName}</h3>
        <p className="text-[13px] text-muted">{lead.businessName ?? 'No business name given'}</p>
      </div>

      <div>
        <p className="nf-eyebrow mb-1.5">Contact</p>
        <MetricRow label="Email" value={lead.email ?? '—'} />
        <MetricRow label="Phone" value={lead.phone ?? '—'} />
      </div>

      <div>
        <p className="nf-eyebrow mb-1.5">Enquiry</p>
        <p className="rounded border border-line bg-sunken/40 p-3 text-[13px] leading-relaxed text-fg">
          {lead.message ?? 'No message recorded.'}
        </p>
      </div>

      <div>
        <p className="nf-eyebrow mb-1.5">Assessment</p>
        <MetricRow label="Source" value={titleCase(lead.source)} />
        <MetricRow label="Status" value={titleCase(lead.status)} />
        <MetricRow label="Score" value={lead.score} />
        <MetricRow label="Suggested next action" value={lead.nextAction ?? '—'} />
      </div>

      {lead.aiSummary ? (
        <div className="rounded-lg border border-brand-violet/25 bg-brand-violet/[0.06] p-4">
          <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-brand-violet">
            <Sparkles className="h-3 w-3" aria-hidden /> AI assessment
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-fg">{lead.aiSummary}</p>
          {lead.aiQualification ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{lead.aiQualification}</p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-faint">Received {formatDateTime(lead.createdAt)}</p>
    </div>
  );
}
