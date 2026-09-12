import { Panel, KpiCard } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge, StatusIndicator } from '@/components/ui/Badge';
import { PortalHeader, MetricRow, Explain } from '@/components/portal/PortalHeader';
import { Timeline } from '@/components/ui/Data';
import { useAsync } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { whatsappService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';
import { PLANS } from '@shared/catalog';

/**
 * WhatsApp (spec §112).
 *
 * Click-to-chat is on every site. Automation, analytics and AI on WhatsApp
 * are Growth / Pro features; this page says so plainly instead of pretending
 * everything is unlocked.
 */
export default function WhatsApp() {
  usePageMeta({ title: 'WhatsApp', noIndex: true });

  const status = useAsync(() => whatsappService.status(), []);
  const messages = useAsync(() => whatsappService.messages(), []);
  const templates = useAsync(() => whatsappService.templates(), []);

  const data = status.data;
  const items = messages.data?.items ?? [];

  const growthPlan = PLANS.find((plan) => plan.slug === 'convert');

  return (
    <div>
      <PortalHeader
        title="WhatsApp"
        description="How your business talks to customers on the app they actually use."
      />

      <AsyncBoundary
        loading={status.loading}
        error={status.error}
        data={status.data}
        onRetry={() => status.refetch().catch(() => undefined)}
      >
        {data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="WhatsApp number"
                value={data.connected ? data.businessNumber ?? 'Connected' : 'Not connected'}
                hint={data.connected ? 'Click-to-chat is live on your site' : 'Contact us to connect your number'}
              />
              <KpiCard label="Automation" value={data.mode === 'cloud_api' ? 'Enabled' : 'Click-to-chat only'} hint="Automated replies and follow-ups" />
              <KpiCard label="Messages recorded" value={data.stats.sent + data.stats.inbound} hint="Inbound and outbound" />
              <KpiCard label="Templates" value={data.stats.templates} hint="Approved message templates" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <Panel title="Message history" description="Everything sent or received through the system.">
                {items.length ? (
                  <Timeline
                    items={items.slice(0, 12).map((message) => ({
                      id: message.id,
                      label:
                        message.direction === 'outbound'
                          ? `To ${message.to}`
                          : `From ${message.to}`,
                      detail: message.body,
                      meta: (
                        <span className="flex items-center gap-2">
                          <Badge tone={message.status === 'failed' ? 'danger' : message.status === 'read' ? 'success' : 'neutral'}>
                            {titleCase(message.status)}
                          </Badge>
                          {message.automated ? <Badge tone="info">Automated</Badge> : null}
                          <span className="text-xs text-faint">{formatDateTime(message.createdAt)}</span>
                        </span>
                      ),
                      state: 'done' as const,
                    }))}
                  />
                ) : (
                  <EmptyState
                    compact
                    title="No messages recorded yet"
                    description="Once WhatsApp is connected, every automated reply and enquiry shows up here."
                  />
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Connection">
                  <MetricRow
                    label="Status"
                    value={
                      <StatusIndicator
                        status={data.connected ? 'connected' : 'not connected'}
                        tone={data.connected ? 'success' : 'neutral'}
                      />
                    }
                  />
                  <MetricRow label="Mode" value={data.mode === 'cloud_api' ? 'Cloud API' : 'Click to chat'} />
                  <MetricRow label="Click-to-chat on website" value={data.connected ? 'Enabled' : 'Enable after connecting'} />
                  <MetricRow label="Automated replies" value={data.stats.automated > 0 ? `${data.stats.automated} sent` : 'None yet'} />
                </Panel>

                <Panel title="Approved templates">
                  {(templates.data?.items ?? []).length ? (
                    <ul className="space-y-2.5">
                      {templates.data!.items.map((template) => (
                        <li key={template.id} className="rounded border border-line bg-sunken/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-fg">{template.name}</span>
                            <Badge tone={template.status === 'approved' ? 'success' : 'warning'}>{titleCase(template.status)}</Badge>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{template.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact title="No templates yet" description="Templates are written with you during setup." />
                  )}
                </Panel>

                <Explain title="Want WhatsApp automation?">
                  Automated acknowledgements, follow-ups and reminders are part of{' '}
                  <span className="font-medium text-fg">Growth</span> and above
                  {growthPlan ? ` — ₹${(growthPlan.amount! / 100).toLocaleString('en-IN')} every ${growthPlan.intervalDays} days` : ''}. Raise a
                  request and we will switch it on.
                </Explain>
              </div>
            </div>
          </div>
        ) : null}
      </AsyncBoundary>
    </div>
  );
}
