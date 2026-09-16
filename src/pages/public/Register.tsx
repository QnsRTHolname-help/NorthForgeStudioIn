import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Input, PasswordInput, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { authService } from '@/services';

export default function Register() {
  usePageMeta({ title: 'Create your account', description: 'Create a NorthForge client account.', noIndex: true });

  const navigate = useNavigate();
  const { register } = useAuth();
  const toast = useToast();

  const [values, setValues] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    businessType: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Email confirmation is enabled: the account exists but needs verifying. */
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const mutation = useMutation(
    async () => {
      const session = await register({
        name: values.name,
        businessName: values.businessName,
        email: values.email,
        phone: values.phone || undefined,
        businessType: values.businessType || undefined,
        password: values.password,
      });
      return session;
    },
    {
      onSuccess: () => {
        toast.success('Account created', 'Tell us about your business to finish setup.');
        navigate('/portal', { replace: true });
      },
    },
  );

  const resend = useMutation((email: string) => authService.resendConfirmation(email));

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = 'Enter your full name.';
    if (values.businessName.trim().length < 2) next.businessName = 'Enter your business name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (values.password.length < 8) next.password = 'Use at least 8 characters.';
    if (values.password !== values.confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;    try {
      await mutation.mutate();
    } catch (error) {
      // With email confirmation on, Supabase returns no session at signup.
      // That is a SUCCESS path — show an inbox panel, not a red error.
      if ((error as { code?: string }).code === 'AUTH_EMAIL_NOT_CONFIRMED') {
        setNeedsConfirmation(true);
        return;
      }
      const fields = (error as { fields?: Record<string, string> }).fields;
      if (fields) setErrors(fields);
    }
  };

  if (needsConfirmation) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-14">
        <div className="w-full max-w-md text-center">
          <Link to="/" className="mb-10 inline-block">
            <Logo />
          </Link>
          <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
                    <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Confirm your email.</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            We sent a verification link to <span className="font-medium text-fg">{values.email}</span>. Confirm it to
            activate your workspace, then sign in.
          </p>
          <div className="mt-8 space-y-3">
            <Button
              variant="secondary"
              size="sm"
              loading={resend.pending}
              onClick={() => {
                void resend.mutate(values.email).catch(() => undefined);
              }}
            >
              {resend.success ? 'Email sent again — check your inbox' : 'Resend verification email'}
            </Button>
            {resend.error ? <p className="text-xs text-danger">{resend.error}</p> : null}
            <div>
              <Link
                to="/login"
                className="text-[13px] font-medium text-brand underline decoration-brand/30 underline-offset-2"
              >
                Continue to sign in →
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>

        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-fg">Create your account.</h1>
        <p className="mt-2 text-[13px] text-muted">
          Tell us who you are and we will set up your business workspace.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Your name" required autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
            <Input
              label="Business name"
              required
              autoComplete="organization"
              value={values.businessName}
              onChange={set('businessName')}
              error={errors.businessName}
            />
          </div>

          <Input label="Email" type="email" required autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="WhatsApp / phone" autoComplete="tel" value={values.phone} onChange={set('phone')} error={errors.phone} />
            <Input
              label="Business type"
              value={values.businessType}
              onChange={set('businessType')}
              placeholder="e.g. Clinic, Retail"
            />
          </div>

          <PasswordInput
            label="Password"
            required
            autoComplete="new-password"
            value={values.password}
            onChange={set('password')}
            error={errors.password}
            hint="At least 8 characters."
          />
          <PasswordInput
            label="Confirm password"
            required
            autoComplete="new-password"
            value={values.confirm}
            onChange={set('confirm')}
            error={errors.confirm}
          />

          <FormError message={mutation.error} />

          <Button type="submit" fullWidth size="lg" loading={mutation.pending} disabled={mutation.pending} arrow>
            {mutation.pending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand underline decoration-brand/30 underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
