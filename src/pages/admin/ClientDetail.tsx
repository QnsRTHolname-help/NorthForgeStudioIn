import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState, NotFoundState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { Button, LinkButton } from '@/components/ui/Button';
import { Timeline } from '@/components/ui/Data';
import { Progress } from '@/components/ui/Loader';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { clientsService } from '@/services';
import { formatDate, formatDateTime, formatMoney, formatRelative, titleCase } from '@/lib/format';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { ClientForm } from './Clients';

/**
 * Client account view (spec §113).
 * One place to see everything about a client: system, delivery, money,
 * requests and history.
 */
export default function ClientDetail() {
  const { id = '' } = useParams();
  usePageMeta({ title: 'Client', noIndex: true });
  const [editing, setEditing] = useState(false);
  const state = useAsync(() => clientsService.get(id), [id]);
  const detail = state.data;

  return (
    <div>
      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {detail ? (
          <>
            <AdminHeader
              title={detail.client.businessName}
              description={`${detail.client.contactName} · ${detail.client.email}`}
              crumbs={[{ label: 'Clients', to: '/app/clients' }, { label: detail.client.businessName }]}
              demo={detail.client.isDemo}
              action={
                <>
                  <Button variant="secondary" size="md" onClick={() => setEditing(true)}>
                    Edit client
                  </Button>
                  {detail.client.phone && normalizeWhatsAppNumber(detail.client.phone) ? (
                    <LinkButton
                      to={`/app/whatsapp?to=${normalizeWhatsAppNumber(detail.client.phone)}`}
                      variant="secondary"
                      size="md"
                      iconLeft={<MessageCircle className="h-3.5 w-3.5" />}
                    >
                      WhatsApp
                    </LinkButton>
                  ) : null}
                  {detail.website?.url ? (
                    <a
                      href={detail.website.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="nf-focus inline-flex h-9 items-center gap-2 rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-elevated"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Visit site
                    </a>
                  ) : null}
                </>
              }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Revenue collected" value={formatMoney(detail.revenue, { compact: true })} />
              <KpiCard label="Leads" value={detail.leads.length} hint={`${detail.leads.filter((lead) => lead.status === 'new').length} new`} />
              <KpiCard label="Open requests" value={detail.requests.filter((request) => request.status === 'open' || request.status === 'in_progress').length} />
              <KpiCard label="Status" value={<StatusIndicator status={detail.client.status} tone={detail.client.status === 'active' ? 'success' : 'warning'} />} />
            </div>

            <div className="mt-5">
              <Tabs
                items={[
                  {
                    id: 'system',
                    label: 'System',
                    content: (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <Panel title="Website">
                          {detail.website ? (
                            <div className="space-y-2.5">
                              <Row label="Domain" value={detail.website.domain ?? '—'} />
                              <Row label="Status" value={titleCase(detail.website.status)} />
                              <Row label="Deployment" value={titleCase(detail.website.deployment)} />
                              <Row label="SSL" value={detail.website.ssl ? 'Active' : 'Disabled'} />
                              <Row label="Last deploy" value={formatDateTime(detail.website.lastDeployedAt)} />
                              <Link
                                to={`/app/websites/${detail.website.id}`}
                                className="mt-2 inline-block text-[13px] text-brand hover:underline"
                              >
                                Open website record →
                              </Link>
                            </div>
                          ) : (
                            <EmptyState compact title="No website yet" description="Create one under Websites." />
                          )}
                        </Panel>

                        <Panel title="Subscription">
                          {detail.subscription ? (
                            <div className="space-y-2.5">
                              <Row label="Status" value={titleCase(detail.subscription.status)} />
                              <Row label="Started" value={formatDate(detail.subscription.startedAt)} />
                              <Row label="Renews" value={formatDate(detail.subscription.renewsAt)} />
                              <Row label="Seats" value={String(detail.subscription.seats)} />
                            </div>
                          ) : (
                            <EmptyState compact title="No subscription" description="Billing has not been set up yet." />
                          )}
                        </Panel>

                        <Panel title="Onboarding">
                          <div className="mb-3">
                            <Progress value={detail.client.onboardingCompleted ? 100 : detail.client.onboardingStep * 20} tone="brand" />
                          </div>
                          <Row
                            label="Progress"
                            value={detail.client.onboardingCompleted ? 'Complete' : `Step ${detail.client.onboardingStep} of 5`}
                          />
                          <Link to="/app/onboarding" className="mt-3 inline-block text-[13px] text-brand hover:underline">
                            Open onboarding board →
                          </Link>
                        </Panel>

                        <Panel title="Account">
                          <Row label="Business type" value={detail.client.businessType ?? '—'} />
                          <Row label="Location" value={[detail.client.city, detail.client.state].filter(Boolean).join(', ') || '—'} />
                          <Row label="Phone" value={detail.client.phone ?? '—'} />
                          <Row label="Client since" value={formatDate(detail.client.createdAt)} />
                          {detail.client.notes ? (
                            <p className="mt-3 rounded border border-line bg-sunken/40 p-2.5 text-[13px] leading-relaxed text-muted">
                              {detail.client.notes}
                            </p>
                          ) : null}
                        </Panel>
                      </div>
                    ),
                  },
                  {
                    id: 'delivery',
                    label: 'Delivery',
                    content: (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <Panel title="Project">
                          {detail.project ? (
                            <div className="space-y-3">
                              <div>
                                <div className="mb-1.5 flex items-baseline justify-between">
                                  <span className="text-[13px] text-muted">{detail.project.name}</span>
                                  <span className="nf-num text-[13px] font-semibold text-fg">{detail.project.progress}%</span>
                                </div>
                                <Progress value={detail.project.progress} tone="brand" />
                              </div>
                              <Row label="Stage" value={titleCase(detail.project.stage)} />
                              <Row label="Status" value={titleCase(detail.project.status)} />
                              <Row label="Due" value={formatDate(detail.project.dueDate)} />
                            </div>
                          ) : (
                            <EmptyState compact title="No project" description="Create one under Projects." />
                          )}
                        </Panel>

                        <Panel title="Tasks">
                          {detail.tasks.length ? (
                            <ul className="space-y-2">
                              {detail.tasks.slice(0, 8).map((task) => (
                                <li key={task.id} className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 px-3 py-2">
                                  <span className="min-w-0 truncate text-[13px] text-fg">{task.title}</span>
                                  <Badge tone={task.status === 'done' ? 'success' : 'neutral'}>{titleCase(task.status)}</Badge>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <EmptyState compact title="No tasks" description="Nothing assigned to this client yet." />
                          )}
                        </Panel>
                      </div>
                    ),
                  },
                  {
                    id: 'money',
                    label: 'Billing',
                    content: (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <Panel title="Invoices">
                          {detail.invoices.length ? (
                            <ul className="space-y-2">
                              {detail.invoices.map((invoice) => (
                                <li key={invoice.id} className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 px-3 py-2">
                                  <span className="min-w-0">
                                    <span className="block truncate font-mono text-[13px] text-fg">{invoice.number}</span>
                                    <span className="text-2xs text-faint">{formatDate(invoice.issuedAt)}</span>
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <Badge tone={invoice.status === 'paid' ? 'success' : 'warning'}>{titleCase(invoice.status)}</Badge>
                                    <span className="nf-num text-[13px] text-fg">{formatMoney(invoice.total)}</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <EmptyState compact title="No invoices" description="Generate one under Invoices." />
                          )}
                        </Panel>
                      </div>
                    ),
                  },
                  {
                    id: 'requests',
                    label: 'Requests',
                    content: (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <Panel title="Client requests">
                          {detail.requests.length ? (
                            <ul className="space-y-2">
                              {detail.requests.map((request) => (
                                <li key={request.id} className="rounded border border-line bg-sunken/30 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[13px] font-medium text-fg">{request.title}</p>
                                    <Badge tone={request.status === 'resolved' ? 'success' : 'info'}>{titleCase(request.status)}</Badge>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-2xs text-muted">{request.description}</p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <EmptyState compact title="No requests" description="This client has not raised anything." />
                          )}
                        </Panel>

                        <Panel title="Bookings">
                          {detail.bookings.length ? (
                            <ul className="space-y-2">
                              {detail.bookings.slice(0, 8).map((booking) => (
                                <li key={booking.id} className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 px-3 py-2">
                                  <span className="min-w-0 truncate text-[13px] text-fg">{booking.customerName}</span>
                                  <span className="shrink-0 text-2xs text-faint">{formatDateTime(booking.startsAt)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <EmptyState compact title="No bookings" description="No appointments recorded." />
                          )}
                        </Panel>
                      </div>
                    ),
                  },
                  {
                    id: 'activity',
                    label: 'Activity',
                    content: (
                      <div className="mt-4">
                        <Panel title="Recent activity">
                          {detail.activity.length ? (
                            <Timeline
                              items={detail.activity.slice(0, 20).map((entry) => ({
                                id: entry.id,
                                label: entry.label,
                                detail: entry.detail ?? undefined,
                                meta: `${entry.actor} · ${formatRelative(entry.createdAt)}`,
                                state: 'done' as const,
                              }))}
                            />
                          ) : (
                            <EmptyState compact title="No activity" description="Nothing recorded for this client yet." />
                          )}
                        </Panel>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </>
        ) : (
          <NotFoundState
            title="Client not found"
            description="This account may have been removed, or it is not visible to you."
            action={
              <Link to="/app/clients" className="nf-focus inline-flex h-9 items-center rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-elevated">
                Back to clients
              </Link>
            }
          />
        )}
      </AsyncBoundary>

      {detail ? (
        <Modal open={editing} onClose={() => setEditing(false)} title="Edit client">
          <ClientForm
            client={detail.client}
            onDone={async () => {
              setEditing(false);
              await state.refetch().catch(() => undefined);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
