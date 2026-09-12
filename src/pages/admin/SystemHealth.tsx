import { useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { systemService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * System health (spec §120, §141).
 *
 * Nothing on this screen is assumed: every component is probed by the
 * server and reported back with a latency figure and a checked-at time.
 */
export default function SystemHealth() {
  usePageMeta({ title: 'System health', noIndex: true });
  const [refreshing, setRefreshing] = useState(false);

  const health = useAsync(() => systemService.health(), []);
  const status = useAsync(() => systemService.status(), []);
  const mine = useAsync(() => systemService.mine(), []);

  const report = health.data;
  const counts = status.data?.counts ?? {};

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      health.refetch().catch(() => undefined),
      status.refetch().catch(() => undefined),
      mine.refetch().catch(() => undefined),
    ]);
    setRefreshing(false);
  };

  return (
    <div>
      <AdminHeader
        title="System health"
        description="Live probes of every component the platform depends on."
        crumbs={[{ label: 'System health' }]}
        action={
          <Button variant="secondary" size="md" iconLeft={<RefreshCw className="h-3.5 w-3.5" />} loading={refreshing} onClick={() => void refresh()}>
            Re-check now
          </Button>
        }
      />

      <AsyncBoundary
        loading={health.loading}
        error={health.error}
        data={health.data}
        onRetry={() => health.refetch().catch(() => undefined)}
      >
        {report ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Overall"
                value={<StatusIndicator status={report.state} tone={report.state === 'operational' ? 'success' : 'warning'} pulse={report.state === 'operational'} />}
              />
              <KpiCard label="Components" value={report.components.length} />
              <KpiCard
                label="Degraded"
                value={report.components.filter((component) => component.state === 'degraded').length}
              />
              <KpiCard label="Last check" value={formatDateTime(report.checkedAt)} />
            </div>

            <Panel title="Components">
              <ul className="space-y-2.5">
                {report.components.map((component) => (
                  <li
                    key={component.key}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-sunken/30 px-3.5 py-3"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        component.state === 'operational'
                          ? 'bg-success'
                          : component.state === 'degraded'
                            ? 'bg-warning'
                            : component.state === 'offline'
                              ? 'bg-danger'
                              : 'bg-faint',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-fg">{component.label}</span>
                      <span className="block text-2xs text-muted">{component.detail}</span>
                    </span>
                    <span className="shrink-0 text-2xs text-faint">
                      {component.latencyMs !== null ? `${component.latencyMs} ms` : '—'}
                    </span>
                    <Badge
                      tone={
                        component.state === 'operational'
                          ? 'success'
                          : component.state === 'degraded'
                            ? 'warning'
                            : component.state === 'offline'
                              ? 'danger'
                              : 'neutral'
                      }
                    >
                      {titleCase(component.state)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Record counts" description="What is actually stored in the database.">
                {Object.keys(counts).length ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(counts).map(([key, value]) => (
                      <li key={key} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                        <span className="text-[13px] capitalize text-muted">{key.replace(/_/g, ' ')}</span>
                        <span className="nf-num text-[13px] font-medium text-fg">{value}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="No counts available" description="Run a re-check to populate these." />
                )}
              </Panel>

              <Panel title="Your connection" description="What the server sees about this session.">
                {mine.data ? (
                  <ul className="space-y-2.5">
                    {mine.data.components.map((component) => (
                      <li key={component.key} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                        <span className="text-[13px] text-muted">{component.label}</span>
                        <span className="text-[13px] font-medium text-fg">{component.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact title="Not checked yet" description="Re-check to see your session details." />
                )}
              </Panel>
            </div>

            <Panel title="What a degraded state means">
              <p className="text-[13px] leading-relaxed text-muted">
                Components report their own real status. Degraded means something is slower than it should be or partially
                unavailable; offline means a dependency is not responding. This page never shows a green light by default
                — if it says operational, the probe passed.
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-2xs text-faint">
                <Activity className="h-3 w-3" aria-hidden />
                Probed at {formatDateTime(report.checkedAt)}
              </p>
            </Panel>
          </div>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
