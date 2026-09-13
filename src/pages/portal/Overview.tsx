import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Globe, Sparkles, TrendingUp } from 'lucide-react';
import { KpiCard, Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { LinkButton } from '@/components/ui/Button';
import { StatusIndicator } from '@/components/ui/Badge';
import { PortalHeader, Explain } from '@/components/portal/PortalHeader';
import { AreaChart } from '@/components/charts/AreaChart';
import { Timeline } from '@/components/ui/Data';
import { useAsync } from '@/hooks/useAsync';
import { insightsService, billingService, announcementsService } from '@/services';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatMoney, formatNumber, formatPercent, formatRelative, formatDateTime } from '@/lib/format';
import { titleForPath } from '@/app/config/titles';

/**
 * Client overview (spec §112, §113).
 *
 * Reads like a business summary, not a system dump: what is live, what is
 * happening, what needs the client to act. Every number comes from the API —
 * if there is nothing recorded, the UI says so instead of inventing a figure.
 */
export default function Overview() {
  usePageMeta({ title: titleForPath('/portal') ?? 'Client portal', noIndex: true });
  const state = useAsync(() => insightsService.clientDashboard(), []);
  const invoices = useAsync(() => billingService.invoices(), []);
  const announcements = useAsync(() => announcementsService.list(), []);

  const dashboard = state.data?.dashboard ?? null;
  const metrics = dashboard?.metrics;
  const demo = dashboard?.client?.isDemo ?? false;
  const outstanding =
    (invoices.data?.items ?? []).filter((invoice) => invoice.status !== 'paid').reduce((sum, i) => sum + i.total, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PortalHeader
        title={dashboard?.client?.businessName ? `${dashboard.client.businessName}` : 'Your business'}
        description="Everything your NorthForge system is doing for you, in plain language."
        demo={demo}
        action={
          <>
            <LinkButton to="/portal/requests" variant="secondary" size="sm">
              New request
            </LinkButton>
            <LinkButton to="/portal/analytics" size="sm" arrow>
              View analytics
            </LinkButton>
          </>
        }
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        errorCode={state.errorCode}
        data={state.data}
        onRetry={state.refetch}
        empty={
          <EmptyState
            title="No dashboard data yet"
            description="Your workspace is being set up. Once your website is live, activity will appear here."
            action={
              <LinkButton to="/portal/requests" variant="secondary" size="sm">
                Request an update
              </LinkButton>
            }
          />
        }
      >
        {dashboard ? (
          <>
            {/* System status row */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatusCard
                icon={<Globe className="h-4 w-4" />}
                label="Your website"
                value={dashboard.website ? (dashboard.website.maintenance ? 'Under maintenance' : dashboard.website.status) : 'Not set up yet'}
                tone={dashboard.website?.status === 'live' ? 'success' : dashboard.website ? 'warning' : 'neutral'}
                detail={dashboard.website?.url ?? 'We will set this up during build'}
                to="/portal/website"
              />
              <StatusCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Project progress"
                value={dashboard.project ? `${dashboard.project.progress}% complete` : 'Not started'}
                tone={dashboard.project?.status === 'completed' ? 'success' : 'info'}
                detail={dashboard.project ? dashboard.project.name : 'We will scope this with you'}
                to="/portal/project"
              />
              <StatusCard
                icon={<CalendarDays className="h-4 w-4" />}
                label="Upcoming appointments"
                value={`${metrics?.bookings ?? 0} booked`}
                tone={(metrics?.bookings ?? 0) > 0 ? 'success' : 'neutral'}
                detail="Confirmed bookings in your calendar"
                to="/portal/bookings"
              />
              <StatusCard
                icon={<Sparkles className="h-4 w-4" />}
                label="Plan"
                value={dashboard.plan?.name ?? 'No active plan'}
                tone="info"
                detail={
                  dashboard.subscription?.renewsAt
                    ? `Renews ${formatDateTime(dashboard.subscription.renewsAt)}`
                    : 'No active subscription'
                }
                to="/portal/subscription"
              />
            </div>

            {/* Metrics */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Visitors recorded"
                value={formatNumber(metrics?.visitors)}
                hint={metrics?.visitors ? 'Since tracking began' : 'Tracking will begin at launch'}
              />
              <KpiCard
                label="Enquiries received"
                value={formatNumber(metrics?.leadsTotal)}
                hint={metrics?.leadsNew ? `${metrics.leadsNew} still new` : 'All enquiries handled'}
              />
              <KpiCard
                label="Enquiries converted"
                value={formatPercent(metrics?.conversionRate)}
                hint={
                  metrics?.leadsConverted
                    ? `${metrics.leadsConverted} became customers`
                    : 'Conversion shows when traffic is recorded'
                }
              />
              <KpiCard
                label="Amount outstanding"
                value={formatMoney(outstanding)}
                hint={outstanding > 0 ? 'Unpaid invoices' : 'Everything is paid up'}
              />
            </div>

            {/* Traffic chart */}
            <Panel
              title="Visitors and enquiries"
              description="Recorded activity over time."
              action={
                <Link to="/portal/analytics" className="text-[13px] text-brand hover:underline">
                  Full analytics →
                </Link>
              }
            >
              {dashboard.series.length ? (
                <AreaChart
                  height={240}
                  caption="Visitors recorded per day"
                  labels={dashboard.series.map((point) => point.date)}
                  series={[
                    {
                      key: 'value',
                      label: 'Visitors',
                      color: 'rgb(var(--nf-blue))',
                      values: dashboard.series.map((p) => p.value),
                    },
                  ]}
                />
              ) : (
                <div className="py-10 text-center">
                  <EmptyState
                    compact
                    title="No traffic recorded yet"
                    description="Analytics start collecting as soon as your website goes live. Until then this stays empty rather than showing a guess."
                  />
                </div>
              )}
            </Panel>

            {/* Announcements (real, RLS-scoped; spec §18) */}
            {announcements.data?.items.length ? (
              <Panel title="From the NorthForge team">
                <ul className="space-y-3">
                  {announcements.data.items.slice(0, 3).map((item) => (
                    <li key={item.id} className="rounded-lg border border-line bg-sunken/30 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-fg">{item.title}</p>
                        <span className="text-2xs text-faint">{formatDateTime(item.startsAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted">{item.message}</p>
                    </li>
                  ))}
                </ul>
                {announcements.data.items.length > 3 ? (
                  <Link
                    to="/portal/announcements"
                    className="mt-3 inline-flex items-center gap-1 text-2xs text-brand hover:underline"
                  >
                    All announcements <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                ) : null}
              </Panel>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Activity */}
              <Panel title="What happened recently">
                {dashboard.recentActivity.length ? (
                  <Timeline
                    items={dashboard.recentActivity.slice(0, 6).map((entry) => ({
                      id: entry.id,
                      label: entry.label,
                      detail: entry.detail ?? undefined,
                      meta: formatRelative(entry.createdAt),
                      state: 'done' as const,
                    }))}
                  />
                ) : (
                  <EmptyState
                    compact
                    title="Nothing recorded yet"
                    description="Project updates, enquiries and invoices will appear here."
                  />
                )}
              </Panel>

              {/* Next actions */}
              <Panel title="What needs you">
                <ul className="space-y-2.5">
                  {[
                    metrics?.openRequests
                      ? {
                          label: `${metrics.openRequests} open request${metrics.openRequests === 1 ? '' : 's'}`,
                          detail: 'We are working on these — add anything else you need.',
                          to: '/portal/requests',
                        }
                      : null,
                    metrics?.leadsNew
                      ? {
                          label: `${metrics.leadsNew} new enquir${metrics.leadsNew === 1 ? 'y' : 'ies'}`,
                          detail: 'Respond fast — most enquiries are answered within the hour.',
                          to: '/portal/leads',
                        }
                      : null,
                    outstanding > 0
                      ? {
                          label: `${formatMoney(outstanding)} outstanding`,
                          detail: 'Settle outstanding invoices to keep everything running.',
                          to: '/portal/invoices',
                        }
                      : null,
                  ]
                    .filter(Boolean)
                    .map((item) => {
                      const action = item as { label: string; detail: string; to: string };
                      return (
                        <li key={action.to}>
                          <Link
                            to={action.to}
                            className="group flex items-start justify-between gap-4 rounded border border-line bg-sunken/30 p-3 transition-colors hover:border-brand/40"
                          >
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-fg">{action.label}</span>
                              <span className="mt-0.5 block text-xs text-muted">{action.detail}</span>
                            </span>
                            <ArrowRight
                              className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      );
                    })}

                  {!metrics?.openRequests && !metrics?.leadsNew && outstanding <= 0 ? (
                    <li>
                      <EmptyState
                        compact
                        title="You are all caught up"
                        description="Nothing is waiting on you right now. New items will appear here the moment they do."
                      />
                    </li>
                  ) : null}
                </ul>

                <div className="mt-5">
                  <Explain title="Need something changed?">
                    Raise a request and it goes straight to the team — no email ping-pong.{' '}
                    <Link to="/portal/requests" className="text-brand hover:underline">
                      New request →
                    </Link>
                  </Explain>
                </div>
              </Panel>
            </div>

            {demo ? (
              <p className="text-center text-xs text-faint">
                This workspace runs on seeded demo data so you can see every screen working. Your real data replaces it
                automatically.
              </p>
            ) : null}
          </>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}

/* ── Small status card ─────────────────────────────────────────── */

function StatusCard({
  icon,
  label,
  value,
  detail,
  tone,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between rounded-lg border border-line bg-surface p-4 transition-colors duration-200 hover:border-brand/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wider text-faint">
          <span className="text-brand" aria-hidden>
            {icon}
          </span>
          {label}
        </span>
        <StatusIndicator status={tone === 'neutral' ? 'pending' : value} tone={tone} />
      </div>
      <p className="mt-3 truncate text-[15px] font-semibold tracking-tight text-fg">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{detail}</p>
    </Link>
  );
}
