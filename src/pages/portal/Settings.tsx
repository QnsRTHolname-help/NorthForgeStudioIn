import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Cookie as CookieIcon,
  Download,
  FileText,
  LogOut,
  Monitor,
  Moon,
  Receipt,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import { Panel, Card } from '@/components/ui/Card';
import { PortalHeader, MetricRow } from '@/components/portal/PortalHeader';
import { PasswordInput, Input, FormError, Switch } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { authService, dataExportService, mfaService, preferencesService } from '@/services';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { applyAnalyticsConsent, analyticsConfigured } from '@/lib/analytics';
import { hasConsent, readConsent, writeConsent } from '@/lib/consent';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { PASSWORD_POLICY, scorePassword } from '@shared/password';
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
  const { session, logout, isClient } = useAuth();
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
    if (passwords.next.length < PASSWORD_POLICY.minLength) {
      return setError(`Use at least ${PASSWORD_POLICY.minLength} characters.`);
    }
    const problem = scorePassword(passwords.next).issues[0]?.message;
    if (problem) return setError(problem);
    if (passwords.next !== passwords.confirm) return setError('New passwords do not match.');
    setError(null);
    await change.mutate().catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <PortalHeader title="Settings" description="How NorthForge looks, how it reaches you, and your security." />

      {/*
        Account settings are split across surfaces, so this screen names
        them rather than pretending one panel does everything (spec §56):
        profile and billing live on their own pages, subscription
        cancellation happens where the plan is described, and everything
        else is handled below.
      */}
      <nav aria-label="Account settings" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: '/portal/profile', label: 'Profile', detail: 'Name, business, contact details', icon: UserRound },
          { to: '/portal/subscription', label: 'Subscription', detail: 'Plan, renewal, cancel plan', icon: FileText },
          { to: '/portal/invoices', label: 'Billing', detail: 'Invoices and payments', icon: Receipt },
          { to: '/privacy', label: 'Privacy policy', detail: 'What we hold and why', icon: ShieldCheck },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="nf-focus flex items-start gap-3 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong"
          >
            <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-fg">{item.label}</span>
              <span className="mt-0.5 block text-xs text-faint">{item.detail}</span>
            </span>
          </Link>
        ))}
      </nav>

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
            Account and security notices about your business cannot be fully disabled. Switching
            “Announcements &amp; marketing” off is the marketing opt-out — it does not cancel your plan
            and does not close your account.
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
            hint={`At least ${PASSWORD_POLICY.minLength} characters.`}
          />
          <PasswordStrength password={passwords.next} />
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

      <TwoFactorPanel />

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

      {isClient ? <PrivacyAndData /> : null}
      {isClient ? <DangerZone /> : null}
    </div>
  );
}

/**
 * Privacy, data and communication controls (spec §22, §53, §54, §56).
 *
 * Three actions that are often wrongly bundled together, kept apart:
 *
 *   • Cookie preferences — optional analytics only; necessary storage is
 *     not optional and is explained rather than asked about.
 *   • Download my data — an export of what THIS account may already read.
 *   • Marketing opt-out — lives with the notification switches above.
 *
 * Closing the account is a separate, deliberate action in the danger zone.
 */
function PrivacyAndData() {
  const toast = useToast();
  const [consent, setConsent] = useState(() => readConsent());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAnalytics = (allowed: boolean) => {
    const next = writeConsent({
      analytics: allowed,
      marketing: hasConsent('marketing', consent),
      decidedAt: new Date().toISOString(),
    });
    applyAnalyticsConsent(next);
    setConsent(next);
    toast.success(allowed ? 'Analytics allowed' : 'Analytics turned off');
  };

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const payload = await dataExportService.collect();
      const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      if (payload.warnings.length) {
        toast.info('Export downloaded with notes', payload.warnings.join(' '));
      } else {
        toast.success('Export downloaded');
      }
    } catch (err) {
      setError((err as Error)?.message ?? 'We could not build your export. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Panel title="Privacy & data">
      <div className="space-y-1">
        <MetricRow
          label="Privacy policy"
          value={
            <Link to="/privacy" className="text-brand hover:underline">
              Read it
            </Link>
          }
        />
        <MetricRow
          label="Terms of service"
          value={
            <Link to="/terms" className="text-brand hover:underline">
              Read them
            </Link>
          }
        />
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <div className="flex items-start gap-3">
          <CookieIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg">Cookies &amp; analytics</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Signing in and your theme choice are strictly necessary and cannot be turned off.
              Analytics is optional{analyticsConfigured ? '' : ' — and is not configured on this deployment'}.
            </p>
          </div>
        </div>
        {analyticsConfigured ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={consent.analytics ? 'secondary' : 'primary'}
              onClick={() => setAnalytics(true)}
              disabled={consent.analytics}
            >
              {consent.analytics ? 'Analytics allowed' : 'Allow analytics'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAnalytics(false)}
              disabled={!consent.analytics}
            >
              Turn analytics off
            </Button>
            <span className="text-xs text-faint">
              {consent.decidedAt
                ? `Last set ${formatDateTime(consent.decidedAt)}`
                : 'No choice recorded yet — analytics is off.'}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-fg">Download my data</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              A JSON copy of your profile, business record, leads, projects, requests, bookings, files,
              subscription, invoices, payments and messages. It contains only what this account can already
              read — never another client's records or internal NorthForge notes.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Button size="sm" variant="secondary" loading={downloading} onClick={download}>
            Download my data
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>
    </Panel>
  );
}

/**
 * Self-service account deletion (spec §47 erasure right).
 *
 * Placed last on Settings, visually distinct, and gated by typing the
 * business name — an irreversible action never sits behind a single tap.
 * The deletion itself is enforced server-side by the 0009 RPC: the client
 * row (and every business record that cascades from it) and the auth user
 * are removed in one transaction. Admins never see this panel — privileged
 * accounts are off-boarded by a super admin.
 */
function DangerZone() {
  const toast = useToast();
  const { session, deleteAccount } = useAuth();
  const businessName = session?.client?.businessName ?? '';
  const [confirmText, setConfirmText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = useMutation(() => deleteAccount(), {
    onSuccess: () => {
      toast.info(
        'Account closed',
        'Data eligible for deletion has been removed. Some records may be retained where the law, security or accounting rules require it.',
      );
      // AuthProvider has already reset state; the router lands on the
      // public site via the unauthenticated redirect.
    },
  });

  return (
    <Panel title="Danger zone" className="border-danger/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-fg">Delete this account permanently</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            This action permanently closes your NorthForge account and may remove data that is
            eligible for deletion: your login, your business workspace and the records attached to it
            — leads, projects, requests, files and messages. Some records may need to be retained for
            legal, security, accounting or operational reasons, and backups can keep a copy for a
            limited period before they cycle out. It cannot be undone from your side.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Closing your account is not the same as cancelling your plan. If your subscription is
            still active,{' '}
            <Link to="/portal/subscription" className="text-brand hover:underline">
              cancel it first
            </Link>{' '}
            so billing stops cleanly.
          </p>
        </div>
      </div>

      {!confirming ? (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            className="border-danger/40 text-danger hover:border-danger hover:text-danger"
            onClick={() => setConfirming(true)}
          >
            Delete my account…
          </Button>
        </div>
      ) : (
        <div className="mt-4 max-w-md rounded-lg border border-danger/30 bg-danger/[0.04] p-4">
          <p className="text-[13px] text-fg">
            Type <span className="font-mono font-semibold">{businessName || 'DELETE'}</span> to confirm.
          </p>
          <Input
            className="mt-2"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={businessName || 'DELETE'}
            autoComplete="off"
            aria-label="Confirmation phrase"
          />
          {error ?? del.error ? (
            <p className="mt-2 text-xs text-danger">{error ?? del.error}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirming(false);
                setConfirmText('');
                setError(null);
              }}
            >
              Keep my account
            </Button>
            <Button
              size="sm"
              className="bg-danger text-white hover:bg-danger/90"
              loading={del.pending}
              disabled={confirmText.trim().toLowerCase() !== (businessName || 'DELETE').toLowerCase()}
              onClick={() => {
                setError(null);
                del.mutate().catch(() => undefined);
              }}
            >
              Delete forever
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/**
 * Two-factor authentication (TOTP via Supabase MFA).
 *
 * Enrolment: verify password → scan QR → confirm first code. Once a
 * verified factor exists, sign-ins require the 6-digit code AND admin
 * server surfaces reject first-factor sessions (AAL2-aware RLS, migration
 * 0008). Disabling requires typing the current password — not just a tap.
 */
export function TwoFactorPanel() {
  const toast = useToast();
  const status = useAsync(() => mfaService.status(), []);

  const [setup, setSetup] = useState<{ factorId: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const qrUri = useMemo(() => {
    if (!setup) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setup.uri)}`;
  }, [setup]);

  const confirm = useMutation(() => mfaService.confirmEnroll(setup!.factorId, code), {
    onSuccess: () => {
      setSetup(null);
      setCode('');
      toast.success('Two-factor authentication enabled');
      void status.refetch().catch(() => undefined);
    },
  });

  const disable = useMutation(() => {
    if (!status.data?.enabled) throw new Error('not enabled');
    return mfaService.verifiedFactorIds().then((ids) => mfaService.unenroll(ids[0]!));
  }, {
    onSuccess: () => {
      setDisablePassword('');
      toast.success('Two-factor authentication disabled');
      void status.refetch().catch(() => undefined);
    },
  });

  const enabled = status.data?.enabled ?? false;

  return (
    <Panel title="Two-factor authentication">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted">
            Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password).
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-2xs text-faint">
            <ShieldCheck className={enabled ? 'h-3 w-3 text-success' : 'h-3 w-3'} aria-hidden />
            {enabled ? 'Enabled — sign-ins ask for a 6-digit code.' : 'Currently off.'}
          </p>
        </div>
        <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'On' : 'Off'}</Badge>
      </div>

      {!setup && !enabled && (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              setError(null);
              try {
                setSetup(await mfaService.enroll());
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Set up authenticator app
          </Button>
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
      )}

      {setup && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="rounded-lg border border-line bg-white p-2">
            {qrUri ? <img src={qrUri} alt="QR code for your authenticator app" width={180} height={180} /> : null}
          </div>
          <div>
            <p className="text-[13px] font-medium text-fg">1. Scan with your authenticator app</p>
            <p className="mt-1 text-xs text-muted">
              Or enter this key manually:{' '}
              <code className="break-all rounded bg-sunken/50 px-1 py-0.5 font-mono text-[11px]">{setup.secret}</code>
            </p>
            <p className="mt-3 text-[13px] font-medium text-fg">2. Enter the 6-digit code</p>
            <div className="mt-2 flex max-w-xs gap-2">
              <Input
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="font-mono tracking-[0.3em]"
                aria-label="Authentication code"
              />
              <Button type="button" loading={confirm.pending} disabled={code.length !== 6} onClick={() => confirm.mutate()}>
                Verify
              </Button>
            </div>
            {confirm.error ? <p className="mt-2 text-xs text-danger">{confirm.error}</p> : null}
          </div>
        </div>
      )}

      {enabled && (
        <div className="mt-4 max-w-sm">
          <PasswordInput
            label="Confirm password to turn off"
            autoComplete="current-password"
            value={disablePassword}
            onChange={(event) => setDisablePassword(event.target.value)}
          />
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              loading={disable.pending}
              disabled={disablePassword.length === 0}
              onClick={() => disable.mutate()}
            >
              Turn off two-factor
            </Button>
          </div>
          {disable.error ? <p className="mt-2 text-xs text-danger">{disable.error}</p> : null}
        </div>
      )}
    </Panel>
  );
}
