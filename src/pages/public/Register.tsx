import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Input, PasswordInput, FormError, Checkbox } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { authService } from '@/services/public';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { useCooldown } from '@/hooks/useCooldown';
import { PASSWORD_POLICY } from '@shared/password';
import { normalizeWhatsAppNumber, prettyWhatsAppNumber } from '@/lib/whatsapp';

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
  /**
   * Age eligibility (spec §10–§11).
   *
   * A self-attested confirmation, NOT an identity check: a basic age gate
   * does not justify asking an adult to upload a passport, Aadhaar card or
   * driving licence. We store only the RESULT (age_verified /
   * age_verified_at, migration 0012) — never a date of birth, which would be
   * more sensitive information than the eligibility decision requires.
   */
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const mutation = useMutation(
    async () => {
      const session = await register({
        name: values.name,
        businessName: values.businessName,
        email: values.email,
        phone: values.phone.trim() ? (normalizeWhatsAppNumber(values.phone) ?? undefined) : undefined,
        businessType: values.businessType || undefined,
        password: values.password,
        ageConfirmed,
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
  // A short, visible wait: repeated resends burn the provider's per-address
  // allowance and make the NEXT attempt slower, so we pace it ourselves.
  const cooldown = useCooldown(45);

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
    if (values.password.length < PASSWORD_POLICY.minLength) {
      next.password = `Use at least ${PASSWORD_POLICY.minLength} characters.`;
    }
    if (values.password !== values.confirm) next.confirm = 'Passwords do not match.';
    if (!ageConfirmed) next.age = 'Please confirm you meet the age requirement.';
    // Phone is optional, but if it is given it must be a reachable number —
    // it is the channel we (and your customers) reply on. It is normalised
    // to international digits so it matches the WhatsApp inbox exactly.
    if (values.phone.trim() && !normalizeWhatsAppNumber(values.phone)) {
      next.phone = 'Enter a valid phone number, including the country code if outside India.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
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
      <main className="flex nf-min-h-viewport items-center justify-center px-5 py-14">
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
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Not seeing it? Check your <span className="font-medium">spam/junk folder</span> and mark the sender as
            trusted — new senders are often filtered. It can take a couple of minutes to arrive.
          </p>
          <div className="mt-8 space-y-3">
            <Button
              variant="secondary"
              size="sm"
              loading={resend.pending}
              disabled={cooldown.active}
              onClick={async () => {
                cooldown.start(45);
                try {
                  await resend.mutate(values.email);
                } catch (error) {
                  // Supabase told us how long to wait — honour its number.
                  const retry = (error as { retryAfterSeconds?: number }).retryAfterSeconds;
                  if (retry) cooldown.start(retry);
                }
              }}
            >
              {cooldown.active
                ? `Resend available in ${cooldown.remaining}s`
                : resend.success
                  ? 'Email sent again — check your inbox'
                  : 'Resend verification email'}
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
    <main className="flex nf-min-h-viewport items-center justify-center px-5 py-14">
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
            <Input
              label="WhatsApp / phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={set('phone')}
              error={errors.phone}
              hint={
                values.phone.trim() && normalizeWhatsAppNumber(values.phone)
                  ? `We will reach you on ${prettyWhatsAppNumber(normalizeWhatsAppNumber(values.phone))}`
                  : 'Used to reach you about your account and your enquiries. Not shown publicly.'
              }
            />
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
            hint={`At least ${PASSWORD_POLICY.minLength} characters with a mix of cases, a number and a symbol.`}
          />
          <PasswordStrength password={values.password} />
          <PasswordInput
            label="Confirm password"
            required
            autoComplete="new-password"
            value={values.confirm}
            onChange={set('confirm')}
            error={errors.confirm}
          />

          <div className="space-y-3 rounded-lg border border-line bg-sunken/30 p-4">
            <Checkbox
              checked={ageConfirmed}
              onChange={(checked) => {
                setAgeConfirmed(checked);
                setErrors((prev) => ({ ...prev, age: '' }));
              }}
              label="I am 18 or older"
              description="NorthForge provides business services intended for adults. We record only that this confirmation was given."
            />
            {errors.age ? (
              <p className="text-xs text-danger" role="alert">
                {errors.age}
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-faint">
              By creating an account you agree to our{' '}
              <Link to="/terms" className="text-brand underline decoration-brand/30 underline-offset-2">
                terms of service
              </Link>{' '}
              and confirm you have read our{' '}
              <Link to="/privacy" className="text-brand underline decoration-brand/30 underline-offset-2">
                privacy policy
              </Link>
              .
            </p>
          </div>

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
