import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyEmailSession, isEmailVerified, exchangeUrlAuthSession } from '@/services/auth';
import { maskEmail } from '@/lib/format';
import { isSafeRedirectUrl, sanitizeRedirectUrl, CANONICAL_SITE_URL } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/public';
import { AuthError } from '@/lib/auth-errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('North Forge Studio – Email Verification System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. HTML Email Template Specifications & Design', () => {
    const templatePath = path.join(rootDir, 'supabase/templates/confirm_signup.html');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    it('exists and contains valid HTML structure', () => {
      expect(fs.existsSync(templatePath)).toBe(true);
      expect(templateHtml).toContain('<!DOCTYPE html');
      expect(templateHtml).toContain('<html');
      expect(templateHtml).toContain('</html>');
    });

    it('enforces North Forge Studio email branding and sender identity', () => {
      expect(templateHtml).toContain('Verify your email address | North Forge Studio');
      expect(templateHtml).toContain('NORTH<span style="color: #3B82F6;">FORGE</span> STUDIO');
      expect(templateHtml).toContain('north.forge.studio.in@gmail.com');
      expect(templateHtml).toContain('© 2026 North Forge Studio. All rights reserved.');
    });

    it('applies dark premium background (#080B12) and centered container styling', () => {
      expect(templateHtml).toContain('#080B12');
      expect(templateHtml).toContain('#0E131F');
      expect(templateHtml).toContain('border: 1px solid #1E2638');
      expect(templateHtml).toContain('border-radius: 16px');
      expect(templateHtml).toContain('linear-gradient(90deg, #3B82F6 0%, #7C5CFC 50%, #00D4B2 100%)');
    });

    it('contains exact required copy and headings from specification', () => {
      expect(templateHtml).toContain('Welcome to North Forge Studio.');
      expect(templateHtml).toContain('One final step to get started.');
      expect(templateHtml).toContain(
        "Thank you for creating your North Forge Studio account. We're excited to have you with us. Please verify your email address to activate your account and securely access your workspace.",
      );
      expect(templateHtml).toContain('VERIFY MY EMAIL');
      expect(templateHtml).toContain(
        "If the button doesn't work, copy and paste the verification link below into your browser.",
      );
    });

    it('uses Supabase GoTrue variables correctly without custom tokens', () => {
      // Must use {{ .ConfirmationURL }} and not custom tokens
      expect(templateHtml).toContain('{{ .ConfirmationURL }}');
      // Must support personalized greeting with fallback
      expect(templateHtml).toContain('{{ if .Data.name }}Hello {{ .Data.name }},{{ else if .Email }}Hello {{ .Email }},{{ else }}Hello,{{ end }}');
    });

    it('includes clear security advisory note', () => {
      expect(templateHtml).toContain('Security notice:');
      expect(templateHtml).toContain(
        'If you did not create a North Forge Studio account, you can safely ignore this email. No account will be activated without verification.',
      );
    });

    it('features Outlook MSO conditionals, solid background fallbacks, and responsive viewport meta', () => {
      expect(templateHtml).toContain('<!--[if mso]>');
      expect(templateHtml).toContain('v:roundrect');
      expect(templateHtml).toContain('name="viewport"');
      expect(templateHtml).toContain('@media only screen and (max-width: 620px)');
      // Solid background fallbacks before gradients for client compatibility
      expect(templateHtml).toContain('background-color: #2563EB;');
      expect(templateHtml).toContain('background-color: #3B82F6;');
      expect(templateHtml).toContain('{{ if .Token }}');
    });
  });

  describe('2. Server-Side Session Verification & Security (verifyEmailSession)', () => {
    it('returns verified: false when no active session exists', async () => {
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const result = await verifyEmailSession();
      expect(result.verified).toBe(false);
      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
    });

    it('returns verified: false when user exists but email_confirmed_at is null on both local and server', async () => {
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'u-unconfirmed',
              email: 'pending@studio.in',
              email_confirmed_at: undefined,
            },
          } as any,
        },
        error: null,
      });
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: { user: null as any },
        error: null,
      });

      const result = await verifyEmailSession();
      expect(result.verified).toBe(false);
      expect(result.user?.id).toBe('u-unconfirmed');
      expect(result.confirmedAt).toBeNull();
    });

    it('re-validates against Supabase Auth server if local session lacks email_confirmed_at', async () => {
      const now = new Date().toISOString();
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'u-stale',
              email: 'stale@studio.in',
              email_confirmed_at: null,
            },
          } as any,
        },
        error: null,
      });
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: {
            id: 'u-stale',
            email: 'stale@studio.in',
            email_confirmed_at: now,
          } as any,
        },
        error: null,
      });

      const result = await verifyEmailSession();
      expect(result.verified).toBe(true);
      expect(result.confirmedAt).toBe(now);
      expect(result.email).toBe('stale@studio.in');
    });

    it('returns verified: true ONLY when email_confirmed_at is populated', async () => {
      const now = new Date().toISOString();
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'u-confirmed',
              email: 'confirmed@studio.in',
              email_confirmed_at: now,
            },
          } as any,
        },
        error: null,
      });

      const result = await verifyEmailSession();
      expect(result.verified).toBe(true);
      expect(result.user?.id).toBe('u-confirmed');
      expect(result.email).toBe('confirmed@studio.in');
      expect(result.confirmedAt).toBe(now);
    });

    it('isEmailVerified strictly checks confirmed email across User, Session, and AuthSession', () => {
      expect(isEmailVerified(null)).toBe(false);
      expect(isEmailVerified(undefined)).toBe(false);

      // Unconfirmed Supabase User: must strictly be false!
      expect(
        isEmailVerified({
          id: 'u-unconfirmed',
          email: 'unconfirmed@studio.in',
          email_confirmed_at: undefined,
        } as any),
      ).toBe(false);

      // Confirmed Supabase User: true
      expect(
        isEmailVerified({
          id: 'u-confirmed',
          email: 'confirmed@studio.in',
          email_confirmed_at: '2026-03-01T00:00:00Z',
        } as any),
      ).toBe(true);

      // Session with unconfirmed user: false
      expect(
        isEmailVerified({
          user: {
            id: 'u-unconfirmed',
            email: 'unconfirmed@studio.in',
            email_confirmed_at: null,
          },
        } as any),
      ).toBe(false);

      // Session with confirmed user: true
      expect(
        isEmailVerified({
          user: {
            id: 'u-confirmed',
            email: 'confirmed@studio.in',
            email_confirmed_at: '2026-03-01T00:00:00Z',
          },
        } as any),
      ).toBe(true);

      // AuthSession loaded from profile
      expect(
        isEmailVerified({
          user: { id: 'u1', email: 'verified@studio.in', name: 'Tester', role: 'client', clientId: 'c1' },
          client: null,
        }),
      ).toBe(true);
    });
  });

  describe('3. Route Protection & Unverified User Rejection', () => {
    it('authService.me() strictly rejects unconfirmed self-service accounts', async () => {
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
        data: {
          session: {
            user: {
              id: 'u-unconfirmed',
              email: 'intruder@studio.in',
              email_confirmed_at: null,
              user_metadata: {},
            },
          } as any,
        },
        error: null,
      });

      const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({ error: null } as any);

      await expect(authService.me()).rejects.toThrowError(
        'Please verify your email before signing in. Check your inbox for the verification link.',
      );
      expect(signOutSpy).toHaveBeenCalled();
    });

    it('authService.login() strictly rejects unconfirmed self-service accounts and signs out', async () => {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: {
            id: 'u-unconfirmed',
            email: 'unconfirmed@studio.in',
            email_confirmed_at: null,
            user_metadata: {},
          } as any,
          session: { access_token: 'tok' } as any,
        },
        error: null,
      });

      const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({ error: null } as any);

      await expect(authService.login('unconfirmed@studio.in', 'Secret123!')).rejects.toThrowError(
        'Please verify your email before signing in. Check your inbox for the verification link.',
      );
      expect(signOutSpy).toHaveBeenCalled();
    });
  });

  describe('4. Privacy-Safe Email Masking', () => {
    it('masks emails preserving privacy while retaining visual recognition', () => {
      expect(maskEmail('north.forge.studio.in@gmail.com')).toBe('no*****n@gmail.com');
      expect(maskEmail('contact@northforge.in')).toBe('co****t@northforge.in');
      expect(maskEmail('alex@studio.in')).toBe('a**x@studio.in');
      expect(maskEmail('me@domain.com')).toBe('m*@domain.com');
      expect(maskEmail('a@domain.com')).toBe('a*@domain.com');
    });

    it('safely handles empty, null, or invalid inputs', () => {
      expect(maskEmail('')).toBe('');
      expect(maskEmail(null)).toBe('');
      expect(maskEmail(undefined)).toBe('');
      expect(maskEmail('plain-text')).toBe('plain-text');
    });
  });

  describe('5. Redirect URL Protection & Open Redirect Prevention', () => {
    it('approves safe internal routes and relative paths', () => {
      expect(isSafeRedirectUrl('/portal')).toBe(true);
      expect(isSafeRedirectUrl('/app/dashboard')).toBe(true);
      expect(isSafeRedirectUrl('/verify/success')).toBe(true);
      expect(isSafeRedirectUrl('/verify/pending')).toBe(true);
      expect(sanitizeRedirectUrl('/portal')).toBe('/portal');
    });

    it('strictly denies external hostnames and open-redirect vectors', () => {
      expect(isSafeRedirectUrl('//malicious.com')).toBe(false);
      expect(isSafeRedirectUrl('/\\malicious.com')).toBe(false);
      expect(isSafeRedirectUrl('https://evil.com/phishing')).toBe(false);
      expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeRedirectUrl('data:text/html,malicious')).toBe(false);

      expect(sanitizeRedirectUrl('//malicious.com', '/portal')).toBe('/portal');
      expect(sanitizeRedirectUrl('https://attacker.com/steal', '/login')).toBe('/login');
    });

    it('approves absolute URLs matching canonical production origin', () => {
      expect(isSafeRedirectUrl(`${CANONICAL_SITE_URL}/portal`)).toBe(true);
      expect(isSafeRedirectUrl(`${CANONICAL_SITE_URL}/verify/success`)).toBe(true);
      expect(sanitizeRedirectUrl(`${CANONICAL_SITE_URL}/verify/success`)).toBe(`${CANONICAL_SITE_URL}/verify/success`);
    });
  });

  describe('6. Supabase Resend & Rate Limit Handling', () => {
    it('authService.resendConfirmation uses signup type and canonical emailRedirectTo', async () => {
      const resendSpy = vi.spyOn(supabase.auth, 'resend').mockResolvedValueOnce({
        data: {} as any,
        error: null,
      });

      const res = await authService.resendConfirmation('test@studio.in');
      expect(res.sent).toBe(true);
      expect(resendSpy).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@studio.in',
        options: { emailRedirectTo: `${CANONICAL_SITE_URL}/auth/callback` },
      });
    });

    it('maps over_email_send_rate_limit to AuthError with retryAfterSeconds', async () => {
      vi.spyOn(supabase.auth, 'resend').mockResolvedValueOnce({
        data: {} as any,
        error: {
          code: 'over_email_send_rate_limit',
          message: 'For security purposes, you can only request this after 47 seconds',
          status: 429,
        } as any,
      });

      try {
        await authService.resendConfirmation('spammer@studio.in');
        expect.unreachable('Should have thrown AuthError');
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        const authErr = err as AuthError;
        expect(authErr.code).toBe('AUTH_RATE_LIMIT');
        expect(authErr.retryAfterSeconds).toBe(47);
        expect(authErr.message).toContain('47s');
      }
    });
  });

  describe('7. Direct Link Token Exchange (exchangeUrlAuthSession)', () => {
    it('returns exchanged: false when no auth code or token_hash is in URL', async () => {
      const res = await exchangeUrlAuthSession();
      expect(res.exchanged).toBe(false);
    });

    it('exchanges PKCE code when code param is present', async () => {
      const exchangeSpy = vi.spyOn(supabase.auth, 'exchangeCodeForSession').mockResolvedValueOnce({
        data: { session: {} as any, user: {} as any },
        error: null,
      });

      const res = await exchangeUrlAuthSession('/verify/success?code=test-auth-code');
      expect(res.exchanged).toBe(true);
      expect(exchangeSpy).toHaveBeenCalledWith('test-auth-code');
    });

    it('verifies OTP token_hash when token_hash param is present', async () => {
      const otpSpy = vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { session: {} as any, user: {} as any },
        error: null,
      });

      const res = await exchangeUrlAuthSession('/verify/success?token_hash=otp-hash-123&type=signup');
      expect(res.exchanged).toBe(true);
      expect(otpSpy).toHaveBeenCalledWith({ token_hash: 'otp-hash-123', type: 'signup' });
    });
  });

  describe('8. Verification Pending & Registration Flow Integration', () => {
    const pendingPath = path.join(rootDir, 'src/pages/public/VerifyPending.tsx');
    const pendingCode = fs.readFileSync(pendingPath, 'utf8');

    it('links to /register?changeEmail=true to allow typo correction without losing context', () => {
      expect(pendingCode).toContain('to="/register?changeEmail=true"');
    });

    it('provides email input fallback when email is not present in route state or storage', () => {
      expect(pendingCode).toContain('id="manual-pending-email"');
    });
  });
});
