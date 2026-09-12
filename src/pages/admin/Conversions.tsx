import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Funnel } from '@/components/charts/Charts';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { insightsService } from '@/services';
import { formatNumber, formatPercent } from '@/lib/format';

/**
 * Conversions (spec §113).
 * The funnel is computed from recorded events only — if a stage has no data,
 * it shows as zero rather than being filled in with an assumption.
 */
export default function Conversions() {
  usePageMeta({ title: 'Conversions', noIndex: true });
  const state = useAsync(() => insightsService.conversions(), []);
  const funnel = state.data?.funnel ?? [];

  const first = funnel[0]?.value ?? 0;
  const last = funnel[funnel.length - 1]?.value ?? 0;
  const overall = first > 0 ? (last / first) * 100 : null;

  return (
    <div>
      <AdminHeader
        title="Conversions"
        description="How many visitors become enquiries, and how many enquiries become customers."
        crumbs={[{ label: 'Conversions' }]}
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
        isEmpty={(payload) => !payload.funnel.length}
        empty={
          <EmptyState
            title="No conversion data yet"
            description="The funnel builds from recorded visits, enquiries and outcomes. It stays empty until there is something real to show."
          />
        }
      >
        {funnel.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <KpiCard label="Top of funnel" value={formatNumber(first)} hint={funnel[0]?.label} />
              <KpiCard label="Bottom of funnel" value={formatNumber(last)} hint={funnel[funnel.length - 1]?.label} />
              <KpiCard label="End-to-end" value={formatPercent(overall)} hint="Last stage ÷ first stage" />
            </div>

            <Panel title="Funnel">
              <Funnel steps={funnel.map((step) => ({ key: step.key, label: step.label, value: step.value }))} />
            </Panel>

            <Panel title="Stage-by-stage">
              <ul className="space-y-2">
                {funnel.map((step, index) => {
                  const previous = funnel[index - 1];
                  const stepRate = previous && previous.value > 0 ? (step.value / previous.value) * 100 : null;
                  return (
                    <li key={step.key} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                      <span className="text-[13px] text-fg">{step.label}</span>
                      <span className="flex items-center gap-4">
                        <span className="nf-num text-[13px] text-muted">{formatNumber(step.value)}</span>
                        <span className="nf-num w-16 text-right text-[13px] font-medium text-fg">
                          {stepRate === null ? '—' : formatPercent(stepRate)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <p className="text-center text-2xs text-faint">
              Percentages are step-to-step conversion. A drop between two stages is the place to investigate first.
            </p>
          </div>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
