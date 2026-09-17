import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  FileText,
  FolderOpen,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  MessagesSquare,
  MoreHorizontal,
  Settings,
  Store,
  Workflow as WorkflowIcon,
  X,
} from 'lucide-react';
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

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/portal', label: 'Overview', icon: LayoutDashboard, primary: true },
      { to: '/portal/profile', label: 'Business Profile', icon: Store },
    ],
  },
  {
    title: 'My website',
    items: [
      { to: '/portal/website', label: 'Website', icon: Globe, primary: true },
      { to: '/portal/project', label: 'Project', icon: WorkflowIcon },
    ],
  },
  {
    title: 'Growth',
    items: [
      { to: '/portal/leads', label: 'Leads', icon: MessagesSquare, primary: true },
      { to: '/portal/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Engage',
    items: [
      { to: '/portal/whatsapp', label: 'WhatsApp', icon: MessagesSquare },
      { to: '/portal/bookings', label: 'Bookings', icon: CalendarDays, primary: true },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/portal/requests', label: 'Requests', icon: FileText },
      { to: '/portal/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/portal/files', label: 'Files', icon: FolderOpen },
      { to: '/portal/subscription', label: 'Subscription', icon: FileText },
      { to: '/portal/invoices', label: 'Invoices', icon: FileText },
      { to: '/portal/support', label: 'Support', icon: LifeBuoy },
      { to: '/portal/settings', label: 'Settings', icon: Settings, primary: true },
    ],
  },
];

/**
 * Client portal shell (spec §32, §46).
 *
 * Desktop: calm left rail. Mobile: compact header + thumb-reachable
 * bottom bar with the five primary destinations and a "More" sheet.
 * The portal is a SaaS product — not a shrunken marketing page.
 */
export function PortalLayout() {
  const { user, client, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [moreOpen, setMoreOpen] = useState(false);

  usePageMeta({ title: TITLES[location.pathname] ?? 'Client portal' });

  useEffect(() => setMoreOpen(false), [location.pathname]);

  const onLogout = async () => {
    await logout();
    toast.success('Signed out', 'Your session has been closed.');
    navigate('/login', { replace: true });
  };

  const secondaryItems = SECTIONS.flatMap((section) => section.items).filter((item) => !item.primary);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Link to="/portal" aria-label="Portal home">
            <Logo markSize={26} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Client portal">
          {SECTIONS.map((section) => (
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
                          isActive ? 'bg-sunken text-fg' : 'text-muted hover:bg-sunken/60 hover:text-fg',
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
      <div className="lg:pl-[248px]">
        <main id="main" className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          <PageTransition variant="moderate">
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Mobile bottom navigation (spec §46, §88) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgb(var(--nf-surface)/0.96)] backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <ul className="grid grid-cols-5">
          {SECTIONS.flatMap((section) => section.items)
            .filter((item) => item.primary)
            .map((item) => (
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
              onClick={() => setMoreOpen(true)}
              className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium text-faint"
            >
              <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[var(--nf-scrim)] backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] animate-fade-up overflow-y-auto rounded-t-xl border-t border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-fg">All sections</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-fg"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {secondaryItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
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
          </div>
        </div>
      ) : null}

    </div>
  );
}
