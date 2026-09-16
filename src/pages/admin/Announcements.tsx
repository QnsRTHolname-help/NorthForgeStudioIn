import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Drawer } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { announcementsService, clientsService } from '@/services';
import { formatDateTime, titleCase } from '@/lib/format';

const PRIORITY_TONE = { normal: 'neutral', high: 'warning', critical: 'danger' } as const;

const AUDIENCES = [
  { value: 'all_clients', label: 'All clients' },
  { value: 'selected_clients', label: 'Selected clients' },
  { value: 'internal_admins', label: 'Internal admins only' },
];

/**
 * Announcements (spec §18). Publishing an announcement is a database event:
 * addressed clients are notified automatically by the backend trigger —
 * no frontend fan-out involved.
 */
export default function Announcements() {
  usePageMeta({ title: 'Announcements', noIndex: true });
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [audience, setAudience] = useState('all_clients');

  const state = useAsync(() => announcementsService.list(), []);
  const clients = useAsync(() => clientsService.list({ pageSize: 200 }), []);
  const items = state.data?.items ?? [];

  const create = useMutation(
    (input: {
      title: string;
      message: string;
      priority: string;
      audience: string;
      clientIds: string[];
      endsAt: string | null;
    }) =>
      announcementsService.create({
        title: input.title,
        message: input.message,
        priority: input.priority,
        audience: input.audience,
        clientIds: input.clientIds,
        endsAt: input.endsAt,
      }),
    {
      onSuccess: async () => {
        toast.success('Announcement published', 'Addressed clients have been notified.');
        setCreating(false);
        await state.refetch().catch(() => undefined);
      },
    },
  );

  const remove = useMutation((id: string) => announcementsService.remove(id), {
    onSuccess: async () => {
      toast.success('Announcement removed');
      await state.refetch().catch(() => undefined);
    },
  });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const audience = String(form.get('audience') ?? 'all_clients');
    const clientIds = form.getAll('clientIds').map(String);
    await create
      .mutate({
        title: String(form.get('title') ?? ''),
        message: String(form.get('message') ?? ''),
        priority: String(form.get('priority') ?? 'normal'),
        audience,
        clientIds: audience === 'selected_clients' ? clientIds : [],
        endsAt: String(form.get('endsAt') ?? '') || null,
      })
      .catch(() => undefined);
  };

  return (
    <div>
      <AdminHeader
        title="Announcements"
        description="Publish notices to all clients, selected clients, or internal admins."
        crumbs={[{ label: 'Announcements' }]}
        action={
          <Button size="md" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New announcement
          </Button>
        }
      />

      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {items.length ? (
          <div className="grid gap-3">
            {items.map((item) => (
              <Panel key={item.id} title={item.title}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={PRIORITY_TONE[item.priority]}>{titleCase(item.priority)}</Badge>
                  <Badge tone="info">{titleCase(item.audience)}</Badge>
                  <span className="text-2xs text-faint">
                    {formatDateTime(item.startsAt)}
                    {item.endsAt ? ` → ${formatDateTime(item.endsAt)}` : ''}
                  </span>
                  <span className="ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                      loading={remove.pending}
                      onClick={() => {
                        void remove.mutate(item.id).catch(() => undefined);
                      }}
                    >
                      Delete
                    </Button>
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{item.message}</p>
              </Panel>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No announcements"
            description="Maintenance windows, product updates and seasonal notices live here."
          />
        )}
      </AsyncBoundary>

      <Drawer open={creating} onClose={() => setCreating(false)} title="New announcement" width="md">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Title" name="title" required placeholder="e.g. Scheduled maintenance this weekend" />
          <Textarea
            label="Message"
            name="message"
            rows={5}
            required
            placeholder="What should clients know, and what (if anything) should they do?"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Priority"
              name="priority"
              defaultValue="normal"
              options={[
                { value: 'normal', label: 'Notice' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
            <Select
              label="Audience"
              name="audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              options={AUDIENCES}
            />
          </div>
          <Input label="Ends at (optional)" name="endsAt" type="datetime-local" />
          {audience === 'selected_clients' ? (
            <div>
              <p className="mb-2 text-[13px] font-medium text-fg">Selected clients</p>
              <div className="max-h-44 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                {(clients.data?.items ?? []).map((client) => (
                  <label
                    key={client.id}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-sunken/60"
                  >
                    <input type="checkbox" name="clientIds" value={client.id} className="h-3.5 w-3.5 accent-brand" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{client.businessName}</span>
                      <span className="block truncate text-xs text-faint">{client.contactName}</span>
                    </span>
                  </label>
                ))}
                {!clients.data?.items.length ? (
                  <p className="px-3 py-3 text-xs text-faint">No clients yet — publish to all clients instead.</p>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-faint">
                Only the ticked clients will see this announcement, and each is notified automatically.
              </p>
            </div>
          ) : null}
          {create.error ? <p className="text-xs text-danger">{create.error}</p> : null}
          <Button type="submit" loading={create.pending}>
            Publish announcement
          </Button>
        </form>
      </Drawer>
    </div>
  );
}

