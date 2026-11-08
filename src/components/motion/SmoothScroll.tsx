import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/hooks';
import { setScrollProgress } from '@/hooks/scrollProgress';
import { LENIS_CONFIG } from '@/components/motion/constants';

gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollValue {
  lenis: Lenis | null;
  scrollTo: (
    target: string | number | HTMLElement,
    options?: { offset?: number; immediate?: boolean; duration?: number; easing?: (t: number) => number },
  ) => void;
  stop: () => void;
  start: () => void;
}

const SmoothScrollContext = createContext<SmoothScrollValue | null>(null);

/**
 * Lenis smooth scrolling, used on the public website only (spec §9).
 *
 * • Uses frame-independent exponential damping (lerp) for continuous,
 *   silky-smooth momentum gliding where individual wheel notches blend seamlessly.
 * • Drives GSAP ScrollTrigger from a single ticker so the two never fight.
 * • Never takes over the browser's scroll — native scroll, anchors,
 *   keyboard navigation and find-in-page all keep working.
 * • Disables itself completely under `prefers-reduced-motion`.
 */
export function SmoothScrollProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const reduced = useReducedMotion();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const instanceRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled || reduced) return;

    let mounted = true;

    // Mark documentElement so CSS rules (height: auto, scroll-behavior: auto !important) apply
    document.documentElement.classList.add('lenis', 'lenis-smooth');

    // Root instance configured with kinematic damping (lerp) rather than fixed duration/easing.
    // This allows successive mouse wheel notches to smoothly accumulate into targetScroll
    // and damp continuously without resetting currentTime or creating stepped acceleration jolts.
    const instance = new Lenis({
      lerp: LENIS_CONFIG.lerp,
      wheelMultiplier: LENIS_CONFIG.wheelMultiplier,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      // Leave touch devices on native momentum scrolling — it feels natural
      // and avoids fighting the platform (spec §9, §147).
      syncTouch: LENIS_CONFIG.syncTouch,
      touchMultiplier: LENIS_CONFIG.touchMultiplier,
      autoResize: LENIS_CONFIG.autoResize,
      anchors: {
        offset: -76,
        duration: LENIS_CONFIG.anchorDuration,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      },
      stopInertiaOnNavigate: true,
    });
    instanceRef.current = instance;
    setLenis(instance);

    const onScroll = (e: { progress?: number }) => {
      ScrollTrigger.update();
      setScrollProgress(e.progress ?? instance.progress);
    };
    instance.on('scroll', onScroll);

    const raf = (time: number) => {
      instance.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Ensure triggers calculate exact geometry with Lenis active
    const refreshTimer = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    // Re-calculate geometry and refresh triggers once custom webfonts are loaded
    if (document.fonts?.ready) {
      document.fonts.ready
        .then(() => {
          if (!mounted) return;
          instance.resize();
          ScrollTrigger.refresh();
        })
        .catch(() => undefined);
    }

    let resizeTimer: number | null = null;
    const onWindowResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        ScrollTrigger.refresh();
        resizeTimer = null;
      }, 150);
    };
    window.addEventListener('resize', onWindowResize, { passive: true });

    return () => {
      mounted = false;
      cancelAnimationFrame(refreshTimer);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onWindowResize);
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      instance.off('scroll', onScroll);
      instance.destroy();
      instanceRef.current = null;
      setLenis(null);
    };
  }, [enabled, reduced]);

  const value = useMemo<SmoothScrollValue>(
    () => ({
      lenis,
      scrollTo: (target, options) => {
        const instance = instanceRef.current;
        if (instance) {
          instance.scrollTo(target as never, {
            offset: options?.offset ?? 0,
            immediate: options?.immediate,
            duration: options?.immediate ? 0 : (options?.duration ?? LENIS_CONFIG.anchorDuration),
            easing: options?.immediate
              ? undefined
              : (options?.easing ?? ((t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)))),
          });
          return;
        }
        // Fallback for reduced-motion / touch / admin routes.
        if (typeof target === 'string') {
          document.querySelector(target)?.scrollIntoView({ behavior: options?.immediate ? 'auto' : 'smooth', block: 'start' });
        } else if (typeof target === 'number') {
          window.scrollTo({ top: target, behavior: options?.immediate ? 'auto' : 'smooth' });
        } else {
          target.scrollIntoView({ behavior: options?.immediate ? 'auto' : 'smooth', block: 'start' });
        }
      },
      stop: () => instanceRef.current?.stop(),
      start: () => instanceRef.current?.start(),
    }),
    [lenis],
  );

  return <SmoothScrollContext.Provider value={value}>{children}</SmoothScrollContext.Provider>;
}

export function useSmoothScroll() {
  const context = useContext(SmoothScrollContext);
  // Return a no-op implementation outside the provider (portal, admin).
  return (
    context ?? {
      lenis: null,
      scrollTo: (target: string | number | HTMLElement) => {
        if (typeof target === 'string') document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
        else if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'smooth' });
        else target.scrollIntoView({ behavior: 'smooth' });
      },
      stop: () => {},
      start: () => {},
    }
  );
}
