import { useState } from 'react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Progress } from '@/components/ui/Loader';
import { Drawer } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select } from '@/components/ui/Form';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { insightsService, websitesService } from '@/services';
import { cn } from '@/lib/cn';
import type { Website } from '@/types';

const SEVERITY_TONE = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
} as const;

/** SEO (spec §113): real checks per site, with recommendations — and the actions that fix them. */
export default function Seo() {
  usePageMeta({ title: 'SEO', noIndex: true });
  const toast = useToast();
  const [fixing, setFixing] = useState<Website | null>(null);
  const state = useAsync(() => insightsService.seo(), []);
  const sites = state.data?.sites ?? [];

  const updateSite = useMutation(
    (input: { id: string; domain?: string | null; ssl?: boolean; status?: string }) =>
      websitesService.update(input.id, {
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.ssl !== undefined ? { ssl: input.ssl } : {}),
        ...(input.status !== undefined ? { status: input.status as Website['status'] } : {}),
      }),
    {
      onSuccess: async () => {
        toast.success('Website updated — recheck scores below');
        setFixing(null);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const average = sites.length ? Math.round(sites.reduce((sum, site) => sum + site.score, 0) / sites.length) : null;
  const issues = sites.reduce((sum, site) => sum + site.issues.length, 0);

  return (
    <div>
      <AdminHeader
        title="SEO"
        description="Technical SEO checks across every site we run, with what to fix first."
        crumbs={[{ label: 'SEO' }]}
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
        isEmpty={(payload) => !payload.sites.length}
        empty={<EmptyState title="No sites to check" description="Add a website to run SEO checks against it." />}
      >
        {sites.length ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <KpiCard label="Sites checked" value={sites.length} />
              <KpiCard label="Average score" value={average === null ? '—' : `${average}/100`} />
              <KpiCard label="Open issues" value={issues} hint={issues > 0 ? 'Needs attention' : 'All clear'} />
            </div>

            <div className="space-y-4">
              {sites.map((site) => (
                <Panel
                  key={site.website.id}
                  title={site.website.name}
                  description={site.website.domain ?? undefined}
                  action={
                    <span className="flex items-center gap-2">
                      <Badge tone={site.indexed ? 'success' : 'warning'}>{site.indexed ? 'Indexed' : 'Not indexed'}</Badge>
                      <span className="nf-num text-[15px] font-semibold text-fg">{site.score}/100</span>
                      {site.issues.length ? (
                        <Button size="sm" variant="secondary" onClick={() => setFixing(site.website)}>
                          Fix issues
                        </Button>
                      ) : null}
                    </span>
                  }
                >
                  <div className="mb-4">
                    <Progress
                      value={site.score}
                      tone={site.score >= 80 ? 'success' : site.score >= 60 ? 'warning' : 'danger'}
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="nf-eyebrow mb-2">Issues</p>
                      {site.issues.length ? (
                        <ul className="space-y-2">
                          {site.issues.map((issue) => (
                            <li key={issue.issue} className="rounded border border-line bg-sunken/30 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[13px] font-medium text-fg">{issue.issue}</p>
                                <Badge tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Badge>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-muted">{issue.recommendation}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-muted">No issues detected in the last check.</p>
                      )}
                    </div>

                    <div>
                      <p className="nf-eyebrow mb-2">Keyword positions</p>
                      {site.rankings.length ? (
                        <ul className="space-y-2">
                          {site.rankings.map((ranking) => (
                            <li
                              key={ranking.keyword}
                              className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 px-3 py-2"
                            >
                              <span className="min-w-0 truncate text-[13px] text-fg">{ranking.keyword}</span>
                              <span
                                className={cn(
                                  'nf-num shrink-0 text-[13px] font-medium',
                                  ranking.position <= 3
                                    ? 'text-success'
                                    : ranking.position <= 10
                                      ? 'text-warning'
                                      : 'text-faint',
                                )}
                              >
                                #{ranking.position}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[13px] text-muted">No ranking data recorded yet.</p>
                      )}
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </>
        ) : null}
      </AsyncBoundary>

      <Panel className="mt-6" title="What these checks cover">
        <p className="text-[13px] leading-relaxed text-muted">
          Each site is checked for indexability, metadata, heading structure, HTTPS and mobile readiness. Scores are
          directional, not a promise of ranking — we report what is mechanically wrong and can be fixed.
        </p>
      </Panel>

      <Drawer open={!!fixing} onClose={() => setFixing(null)} title="Fix website issues" width="md">
        {fixing ? (
          <FixIssuesForm
            website={fixing}
            pending={updateSite.pending}
            error={updateSite.error}
            onClose={() => setFixing(null)}
            onSubmit={async (values) => {
              await updateSite.mutate({ id: fixing.id, ...values }).catch(() => undefined);
            }}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

/** Owns its form state so the SSL toggle reflects the site being fixed. */
function FixIssuesForm({
  website,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  website: Website;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { domain: string | null; ssl: boolean; status: string }) => Promise<void>;
}) {
  const [ssl, setSsl] = useState(website.ssl);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await onSubmit({
          domain: String(data.get('domain') ?? '').trim() || null,
          ssl,
          status: String(data.get('status') ?? website.status),
        });
      }}
      className="space-y-4"
    >
      <p className="text-[13px] text-muted">{website.name}</p>
      <Input
        label="Custom domain"
        name="domain"
        defaultValue={website.domain ?? ''}
        placeholder="client.example.com"
        hint="Clears the “No custom domain connected” issue. Leave blank to remove."
      />
      <Checkbox
        checked={ssl}
        onChange={setSsl}
        label="SSL / HTTPS enabled"
        description="Only tick once the certificate is actually live on the domain."
        id={`ssl-${website.id}`}
      />
      <Select
        label="Publication status"
        name="status"
        defaultValue={website.status}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'building', label: 'Building' },
          { value: 'review', label: 'In review' },
          { value: 'live', label: 'Live' },
          { value: 'paused', label: 'Paused' },
          { value: 'offline', label: 'Offline' },
        ]}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
