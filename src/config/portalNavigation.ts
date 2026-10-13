import {
  BarChart3,
  BrainCircuit,
  CalendarDays,
  FileText,
  FolderOpen,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  ListTodo,
  Megaphone,
  MessagesSquare,
  Plug,
  Settings,
  Sparkles,
  Store,
  UsersRound,
  Workflow as WorkflowIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Shown in the mobile bottom bar (MobileActionBar). */
  primary?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Single source of truth for portal navigation.
 * Used by PortalLayout (desktop rail) and MobileActionBar (mobile bottom bar).
 */
export const PORTAL_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/portal', label: 'Overview', icon: LayoutDashboard, primary: true },
      { to: '/portal/profile', label: 'Business Profile', icon: Store },
    ],
  },
  {
    title: 'Daily OS',
    items: [
      { to: '/portal/calendar', label: 'Calendar', icon: CalendarDays, primary: true },
      { to: '/portal/tasks', label: 'Tasks', icon: ListTodo, primary: true },
      { to: '/portal/project', label: 'Project', icon: WorkflowIcon },
      { to: '/portal/employees', label: 'Employees', icon: UsersRound },
    ],
  },
  {
    title: 'My website',
    items: [
      { to: '/portal/website', label: 'Website', icon: Globe },
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
      { to: '/portal/bookings', label: 'Bookings', icon: CalendarDays },
      { to: '/portal/integrations', label: 'Integrations', icon: Plug },
      { to: '/portal/second-brain', label: 'Second Brain', icon: BrainCircuit },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/portal/requests', label: 'Requests', icon: FileText },
      { to: '/portal/services', label: 'Services', icon: Sparkles },
      { to: '/portal/announcements', label: 'Announcements', icon: Megaphone },
      { to: '/portal/files', label: 'Files', icon: FolderOpen },
      { to: '/portal/subscription', label: 'Subscription', icon: FileText },
      { to: '/portal/invoices', label: 'Invoices', icon: FileText },
      { to: '/portal/support', label: 'Support', icon: LifeBuoy },
      { to: '/portal/settings', label: 'Settings', icon: Settings },
    ],
  },
];

/** All primary items for the mobile bottom bar (exactly 5). */
export const PRIMARY_ITEMS = PORTAL_SECTIONS.flatMap((section) => section.items).filter((item) => item.primary);

/** All secondary items for the "More" sheet. */
export const SECONDARY_ITEMS = PORTAL_SECTIONS.flatMap((section) => section.items).filter((item) => !item.primary);

/** All items flattened. */
export const ALL_ITEMS = PORTAL_SECTIONS.flatMap((section) => section.items);