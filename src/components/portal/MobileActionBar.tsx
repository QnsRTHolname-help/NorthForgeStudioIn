import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { X, MoreHorizontal, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { PRIMARY_ITEMS, SECONDARY_ITEMS } from '@/config/portalNavigation';

/**
 * Mobile bottom navigation bar for the client portal.
 *
 * Fixed-position bar at the bottom with proper spacing and responsive behavior.
 * Uses the shared PORTAL_SECTIONS config for consistency with the desktop rail.
 * The bar is hidden on lg+ screens where the sidebar carries navigation.
 */
export function MobileActionBar({ onMoreClick }: { onMoreClick: () => void }) {
  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgb(var(--nf-surface)/0.96)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/portal'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-brand' : 'text-faint',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" aria-hidden />
              {item.label}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMoreClick}
            className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium text-faint"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </footer>
  );
}

/**
 * More sheet component — extracted so it can be composed.
 * Renders the secondary navigation items in a bottom sheet.
 */
export function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const toast = useToast();

  if (!open) return null;

  const onLogout = async () => {
    onClose();
    await logout();
    toast.success('Signed out', 'Your session has been closed.');
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-[var(--nf-scrim)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] animate-fade-up overflow-y-auto rounded-t-xl border-t border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-fg">All sections</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="grid gap-1 sm:grid-cols-2">
          {SECONDARY_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded px-3 py-2.5 text-[13px] font-medium transition-colors',
                    isActive ? 'bg-sunken text-fg' : 'text-muted hover:bg-sunken/60',
                  )
                }
              >
                <item.icon className="h-4 w-4 text-faint" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded px-3 py-2.5 text-[13px] font-medium text-danger hover:bg-sunken/60"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Container that composes MobileActionBar with MobileMoreSheet.
 * This is the single component to use in PortalLayout.
 */
export function MobileActionBarContainer() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <MobileActionBar onMoreClick={() => setMoreOpen(true)} />
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}