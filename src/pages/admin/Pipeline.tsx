import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { leadsService } from '@/services';
import { formatMoney, formatRelative, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const STAGES = ['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'];

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
  const [moving, setMoving] = useState<string | null>(null);

  const counts = useAsync(() => leadsService.pipeline(), []);
  const leads = useAsync(() => leadsService.list({ pageSize: 200 }), []);
  const pipeline = counts.data?.pipeline ?? [];
  const items = leads.data?.items ?? [];

  const move = async (id: string, status: string) => {
    setMoving(id);
    try {
      await leadsService.update(id, { status: status as never });
      await Promise.all([leads.refetch().catch(() => undefined), counts.refetch().catch(() => undefined)]);
    } finally {
      setMoving(null);
    }
  };

  return (
    <div>
      <AdminHeader
        title="Pipeline"
        description="Every lead by stage. Move a lead from its card — the change saves immediately."
        crumbs={[{ label: 'Pipeline' }]}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        {pipeline.map((stage) => (
          <div key={stage.status} className="rounded-lg border border-line bg-surface px-4 py-3">
            <p className="nf-num text-[20px] font-semibold text-fg">{stage.count}</p>
            <p className="text-2xs uppercase tracking-wider text-faint">{titleCase(stage.status)}</p>
            {stage.value ? (
              <p className="mt-0.5 text-2xs text-muted">{formatMoney(stage.value, { compact: true })}</p>
            ) : null}
          </div>
        ))}
      </div>

      <AsyncBoundary
        loading={leads.loading}
        error={leads.error}
        data={leads.data}
        onRetry={() => leads.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="nf-scroll-x pb-3">
            <div className="flex min-w-[1100px] gap-3">
              {STAGES.map((stage) => {
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
        ) : (
          <EmptyState
            title="No leads yet"
            description="Leads captured from websites, WhatsApp and manual entry land here."
          />
        )}
      </AsyncBoundary>

      <Panel className="mt-4" title="Reading the board">
        <p className="text-[13px] leading-relaxed text-muted">
          Score is the AI's assessment of how ready a lead is. It is a prompt for prioritisation, not a verdict — a low
          score with a clear requirement is often worth more than a high score that never replies.
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
