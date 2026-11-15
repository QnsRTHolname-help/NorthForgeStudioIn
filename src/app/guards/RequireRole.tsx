import { useState, useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Loader } from '@/components/ui/Loader';
import type { Role } from '@/types';

/**
 * Route guards (spec §128).
 *
 * Direct URL access and refreshes both land here. While the session is
 * being verified we render a neutral loading state rather than flashing
 * a login screen — and we remember where the user was going.
 */

function Booting() {
  return (
    <div className="flex nf-min-h-viewport items-center justify-center bg-canvas">
      <Loader label="Verifying your session" />
    </div>
  );
}

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Booting />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children ?? <Outlet />}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children?: ReactNode }) {
  const { status, role } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Booting />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!role || !roles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return <>{children ?? <Outlet />}</>;
}

/** Sends already-signed-in users to their correct home (spec §30). */
export function RequireGuest({ children }: { children?: ReactNode }) {
  const { status, isAdmin, isClient } = useAuth();
  if (status === 'loading') return <Booting />;
  if (status === 'authenticated') {
    return <Navigate to={isAdmin ? '/app' : isClient ? '/portal' : '/'} replace />;
  }
  return <>{children ?? <Outlet />}</>;
}

export function RequireClient({ children }: { children?: ReactNode }) {
  return <RequireRole roles={['client']}>{children}</RequireRole>;
}

export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { status, role } = useAuth();
  const location = useLocation();
  const [aalChecking, setAalChecking] = useState(false);
  const [needsStepUp, setNeedsStepUp] = useState(false);

  useEffect(() => {
    let active = true;
    if (status === 'authenticated' && (role === 'admin' || role === 'super_admin')) {
      setAalChecking(true);
      supabase.auth.mfa
        .getAuthenticatorAssuranceLevel()
        .then(({ data }) => {
          if (!active) return;
          if (data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2') {
            setNeedsStepUp(true);
          } else {
            setNeedsStepUp(false);
          }
          setAalChecking(false);
        })
        .catch(() => {
          if (active) setAalChecking(false);
        });
    } else {
      setAalChecking(false);
      setNeedsStepUp(false);
    }
    return () => {
      active = false;
    };
  }, [status, role]);

  if (status === 'loading' || aalChecking) return <Booting />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!role || !['admin', 'super_admin'].includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  if (needsStepUp) {
    return <Navigate to="/mfa" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children ?? <Outlet />}</>;
}
