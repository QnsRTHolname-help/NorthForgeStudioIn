import { useState } from 'react';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { Panel, Card } from '@/components/ui/Card';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { PasswordInput, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Form';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useMutation } from '@/hooks/useAsync';
import { useLocalStorage } from '@/hooks';
import { authService } from '@/services';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

/** Settings (spec §112): theme, notifications, security. */
export default function Settings() {
  usePageMeta({ title: 'Settings', noIndex: true });
  const { session, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const toast = useToast();

  const [emailNotifications, setEmailNotifications] = useLocalStorage('nf-portal-notify-email', true);
  const [whatsappNotifications, setWhatsappNotifications] = useLocalStorage('nf-portal-notify-whatsapp', true);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);

  const change = useMutation(() => authService.changePassword(passwords.current, passwords.next), {
    onSuccess: () => {
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password updated');
    },
  });

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwords.next.length < 8) return setError('Use at least 8 characters.');
    if (passwords.next !== passwords.confirm) return setError('New passwords do not match.');
    setError(null);
    await change.mutate().catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <PortalHeader title="Settings" description="How NorthForge looks, how it reaches you, and your security." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Appearance">
          <p className="text-[13px] text-muted">Choose how the portal looks on this device.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreference(option.value as 'light' | 'dark' | 'system')}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-[13px] transition-colors',
                  preference === option.value
                    ? 'border-brand bg-brand/[0.06] text-fg'
                    : 'border-line text-muted hover:border-line-strong hover:text-fg',
                )}
                aria-pressed={preference === option.value}
              >
                <option.icon className="h-4 w-4" aria-hidden />
                {option.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Notifications">
          <div className="space-y-1">
            <Switch
              checked={emailNotifications}
              onChange={setEmailNotifications}
              label="Email me about new enquiries"
              description="A short summary when someone contacts your business."
            />
            <div className="my-1 h-px bg-line" />
            <Switch
              checked={whatsappNotifications}
              onChange={setWhatsappNotifications}
              label="WhatsApp me about new enquiries"
              description="Fastest way to hear about an enquiry while you are out."
            />
          </div>
          <p className="mt-4 text-xs text-faint">
            Reminders about bookings and renewals are sent automatically and are not affected by these switches.
          </p>
        </Panel>
      </div>

      <Card padded={false} className="p-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-fg">Change password</h2>
        <form onSubmit={submitPassword} className="mt-4 grid max-w-md gap-4">
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={passwords.current}
            onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
          />
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={passwords.next}
            onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
            hint="At least 8 characters."
          />
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            value={passwords.confirm}
            onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
          />
          <FormError message={error ?? change.error} />
          <div>
            <Button type="submit" loading={change.pending} disabled={!passwords.current || !passwords.next}>
              Update password
            </Button>
          </div>
        </form>
      </Card>

      <Panel title="Session">
        <MetricRow label="Signed in as" value={session?.user.email ?? '—'} />
        <MetricRow label="Role" value={session?.user.role ?? '—'} />
        <MetricRow label="Business" value={session?.client?.businessName ?? '—'} />
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<LogOut className="h-3.5 w-3.5" />}
            onClick={() => {
              void logout();
            }}
          >
            Sign out
          </Button>
        </div>
        <p className="mt-3 text-xs text-faint">Last updated {formatDateTime(new Date().toISOString())}</p>
      </Panel>
    </div>
  );
}
