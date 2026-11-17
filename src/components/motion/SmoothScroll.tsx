import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setScrollProgress } from '@/hooks/scrollProgress';
import { LENIS_CONFIG } from '@/components/motion/constants';

gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollValue {
  lenis: Lenis | null;
  scrollTo: (
    target: string | number | HTMLElement,
    options?: {
      offset?: number;
      immediate?: boolean;
      duration?: number;
      easing?: (t: number) => number;
      lock?: boolean;
    },
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
 */
export function SmoothScrollProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const instanceRef = useRef<Lenis | null>(null);
  const momentumRef = useRef<{ remaining: number; targetOffset: number }>({
    remaining: 0,
    targetOffset: 0,
  });

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    // Mark documentElement so CSS rules (height: auto, scroll-behavior: auto !important) apply
    document.documentElement.classList.add('lenis', 'lenis-smooth');

    const momentum = momentumRef.current;
    momentum.remaining = 0;
    momentum.targetOffset = window.scrollY;

    // Root instance configured with kinematic damping (lerp) for continuous exponential damping.
    // By omitting duration and easing from the root options, Lenis uses frame-independent
    // lerp damping on mouse wheel events rather than stepped duration-based easing curves.
    // In addition, virtualScroll intercepts discrete notched mouse wheel ticks and feeds them
    // into our frame-independent continuous momentum integrator, blending successive notches
    // into silky-smooth continuous glide without stepped velocity spikes.
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
      respectReducedMotion: false,
      anchors: {
        offset: -76,
        duration: LENIS_CONFIG.anchorDuration,
        easing: LENIS_CONFIG.easing,
      },
      stopInertiaOnNavigate: true,
      virtualScroll: (data) => {
        // Continuous momentum integration for physical mouse wheels:
        // Desktop mouse wheels send discrete notch ticks (deltaMode 1, or deltaY multiples of 100/120)
        // rather than continuous high-frequency stream deltas. By intercepting discrete notches,
        // we feed an impulse into our frame-independent momentum integrator that bleeds smoothly
        // into targetScroll across frames, eliminating stepped velocity shocks on each wheel detent notch.
        if (data.event.type === 'wheel') {
          const wheelEv = data.event as WheelEvent;
          const isNotched =
            wheelEv.deltaMode !== 0 ||
            Math.abs(data.deltaY) >= 30 ||
            (data.deltaY !== 0 && data.deltaY % 10 === 0);

          if (isNotched) {
            if (data.event.cancelable) data.event.preventDefault();

            // Reverse direction protection: immediately sync to current scroll position
            // if the user turns the wheel in the opposite direction
            if (
              (data.deltaY > 0 && momentum.remaining < 0) ||
              (data.deltaY < 0 && momentum.remaining > 0)
            ) {
              momentum.remaining = 0;
              momentum.targetOffset = instance.animatedScroll;
            } else if (Math.abs(momentum.remaining) < 1) {
              momentum.targetOffset = instance.targetScroll;
            }

            momentum.remaining += data.deltaY;
            return false;
          }
        }
        return true;
      },
    });
    instanceRef.current = instance;
    setLenis(instance);

    const onScroll = (e: { progress?: number }) => {
      ScrollTrigger.update();
      setScrollProgress(e.progress ?? instance.progress);
    };
    instance.on('scroll', onScroll);

    const raf = (time: number, deltaTime?: number) => {
      // Frame-independent continuous momentum integration for notched mouse wheels:
      // Gradually bleed the accumulated wheel impulse into targetScroll across frames,
      // eliminating the harsh stepped velocity shock on each wheel detent notch.
      if (Math.abs(momentum.remaining) > 0.05) {
        const dt = Math.min((deltaTime || 16.67) * 0.001, 0.1);
        const fraction = 1 - Math.exp(-18 * dt);
        const chunk = momentum.remaining * fraction;
        momentum.remaining -= chunk;
        momentum.targetOffset = Math.max(0, Math.min(instance.limit, momentum.targetOffset + chunk));
        instance.scrollTo(momentum.targetOffset, {
          programmatic: false,
          lerp: LENIS_CONFIG.lerp,
        });
      } else if (momentum.remaining !== 0) {
        momentum.remaining = 0;
      }

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
        if (!mounted) return;
        instance.resize();
        ScrollTrigger.refresh();
        resizeTimer = null;
      }, 150);
    };
    const onWindowLoad = () => {
      if (!mounted) return;
      instance.resize();
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', onWindowResize, { passive: true });
    window.addEventListener('load', onWindowLoad);

    return () => {
      mounted = false;
      momentum.remaining = 0;
      cancelAnimationFrame(refreshTimer);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('load', onWindowLoad);
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      instance.off('scroll', onScroll);
      instance.destroy();
      instanceRef.current = null;
      setLenis(null);
    };
  }, [enabled]);

  const value = useMemo<SmoothScrollValue>(
    () => ({
      lenis,
      scrollTo: (target, options) => {
        momentumRef.current.remaining = 0;
        const instance = instanceRef.current;
        if (instance) {
          instance.scrollTo(target as never, {
            offset: options?.offset ?? 0,
            immediate: options?.immediate,
            duration: options?.immediate ? 0 : (options?.duration ?? LENIS_CONFIG.anchorDuration),
            easing: options?.immediate
              ? undefined
              : (options?.easing ?? LENIS_CONFIG.easing),
            lock: options?.lock,
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
      stop: () => {
        momentumRef.current.remaining = 0;
        instanceRef.current?.stop();
      },
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
