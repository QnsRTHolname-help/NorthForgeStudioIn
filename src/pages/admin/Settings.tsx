import { useState } from 'react';
import { LogOut, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PasswordInput, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AsyncBoundary, EmptyState } from '@/components/ui/States';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useAuth } from '@/app/providers/AuthProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { useAsync, useMutation } from '@/hooks/useAsync';
import { authService, rolesService, systemService, type ProfileRole } from '@/services';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Role } from '@/types';

/** Admin settings (spec §113): appearance, security, session. */
export default function Settings() {
  usePageMeta({ title: 'Settings', noIndex: true });
  const { session, logout, isSuperAdmin } = useAuth();
  const { preference, setPreference } = useTheme();
  const toast = useToast();

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);

  const change = useMutation(() => authService.changePassword(passwords.current, passwords.next), {
    onSuccess: () => {
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password updated');
    },
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwords.next.length < 8) return setError('Use at least 8 characters.');
    if (passwords.next !== passwords.confirm) return setError('New passwords do not match.');
    setError(null);
    await change.mutate().catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Settings"
        description="Appearance, security and session for your admin account."
        crumbs={[{ label: 'Settings' }]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Appearance">
          <p className="text-[13px] text-muted">Applies to this device only.</p>
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

        <Panel title="Session">
          <Row label="Signed in as" value={session?.user.email ?? '—'} />
          <Row label="Role" value={session?.user.role ? titleCaseRole(session.user.role) : '—'} />
          <Row label="User ID" value={<span className="font-mono text-xs">{session?.user.id ?? '—'}</span>} />
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
        </Panel>
      </div>

      <Panel title="Change password">
        <form onSubmit={submit} className="grid max-w-md gap-4">
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
      </Panel>

      <Panel title="Environment">
        <div className="grid gap-3 sm:grid-cols-3">
          <EnvProbe label="API" probe={async () => ((await systemService.ping()).pong ? 'reachable' : 'no response')} />
          <EnvProbe label="Session scope" probe={async () => session?.user.role ?? 'unknown'} />
          <EnvProbe label="Build" probe={async () => (import.meta.env.PROD ? 'production' : 'development')} />
        </div>
      </Panel>

      {isSuperAdmin && <UserRoles />}
    </div>
  );
}

/**
 * Role management (spec §7): SUPER_ADMIN only. The database enforces the
 * same rule (guard_profile_update, migration 0003) — this panel simply
 * hides a capability a non-super-admin could not use anyway.
 */
const ASSIGNABLE: Role[] = ['client', 'admin', 'super_admin'];

function UserRoles() {
  const toast = useToast();
  const { session } = useAuth();
  const state = useAsync(() => rolesService.list(), []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const change = useMutation(
    async ({ userId, role }: { userId: string; role: Role }) => {
      await rolesService.setRole(userId, role);
    },
    {
      onSuccess: () => {
        toast.success('Role updated');
        void state.refetch().catch(() => undefined);
      },
    },
  );

  const onRoleChange = async (profile: ProfileRole, role: Role) => {
    if (role === profile.role) return;
    // Self-demotion lock: a lone super_admin must not be able to lock
    // themselves out of role management by accident.
    if (profile.id === session?.user.id && profile.role === 'super_admin' && role !== 'super_admin') {
      toast.error('Not allowed', 'Ask another super admin to change your role.');
      return;
    }
    setBusyId(profile.id);
    try {
      await change.mutate({ userId: profile.id, role });
    } catch {
      /* error already surfaced by useMutation / FormError patterns */
    } finally {
      setBusyId(null);
    }
  };

  const users = state.data ?? [];

  return (
    <Panel title="User roles">
      <div className="mb-3 flex items-center gap-2 text-[13px] text-muted">
        <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
        <span>Only super admins can change roles — enforced by the database, not just this screen.</span>
      </div>
      <AsyncBoundary
        loading={state.loading}
        error={state.error}
        data={state.data}
        onRetry={() => state.refetch().catch(() => undefined)}
        empty={<EmptyState title="No user profiles yet" description="Profiles appear once users sign up." />}
      >
        <div className="divide-y divide-line">
          {users.map((profile) => (
            <div key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-fg">{profile.name || profile.email}</p>
                <p className="truncate text-2xs text-faint">{profile.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-faint">{profile.lastLoginAt ? `Seen ${formatRelative(profile.lastLoginAt)}` : 'Never signed in'}</span>
                {profile.role === 'super_admin' ? (
                  <Badge tone="brand">Super admin</Badge>
                ) : profile.role === 'admin' ? (
                  <Badge tone="info">Admin</Badge>
                ) : (
                  <Badge tone="neutral">Client</Badge>
                )}
                <select
                  aria-label={`Role for ${profile.email}`}
                  value={profile.role}
                  disabled={busyId === profile.id || change.pending}
                  onChange={(event) => void onRoleChange(profile, event.target.value as Role)}
                  className={cn(
                    'h-8 rounded-md border border-line bg-canvas px-2 text-xs text-fg',
                    'nf-focus disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {ASSIGNABLE.map((role) => (
                    <option key={role} value={role}>
                      {role === 'super_admin' ? 'Super admin' : role === 'admin' ? 'Admin' : 'Client'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </Panel>
  );
}

function EnvProbe({ label, probe }: { label: string; probe: () => Promise<string> }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="rounded border border-line bg-sunken/30 p-3">
      <p className="text-2xs uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-fg">{value ?? '—'}</p>
      <button
        type="button"
        onClick={async () => setValue(await probe().catch(() => 'unavailable'))}
        className="mt-2 text-2xs text-brand hover:underline"
      >
        Check
      </button>
    </div>
  );
}

function titleCaseRole(role: string) {
  return role === 'super_admin' ? 'Super admin' : role === 'admin' ? 'Admin' : 'Client';
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
