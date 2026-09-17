import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { PortalHeader, Explain } from '@/components/portal/PortalHeader';
import { BarChart, DonutChart, Funnel } from '@/components/charts/Charts';
import { AreaChart } from '@/components/charts/AreaChart';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { insightsService } from '@/services';
import { formatNumber, formatPercent, titleCase } from '@/lib/format';

const DONUT_COLORS = ['primary', 'violet', 'success', 'warning', 'danger', 'muted'];

/** Analytics (spec §112, §118). Real data only — empty states when there is none. */
export default function Analytics() {
  usePageMeta({ title: 'Analytics', noIndex: true });
  const analytics = useAsync(() => insightsService.analytics(), []);
  const conversions = useAsync(() => insightsService.conversions(), []);

  const data = analytics.data?.analytics ?? null;
  const funnel = conversions.data?.funnel ?? [];

  return (
    <div>
      <PortalHeader
        title="Analytics"
        description="Where your visitors come from, what they do, and how many become enquiries."
      />

      <AsyncBoundary
        loading={analytics.loading}
        error={analytics.error}
        data={analytics.data}
        isEmpty={(payload) => !payload.analytics}
        onRetry={() => analytics.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No analytics yet"
            description="Traffic is recorded from the moment your website goes live. Until then, this page stays empty rather than showing invented numbers."
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
              <KpiCard label="Conversion" value={formatPercent(data.conversionRate)} hint="Enquiries ÷ visitors" />
            </div>

            <Panel title="Visitors and enquiries over time">
              {data.series.length ? (
                <AreaChart
                  height={260}
                  caption="Visitors and enquiries per day"
                  labels={data.series.map((point) => point.date)}
                  series={[
                    { key: 'visitors', label: 'Visitors', color: 'rgb(var(--nf-blue))', values: data.series.map((p) => p.visitors) },
                    { key: 'leads', label: 'Enquiries', color: 'rgb(var(--nf-violet))', values: data.series.map((p) => p.leads) },
                  ]}
                />
              ) : (
                <EmptyState compact title="No daily data recorded" description="Check back after launch." />
              )}
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Where enquiries come from">
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
                  <EmptyState compact title="No sources recorded" description="Sources appear with your first enquiry." />
                )}
              </Panel>

              <Panel title="Most viewed pages">
                {data.pages.length ? (
                  <BarChart
                    horizontal
                    caption="Page views by path"
                    labels={data.pages.slice(0, 8).map((page) => page.path)}
                    series={[
                      {
                        key: 'views',
                        label: 'Views',
                        color: 'primary',
                        values: data.pages.slice(0, 8).map((page) => page.views),
                      },
                    ]}
                  />
                ) : (
                  <EmptyState compact title="No page data yet" description="Page tracking starts at launch." />
                )}
              </Panel>
            </div>

            {funnel.length ? (
              <Panel title="From visit to customer" description="The path your visitors actually take.">
                <Funnel
                  steps={funnel.map((step) => ({ key: step.key, label: step.label, value: step.value }))}
                />
              </Panel>
            ) : null}

            {data.series.length ? (
              <Panel title="Enquiries per day">
                <BarChart
                  caption="Enquiries per day (last 14 days)"
                  labels={data.series.slice(-14).map((point) => point.date.slice(5))}
                  series={[
                    { key: 'leads', label: 'Enquiries', color: 'violet', values: data.series.slice(-14).map((p) => p.leads) },
                  ]}
                />
              </Panel>
            ) : null}

            <Explain title="How to read this">
              Conversion rate is enquiries divided by visitors. A typical small-business site converts between 1% and 5%;
              if yours is lower, the usual causes are a slow page, a form that asks for too much, or no clear next step.
            </Explain>
          </div>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
