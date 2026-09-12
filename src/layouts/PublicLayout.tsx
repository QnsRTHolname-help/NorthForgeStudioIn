import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { ScrollProgress } from '@/components/motion';
import { SmoothScrollProvider } from '@/components/motion/SmoothScroll';
import { PageTransition } from '@/components/motion';

/**
 * Public marketing shell.
 *
 * Lenis is enabled here only (spec §9) — the portal and admin keep native
 * scrolling for data density and performance.
 */
export function PublicLayout() {
  const { pathname, hash } = useLocation();

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
