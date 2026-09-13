import { useEffect, useState } from 'react';
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
import { useAsync, useMutation } from '@/hooks/useAsync';
import { authService, preferencesService } from '@/services';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import type { NotificationPreferences } from '@/types';

/** Categories the backend event engine reads from this table (spec §6). */
const CATEGORIES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'projectUpdates', label: 'Project updates', description: 'Progress, milestones and website status changes.' },
  { key: 'leads', label: 'Lead notifications', description: 'New enquiries captured for your business.' },
  { key: 'appointments', label: 'Appointment notifications', description: 'Bookings, confirmations and changes.' },
  { key: 'billing', label: 'Billing notifications', description: 'Invoices issued and payments recorded.' },
  { key: 'support', label: 'Support notifications', description: 'Replies and status changes on your tickets and requests.' },
  { key: 'marketing', label: 'Announcements & marketing', description: 'Product updates and NorthForge news.' },
  { key: 'system', label: 'System notifications', description: 'Account and security notices. Recommended.' },
];

/** Settings (spec §112): theme, notifications, security. */
export default function Settings() {
  usePageMeta({ title: 'Settings', noIndex: true });
  const { session, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const toast = useToast();

  // Notification preferences live in the database (migration 0004) and are
  // read by the backend event engine — not browser localStorage (spec §6).
  const prefs = useAsync(() => preferencesService.get(), []);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (prefs.data && !draft) setDraft(prefs.data);
  }, [prefs.data, draft]);

  const savePrefs = useMutation((next: NotificationPreferences) => preferencesService.save(next), {
    onSuccess: () => toast.success('Notification preferences saved'),
  });

  const toggle = (key: keyof NotificationPreferences) => {
    if (!draft) return;
    const next = { ...draft, [key]: !draft[key] };
    setDraft(next);
    savePrefs.mutate(next).catch(() => {
      setDraft(draft); // revert on failure
    });
  };

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
          {!draft ? (
            <p className="text-[13px] text-muted">
              {prefs.loading ? 'Loading your preferences…' : (prefs.error ?? 'Preferences are unavailable.')}
            </p>
          ) : (
            <div className="space-y-1">
              {CATEGORIES.map((category, index) => (
                <span key={category.key} className="block">
                  {index > 0 ? <div className="my-1 h-px bg-line" /> : null}
                  <Switch
                    checked={draft[category.key]}
                    onChange={() => toggle(category.key)}
                    label={category.label}
                    description={category.description}
                  />
                </span>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-faint">
            These switches control your in-portal notifications and are stored on your account.
            Account and security notices about your business cannot be fully disabled.
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
