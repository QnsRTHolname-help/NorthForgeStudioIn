import { Link } from 'react-router-dom';
import { BellOff, Check } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { insightsService } from '@/services';
import { formatRelative, titleCase } from '@/lib/format';
import { cn } from '@/lib/cn';

const KIND_TONE: Record<string, string> = {
  lead: 'border-l-info',
  task: 'border-l-warning',
  billing: 'border-l-success',
  system: 'border-l-faint',
  request: 'border-l-brand',
  automation: 'border-l-brand-violet',
  message: 'border-l-warning',
};

/** Notifications (spec §113): the in-app feed behind the header bell. */
export default function Notifications() {
  usePageMeta({ title: 'Notifications', noIndex: true });
  const toast = useToast();
  const state = useAsync(() => insightsService.notifications(), []);
  const items = state.data?.items ?? [];

  const markRead = useMutation(
    (id?: string) => insightsService.markRead(id),
    {
      onSuccess: async () => {
        if (!items.some((item) => !item.read)) toast.success('All notifications marked as read');
        await state.refetch().catch(() => undefined);
      },
    },
  );

  return (
    <div>
      <AdminHeader
        title="Notifications"
        description="Everything the system has flagged for your account."
        crumbs={[{ label: 'Notifications' }]}
        action={
          items.some((item) => !item.read) ? (
            <Button variant="secondary" size="md" iconLeft={<Check className="h-3.5 w-3.5" />} onClick={() => void markRead.mutate().catch(() => undefined)}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <Panel bodyClassName="p-4">
            <ul className="space-y-2">
              {items.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    'rounded-lg border border-line border-l-2 p-3.5 transition-colors',
                    KIND_TONE[notification.kind] ?? 'border-l-line',
                    notification.read ? 'bg-surface' : 'bg-sunken/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn('text-[13px]', notification.read ? 'text-muted' : 'font-medium text-fg')}>
                        {notification.title}
                      </p>
                      {notification.body ? (
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{notification.body}</p>
                      ) : null}
                      <p className="mt-1.5 text-2xs uppercase tracking-wider text-faint">
                        {titleCase(notification.kind)} · {formatRelative(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!notification.read ? <Badge tone="info">New</Badge> : null}
                      {notification.href ? (
                        <Link to={notification.href} className="text-2xs text-brand hover:underline">
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState
            title="No notifications"
            description="Leads, tasks, billing events and system alerts will show up here."
            icon={<BellOff className="h-4 w-4" />}
          />
        )}
      </AsyncBoundary>
    </div>
  );
}
