import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/app/providers/ToastProvider';

/**
 * Global handler for authentication errors that arrive in the URL —
 * e.g. an expired or already-used email-verification link:
 *   /?error=access_denied&error_code=otp_expired&error_description=…
 *
 * Instead of landing silently on the marketing page, the user gets a clear
 * explanation and a path forward, and the error parameters are scrubbed
 * from the address bar.
 */
export function AuthUrlErrorHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (!error) return;

    const code = params.get('error_code') ?? '';
    const description = params.get('error_description') ?? '';

    let message: string;
    if (code === 'otp_expired' || description.toLowerCase().includes('invalid or has expired')) {
      message =
        'That email link has expired or was already used. If you already confirmed, just sign in — otherwise use "Resend verification email" on the register page for a fresh link.';
    } else if (code === 'access_denied') {
      message = 'The email link was not accepted. Request a new link and confirm within its validity window.';
    } else {
      message = 'The email link could not be completed. Please try again or contact support.';
    }

    toast.error('Email link problem', message);

    // Scrub the error parameters so refresh/re-share never re-triggers it.
    params.delete('error');
    params.delete('error_code');
    params.delete('error_description');
    const remaining = params.toString();
    navigate({ pathname: location.pathname, search: remaining ? `?${remaining}` : '' }, { replace: true });
  }, [location.search, location.pathname, navigate, toast]);

  return null;
}

