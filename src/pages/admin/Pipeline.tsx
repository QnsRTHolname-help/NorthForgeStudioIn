import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Select } from '@/components/ui/Form';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { leadsService } from '@/services';
import { formatMoney, formatRelative, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const STAGES = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'];

/**
 * How many leads the board loads at once. The board is a working view, not a
 * report: past this many the page tells you it is incomplete instead of
 * quietly drawing a partial board (spec §113).
 */
const BOARD_LIMIT = 500;

const TONES: Record<string, string> = {
  new: 'border-l-info',
  qualified: 'border-l-brand',
  contacted: 'border-l-brand-violet',
  proposal: 'border-l-warning',
  won: 'border-l-success',
  lost: 'border-l-faint',
};

/**
 * Pipeline board (spec §113).
 * Drag-and-drop is deliberately not implemented with HTML5 DnD: a status
 * menu is keyboard accessible and works on touch. Moving a lead is a PATCH.
 */
export default function Pipeline() {
  usePageMeta({ title: 'Pipeline', noIndex: true });
  const navigate = useNavigate();
  const toast = useToast();
  const [moving, setMoving] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('');

  const leads = useAsync(
    () => leadsService.list({ status: stageFilter || undefined, pageSize: BOARD_LIMIT }),
    [stageFilter],
  );
  const items = leads.data?.items ?? [];
  const total = leads.data?.total ?? items.length;
  const truncated = total > items.length;
  const visibleStages = stageFilter ? [stageFilter] : STAGES;

  /**
   * Move a lead to another stage.
   *
   * The write is admin-only and can legitimately be refused (an admin
   * session without a verified second factor is denied by RLS, migration
   * 0008), so a failure must be visible. Previously this rejected into
   * nothing: the card looked like it had moved while the database still held
   * the old stage.
   */
  const move = async (id: string, status: string) => {
    setMoving(id);
    try {
      await leadsService.update(id, { status: status as never });
      await leads.refetch().catch(() => undefined);
      toast.success('Lead moved', `Stage set to ${titleCase(status)}.`);
    } catch (error) {
      toast.error('Could not move that lead', (error as Error)?.message ?? 'The change was not saved.');
      // Re-read so the board shows the database's actual state, never a
      // optimistic one.
      await leads.refetch().catch(() => undefined);
    } finally {
      setMoving(null);
    }
  };

  // Counts are derived from the rows on the board (not a second query), so
  // the summary strip and the columns can never disagree with each other.
  const summary = STAGES.map((stage) => {
    const inStage = items.filter((lead) => lead.status === stage);
    return { status: stage, count: inStage.length, value: inStage.reduce((sum, lead) => sum + (lead.value ?? 0), 0) };
  });

  return (
    <div>
      <AdminHeader
        title="Pipeline"
        description="Every lead by stage. Move a lead from its card — the change saves immediately."
        crumbs={[{ label: 'Pipeline' }]}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        {summary.map((stage) => (
          <button
            key={stage.status}
            type="button"
            onClick={() => setStageFilter((current) => (current === stage.status ? '' : stage.status))}
            aria-pressed={stageFilter === stage.status}
            className={cn(
              'nf-focus rounded-lg border px-4 py-3 text-left transition-colors',
              stageFilter === stage.status
                ? 'border-brand bg-brand/[0.06]'
                : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <p className="nf-num text-[20px] font-semibold text-fg">{stage.count}</p>
            <p className="text-2xs uppercase tracking-wider text-faint">{titleCase(stage.status)}</p>
            {stage.value ? (
              <p className="mt-0.5 text-2xs text-muted">{formatMoney(stage.value, { compact: true })}</p>
            ) : null}
          </button>
        ))}
      </div>

      {truncated ? (
        <p className="mb-4 flex items-start gap-2 rounded border border-warning/30 bg-warning/[0.06] px-3 py-2 text-[13px] text-fg">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            The board shows the newest {items.length} of {total} leads. The counts above describe what is on the board —
            pick a stage to focus it, or open the{' '}
            <Link to="/app/leads" className="text-brand hover:underline">
              full lead list
            </Link>{' '}
            for the rest.
          </span>
        </p>
      ) : null}

      {/* Focus control: on a busy board the columns are the filter, so this
          stays a plain labelled select rather than the list toolbar (which
          would add a search box the board has nothing to search). */}
      <div className="mb-4 max-w-[190px]">
        <Select
          label="Focus a stage"
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
          options={[
            { value: '', label: 'All stages' },
            ...STAGES.map((stage) => ({ value: stage, label: titleCase(stage) })),
          ]}
          containerClassName="gap-1"
        />
      </div>

      <AsyncBoundary
        loading={leads.loading}
        error={leads.error}
        data={leads.data}
        onRetry={() => leads.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="nf-scroll-x pb-3">
            <div className={cn('flex gap-3', !stageFilter && 'min-w-[1100px]')}>
              {visibleStages.map((stage) => {
                const column = items.filter((lead) => lead.status === stage);
                return (
                  <div key={stage} className="flex w-[280px] shrink-0 flex-col rounded-lg border border-line bg-sunken/30">
                    <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                      <span className="text-2xs font-medium uppercase tracking-wider text-muted">{titleCase(stage)}</span>
                      <span className="nf-num text-2xs text-faint">{column.length}</span>
                    </header>
                    <ul className="flex-1 space-y-2 p-2.5">
                      {column.map((lead) => (
                        <li
                          key={lead.id}
                          className={cn(
                            'rounded border border-line border-l-2 bg-surface p-3 transition-colors hover:border-brand/40',
                            TONES[stage] ?? 'border-l-line',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => navigate(`/app/leads/${lead.id}`)}
                            className="w-full text-left"
                          >
                            <p className="truncate text-[13px] font-medium text-fg">{lead.contactName}</p>
                            {lead.businessName ? (
                              <p className="truncate text-2xs text-muted">{lead.businessName}</p>
                            ) : null}
                          </button>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="nf-num text-xs text-faint">Score {lead.score}</span>
                            {lead.value ? <span className="text-2xs text-muted">{formatMoney(lead.value, { compact: true })}</span> : null}
                          </div>
                          {lead.nextAction ? (
                            <p className="mt-2 border-t border-line pt-2 text-2xs leading-relaxed text-muted">{lead.nextAction}</p>
                          ) : null}
                          <p className="mt-1.5 text-2xs text-faint">{formatRelative(lead.createdAt)}</p>

                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {STAGES.filter((option) => option !== stage).map((option) => (
                              <button
                                key={option}
                                type="button"
                                disabled={moving === lead.id}
                                aria-label={`Move ${lead.contactName} to ${titleCase(option)}`}
                                onClick={() => void move(lead.id, option)}
                                className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted transition-colors hover:border-brand/40 hover:text-fg disabled:opacity-50"
                              >
                                {moving === lead.id ? '…' : titleCase(option)}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                      {!column.length ? <li className="rounded border border-dashed border-line p-4 text-center text-2xs text-faint">Empty</li> : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ) : stageFilter ? (
          <EmptyState
            title={`No leads in ${titleCase(stageFilter)}`}
            description="Clear the focus to see the whole board, or move a lead into this stage."
          />
        ) : (
          <EmptyState
            title="No leads yet"
            description="Leads captured from websites, WhatsApp and manual entry land here."
          />
        )}
      </AsyncBoundary>

      <Panel className="mt-4" title="Reading the board">
        <p className="text-[13px] leading-relaxed text-muted">
          Score is a completeness signal — how much of the qualifying detail a lead actually gave us (contact details, a
          real message, a stated value). It is not an AI verdict and not a prediction. Treat it as a nudge on where to
          look next: a low score with a clear requirement is often worth more than a high score that never replies.
        </p>
      </Panel>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {items.filter((lead) => lead.isDemo).length ? (
          <Badge tone="neutral">{items.filter((lead) => lead.isDemo).length} demo leads</Badge>
        ) : null}
      </div>
    </div>
  );
}
