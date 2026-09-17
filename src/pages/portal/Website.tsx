import { ExternalLink, Lock, RefreshCw, Server } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { StatusIndicator, DemoBadge } from '@/components/ui/Badge';
import { PortalHeader, MetricRow, Explain } from '@/components/portal/PortalHeader';
import { AreaChart } from '@/components/charts/AreaChart';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { websitesService, insightsService } from '@/services';
import { formatDateTime, formatNumber, formatPercent } from '@/lib/format';

/** Website status (spec §112) — hosting, SSL, deployment and live traffic. */
export default function Website() {
  usePageMeta({ title: 'My website', noIndex: true });

  const sites = useAsync(() => websitesService.list(), []);
  const analytics = useAsync(() => insightsService.analytics(), []);

  const website = sites.data?.items?.[0] ?? null;
  const data = analytics.data?.analytics ?? null;

  return (
    <div className="space-y-6">
      <PortalHeader
        title="My website"
        description="Your site, its infrastructure and how people are finding it."
        demo={website?.isDemo}
        action={
          website?.url ? (
            <a
              href={website.url}
              target="_blank"
              rel="noreferrer noopener"
              className="nf-focus inline-flex h-9 items-center gap-2 rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:border-line-strong hover:bg-elevated"
            >
              Visit site <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : undefined
        }
      />

      <AsyncBoundary
        loading={sites.loading}
        error={sites.error}
        data={sites.data}
        isEmpty={(payload) => !payload.items?.length}
        onRetry={() => sites.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No website connected yet"
            description="Your site is created during the build stage. Once it is deployed, its status will appear here."
          />
        }
      >
        {website ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Status"
                value={website.maintenance ? 'Under maintenance' : website.status}
                hint="What visitors see right now"
              />
              <KpiCard label="SSL certificate" value={website.ssl ? 'Active & auto-renewing' : 'Not enabled'} hint="HTTPS encryption" />
              <KpiCard label="Hosting" value={website.hosting ?? 'Managed by NorthForge'} hint="Included in your plan" />
              <KpiCard label="Last deployment" value={formatDateTime(website.lastDeployedAt)} hint="Most recent publish" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
              <Panel title="Traffic" description="Visitors recorded on your site.">
                {data?.series?.length ? (
                  <AreaChart
                    height={230}
                    caption="Visitors per day"
                    labels={data.series.map((point) => point.date)}
                    series={[
                      { key: 'visitors', label: 'Visitors', color: 'rgb(var(--nf-blue))', values: data.series.map((p) => p.visitors) },
                      { key: 'leads', label: 'Enquiries', color: 'rgb(var(--nf-violet))', values: data.series.map((p) => p.leads) },
                    ]}
                  />
                ) : (
                  <EmptyState
                    compact
                    title="No traffic recorded yet"
                    description="Tracking begins the moment your site goes live."
                  />
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Infrastructure">
                  <MetricRow label="Domain" value={website.domain ?? 'Not connected'} />
                  <MetricRow
                    label="Deployment"
                    value={<StatusIndicator status={website.deployment} tone={website.deployment === 'live' ? 'success' : 'neutral'} />}
                  />
                  <MetricRow label="Framework" value={website.framework ?? 'Managed'} />
                  <MetricRow label="SSL" value={<span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" aria-hidden />{website.ssl ? 'Enabled' : 'Disabled'}</span>} />
                  <MetricRow label="Hosting" value={<span className="inline-flex items-center gap-1.5"><Server className="h-3 w-3" aria-hidden />{website.hosting ?? 'NorthForge'}</span>} />
                </Panel>

                {data ? (
                  <Panel title="Recorded totals">
                    <MetricRow label="Visitors" value={formatNumber(data.totals.visitors)} />
                    <MetricRow label="Sessions" value={formatNumber(data.totals.sessions)} />
                    <MetricRow label="Enquiries" value={formatNumber(data.totals.leads)} />
                    <MetricRow label="WhatsApp clicks" value={formatNumber(data.totals.whatsappClicks)} />
                    <MetricRow label="Conversion" value={formatPercent(data.conversionRate)} />
                    <div className="mt-3 flex items-center gap-1.5 text-2xs text-faint">
                      <RefreshCw className="h-3 w-3" aria-hidden />
                      Updated {formatDateTime(data.website.lastUpdatedAt)}
                    </div>
                  </Panel>
                ) : null}
              </div>
            </div>

            <Explain title="Something need changing?">
              Content edits, new sections and design tweaks are all handled through{' '}
              <span className="font-medium text-fg">requests</span>. Raise one and we will pick it up — no ticket
              numbers to chase.
            </Explain>

            {website.isDemo ? (
              <p className="text-center text-xs text-faint">
                <DemoBadge /> This website record is seeded demo data.
              </p>
            ) : null}
          </>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
