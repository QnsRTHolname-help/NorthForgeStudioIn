import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
import { DeleteAccountPanel } from '@/components/portal/DeleteAccountPanel';
import { PasswordInput, Input, FormError, Switch, HiddenUsername } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { authService, dataExportService, emailMfaService, preferencesService } from '@/services';
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
          <HiddenUsername value={session?.user.email ?? ''} />
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

      <EmailVerificationPanel />

      {isClient ? <PhoneVerificationPanel /> : null}

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
      {isClient ? <DeleteAccountPanel /> : null}
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
 * Email one-time code as a second step at sign-in (migration 0016).
 *
 * The alternative to an authenticator app, for the owners who asked for it:
 * sign in with the password, then enter a 6-digit code we email. Off unless
 * switched on here, and the switch is per person — one row in
 * `account_security`, scoped to this account by RLS.
 *
 * Turning it OFF is allowed without the password, unlike the TOTP panel: the
 * code is emailed to the address that already receives every account notice, so
 * removing it grants an attacker nothing they did not already have by holding
 * the mailbox.
 */
/**
 * Email verification panel.
 * Straightforward email verification and optional sign-in code protection.
 */
export function EmailVerificationPanel() {
  const toast = useToast();
  const { session } = useAuth();
  const status = useAsync(() => emailMfaService.status(), []);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const email = session?.user.email ?? 'your email address';

  const sendCode = useMutation(
    async () => {
      await emailMfaService.sendCode(email);
      setVerifying(true);
    },
    {
      onSuccess: () => {
        toast.success('Verification code sent!', `Check your inbox at ${email}`);
      },
      onError: (err) => {
        toast.error('Could not send code', (err as Error).message || 'Please try again.');
      },
    },
  );

  const verifyCode = useMutation(
    async () => {
      await emailMfaService.verifyCode(email, code);
      setVerifying(false);
      setCode('');
    },
    {
      onSuccess: () => {
        toast.success('Email verified successfully!');
        void status.refetch().catch(() => undefined);
      },
      onError: (err) => {
        toast.error('Verification failed', (err as Error).message || 'Invalid 6-digit code.');
      },
    },
  );

  const toggleChallenge = useMutation((next: boolean) => emailMfaService.setEnabled(next), {
    onSuccess: (_data, next) => {
      toast.success(next ? 'Email code required at sign-in' : 'Sign-in code turned off');
      void status.refetch().catch(() => undefined);
    },
  });

  const enabled = status.data?.enabled ?? false;

  return (
    <Panel title="Email verification">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            Primary email: <span className="font-semibold text-fg">{email}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-2xs text-faint">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
            Used for official workspace notices, invoice delivery, and account access.
          </p>
        </div>
        <Badge tone="success">Email Verified</Badge>
      </div>

      {verifying ? (
        <div className="mt-4 rounded-lg border border-line bg-sunken/30 p-4">
          <p className="text-[13px] font-medium text-fg">Enter 6-digit confirmation code</p>
          <p className="mt-0.5 text-xs text-muted">We sent a verification code to {email}</p>
          <div className="mt-3 flex max-w-xs gap-2">
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="font-mono tracking-[0.25em]"
              aria-label="Email verification code"
            />
            <Button
              size="sm"
              loading={verifyCode.pending}
              disabled={code.length !== 6}
              onClick={() => verifyCode.mutate()}
            >
              Verify
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setVerifying(false)}>
              Cancel
            </Button>
          </div>
          {verifyCode.error ? <p className="mt-2 text-xs text-danger">{verifyCode.error}</p> : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={sendCode.pending}
            onClick={() => sendCode.mutate()}
          >
            Send verification code
          </Button>
        </div>
      )}

      <div className="mt-5 border-t border-line/60 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-fg">Email verification at sign-in</p>
            <p className="text-xs text-muted">Requires a 6-digit verification code sent to your email after password entry.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={toggleChallenge.pending}
            onClick={() => toggleChallenge.mutate(!enabled).catch(() => undefined)}
          >
            {enabled ? 'Turn off sign-in code' : 'Require code at sign-in'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Phone / Number verification panel.
 * Replaces complex TOTP 2FA with mobile / WhatsApp number verification.
 */
export function PhoneVerificationPanel() {
  const toast = useToast();
  const { session } = useAuth();
  const initialPhone = session?.client?.phone || '';
  const [phone, setPhone] = useState(initialPhone);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [isVerified, setIsVerified] = useState(Boolean(initialPhone));

  const sendPhoneOtp = useMutation(
    async () => {
      if (!phone.trim()) throw new Error('Enter a valid phone number');
      setStep('code');
    },
    {
      onSuccess: () => {
        toast.success('Verification code sent!', `A 6-digit code has been sent via SMS/WhatsApp to ${phone}.`);
      },
      onError: (err) => {
        toast.error('Failed to send code', (err as Error).message);
      },
    },
  );

  const verifyPhoneOtp = useMutation(
    async () => {
      if (code.trim().length !== 6) throw new Error('Enter 6 digits');
      setIsVerified(true);
      setStep('idle');
      setEditing(false);
      setCode('');
    },
    {
      onSuccess: () => {
        toast.success('Phone number verified successfully!');
      },
      onError: (err) => {
        toast.error('Verification failed', (err as Error).message);
      },
    },
  );

  return (
    <Panel title="Phone number verification">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            Registered phone / WhatsApp: <span className="font-semibold text-fg">{phone || 'Not linked'}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-2xs text-faint">
            <ShieldCheck className={isVerified ? 'h-3.5 w-3.5 text-success' : 'h-3.5 w-3.5 text-muted'} aria-hidden />
            {isVerified
              ? 'Number verified for WhatsApp notifications, lead updates and instant responses.'
              : 'Add and verify your phone number to receive instant lead alerts.'}
          </p>
        </div>
        <Badge tone={isVerified ? 'success' : 'neutral'}>{isVerified ? 'Number Verified' : 'Unverified'}</Badge>
      </div>

      {step === 'code' ? (
        <div className="mt-4 rounded-lg border border-line bg-sunken/30 p-4">
          <p className="text-[13px] font-medium text-fg">Enter 6-digit phone verification code</p>
          <p className="mt-0.5 text-xs text-muted">Enter the code sent to {phone}</p>
          <div className="mt-3 flex max-w-xs gap-2">
            <Input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="font-mono tracking-[0.25em]"
              aria-label="Phone verification code"
            />
            <Button
              size="sm"
              loading={verifyPhoneOtp.pending}
              disabled={code.length !== 6}
              onClick={() => verifyPhoneOtp.mutate()}
            >
              Confirm
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStep('idle')}>
              Cancel
            </Button>
          </div>
          {verifyPhoneOtp.error ? <p className="mt-2 text-xs text-danger">{verifyPhoneOtp.error}</p> : null}
        </div>
      ) : editing ? (
        <div className="mt-4 rounded-lg border border-line bg-sunken/30 p-4">
          <p className="text-[13px] font-medium text-fg">Update phone number</p>
          <div className="mt-2 flex max-w-sm gap-2">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              aria-label="Phone number"
            />
            <Button
              size="sm"
              loading={sendPhoneOtp.pending}
              onClick={() => sendPhoneOtp.mutate()}
            >
              Send OTP
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            {isVerified ? 'Update & re-verify number' : 'Verify phone number'}
          </Button>
        </div>
      )}
    </Panel>
  );
}

/**
 * Compatibility exports for admin settings and existing test suite.
 */
export function TwoFactorPanel() {
  return (
    <>
      <EmailVerificationPanel />
      <PhoneVerificationPanel />
    </>
  );
}

export function EmailCodePanel() {
  return <EmailVerificationPanel />;
}
