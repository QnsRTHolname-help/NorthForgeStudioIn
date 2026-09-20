import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Input, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand/Logo';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { authService } from '@/services/public';

export default function ForgotPassword() {
  usePageMeta({ title: 'Reset your password', noIndex: true });

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation(
    async () => {
      const result = await authService.forgotPassword(email.trim());
      return result;
    },
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    await mutation.mutate().catch(() => undefined);
  };

  return (
    <main className="flex nf-min-h-viewport items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 inline-block">
          <Logo />
        </Link>

        {mutation.success ? (
          <>
            <span className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Check your email.</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              If an account exists for that address, a reset link is on its way. The link expires in 30 minutes.
            </p>

            <div className="mt-8">
              <Link to="/login" className="text-[13px] text-muted hover:text-fg">
                ← Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Reset your password.</h1>
            <p className="mt-2 text-[13px] text-muted">
              Enter the email on your account and we will send a reset link.
            </p>

            <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
              <Input
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                error={error ?? undefined}
              />
              <FormError message={mutation.error} />
              <Button type="submit" fullWidth size="lg" loading={mutation.pending}>
                Send reset link
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-muted">
              <Link to="/login" className="hover:text-fg">
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
