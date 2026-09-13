import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgress } from '@/components/motion';
import { SmoothScrollProvider } from '@/components/motion/SmoothScroll';
import { PageTransition } from '@/components/motion';
import { useTheme } from '@/app/providers/ThemeProvider';

/**
 * Public marketing shell.
 *
 * Lenis is enabled here only (spec §9) — the portal and admin keep native
 * scrolling for data density and performance.
 *
 * The public site is pinned to the warm cream theme (spec: dark mode is a
 * dashboard feature only). Clients — often reading on phones in daylight —
 * get one premium, consistent brand experience here; the saved theme
 * preference still applies as soon as they reach the portal or admin.
 */
export function PublicLayout() {
  const { pathname, hash } = useLocation();
  const { setOverride } = useTheme();

  // Enter the marketing site: force the cream theme.
  useEffect(() => {
    setOverride('light');
    return () => setOverride(null);
  }, [setOverride]);

  useEffect(() => {
    // Arriving with a hash (e.g. /#work) scrolls to that section instead
    // of the top; otherwise every route change starts at the top.
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return (
    <SmoothScrollProvider>
      <div className="flex min-h-screen flex-col bg-canvas">
        <ScrollProgress />
        <Navbar />
        <main id="main" className="flex-1 pt-16 lg:pt-[72px]">
          <PageTransition variant="expressive">
            <Outlet />
          </PageTransition>
        </main>
        <Footer />
      </div>
    </SmoothScrollProvider>
  );
}
