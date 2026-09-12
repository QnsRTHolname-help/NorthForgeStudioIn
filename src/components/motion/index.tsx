import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '@/lib/cn';
import { useReducedMotion, useIsTouch } from '@/hooks';

gsap.registerPlugin(ScrollTrigger);

/**
 * Motion primitives (spec §8).
 *
 * Rules enforced here:
 * • Every animation is registered in a gsap.context and reverted on unmount
 *   (no ScrollTrigger leaks between routes).
 * • Under `prefers-reduced-motion` elements render in their final state —
 *   nothing is hidden waiting for an animation that will not run.
 * • Cursor-driven effects are disabled on touch devices.
 */

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* ── FadeUp / FadeIn — the workhorse reveal ────────────────────── */

export function FadeUp({
  children,
  delay = 0,
  y = 18,
  duration = 0.7,
  className,
  as: Tag = 'div',
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  as?: 'div' | 'section' | 'span' | 'li' | 'p' | 'h1' | 'h2';
  once?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: node, start: 'top 88%', once },
        },
      );
    }, node);

    return () => ctx.revert();
  }, [delay, y, duration, once, reduced]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}

/* ── Stagger ───────────────────────────────────────────────────── */

export function Stagger({
  children,
  className,
  stagger = 0.08,
  y = 20,
  start = 'top 85%',
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>(node.children);
      gsap.fromTo(
        items,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration: 0.65, stagger, ease: 'power3.out', scrollTrigger: { trigger: node, start, once: true } },
      );
    }, node);

    return () => ctx.revert();
  }, [stagger, y, start, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Child of <Stagger> that still animates if used standalone. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/* ── Masked text reveal (headline choreography) ────────────────── */

export function TextReveal({
  text,
  className,
  delay = 0,
  stagger = 0.055,
  as: Tag = 'span',
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  as?: 'span' | 'h1' | 'h2' | 'p';
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(' '), [text]);

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        node.querySelectorAll('[data-word]'),
        { yPercent: 108, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.85, ease: 'power4.out', stagger, delay },
      );
    }, node);

    return () => ctx.revert();
  }, [delay, stagger, reduced, words.length]);

  return (
    <Tag ref={ref as never} className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <span data-word className="inline-block will-change-transform">
            {word}
            {index < words.length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </Tag>
  );
}

/* ── Parallax ──────────────────────────────────────────────────── */

export function Parallax({
  children,
  distance = 60,
  className,
  scale,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
  scale?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const touch = useIsTouch();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduced || touch) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { y: -distance / 2 },
        {
          y: distance / 2,
          ...(scale ? { scale } : {}),
          ease: 'none',
          scrollTrigger: { trigger: node, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        },
      );
    }, node);

    return () => ctx.revert();
  }, [distance, scale, reduced, touch]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/* ── Animated counter (KPIs) ───────────────────────────────────── */

export function AnimatedCounter({
  value,
  duration = 1.1,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const counter = { current: 0 };
    const tween = gsap.to(counter, {
      current: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => setDisplay(counter.current),
    });
    return () => {
      tween.kill();
    };
  }, [value, duration, reduced]);

  return (
    <span ref={ref} className={cn('nf-num', className)}>
      {prefix}
      {display.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ── Marquee (proof strip) ─────────────────────────────────────── */

export function Marquee({
  children,
  speed = 42,
  className,
  pauseOnHover = true,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
  pauseOnHover?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <div className={cn('nf-mask-fade-x group relative w-full overflow-hidden', className)} aria-hidden={false}>
      <div
        className={cn('flex w-max gap-10', !reduced && 'animate-marquee', pauseOnHover && 'group-hover:[animation-play-state:paused]')}
        style={reduced ? undefined : { animationDuration: `${speed}s` }}
      >
        <div className="flex shrink-0 gap-10">{children}</div>
        <div className="flex shrink-0 gap-10">{children}</div>
      </div>
    </div>
  );
}

/* ── Magnetic button (desktop pointer only) ────────────────────── */

export function Magnetic({
  children,
  strength = 0.28,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const touch = useIsTouch();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || touch) return;

    const quickX = gsap.quickTo(node, 'x', { duration: 0.5, ease: 'power3.out' });
    const quickY = gsap.quickTo(node, 'y', { duration: 0.5, ease: 'power3.out' });

    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      quickX((event.clientX - (rect.left + rect.width / 2)) * strength);
      quickY((event.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const onLeave = () => {
      quickX(0);
      quickY(0);
    };

    node.addEventListener('mousemove', onMove);
    node.addEventListener('mouseleave', onLeave);
    return () => {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
      gsap.killTweensOf(node);
    };
  }, [strength, reduced, touch]);

  return (
    <div ref={ref} className={cn('inline-block', className)}>
      {children}
    </div>
  );
}

/* ── Card spotlight (pointer follow, restrained) ───────────────── */

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const touch = useIsTouch();

  useEffect(() => {
    const node = ref.current;
    if (!node || touch) return;

    const onMove = (event: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      node.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      node.style.setProperty('--my', `${event.clientY - rect.top}px`);
    };
    node.addEventListener('mousemove', onMove);
    return () => node.removeEventListener('mousemove', onMove);
  }, [touch]);

  return (
    <div
      ref={ref}
      className={cn('group relative overflow-hidden rounded-lg border border-line bg-surface', className)}
      style={{ ['--mx' as string]: '50%', ['--my' as string]: '50%' }}
    >
      {!touch ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(340px circle at var(--mx) var(--my), rgb(var(--nf-blue) / 0.07), transparent 62%)',
          }}
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ── Scroll progress bar ───────────────────────────────────────── */

export function ScrollProgress({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
        },
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className={cn('fixed inset-x-0 top-0 z-[70] h-px bg-transparent', className)} aria-hidden>
      <div ref={ref} className="h-full origin-left bg-brand" style={{ transform: 'scaleX(0)' }} />
    </div>
  );
}

/* ── Route transition ──────────────────────────────────────────── */

export function PageTransition({
  children,
  variant = 'subtle',
}: {
  children: ReactNode;
  variant?: 'expressive' | 'moderate' | 'subtle';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduced || variant === 'subtle') return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { opacity: 0, y: variant === 'expressive' ? 14 : 8 },
        {
          opacity: 1,
          y: 0,
          duration: variant === 'expressive' ? 0.5 : 0.35,
          ease: 'power2.out',
          // Clear the inline transform when the intro finishes. A leftover
          // transform (even translate(0,0)) on this wrapper makes it the
          // containing block for position:fixed descendants, which desyncs
          // ScrollTrigger's fixed-position pinning — visibly glitching the
          // pinned How It Works storyboard while scrolling.
          clearProps: 'transform,opacity',
        },
      );
    }, node);
    return () => ctx.revert();
  }, [variant, reduced]);

  return (
    <div ref={ref} className="min-h-0">
      {children}
    </div>
  );
}

/* ── Section reveal used by marketing sections ─────────────────── */

export function Reveal({
  children,
  className,
  start = 'top 82%',
  delay = 0,
  y = 26,
}: {
  children: ReactNode;
  className?: string;
  start?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: node, start, once: true },
        },
      );
    }, node);
    return () => ctx.revert();
  }, [start, reduced, delay, y]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export { gsap, ScrollTrigger };
