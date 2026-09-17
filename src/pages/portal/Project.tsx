import { useState } from 'react';
import { Check } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { Timeline } from '@/components/ui/Data';
import { Progress } from '@/components/ui/Loader';
import { Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { projectsService, milestonesService } from '@/services';
import { formatDate } from '@/lib/format';
import type { Milestone } from '@/types';

const STAGES = ['discovery', 'design', 'development', 'review', 'launch', 'maintenance'];

const MILESTONE_STATE: Record<Milestone['status'], 'done' | 'current' | 'upcoming'> = {
  completed: 'done',
  in_progress: 'current',
  planning: 'upcoming',
};

/** Project progress (spec §112): clear, honest, with a feedback channel. */
export default function Project() {
  usePageMeta({ title: 'My project', noIndex: true });
  const toast = useToast();
  const state = useAsync(() => projectsService.list(), []);
  const project = state.data?.items?.[0] ?? null;
  const milestones = useAsync(
    () => (project ? milestonesService.listByProject(project.id) : Promise.resolve({ items: [] })),
    [project?.id],
    { enabled: !!project },
  );

  const [feedback, setFeedback] = useState('');
  const send = useMutation(
    async () => {
      if (!project) throw new Error('No project');
      return projectsService.update(project.id, { feedback: feedback.trim() });
    },
    {
      onSuccess: () => {
        setFeedback('');
        toast.success('Feedback sent', 'The team will see it on this project.');
        state.refetch().catch(() => undefined);
      },
    },
  );

  const currentStageIndex = project ? STAGES.indexOf(project.stage) : -1;

  return (
    <div>
      <PortalHeader
        title="My project"
        description="Where the build is, what has been delivered, and what happens next."
        demo={project?.isDemo}
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        isEmpty={(payload) => !payload.items?.length}
        onRetry={() => state.refetch().catch(() => undefined)}
        empty={
          <EmptyState
            title="No project yet"
            description="Once your engagement starts, the project plan, milestones and progress will appear here."
          />
        }
      >
        {project ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div className="space-y-4">
              <Panel title={project.name} description={`Stage: ${project.stage}`}>
                <div className="mb-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] text-muted">Overall progress</span>
                    <span className="nf-num text-[15px] font-semibold text-fg">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} tone="brand" />
                </div>

                <Timeline
                  items={STAGES.map((stage, index) => ({
                    id: stage,
                    label: stage,
                    detail:
                      index < currentStageIndex
                        ? 'Completed'
                        : index === currentStageIndex
                          ? 'In progress'
                          : 'Not started',
                    state: index < currentStageIndex ? 'done' : index === currentStageIndex ? 'current' : 'upcoming',
                  }))}
                />
              </Panel>

              {milestones.data?.items.length ? (
                <Panel title="Milestones">
                  <Timeline
                    items={milestones.data.items.map((milestone) => ({
                      id: milestone.id,
                      label: milestone.title,
                      detail: [
                        milestone.status === 'completed' && milestone.completedAt
                          ? `Completed ${formatDate(milestone.completedAt)}`
                          : milestone.dueDate
                            ? `Due ${formatDate(milestone.dueDate)}`
                            : undefined,
                        milestone.description ?? undefined,
                      ]
                        .filter(Boolean)
                        .join(' · '),
                      state: MILESTONE_STATE[milestone.status],
                    }))}
                  />
                </Panel>
              ) : null}

              {project.notes ? (
                <Panel title="Notes from the team">
                  <p className="text-[13px] leading-relaxed text-muted">{project.notes}</p>
                </Panel>
              ) : null}
            </div>

            <div className="space-y-4">
              <Panel title="Timeline">
                <MetricRow label="Started" value={formatDate(project.startDate)} />
                <MetricRow
                  label="Target completion"
                  value={formatDate(project.dueDate)}
                  tone={project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'completed' ? 'warning' : undefined}
                />
                <MetricRow label="Status" value={<StatusIndicator status={project.status} tone={project.status === 'completed' ? 'success' : 'info'} />} />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="info">{project.stage}</Badge>
                  {project.progress >= 100 ? (
                    <Badge tone="success" dot>
                      <Check className="h-3 w-3" aria-hidden /> Delivered
                    </Badge>
                  ) : null}
                </div>
              </Panel>

              <Panel title="Send feedback" description="Questions, changes, or a thumbs up.">
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!feedback.trim()) return;
                    await send.mutate().catch(() => undefined);
                  }}
                  className="space-y-3"
                >
                  <Textarea
                    rows={4}
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Anything you would like us to know about the project…"
                    aria-label="Project feedback"
                  />
                  <Button type="submit" loading={send.pending} disabled={!feedback.trim()}>
                    Send to the team
                  </Button>
                  {send.error ? <p className="text-xs text-danger">{send.error}</p> : null}
                </form>
              </Panel>
            </div>
          </div>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
