import { useState } from 'react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { AreaChart } from '@/components/charts/AreaChart';
import { BarChart, DonutChart } from '@/components/charts/Charts';
import { DataTable } from '@/components/ui/Table';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { insightsService, clientsService } from '@/services';
import { formatMoney, formatNumber, formatPercent, titleCase } from '@/lib/format';

const DONUT_COLORS = ['primary', 'violet', 'success', 'warning', 'danger', 'muted'];

/** Admin analytics (spec §113): pick a client, see their real numbers. */
export default function Analytics() {
  usePageMeta({ title: 'Analytics', noIndex: true });
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const [query, setQuery] = useState('');

  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const analytics = useAsync(() => insightsService.analytics(clientId || undefined), [clientId]);

  void toast;

  const options = (clients.data?.items ?? []).filter((client) =>
    !query ? true : client.businessName.toLowerCase().includes(query.toLowerCase()),
  );

  const data = analytics.data?.analytics ?? null;

  return (
    <div>
      <AdminHeader
        title="Analytics"
        description="Traffic, enquiries and conversion for any client website."
        crumbs={[{ label: 'Analytics' }]}
      />

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search clients…"
        filters={[
          {
            label: 'Client',
            value: clientId,
            onChange: setClientId,
            options: [
              { value: '', label: 'All clients (aggregate)' },
              ...options.map((client) => ({ value: client.id, label: client.businessName })),
            ],
          },
        ]}
      />

      <AsyncBoundary
        loading={analytics.loading}
        error={analytics.error}
        data={analytics.data}
        onRetry={() => analytics.refetch().catch(() => undefined)}
        isEmpty={(payload) => !payload.analytics}
        empty={
          <EmptyState
            title="No analytics recorded"
            description="Analytics begin when a client website goes live. Nothing is estimated in the meantime."
          />
        }
      >
        {data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard label="Visitors" value={formatNumber(data.totals.visitors)} />
              <KpiCard label="Sessions" value={formatNumber(data.totals.sessions)} />
              <KpiCard label="Enquiries" value={formatNumber(data.totals.leads)} />
              <KpiCard label="WhatsApp clicks" value={formatNumber(data.totals.whatsappClicks)} />
              <KpiCard label="Conversion" value={formatPercent(data.conversionRate)} />
            </div>

            <Panel title="Traffic over time">
              {data.series.length ? (
                <AreaChart
                  height={260}
                  caption="Visitors and enquiries per day"
                  labels={data.series.map((point) => point.date)}
                  series={[
                    { key: 'visitors', label: 'Visitors', color: 'primary', values: data.series.map((p) => p.visitors) },
                    { key: 'leads', label: 'Enquiries', color: 'violet', values: data.series.map((p) => p.leads) },
                  ]}
                />
              ) : (
                <EmptyState compact title="No daily data" description="Tracking begins at launch." />
              )}
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Sources">
                {data.sources.length ? (
                  <DonutChart
                    caption="Enquiries by source"
                    centerLabel="Enquiries"
                    centerValue={data.totals.leads}
                    segments={data.sources.map((source, index) => ({
                      label: titleCase(source.source),
                      value: source.count,
                      color: DONUT_COLORS[index % DONUT_COLORS.length]!,
                    }))}
                  />
                ) : (
                  <EmptyState compact title="No source data" description="Sources are derived from real enquiries." />
                )}
              </Panel>

              <Panel title="Top pages">
                {data.pages.length ? (
                  <BarChart
                    horizontal
                    caption="Page views by path"
                    labels={data.pages.slice(0, 8).map((page) => page.path)}
                    series={[{ key: 'views', label: 'Views', color: 'primary', values: data.pages.slice(0, 8).map((page) => page.views) }]}
                  />
                ) : (
                  <EmptyState compact title="No page data" description="Page tracking starts at launch." />
                )}
              </Panel>
            </div>

            <Panel title="Daily breakdown">
              {data.series.length ? (
                <DataTable
                  rows={data.series.map((point, index) => ({ id: String(index), ...point }))}
                  columns={[
                    { key: 'date', header: 'Date', cell: (row) => row.date },
                    { key: 'visitors', header: 'Visitors', cell: (row) => formatNumber(row.visitors), align: 'right' },
                    { key: 'leads', header: 'Enquiries', cell: (row) => formatNumber(row.leads), align: 'right' },
                    { key: 'whatsappClicks', header: 'WhatsApp', cell: (row) => formatNumber(row.whatsappClicks), align: 'right', hideBelow: 'md' },
                    { key: 'bookings', header: 'Bookings', cell: (row) => formatNumber(row.bookings), align: 'right', hideBelow: 'md' },
                  ]}
                />
              ) : (
                <EmptyState compact title="No rows yet" description="Data appears after launch." />
              )}
            </Panel>

            <p className="text-center text-2xs text-faint">
              Figures above are recorded values only — no estimates, no modelled traffic.{' '}
              {clientId ? '' : 'Showing the first client with analytics configured.'}
            </p>
          </div>
        ) : null}
      </AsyncBoundary>

      <Panel className="mt-6" title="Reading conversion">
        <p className="text-[13px] leading-relaxed text-muted">
          Conversion is enquiries divided by visitors. Across small-business sites it usually sits between 1% and 5%. When
          it is low, the cause is almost always one of three things: a slow page, too many form fields, or no obvious next
          step.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Revenue figures elsewhere in the OS are stored in paise; displayed values are rounded once, at the edge.{' '}
          {formatMoney(0)} shown here means nothing recorded, not zero revenue.
        </p>
      </Panel>
    </div>
  );
}
