import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/hooks';

gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollValue {
  lenis: Lenis | null;
  scrollTo: (target: string | number | HTMLElement, options?: { offset?: number; immediate?: boolean }) => void;
  stop: () => void;
  start: () => void;
}

const SmoothScrollContext = createContext<SmoothScrollValue | null>(null);

/**
 * Lenis smooth scrolling, used on the public website only (spec §9).
 *
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

    const instance = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      // Leave touch devices on native momentum scrolling — it feels better
      // and avoids fighting the platform (spec §9, §147).
      syncTouch: false,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
    });
    instanceRef.current = instance;
    setLenis(instance);

    const onScroll = () => ScrollTrigger.update();
    instance.on('scroll', onScroll);

    const raf = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
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
          instance.scrollTo(target as never, { offset: options?.offset ?? 0, immediate: options?.immediate });
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
