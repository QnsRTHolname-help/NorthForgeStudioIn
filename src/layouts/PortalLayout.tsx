import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Data';
import { IconButton } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PageTransition } from '@/components/motion';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { usePageMeta } from '@/hooks/usePageMeta';
import { TITLES } from '@/app/config/titles';
import { MobileActionBarContainer } from '@/components/portal/MobileActionBar';
import { PORTAL_SECTIONS } from '@/config/portalNavigation';

/**
 * Client portal shell (spec §32, §46).
 *
 * Desktop: calm left rail. Mobile: compact header + thumb-reachable
 * bottom bar with the five primary destinations and a "More" sheet
 * (provided by MobileActionBar).
 * The portal is a SaaS product — not a shrunken marketing page.
 */
export function PortalLayout() {
  const { user, client, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  usePageMeta({ title: TITLES[location.pathname] ?? 'Client portal' });

  const onLogout = async () => {
    await logout();
    toast.success('Signed out', 'Your session has been closed.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="nf-min-h-viewport bg-[linear-gradient(180deg,rgb(var(--nf-canvas)),rgb(var(--nf-elevated)/0.72))] flex flex-col">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Link to="/portal" aria-label="Portal home">
            <Logo markSize={26} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Client portal">
          {PORTAL_SECTIONS.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="nf-eyebrow px-2.5 pb-2">{section.title}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/portal'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium transition-colors duration-150',
                          isActive
                            ? 'border border-brand/20 bg-brand/[0.08] text-fg shadow-soft'
                            : 'border border-transparent text-muted hover:bg-sunken/60 hover:text-fg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand' : 'text-faint')} aria-hidden />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded px-2 py-2">
            <Avatar name={user?.name ?? null} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-fg">{user?.name}</p>
              <p className="truncate text-xs text-faint">{client?.businessName ?? 'NorthForge client'}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Link to="/portal/settings" className="flex-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-sunken hover:text-fg"
              >
                <Settings className="h-4 w-4" aria-hidden />
                Settings
              </button>
            </Link>
            <ThemeToggle className="h-8 w-8 border-transparent" />
            <IconButton label="Sign out" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-line bg-[rgb(var(--nf-canvas)/0.9)] px-4 backdrop-blur-xl lg:hidden">
        <Link to="/portal">
          <Logo markSize={26} showWordmark={false} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-fg">{TITLES[location.pathname] ?? 'Portal'}</p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle className="h-8 w-8 border-transparent" />
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="lg:pl-[248px] flex-1 flex flex-col">
        <main id="main" className="flex-1 mx-auto w-full max-w-[1180px] px-4 pt-6 pb-20 sm:px-6 sm:pb-20 lg:px-10 lg:pt-8 lg:pb-8">
          <PageTransition variant="moderate">
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Mobile bottom navigation — uses the shared component */}
      <MobileActionBarContainer />

    </div>
  );
}
