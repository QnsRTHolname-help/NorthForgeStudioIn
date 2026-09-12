import { Link } from 'react-router-dom';
import { ArrowRight, Check, CircleDollarSign, FolderKanban, ListChecks, Users, Workflow } from 'lucide-react';
import { KpiCard, Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { BarChart, Sparkline } from '@/components/charts/Charts';
import { AreaChart } from '@/components/charts/AreaChart';
import { Timeline } from '@/components/ui/Data';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { insightsService, systemService } from '@/services';
import { formatMoney, formatNumber, formatPercent, formatRelative, titleCase } from '@/lib/format';

/**
 * Admin dashboard (spec §113).
 * Operations view: money in, pipeline shape, what is on fire, what is idle.
 */
export default function Dashboard() {
  usePageMeta({ title: 'Operations', noIndex: true });
  const state = useAsync(() => insightsService.adminDashboard(), []);
  const health = useAsync(() => systemService.health(), []);

  const dashboard = state.data?.dashboard ?? null;
  const metrics = dashboard?.metrics;

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Operations"
        description="NorthForge at a glance — revenue, pipeline, delivery load and system state."
        action={
          <>
            <Link
              to="/app/leads"
              className="nf-focus inline-flex h-9 items-center gap-2 rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-elevated"
            >
              Open pipeline
            </Link>
            <Link
              to="/app/tasks"
              className="nf-focus inline-flex h-9 items-center gap-2 rounded-md bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[rgb(var(--nf-blue)/0.88)]"
            >
              My tasks
            </Link>
          </>
        }
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
        empty={<EmptyState title="No operational data yet" description="Data appears once leads and clients exist." />}
      >
        {dashboard ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <KpiCard
                label="Collected revenue"
                value={formatMoney(metrics?.revenue, { compact: true })}
                icon={<CircleDollarSign className="h-4 w-4" />}
              />
              <KpiCard
                label="Recurring"
                value={formatMoney(metrics?.recurringRevenue, { compact: true })}
                hint="Per billing cycle"
                icon={<CircleDollarSign className="h-4 w-4" />}
              />
              <KpiCard label="Leads" value={formatNumber(metrics?.leads)} icon={<Users className="h-4 w-4" />} />
              <KpiCard
                label="Active clients"
                value={formatNumber(metrics?.activeClients)}
                icon={<Users className="h-4 w-4" />}
              />
              <KpiCard
                label="Open tasks"
                value={formatNumber(metrics?.openTasks)}
                icon={<ListChecks className="h-4 w-4" />}
              />
              <KpiCard
                label="Active projects"
                value={formatNumber(metrics?.activeProjects)}
                icon={<FolderKanban className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Panel
                title="Revenue trend"
                action={
                  <Link to="/app/analytics" className="text-[13px] text-brand hover:underline">
                    Analytics →
                  </Link>
                }
              >
                {dashboard.series.length ? (
                  <AreaChart
                    height={230}
                    caption="Recorded revenue per day"
                    labels={dashboard.series.map((point) => point.date)}
                    series={[
                      {
                        key: 'value',
                        label: 'Revenue',
                        color: 'primary',
                        values: dashboard.series.map((point) => point.value / 100),
                      },
                    ]}
                    formatValue={(value: number) => formatMoney(value * 100, { compact: true })}
                  />
                ) : (
                  <EmptyState compact title="No revenue recorded yet" description="Invoices will populate this chart." />
                )}
              </Panel>

              <Panel title="Pipeline by stage">
                {dashboard.pipeline.length ? (
                  <BarChart
                    horizontal
                    caption="Leads by stage"
                    labels={dashboard.pipeline.map((stage) => titleCase(stage.status))}
                    series={[
                      {
                        key: 'count',
                        label: 'Leads',
                        color: 'primary',
                        values: dashboard.pipeline.map((stage) => stage.count),
                      },
                    ]}
                  />
                ) : (
                  <EmptyState compact title="Pipeline is empty" description="Leads appear here as they arrive." />
                )}
                {dashboard.pipeline.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {dashboard.pipeline.map((stage) => (
                      <Link
                        key={stage.status}
                        to={`/app/leads?status=${stage.status}`}
                        className="rounded border border-line bg-sunken/30 p-2.5 transition-colors hover:border-brand/40"
                      >
                        <p className="nf-num text-[15px] font-semibold text-fg">{stage.count}</p>
                        <p className="text-2xs uppercase tracking-wider text-faint">{titleCase(stage.status)}</p>
                        {stage.value ? (
                          <p className="mt-0.5 text-2xs text-muted">{formatMoney(stage.value, { compact: true })}</p>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Open tasks" className="lg:col-span-1">
                {dashboard.openTasks.length ? (
                  <ul className="space-y-2">
                    {dashboard.openTasks.slice(0, 6).map((task) => (
                      <li key={task.id} className="flex items-start justify-between gap-3 rounded border border-line bg-sunken/30 p-2.5">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-fg">{task.title}</span>
                          <span className="text-2xs uppercase tracking-wider text-faint">{titleCase(task.status)}</span>
                        </span>
                        <Badge tone={task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'neutral'}>
                          {titleCase(task.priority)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="Nothing open" description="No tasks are currently assigned as open." icon={<Check className="h-4 w-4" />} />
                )}
              </Panel>

              <Panel title="Workflows" className="lg:col-span-1">
                {dashboard.workflows.length ? (
                  <ul className="space-y-2">
                    {dashboard.workflows.slice(0, 5).map((workflow) => (
                      <li key={workflow.id} className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 p-2.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <Workflow className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                          <span className="truncate text-[13px] text-fg">{workflow.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Sparkline values={[workflow.runs, Math.max(1, Math.round(workflow.runs * 0.7))]} className="w-12" />
                          <Badge tone={workflow.status === 'active' ? 'success' : workflow.status === 'error' ? 'danger' : 'neutral'}>
                            {titleCase(workflow.status)}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="No workflows yet" description="Create one under Automation." />
                )}
              </Panel>

              <Panel title="Activity" className="lg:col-span-1">
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
                  <EmptyState compact title="No activity yet" description="System events appear here." />
                )}
              </Panel>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Panel title="System">
                <StatusIndicator
                  status={metrics?.systemHealth ?? 'unknown'}
                  tone={metrics?.systemHealth === 'operational' ? 'success' : 'warning'}
                  pulse={metrics?.systemHealth === 'operational'}
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(health.data?.components ?? []).map((component) => (
                    <Badge
                      key={component.key}
                      tone={component.state === 'operational' ? 'success' : component.state === 'degraded' ? 'warning' : 'danger'}
                    >
                      {component.label}
                    </Badge>
                  ))}
                </div>
                <Link
                  to="/app/system-health"
                  className="mt-3 inline-flex items-center gap-1 text-[13px] text-brand hover:underline"
                >
                  Full health report <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </Panel>

              <Panel title="Conversion">
                <p className="nf-num text-[28px] font-semibold tracking-tight text-fg">
                  {formatPercent(metrics?.conversionRate)}
                </p>
                <p className="mt-1 text-[13px] text-muted">Leads converted from recorded enquiries</p>
                <Link to="/app/conversions" className="mt-3 inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
                  Funnel detail <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </Panel>

              <Panel title="Quick actions">
                <ul className="space-y-2">
                  {[
                    { label: 'Add a lead', to: '/app/leads' },
                    { label: 'Create a task', to: '/app/tasks' },
                    { label: 'Generate an invoice', to: '/app/invoices' },
                    { label: 'Build a workflow', to: '/app/workflows' },
                  ].map((action) => (
                    <li key={action.to}>
                      <Link
                        to={action.to}
                        className="flex items-center justify-between gap-2 rounded border border-line bg-sunken/30 px-3 py-2 text-[13px] text-fg transition-colors hover:border-brand/40"
                      >
                        {action.label}
                        <ArrowRight className="h-3.5 w-3.5 text-faint" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
