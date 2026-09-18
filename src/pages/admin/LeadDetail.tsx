import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Sparkles, Trash2 } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AsyncBoundary, EmptyState, NotFoundState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Button, LinkButton } from '@/components/ui/Button';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useToast } from '@/app/providers/ToastProvider';
import { leadsService } from '@/services';
import { formatDateTime, formatMoney, titleCase } from '@/lib/format';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';

/** Lead detail (spec §113): the full record plus AI qualification and follow-ups. */
export default function LeadDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  usePageMeta({ title: 'Lead', noIndex: true });

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const state = useAsync(() => leadsService.get(id), [id]);
  const lead = state.data?.lead ?? null;

  const remove = useMutation(() => leadsService.remove(id), {
    onSuccess: () => {
      toast.success('Lead deleted');
      navigate('/app/leads');
    },
  });

  const qualify = useMutation(() => leadsService.qualify(id), {
    onSuccess: async () => {
      toast.success('AI qualification complete');
      await state.refetch().catch(() => undefined);
    },
  });

  return (
    <div>
      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
      >
        {lead ? (
          <>
            <AdminHeader
              title={lead.contactName}
              description={lead.businessName ?? 'Individual enquiry'}
              crumbs={[{ label: 'Leads', to: '/app/leads' }, { label: lead.contactName }]}
              demo={lead.isDemo}
              action={
                <>
                  <Button variant="secondary" size="md" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  {lead.phone && normalizeWhatsAppNumber(lead.phone) ? (
                    <LinkButton
                      to={`/app/whatsapp?to=${normalizeWhatsAppNumber(lead.phone)}`}
                      variant="secondary"
                      size="md"
                      iconLeft={<MessageCircle className="h-3.5 w-3.5" />}
                    >
                      WhatsApp
                    </LinkButton>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="md"
                    iconLeft={<Sparkles className="h-3.5 w-3.5" />}
                    loading={qualify.pending}
                    onClick={() => void qualify.mutate().catch(() => undefined)}
                  >
                    Qualify with AI
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </Button>
                </>
              }
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <Panel title="Enquiry">
                  <p className="rounded border border-line bg-sunken/40 p-3 text-[13px] leading-relaxed text-fg">
                    {lead.message ?? 'No message recorded.'}
                  </p>
                  <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
                    <Field label="Email" value={lead.email} />
                    <Field label="Phone" value={lead.phone} />
                    <Field label="Source" value={titleCase(lead.source)} />
                    <Field label="Created" value={formatDateTime(lead.createdAt)} />
                  </div>
                </Panel>

                {lead.aiSummary ? (
                  <Panel title="AI assessment">
                    <div className="rounded-lg border border-brand-violet/25 bg-brand-violet/[0.06] p-4">
                      <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-brand-violet">
                        <Sparkles className="h-3 w-3" aria-hidden /> Summary
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-fg">{lead.aiSummary}</p>
                      {lead.aiQualification ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-muted">{lead.aiQualification}</p>
                      ) : null}
                    </div>
                  </Panel>
                ) : (
                  <Panel title="AI assessment">
                    <EmptyState
                      compact
                      title="Not qualified yet"
                      description="Run AI qualification to extract intent, score the enquiry and suggest the next action."
                      action={
                        <Button size="sm" iconLeft={<Sparkles className="h-3.5 w-3.5" />} loading={qualify.pending} onClick={() => void qualify.mutate().catch(() => undefined)}>
                          Qualify now
                        </Button>
                      }
                    />
                  </Panel>
                )}

                <Panel title="Follow-ups">
                  <FollowUps leadId={lead.id} onChanged={() => state.refetch().catch(() => undefined)} />
                </Panel>
              </div>

              <div className="space-y-4">
                <Panel title="Status">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Stage" value={<Badge tone={lead.status === 'won' ? 'success' : 'info'}>{titleCase(lead.status)}</Badge>} />
                    <Stat label="Score" value={<span className="nf-num text-[20px] font-semibold text-fg">{lead.score}</span>} />
                    <Stat label="Value" value={lead.value ? formatMoney(lead.value) : '—'} />
                    <Stat label="Intent" value={lead.intent ?? '—'} />
                  </div>
                </Panel>

                <Panel title="Move the lead on">
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      try {
                        await leadsService.update(lead.id, {
                          status: String(data.get('status')) as never,
                          nextAction: String(data.get('nextAction') ?? ''),
                        });
                        toast.success('Lead updated');
                        await state.refetch().catch(() => undefined);
                      } catch {
                        /* surfaced by the mutation fallback toast */
                      }
                    }}
                    className="space-y-3"
                  >
                    <Select
                      label="Status"
                      name="status"
                      defaultValue={lead.status}
                      options={['new', 'qualified', 'contacted', 'proposal', 'won', 'lost'].map((value) => ({
                        value,
                        label: titleCase(value),
                      }))}
                    />
                    <Input
                      label="Next action"
                      name="nextAction"
                      defaultValue={lead.nextAction ?? ''}
                      placeholder="What happens next, and when?"
                    />
                    <Button size="sm" type="submit">
                      Save
                    </Button>
                  </form>
                </Panel>

                {state.data?.client ? (
                  <Panel title="Assigned client">
                    <Link
                      to={`/app/clients/${state.data.client.id}`}
                      className="flex items-center justify-between gap-2 rounded border border-line bg-sunken/30 px-3 py-2.5 text-[13px] text-fg transition-colors hover:border-brand/40"
                    >
                      {state.data.client.businessName}
                      <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-faint" aria-hidden />
                    </Link>
                  </Panel>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <NotFoundState
            title="Lead not found"
            description="This lead may have been deleted, or it is not visible to your account."
            action={
              <Link to="/app/leads" className="nf-focus inline-flex h-9 items-center rounded-md border border-line px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-elevated">
                Back to leads
              </Link>
            }
          />
        )}
      </AsyncBoundary>

      {lead ? (
        <Modal open={editing} onClose={() => setEditing(false)} title="Edit lead">
          <EditLeadForm
            lead={lead}
            onDone={async () => {
              setEditing(false);
              await state.refetch().catch(() => undefined);
            }}
          />
        </Modal>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this lead?"
        description="This cannot be undone. The enquiry record and its follow-ups are removed."
        confirmLabel="Delete lead"
        destructive
        pending={remove.pending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove.mutate().catch(() => undefined)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-line bg-sunken/30 p-3">
      <p className="text-2xs uppercase tracking-wider text-faint">{label}</p>
      <div className="mt-1.5 text-[13px] text-fg">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-line py-2">
      <p className="text-2xs uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-0.5 text-[13px] text-fg">{value ?? '—'}</p>
    </div>
  );
}

function FollowUps({ leadId, onChanged }: { leadId: string; onChanged: () => void }) {
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const followUps = useAsync(() => leadsService.get(leadId), [leadId]);
  const add = useMutation(
    () => leadsService.addFollowUp(leadId, { title: title.trim(), dueAt: new Date(dueAt).toISOString() }),
    {
      onSuccess: () => {
        setTitle('');
        setDueAt('');
        onChanged();
        followUps.refetch().catch(() => undefined);
      },
    },
  );

  const items = followUps.data?.followUps ?? [];

  return (
    <div className="space-y-3">
      {items.length ? (
        <ul className="space-y-2">
          {items.map((followUp) => (
            <li key={followUp.id} className="flex items-center justify-between gap-3 rounded border border-line bg-sunken/30 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-fg">{followUp.title}</span>
                <span className="text-2xs text-faint">
                  {followUp.status === 'done' ? 'Done' : `Due ${formatDateTime(followUp.dueAt)}`}
                </span>
              </span>
              <Badge tone={followUp.status === 'done' ? 'success' : followUp.status === 'missed' ? 'danger' : 'warning'}>
                {titleCase(followUp.status)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">No follow-ups scheduled.</p>
      )}

      <form
        className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim() || !dueAt) return;
          await add.mutate().catch(() => undefined);
        }}
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Call back about pricing"
          aria-label="Follow-up title"
          containerClassName="gap-0"
        />
        <Input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          aria-label="Due date"
          containerClassName="gap-0"
        />
        <Button type="submit" size="md" loading={add.pending} disabled={!title.trim() || !dueAt}>
          Schedule
        </Button>
      </form>
    </div>
  );
}

function EditLeadForm({ lead, onDone }: { lead: import('@/types').Lead; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    contactName: lead.contactName,
    businessName: lead.businessName ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    value: lead.value ? String(lead.value / 100) : '',
    message: lead.message ?? '',
  });

  const mutation = useMutation(
    () =>
      leadsService.update(lead.id, {
        contactName: form.contactName,
        businessName: form.businessName || null,
        email: form.email || null,
        phone: form.phone || null,
        value: form.value ? Math.round(Number(form.value) * 100) : null,
        message: form.message || null,
      }),
    {
      onSuccess: () => {
        toast.success('Lead updated');
        onDone();
      },
    },
  );

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await mutation.mutate().catch(() => undefined);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Contact name" required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
        <Input label="Business name" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Input label="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      </div>
      <Input label="Estimated value (₹)" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
      <Textarea label="Message" rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      {mutation.error ? <p className="text-xs text-danger">{mutation.error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={mutation.pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
