import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronLeft,
  CreditCard,
  FileText,
  Gauge,
  Globe,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Target,
  Users,
  Workflow as WorkflowIcon,
  Wrench,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Data';
import { Button, IconButton } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Dropdown } from '@/components/ui/Overlay';
import { Badge } from '@/components/ui/Badge';
import { useCommandPalette } from '@/components/ui/CommandPalette';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/app/providers/ToastProvider';
import { usePageMeta } from '@/hooks/usePageMeta';
import { titleForPath } from '@/app/config/titles';
import { insightsService } from '@/services';
import { useAsync } from '@/hooks/useAsync';

interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: 'requests' | 'tasks';
}

const SECTIONS: { title: string; items: AdminNavItem[] }[] = [
  { title: 'Overview', items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Sales',
    items: [
      { to: '/app/leads', label: 'Leads', icon: Users },
      { to: '/app/pipeline', label: 'Pipeline', icon: KanbanSquare },
      { to: '/app/proposals', label: 'Proposals', icon: FileText },
      { to: '/app/follow-ups', label: 'Follow-ups', icon: Send },
      { to: '/app/outreach', label: 'Outreach', icon: Target },
    ],
  },
  {
    title: 'Clients',
    items: [
      { to: '/app/clients', label: 'All Clients', icon: Building2 },
      { to: '/app/requests', label: 'Requests', icon: Inbox, badge: 'requests' },
      { to: '/app/onboarding', label: 'Onboarding', icon: Wrench },
    ],
  },
  {
    title: 'Delivery',
    items: [
      { to: '/app/projects', label: 'Projects', icon: KanbanSquare },
      { to: '/app/websites', label: 'Websites', icon: Globe },
      { to: '/app/tasks', label: 'Tasks', icon: KanbanSquare, badge: 'tasks' },
      { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    title: 'Growth',
    items: [
      { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/app/seo', label: 'SEO', icon: Search },
      { to: '/app/conversions', label: 'Conversions', icon: Gauge },
    ],
  },
  {
    title: 'Automation',
    items: [
      { to: '/app/whatsapp', label: 'WhatsApp', icon: MessagesSquare },
      { to: '/app/workflows', label: 'Workflows', icon: WorkflowIcon },
      { to: '/app/bookings', label: 'Bookings', icon: CalendarDays },
    ],
  },
  {
    title: 'Billing',
    items: [
      { to: '/app/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { to: '/app/payments', label: 'Payments', icon: CreditCard },
      { to: '/app/invoices', label: 'Invoices', icon: FileText },
      { to: '/app/plans', label: 'Plans', icon: FileText },
      { to: '/app/services', label: 'Services', icon: FileText },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/app/notifications', label: 'Notifications', icon: Bell },
      { to: '/app/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/app/activity', label: 'Activity', icon: Activity },
      { to: '/app/support', label: 'Support', icon: LifeBuoy },
      { to: '/app/system-health', label: 'System Health', icon: ShieldCheck },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/**
 * Admin operating system shell (spec §47, §112).
 *
 * Deliberately denser than the portal: a collapsible rail, a command bar,
 * live notification counts, and restrained motion. This is a tool the
 * agency operates the business from — not a landing page.
 */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const palette = useCommandPalette();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  usePageMeta({ title: titleForPath(location.pathname) ?? 'NorthForge OS', noIndex: true });

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const notifications = useAsync(() => insightsService.notifications(), [location.pathname]);

  const unread = notifications.data?.unread ?? 0;

  const onLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-5">
          <p className={cn('nf-eyebrow px-2.5 pb-2', collapsed && 'sr-only')}>{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/app'}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-150',
                      collapsed && 'justify-center px-0',
                      isActive ? 'bg-sunken text-fg' : 'text-muted hover:bg-sunken/60 hover:text-fg',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand' : 'text-faint')} aria-hidden />
                      <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>
                      {item.badge === 'requests' && (notifications.data?.items.length ?? 0) > 0 ? (
                        <span className="nf-num rounded bg-sunken px-1.5 text-2xs text-muted">{notifications.data?.items.length}</span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop rail */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface transition-[width] duration-300 ease-forge lg:flex',
          collapsed ? 'w-[68px]' : 'w-[252px]',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-line px-4', collapsed && 'justify-center px-0')}>
          <Link to="/app" aria-label="NorthForge OS">
            <Logo markSize={26} showWordmark={!collapsed} />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin">
          <NavList />
        </nav>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-sunken hover:text-fg',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeftClose className={cn('h-4 w-4 shrink-0', !collapsed && 'rotate-180')} aria-hidden />
            <span className={cn(collapsed && 'sr-only')}>Collapse</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-[rgb(6_8_12/0.55)]" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-[272px] animate-[fade-in_0.2s_ease] flex-col border-r border-line bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Logo />
              <IconButton label="Close menu" size="sm" onClick={() => setMobileOpen(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </nav>
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className={cn('transition-[padding] duration-300 ease-forge', collapsed ? 'lg:pl-[68px]' : 'lg:pl-[252px]')}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-[rgb(var(--nf-canvas)/0.88)] px-4 backdrop-blur-xl lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-line text-fg lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-fg">
              {titleForPath(location.pathname) ?? 'NorthForge'}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => palette.open('search')}
            className="hidden h-9 items-center gap-2 rounded border border-line px-3 text-[13px] text-faint transition-colors hover:bg-sunken hover:text-fg md:flex"
            aria-label="Search"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            Search
            <kbd className="ml-4 rounded border border-line px-1 font-mono text-2xs">⌘K</kbd>
          </button>

          <Button size="sm" className="hidden sm:inline-flex" iconLeft={<Plus className="h-3.5 w-3.5" />} onClick={() => palette.open('create')}>
            Create
          </Button>

          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded border border-line text-muted transition-colors hover:bg-sunken hover:text-fg"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                ) : null}
              </button>
            )}
            items={[
              {
                id: 'all',
                label: 'View all notifications',
                icon: <Bell className="h-3.5 w-3.5" />,
                onSelect: () => navigate('/app/notifications'),
              },
              {
                id: 'mark',
                label: 'Mark all as read',
                icon: <ShieldCheck className="h-3.5 w-3.5" />,
                onSelect: async () => {
                  await insightsService.markRead();
                  notifications.refetch();
                },
              },
            ]}
          />

          <ThemeToggle className="h-9 w-9" />

          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} className="flex items-center gap-2 rounded p-0.5" aria-label="Account menu">
                <Avatar name={user?.name ?? null} size="sm" />
                <ChevronLeft className="hidden h-3.5 w-3.5 -rotate-90 text-faint sm:block" aria-hidden />
              </button>
            )}
            items={[
              { id: 'profile', label: 'Settings', icon: <Settings className="h-3.5 w-3.5" />, onSelect: () => navigate('/app/settings') },
              {
                id: 'site',
                label: 'View public site',
                icon: <Globe className="h-3.5 w-3.5" />,
                onSelect: () => window.open('/', '_blank', 'noopener'),
              },
              { id: 'logout', label: 'Sign out', icon: <LogOut className="h-3.5 w-3.5" />, onSelect: onLogout },
            ]}
          />
        </header>

        <main id="main" className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminBadge() {
  return <Badge tone="violet">Agency OS</Badge>;
}
