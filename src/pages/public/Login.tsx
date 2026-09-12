import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Input, PasswordInput, Checkbox, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { GrowthChain } from '@/components/marketing/GrowthSystem';

interface LocationState {
  from?: string;
}

export default function Login() {
  usePageMeta({ title: 'Sign in', description: 'Sign in to your NorthForge client portal or agency workspace.', noIndex: true });

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const from = (location.state as LocationState | null)?.from;

  const mutation = useMutation(
    async () => {
      const session = await login(email.trim(), password, remember);
      return session;
    },
    {
      onSuccess: (session) => {
        const isAdmin = session.user.role === 'admin' || session.user.role === 'super_admin';
        toast.success(`Welcome back, ${session.user.name.split(' ')[0]}`);
        // Honour the original destination when it matches the user's role.
        if (from && (isAdmin ? from.startsWith('/app') : from.startsWith('/portal'))) {
          navigate(from, { replace: true });
          return;
        }
        navigate(isAdmin ? '/app' : '/portal', { replace: true });
      },
    },
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await mutation.mutate();
    } catch (error) {
      const fields = (error as { fields?: Record<string, string> }).fields;
      if (fields) setErrors(fields);
    }
  };


  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden border-r border-line bg-sunken/30 lg:flex lg:flex-col lg:justify-between">
        <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div
          className="pointer-events-none absolute -left-20 top-1/3 h-[380px] w-[380px] rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: 'radial-gradient(circle, rgb(var(--nf-blue)), transparent 70%)' }}
          aria-hidden
        />

        <div className="relative p-10">
          <Link to="/">
            <Logo />
          </Link>
        </div>

        <div className="relative px-10">
          <h2 className="max-w-sm text-headline font-semibold text-fg">
            Your business system, in one place.
          </h2>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted">
            Enquiries, website status, project progress, analytics, bookings, billing and support — in plain business
            language.
          </p>

          <div className="mt-10 max-w-sm">
            <GrowthChain />
          </div>
        </div>

        <div className="relative p-10">
          <p className="flex items-center gap-2 text-xs text-faint">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
            Sessions are verified server-side on every request.
          </p>
        </div>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-5 py-14 sm:px-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>

          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-fg">Welcome back.</h1>
          <p className="mt-2 text-[13px] text-muted">Sign in to your NorthForge workspace.</p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((prev) => ({ ...prev, email: '' }));
              }}
              error={errors.email}
              placeholder="you@business.com"
            />

            <PasswordInput
              label="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((prev) => ({ ...prev, password: '' }));
              }}
              error={errors.password}
              placeholder="••••••••"
            />

            <div className="flex items-center justify-between gap-4 pt-1">
              <Checkbox checked={remember} onChange={setRemember} label="Keep me signed in" />
              <Link to="/forgot-password" className="shrink-0 text-[13px] text-muted transition-colors hover:text-fg">
                Forgot password?
              </Link>
            </div>

            <FormError message={mutation.error} />

            <Button type="submit" fullWidth size="lg" loading={mutation.pending} disabled={mutation.pending} arrow>
              {mutation.pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-muted">
            New to NorthForge?{' '}
            <Link to="/register" className="font-medium text-brand underline decoration-brand/30 underline-offset-2">
              Create an account
            </Link>
          </p>

          <p className="mt-8 text-center text-2xs text-faint">
            <Link to="/" className="hover:text-muted">
              ← Back to northforge
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
