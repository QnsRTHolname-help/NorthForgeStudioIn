import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState, NotFoundState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AreaChart } from '@/components/charts/AreaChart';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { websitesService, insightsService } from '@/services';
import { formatDateTime, formatNumber, titleCase } from '@/lib/format';
import { WebsiteForm } from './Websites';

/**
 * Website detail (spec §113).
 * Combines the website record with the analytics endpoint for that client,
 * so infra state and traffic sit side by side.
 */
export default function WebsiteDetail() {
  const { id = '' } = useParams();
  usePageMeta({ title: 'Website', noIndex: true });
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const state = useAsync(() => websitesService.get(id), [id]);
  const analytics = useAsync(() => insightsService.analytics(state.data?.website.clientId), [state.data?.website.clientId]);
  const site = state.data?.website ?? null;
  const data = analytics.data?.analytics ?? null;

  const toggleMaintenance = useMutation(
    async () => {
      if (!site) return null;
      const result = await websitesService.update(site.id, { maintenance: !site.maintenance });
      return result;
    },
    {
      onSuccess: async () => {
        toast.success(site?.maintenance ? 'Maintenance mode off' : 'Maintenance mode on');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {site ? (
          <>
            <AdminHeader
              title={site.name}
              description={site.domain ?? 'No domain connected'}
              crumbs={[{ label: 'Websites', to: '/app/websites' }, { label: site.name }]}
              demo={site.isDemo}
              action={
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    loading={toggleMaintenance.pending}
                    onClick={() => void toggleMaintenance.mutate().catch(() => undefined)}
                  >
                    {site.maintenance ? 'Turn maintenance off' : 'Turn maintenance on'}
                  </Button>
                  <Button variant="secondary" size="md" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  {site.url ? (
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="nf-focus inline-flex h-9 items-center gap-2 rounded-md bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[rgb(var(--nf-blue)/0.88)]"
                    >
                      Visit site <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : null}
                </>
              }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Status" value={<StatusIndicator status={site.status} tone={site.status === 'live' ? 'success' : 'warning'} />} />
              <KpiCard label="Deployment" value={titleCase(site.deployment)} hint="Last publish pipeline state" />
              <KpiCard label="Visitors recorded" value={data ? formatNumber(data.totals.visitors) : '—'} />
              <KpiCard label="Enquiries" value={data ? formatNumber(data.totals.leads) : '—'} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Panel title="Traffic">
                {data?.series?.length ? (
                  <AreaChart
                    height={250}
                    caption="Visitors per day"
                    labels={data.series.map((point) => point.date)}
                    series={[
                      { key: 'visitors', label: 'Visitors', color: 'primary', values: data.series.map((p) => p.visitors) },
                      { key: 'leads', label: 'Enquiries', color: 'violet', values: data.series.map((p) => p.leads) },
                    ]}
                  />
                ) : (
                  <EmptyState compact title="No analytics recorded" description="Traffic data appears once tracking is live." />
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Infrastructure">
                  <Row label="Domain" value={site.domain ?? '—'} />
                  <Row label="URL" value={site.url ?? '—'} />
                  <Row label="Hosting" value={site.hosting ?? 'NorthForge'} />
                  <Row label="Framework" value={site.framework ?? '—'} />
                  <Row label="SSL" value={site.ssl ? 'Active' : 'Disabled'} />
                  <Row label="Maintenance" value={site.maintenance ? 'On' : 'Off'} />
                  <Row label="Last deployed" value={formatDateTime(site.lastDeployedAt)} />
                  <Row label="Last updated" value={formatDateTime(site.lastUpdatedAt)} />
                </Panel>

                {state.data?.client ? (
                  <Panel title="Client">
                    <Link
                      to={`/app/clients/${state.data.client.id}`}
                      className="flex items-center justify-between gap-2 rounded border border-line bg-sunken/30 px-3 py-2.5 text-[13px] text-fg transition-colors hover:border-brand/40"
                    >
                      {state.data.client.businessName}
                      <span className="text-2xs text-faint">Open →</span>
                    </Link>
                  </Panel>
                ) : null}

                {data?.sources?.length ? (
                  <Panel title="Enquiry sources">
                    <ul className="space-y-2">
                      {data.sources.map((source) => (
                        <li key={source.source} className="flex items-center justify-between gap-3">
                          <span className="text-[13px] text-muted">{titleCase(source.source)}</span>
                          <Badge tone="neutral">{source.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <NotFoundState
            title="Website not found"
            description="This record may have been removed."
            action={
              <Link to="/app/websites" className="nf-focus inline-flex h-9 items-center rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-elevated">
                Back to websites
              </Link>
            }
          />
        )}
      </AsyncBoundary>

      {site ? (
        <Modal open={editing} onClose={() => setEditing(false)} title="Edit website">
          <WebsiteForm
            website={site}
            clients={[]}
            onDone={async () => {
              setEditing(false);
              await state.refetch().catch(() => undefined);
            }}
          />
        </Modal>
      ) : null}
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
