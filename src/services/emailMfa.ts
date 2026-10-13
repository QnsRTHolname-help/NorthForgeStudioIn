/**
 * Email MFA Service (Milestone 5 / R5).
 *
 * Provides client email-based two-factor authentication (6-digit OTP code sent on sign-in).
 * Backed by `account_security` table (migration 0016).
 */
export { isEmailMfaEnabled, emailMfaService } from './public';

export interface EmailMfaStatus {
  enabled: boolean;
  updatedAt: string | null;
}
