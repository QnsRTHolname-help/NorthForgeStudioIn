import { lazy, type ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { RequireAdmin, RequireAuth, RequireClient, RequireGuest } from './guards/RequireRole';

/**
 * Route table (spec §127).
 *
 * Every page is code-split. The portal and admin *shells* are split too, not
 * just their pages: while both layouts were imported eagerly, the whole admin
 * chrome shipped in the bundle every marketing visitor downloads, because a
 * static `import` at the top of this file pulls its graph into the entry
 * chunk no matter which route renders it. Guards wrap the layouts so a direct
 * URL hit and a client-side navigation behave identically.
 *
 * Both shells are named exports, hence the `.then()` re-shaping.
 */
const PortalLayout = lazy(() =>
  import('@/layouts/PortalLayout').then((module) => ({ default: module.PortalLayout })),
);
const AdminLayout = lazy(() =>
  import('@/layouts/AdminLayout').then((module) => ({ default: module.AdminLayout })),
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lazyPage = (loader: () => Promise<{ default: ComponentType<any> }>) => lazy(loader);

/* ── Public ────────────────────────────────────────────────────── */
const Home = lazyPage(() => import('@/pages/public/Home'));
const HowItWorks = lazyPage(() => import('@/pages/public/HowItWorks'));
const PricingPage = lazyPage(() => import('@/pages/public/Pricing'));
const FaqPage = lazyPage(() => import('@/pages/public/Faq'));
const ContactPage = lazyPage(() => import('@/pages/public/Contact'));
const LoginPage = lazyPage(() => import('@/pages/public/Login'));
const RegisterPage = lazyPage(() => import('@/pages/public/Register'));
const ForgotPasswordPage = lazyPage(() => import('@/pages/public/ForgotPassword'));
const ResetPasswordPage = lazyPage(() => import('@/pages/public/ResetPassword'));
const MfaVerifyPage = lazyPage(() => import('@/pages/public/MfaVerify'));
const AuthCallbackPage = lazyPage(() => import('@/pages/public/AuthCallback'));
const PrivacyPage = lazyPage(() => import('@/pages/public/Legal'));
const NotFoundPage = lazyPage(() => import('@/pages/errors/NotFound'));
const UnauthorizedPage = lazyPage(() => import('@/pages/errors/Unauthorized'));
const ServerErrorPage = lazyPage(() => import('@/pages/errors/ServerError'));

/* ── Client portal ─────────────────────────────────────────────── */
const PortalOverview = lazyPage(() => import('@/pages/portal/Overview'));
const PortalProfile = lazyPage(() => import('@/pages/portal/Profile'));
const PortalWebsite = lazyPage(() => import('@/pages/portal/Website'));
const PortalProject = lazyPage(() => import('@/pages/portal/Project'));
const PortalLeads = lazyPage(() => import('@/pages/portal/Leads'));
const PortalAnalytics = lazyPage(() => import('@/pages/portal/Analytics'));
const PortalWhatsApp = lazyPage(() => import('@/pages/portal/WhatsApp'));
const PortalBookings = lazyPage(() => import('@/pages/portal/Bookings'));
const PortalSubscription = lazyPage(() => import('@/pages/portal/Subscription'));
const PortalInvoices = lazyPage(() => import('@/pages/portal/Invoices'));
const PortalRequests = lazyPage(() => import('@/pages/portal/Requests'));
const PortalSupport = lazyPage(() => import('@/pages/portal/Support'));
const PortalAnnouncements = lazyPage(() => import('@/pages/portal/Announcements'));
const PortalFiles = lazyPage(() => import('@/pages/portal/Files'));
const PortalSettings = lazyPage(() => import('@/pages/portal/Settings'));

/* ── Admin operating system ────────────────────────────────────── */
const AdminDashboard = lazyPage(() => import('@/pages/admin/Dashboard'));
const AdminLeads = lazyPage(() => import('@/pages/admin/Leads'));
const AdminLeadDetail = lazyPage(() => import('@/pages/admin/LeadDetail'));
const AdminPipeline = lazyPage(() => import('@/pages/admin/Pipeline'));
const AdminProposals = lazyPage(() => import('@/pages/admin/Proposals'));
const AdminFollowUps = lazyPage(() => import('@/pages/admin/FollowUps'));
const AdminOutreach = lazyPage(() => import('@/pages/admin/Outreach'));
const AdminClients = lazyPage(() => import('@/pages/admin/Clients'));
const AdminClientDetail = lazyPage(() => import('@/pages/admin/ClientDetail'));
const AdminRequests = lazyPage(() => import('@/pages/admin/Requests'));
const AdminOnboarding = lazyPage(() => import('@/pages/admin/Onboarding'));
const AdminProjects = lazyPage(() => import('@/pages/admin/Projects'));
const AdminWebsites = lazyPage(() => import('@/pages/admin/Websites'));
const AdminWebsiteDetail = lazyPage(() => import('@/pages/admin/WebsiteDetail'));
const AdminTasks = lazyPage(() => import('@/pages/admin/Tasks'));
const AdminCalendar = lazyPage(() => import('@/pages/admin/Calendar'));
const AdminAnalytics = lazyPage(() => import('@/pages/admin/Analytics'));
const AdminSeo = lazyPage(() => import('@/pages/admin/Seo'));
const AdminConversions = lazyPage(() => import('@/pages/admin/Conversions'));
const AdminWhatsApp = lazyPage(() => import('@/pages/admin/WhatsAppAdmin'));
const AdminWorkflows = lazyPage(() => import('@/pages/admin/Workflows'));
const AdminWorkflowBuilder = lazyPage(() => import('@/pages/admin/WorkflowBuilder'));
const AdminBookings = lazyPage(() => import('@/pages/admin/Bookings'));
const AdminSubscriptions = lazyPage(() => import('@/pages/admin/Subscriptions'));
const AdminPayments = lazyPage(() => import('@/pages/admin/Payments'));
const AdminInvoices = lazyPage(() => import('@/pages/admin/Invoices'));
const AdminPlans = lazyPage(() => import('@/pages/admin/Plans'));
const AdminServices = lazyPage(() => import('@/pages/admin/Services'));
const AdminNotifications = lazyPage(() => import('@/pages/admin/Notifications'));
const AdminAnnouncements = lazyPage(() => import('@/pages/admin/Announcements'));
const AdminActivity = lazyPage(() => import('@/pages/admin/Activity'));
const AdminSupport = lazyPage(() => import('@/pages/admin/Support'));
const AdminSystemHealth = lazyPage(() => import('@/pages/admin/SystemHealth'));
const AdminSettings = lazyPage(() => import('@/pages/admin/Settings'));

interface RouteDefinition {
  path: string;
  element: React.ReactNode;
  children?: { index?: true; path?: string; element: React.ReactNode }[];
}

export const AppRoutes: RouteDefinition[] = [
  /* ── Public marketing site ─────────────────────────────────── */
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'how-it-works', element: <HowItWorks /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'faq', element: <FaqPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <PrivacyPage /> },
      { path: 'error', element: <ServerErrorPage /> },
      {
        path: 'login',
        element: (
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        ),
      },
      {
        path: 'register',
        element: (
          <RequireGuest>
            <RegisterPage />
          </RequireGuest>
        ),
      },
      /* Where every emailed auth link lands (confirmation, magic link,
         recovery) — never guarded, it must run while signed out. */
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'mfa', element: <MfaVerifyPage /> },
      { path: 'unauthorized', element: <UnauthorizedPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  /* ── Client portal ─────────────────────────────────────────── */
  {
    path: '/portal',
    element: (
      <RequireClient>
        <PortalLayout />
      </RequireClient>
    ),
    children: [
      { index: true, element: <PortalOverview /> },
      { path: 'profile', element: <PortalProfile /> },
      { path: 'website', element: <PortalWebsite /> },
      { path: 'project', element: <PortalProject /> },
      { path: 'leads', element: <PortalLeads /> },
      { path: 'analytics', element: <PortalAnalytics /> },
      { path: 'whatsapp', element: <PortalWhatsApp /> },
      { path: 'bookings', element: <PortalBookings /> },
      { path: 'subscription', element: <PortalSubscription /> },
      { path: 'invoices', element: <PortalInvoices /> },
      { path: 'requests', element: <PortalRequests /> },
      { path: 'support', element: <PortalSupport /> },
      { path: 'announcements', element: <PortalAnnouncements /> },
      { path: 'files', element: <PortalFiles /> },
      { path: 'settings', element: <PortalSettings /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  /* ── Admin operating system ────────────────────────────────── */
  {
    path: '/app',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'leads', element: <AdminLeads /> },
      { path: 'leads/:id', element: <AdminLeadDetail /> },
      { path: 'pipeline', element: <AdminPipeline /> },
      { path: 'proposals', element: <AdminProposals /> },
      { path: 'follow-ups', element: <AdminFollowUps /> },
      { path: 'outreach', element: <AdminOutreach /> },
      { path: 'clients', element: <AdminClients /> },
      { path: 'clients/:id', element: <AdminClientDetail /> },
      { path: 'requests', element: <AdminRequests /> },
      { path: 'onboarding', element: <AdminOnboarding /> },
      { path: 'projects', element: <AdminProjects /> },
      { path: 'websites', element: <AdminWebsites /> },
      { path: 'websites/:id', element: <AdminWebsiteDetail /> },
      { path: 'tasks', element: <AdminTasks /> },
      { path: 'calendar', element: <AdminCalendar /> },
      { path: 'analytics', element: <AdminAnalytics /> },
      { path: 'seo', element: <AdminSeo /> },
      { path: 'conversions', element: <AdminConversions /> },
      { path: 'whatsapp', element: <AdminWhatsApp /> },
      { path: 'workflows', element: <AdminWorkflows /> },
      { path: 'workflows/:id', element: <AdminWorkflowBuilder /> },
      { path: 'bookings', element: <AdminBookings /> },
      { path: 'subscriptions', element: <AdminSubscriptions /> },
      { path: 'payments', element: <AdminPayments /> },
      { path: 'invoices', element: <AdminInvoices /> },
      { path: 'plans', element: <AdminPlans /> },
      { path: 'services', element: <AdminServices /> },
      { path: 'notifications', element: <AdminNotifications /> },
      { path: 'announcements', element: <AdminAnnouncements /> },
      { path: 'activity', element: <AdminActivity /> },
      { path: 'support', element: <AdminSupport /> },
      { path: 'system-health', element: <AdminSystemHealth /> },
      { path: 'settings', element: <AdminSettings /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  /* ── Signed-in users hitting /login are redirected by the guard ─ */
  {
    path: '/me',
    element: <RequireAuth />,
    children: [{ index: true, element: <Navigate to="/" replace /> }],
  },
];
