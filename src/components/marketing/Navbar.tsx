import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Menu, MessageCircle, X } from 'lucide-react';
import { gsap } from 'gsap';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/brand/Logo';
import { Button, LinkButton } from '@/components/ui/Button';
import { StaggerMenu, StaggerItem } from '@/components/motion/primitives';
import { PUBLIC_NAV, whatsappLink } from '@/data/site';
import { useScrolled, useReducedMotion, useFocusTrap } from '@/hooks';
import { useSmoothScroll } from '@/components/motion/SmoothScroll';

/**
 * Public navigation.
 *
 * Sits in the page as a floating pill — quiet at rest, gains a surface and
 * elevation once scrolling starts. The active-section indicator slides
 * between links, so on the homepage you always know where you are.
 *
 * Mobile opens a full panel whose contents cascade in with a GSAP stagger;
 * it is focus-trapped, closes on Escape and locks the page behind it.
 */
export function Navbar() {
  const scrolled = useScrolled(12);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const location = useLocation();
  const reduced = useReducedMotion();
  const { stop, start, scrollTo } = useSmoothScroll();

  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap<HTMLDivElement>(menuOpen);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  /* ── Scroll lock while the mobile panel is open ─────────────── */
  useEffect(() => {
    if (!menuOpen) return;
    stop();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      start();
    };
  }, [menuOpen, stop, start]);

  /* ── Scroll spy: which section is currently in view ─────────── */
  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveId(null);
      return;
    }
    const sections = PUBLIC_NAV.map((item) => document.getElementById(item.id)).filter(
      (node): node is HTMLElement => Boolean(node),
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [location.pathname]);

  /* ── Slide the indicator to the active link ─────────────────── */
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const target = activeId
      ? list.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`)
      : null;

    if (!target) {
      gsap.to(indicator, { opacity: 0, duration: reduced ? 0 : 0.25 });
      return;
    }

    gsap.to(indicator, {
      x: target.offsetLeft,
      width: target.offsetWidth,
      opacity: 1,
      duration: reduced ? 0 : 0.45,
      ease: 'power3.out',
    });
  }, [activeId, reduced]);

  const goToSection = (id: string) => {
    setMenuOpen(false);
    const target = document.getElementById(id);
    if (target) scrollTo(target, { offset: -96 });
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-[60] pt-3 sm:pt-4">
        <div className="nf-shell">
          <div
            className={cn(
              'flex items-center justify-between gap-4 rounded-full border px-3 py-2 transition-[background-color,border-color,box-shadow,padding] duration-500 ease-forge sm:px-4',
              scrolled
                ? 'border-line bg-[rgb(var(--nf-canvas)/0.78)] shadow-lift backdrop-blur-xl supports-[backdrop-filter]:bg-[rgb(var(--nf-canvas)/0.62)]'
                : 'border-transparent bg-transparent',
            )}
          >
            <Link to="/" className="nf-focus shrink-0 rounded-full pl-1" aria-label="NorthForge home">
              <Logo />
            </Link>

            {/* Desktop links */}
            <nav aria-label="Primary" className="hidden lg:block">
              <div ref={listRef} className="relative flex items-center gap-1">
                <span
                  ref={indicatorRef}
                  aria-hidden
                  className="absolute left-0 top-0 h-full rounded-full bg-elevated opacity-0"
                  style={{ width: 0, transform: 'translateX(0)' }}
                />
                {PUBLIC_NAV.map((item) => {
                  const isActive = activeId === item.id;
                  return (
                    <button
                      key={item.to}
                      data-nav-id={item.id}
                      type="button"
                      onClick={() => {
                        if (location.pathname === '/') goToSection(item.id);
                      }}
                      className={cn(
                        'relative rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-300',
                        isActive ? 'text-fg' : 'text-muted hover:text-fg',
                      )}
                    >
                      {location.pathname === '/' ? (
                        item.label
                      ) : (
                        <Link to={item.to} className="block">
                          {item.label}
                        </Link>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="flex items-center gap-1.5">
              <a
                href={whatsappLink('Hi NorthForge — I would like to know more.')}
                target="_blank"
                rel="noreferrer noopener"
                className="nf-focus hidden h-9 items-center gap-2 rounded-full px-3 text-[13px] text-muted transition-colors hover:bg-elevated hover:text-fg sm:inline-flex"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>

              <Link
                to="/login"
                className="nf-focus hidden h-9 items-center rounded-full border border-line bg-surface/60 px-3.5 text-[13px] font-medium text-fg transition-colors hover:border-line-strong hover:bg-elevated sm:inline-flex"
              >
                Client login
              </Link>

              <LinkButton to="/contact" size="sm" className="hidden sm:inline-flex">
                Get started
              </LinkButton>

              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile panel ─────────────────────────────────────── */}
      {menuOpen ? (
        <div className="fixed inset-0 z-[59] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[rgb(var(--nf-scrim))] backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-x-3 top-[4.75rem] overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-panel"
          >
            <StaggerMenu open={menuOpen}>
              <nav aria-label="Mobile" className="flex flex-col">
                {PUBLIC_NAV.map((item) => (
                  <StaggerItem key={item.to}>
                    {location.pathname === '/' ? (
                      <button
                        type="button"
                        onClick={() => goToSection(item.id)}
                        className="flex w-full items-center justify-between border-b border-line py-3.5 text-left text-[15px] text-fg"
                      >
                        {item.label}
                        <ArrowUpRight className="h-4 w-4 text-faint" aria-hidden />
                      </button>
                    ) : (
                      <Link
                        to={item.to}
                        className="flex w-full items-center justify-between border-b border-line py-3.5 text-left text-[15px] text-fg"
                      >
                        {item.label}
                        <ArrowUpRight className="h-4 w-4 text-faint" aria-hidden />
                      </Link>
                    )}
                  </StaggerItem>
                ))}
              </nav>

              <StaggerItem className="mt-5">
                <LinkButton to="/contact" fullWidth size="lg">
                  Get started
                </LinkButton>
              </StaggerItem>

              <StaggerItem className="mt-2.5">
                <a
                  href={whatsappLink('Hi NorthForge — I would like to know more.')}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="nf-focus flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line text-[13px] font-medium text-fg transition-colors hover:bg-elevated"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Talk on WhatsApp
                </a>
              </StaggerItem>

              <StaggerItem className="mt-2.5">
                <Link
                  to="/login"
                  className="nf-focus flex h-11 w-full items-center justify-center rounded-md border border-line text-[13px] font-medium text-fg transition-colors hover:bg-elevated"
                >
                  Client login
                </Link>
              </StaggerItem>
            </StaggerMenu>
          </div>
        </div>
      ) : null}
    </>
  );
}
