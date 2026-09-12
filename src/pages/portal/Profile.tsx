import { useState } from 'react';
import { Building2, Mail, Phone, User } from 'lucide-react';
import { Panel, Card } from '@/components/ui/Card';
import { Input, Textarea, Field, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useMutation } from '@/hooks/useAsync';
import { authService } from '@/services';
import { formatDateTime } from '@/lib/format';

export default function Profile() {
  usePageMeta({ title: 'Business profile', noIndex: true });
  const { session, refresh } = useAuth();
  const toast = useToast();
  const client = session?.client ?? null;

  const [form, setForm] = useState({
    name: session?.user.name ?? '',
    phone: client?.phone ?? '',
    businessName: client?.businessName ?? '',
    businessType: client?.businessType ?? '',
    notes: client?.notes ?? '',
  });

  const save = useMutation(
    async () => {
      await authService.updateProfile({ name: form.name, phone: form.phone });
      const result = await authService.updateBusiness({
        businessName: form.businessName,
        businessType: form.businessType,
        notes: form.notes,
      });
      return result;
    },
    {
      onSuccess: async () => {
        await refresh();
        toast.success('Profile updated');
      },
    },
  );

  return (
    <div>
      <PortalHeader
        title="Business profile"
        description="How your business appears to the NorthForge team and in your portal."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <Card padded={false} className="p-6">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await save.mutate().catch(() => undefined);
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Your name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                iconLeft={<User className="h-4 w-4" />}
              />
              <Input
                label="WhatsApp / phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                iconLeft={<Phone className="h-4 w-4" />}
              />
              <Input
                label="Business name"
                value={form.businessName}
                onChange={(event) => setForm({ ...form, businessName: event.target.value })}
                iconLeft={<Building2 className="h-4 w-4" />}
              />
              <Input
                label="Business type"
                value={form.businessType}
                onChange={(event) => setForm({ ...form, businessType: event.target.value })}
                placeholder="e.g. Dental clinic"
              />
            </div>

            <Textarea
              label="Anything we should know"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={3}
              hint="Opening hours, seasonal peaks, the things customers ask most."
            />

            <Field label="Account email">
              <div className="flex items-center gap-2.5 rounded border border-line bg-sunken/40 px-3 py-2.5 text-[13px] text-muted">
                <Mail className="h-4 w-4 text-faint" aria-hidden />
                {session?.user.email}
                <span className="ml-auto text-2xs text-faint">Contact us to change this</span>
              </div>
            </Field>

            <FormError message={save.error} />

            <div className="flex items-center gap-3 border-t border-line pt-4">
              <Button type="submit" loading={save.pending}>
                Save changes
              </Button>
              {save.success ? <span className="text-[13px] text-success">Saved.</span> : null}
            </div>
          </form>
        </Card>

        <Panel title="Account details">
          <MetricRow label="Account type" value={session?.user.role === 'client' ? 'Client' : session?.user.role} />
          <MetricRow label="Client ID" value={<span className="font-mono text-xs">{client?.id ?? '—'}</span>} />
          <MetricRow label="Status" value={client?.status ?? '—'} tone={client?.status === 'active' ? 'success' : undefined} />
          <MetricRow label="Onboarded" value={formatDateTime(client?.createdAt)} />
          <p className="mt-4 text-xs leading-relaxed text-faint">
            Need the email on the account changed, or an extra person added? Raise a request and we will sort it.
          </p>
        </Panel>
      </div>
    </div>
  );
}
