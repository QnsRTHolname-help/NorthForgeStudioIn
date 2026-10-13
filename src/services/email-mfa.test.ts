import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailMfaService, isEmailMfaEnabled } from './emailMfa';
import { authService } from './public';
import { supabase } from '@/lib/supabase';
import { AuthError } from '@/lib/auth-errors';

describe('Requirement R5: Client Gmail / Email 2FA Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEmailMfaEnabled check', () => {
    it('returns false immediately when userId is empty or null', async () => {
      expect(await isEmailMfaEnabled('')).toBe(false);
      expect(await isEmailMfaEnabled(null as unknown as string)).toBe(false);
    });

    it('returns true when account_security has email_mfa_enabled = true', async () => {
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email_mfa_enabled: true },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await isEmailMfaEnabled('usr-client-1');
      expect(result).toBe(true);
    });

    it('returns false when account_security has email_mfa_enabled = false', async () => {
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email_mfa_enabled: false },
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await isEmailMfaEnabled('usr-client-2');
      expect(result).toBe(false);
    });

    it('returns false when account_security has no row for user', async () => {
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await isEmailMfaEnabled('usr-client-3');
      expect(result).toBe(false);
    });

    it('fails OPEN by design: returns false instead of throwing if table or network error occurs', async () => {
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '42P01', message: 'relation "account_security" does not exist' },
            }),
          }),
        }),
      } as any);

      const result = await isEmailMfaEnabled('usr-client-4');
      expect(result).toBe(false);
    });
  });

  describe('emailMfaService.status', () => {
    it('retrieves enabled state and timestamp for authenticated user', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: { id: 'usr-client-1', email: 'designer@studio.in' } as any,
        },
        error: null,
      });

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                email_mfa_enabled: true,
                updated_at: '2026-10-13T10:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      } as any);

      const status = await emailMfaService.status();
      expect(status.enabled).toBe(true);
      expect(status.updatedAt).toBe('2026-10-13T10:00:00Z');
    });

    it('returns enabled = false and updatedAt = null when no security record exists', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: { id: 'usr-client-2', email: 'new@studio.in' } as any,
        },
        error: null,
      });

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      } as any);

      const status = await emailMfaService.status();
      expect(status.enabled).toBe(false);
      expect(status.updatedAt).toBeNull();
    });
  });

  describe('emailMfaService.setEnabled (Toggle MFA in account_security)', () => {
    it('toggles email 2FA on by upserting to account_security table', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: { id: 'usr-client-1', email: 'designer@studio.in' } as any,
        },
        error: null,
      });

      const upsertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ email_mfa_enabled: true }],
          error: null,
        }),
      });

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        upsert: upsertSpy,
      } as any);

      const result = await emailMfaService.setEnabled(true);
      expect(result.enabled).toBe(true);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'usr-client-1',
          email_mfa_enabled: true,
          email_mfa_set_at: expect.any(String),
        }),
        { onConflict: 'user_id' },
      );
    });

    it('toggles email 2FA off cleanly', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: {
          user: { id: 'usr-client-1', email: 'designer@studio.in' } as any,
        },
        error: null,
      });

      const upsertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ email_mfa_enabled: false }],
          error: null,
        }),
      });

      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        upsert: upsertSpy,
      } as any);

      const result = await emailMfaService.setEnabled(false);
      expect(result.enabled).toBe(false);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'usr-client-1',
          email_mfa_enabled: false,
        }),
        { onConflict: 'user_id' },
      );
    });
  });

  describe('emailMfaService.sendCode (OTP Request)', () => {
    it('requests a 6-digit OTP code sent to user email without creating user', async () => {
      const signInWithOtpSpy = vi.spyOn(supabase.auth, 'signInWithOtp').mockResolvedValueOnce({
        data: {} as any,
        error: null,
      });

      const result = await emailMfaService.sendCode('client@interiorforge.in');
      expect(result).toEqual({ sent: true });
      expect(signInWithOtpSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'client@interiorforge.in',
          options: expect.objectContaining({
            shouldCreateUser: false,
          }),
        }),
      );
    });

    it('surfaces auth errors as AuthError if OTP sending fails', async () => {
      vi.spyOn(supabase.auth, 'signInWithOtp').mockResolvedValueOnce({
        data: {} as any,
        error: {
          name: 'AuthApiError',
          code: 'over_email_send_rate_limit',
          message: 'over_email_send_rate_limit',
          status: 429,
        } as any,
      });

      await expect(emailMfaService.sendCode('client@interiorforge.in')).rejects.toThrowError(
        expect.objectContaining({
          code: 'AUTH_RATE_LIMIT',
        }),
      );
    });
  });

  describe('emailMfaService.verifyCode (OTP Verification)', () => {
    it('verifies 6-digit OTP code successfully with supabase.auth.verifyOtp', async () => {
      const verifyOtpSpy = vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: {
          session: { access_token: 'valid_jwt_token' } as any,
          user: { id: 'usr-client-1' } as any,
        },
        error: null,
      });

      await expect(
        emailMfaService.verifyCode('client@interiorforge.in', '123456'),
      ).resolves.toBeUndefined();

      expect(verifyOtpSpy).toHaveBeenCalledWith({
        email: 'client@interiorforge.in',
        token: '123456',
        type: 'email',
      });
    });

    it('throws AuthError when OTP token has expired or is invalid', async () => {
      vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValueOnce({
        data: { session: null, user: null },
        error: {
          name: 'AuthApiError',
          message: 'Token has expired or is invalid',
          code: 'otp_expired',
          status: 403,
        } as any,
      });

      await expect(
        emailMfaService.verifyCode('client@interiorforge.in', '999999'),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: 'AUTH_VALIDATION',
          message: expect.stringContaining('That code has expired'),
        }),
      );
    });
  });

  describe('Login Flow with Email 2FA Interception', () => {
    it('throws AUTH_EMAIL_MFA_REQUIRED and sends OTP when client has Email 2FA enabled', async () => {
      // 1. Password sign-in succeeds with verified email
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: {
            id: 'usr-client-mfa',
            email: 'owner@studio.in',
            email_confirmed_at: '2026-10-13T09:00:00Z',
          } as any,
          session: { access_token: 'aal1_temp_token' } as any,
        },
        error: null,
      });

      // 2. MFA assurance level check (no TOTP enrolled)
      vi.spyOn(supabase.auth.mfa, 'getAuthenticatorAssuranceLevel').mockResolvedValueOnce({
        data: { currentLevel: 'aal1', nextLevel: 'aal1', currentAuthenticationMethods: [] },
        error: null,
      });

      // 3. Email MFA check: enabled in account_security
      vi.spyOn(supabase, 'from').mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email_mfa_enabled: true },
              error: null,
            }),
          }),
        }),
      } as any);

      // 4. Session drop
      const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({ error: null });

      // 5. OTP dispatch
      const sendOtpSpy = vi.spyOn(supabase.auth, 'signInWithOtp').mockResolvedValueOnce({
        data: {} as any,
        error: null,
      });

      // Execute login
      let thrownError: any = null;
      try {
        await authService.login('owner@studio.in', 'Secret123!');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AuthError);
      expect(thrownError?.code).toBe('AUTH_EMAIL_MFA_REQUIRED');
      expect(thrownError?.message).toContain('Enter the 6-digit code');
      expect(signOutSpy).toHaveBeenCalled();
      expect(sendOtpSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'owner@studio.in',
          options: expect.objectContaining({ shouldCreateUser: false }),
        }),
      );
    });

    it('proceeds with standard login session when Email 2FA is disabled', async () => {
      // 1. Password sign-in succeeds
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: {
          user: {
            id: 'usr-client-no-mfa',
            email: 'simple@studio.in',
            email_confirmed_at: '2026-10-13T09:00:00Z',
          } as any,
          session: { access_token: 'full_session_token' } as any,
        },
        error: null,
      });

      // 2. getUser for loadProfile / authUserId
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: {
          user: {
            id: 'usr-client-no-mfa',
            email: 'simple@studio.in',
          } as any,
        },
        error: null,
      });

      // 3. MFA check
      vi.spyOn(supabase.auth.mfa, 'getAuthenticatorAssuranceLevel').mockResolvedValueOnce({
        data: { currentLevel: 'aal1', nextLevel: 'aal1', currentAuthenticationMethods: [] },
        error: null,
      });

      // 4. Email MFA check: disabled, and profiles row for loadProfile
      vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
        if (table === 'account_security') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { email_mfa_enabled: false },
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'usr-client-no-mfa',
                      email: 'simple@studio.in',
                      name: 'Client User',
                      role: 'client',
                      client_id: 'cl-1',
                      client: [{ id: 'cl-1', business_name: 'Studio Flow' }],
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      }) as any);

      const session = await authService.login('simple@studio.in', 'Secret123!');
      expect(session).toBeDefined();
      expect(session.user.role).toBe('client');
      expect(session.user.name).toBe('Client User');
    });
  });
});
