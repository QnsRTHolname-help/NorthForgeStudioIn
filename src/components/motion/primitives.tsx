import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { gsap, ScrollTrigger } from '@/components/motion';
import { useIsTouch, useReducedMotion } from '@/hooks';
import { cn } from '@/lib/cn';

/**
 * NorthForge interaction primitives.
 *
 * One animation architecture, applied consistently:
 *   Lenis      → scroll foundation (SmoothScrollProvider)
 *   GSAP       → choreography and timelines
 *   ScrollTrigger → anything driven by scroll position
 *
 * Rules these components all follow:
 *   · every effect is created inside gsap.context() and reverted on unmount
 *   · prefers-reduced-motion degrades to a plain fade or nothing at all
 *   · touch devices never get hover-only or cursor-only behaviour
 *   · only transform / opacity / clip-path are animated
 */

/* ═══════════════════════════════════════════════════════════════
   SPLIT TEXT — line / word / character reveal behind a mask
   ═══════════════════════════════════════════════════════════════ */

export function SplitText({
  text,
  as: Tag = 'span',
  by = 'word',
  className,
  wordClassName,
  delay = 0,
  stagger = 0.055,
  duration = 0.9,
  start = 'top 85%',
  trigger = 'scroll',
  fade = true,
}: {
  text: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
  by?: 'word' | 'char' | 'line';
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  start?: string;
  trigger?: 'scroll' | 'mount';
  /**
   * Whether the units also fade. Set false for above-the-fold text: opacity 0
   * makes an element ineligible as a Largest Contentful Paint candidate until
   * the tween runs, so the largest text on the page stayed unpainted for the
   * length of its delay. The units sit inside an `overflow-hidden` mask, so
   * sliding them up on transform alone reads the same and paints immediately.
   */
  fade?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  // Splitting is pure string work — safe to memoise on content + mode.
  const units = useCallback(() => {
    if (by === 'char') return text.split('');
    if (by === 'line') return text.split('\n');
    return text.split(' ');
  }, [text, by])();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduced) {
      gsap.set(node.querySelectorAll('[data-split-inner]'), { yPercent: 0, opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      const inners = node.querySelectorAll('[data-split-inner]');
      gsap.fromTo(
        inners,
        fade ? { yPercent: 118, opacity: 0 } : { yPercent: 118 },
        {
          yPercent: 0,
          opacity: 1,
          duration,
          delay,
          ease: 'expo.out',
          stagger: by === 'char' ? stagger * 0.35 : stagger,
          ...(trigger === 'scroll' ? { scrollTrigger: { trigger: node, start, once: true } } : {}),
        },
      );
    }, node);

    return () => ctx.revert();
  }, [reduced, by, delay, stagger, duration, start, trigger, fade, units.length]);

  return (
    <Tag ref={ref as never} className={className}>
      {units.map((unit, index) => (
        <span
          key={`${unit}-${index}`}
          className={cn('inline-block overflow-hidden align-bottom', by === 'word' && 'whitespace-pre')}
          style={{ paddingBottom: '0.06em', marginBottom: '-0.06em' }}
          aria-hidden
        >
          <span data-split-inner className={cn('inline-block will-change-transform', wordClassName)}>
            {unit}
          </span>
          {by === 'word' && index < units.length - 1 ? ' ' : null}
        </span>
      ))}
      <span className="sr-only">{text}</span>
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TEXT SCRAMBLE — settles into the real string
   ═══════════════════════════════════════════════════════════════ */

const SCRAMBLE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789<>/\\_—+*';

export function TextScramble({
  text,
  className,
  duration = 1100,
}: {
  text: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (reduced) {
      setDisplay(text);
      return;
    }
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    let startedAt = 0;
    let running = false;
    let observer: IntersectionObserver | null = null;

    const step = (now: number) => {
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / duration);
      const revealed = Math.floor(progress * text.length);

      setDisplay(
        text
          .split('')
          .map((char, index) => {
            if (index < revealed || char === ' ') return char;
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]!;
          })
          .join(''),
      );

      if (progress < 1) frame = requestAnimationFrame(step);
      else setDisplay(text);
    };

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !running) {
          running = true;
          observer?.disconnect();
          frame = requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [text, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden>{display}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHINY TEXT — a light sweep across a word or short phrase
   ═══════════════════════════════════════════════════════════════ */

export function ShinyText({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span
      className={cn('relative inline-block', className)}
      style={
        reduced
          ? undefined
          : {
              backgroundImage:
                'linear-gradient(105deg, rgb(var(--nf-muted)) 30%, rgb(var(--nf-fg)) 45%, rgb(var(--nf-blue)) 55%, rgb(var(--nf-muted)) 70%)',
              backgroundSize: '220% 100%',
              backgroundPosition: '120% 0',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              animation: 'nf-shiny 5.5s ease-in-out infinite',
            }
      }
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TILT CARD — pointer-tracked 3D tilt (desktop, motion-allowed only)
   ═══════════════════════════════════════════════════════════════ */

export function TiltCard({
  children,
  className,
  max = 7,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const touch = useIsTouch();

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || reduced || touch) return;
    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    gsap.to(node, {
      rotateY: (px - 0.5) * max * 2,
      rotateX: -(py - 0.5) * max * 2,
      duration: 0.5,
      ease: 'power3.out',
      transformPerspective: 900,
    });

    if (glare) {
      node.style.setProperty('--nf-tilt-x', `${px * 100}%`);
      node.style.setProperty('--nf-tilt-y', `${py * 100}%`);
    }
  };

  const onLeave = () => {
    const node = ref.current;
    if (!node || reduced || touch) return;
    gsap.to(node, { rotateX: 0, rotateY: 0, duration: 0.7, ease: 'power3.out' });
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn('relative will-change-transform', className)}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
      {glare && !reduced && !touch ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(320px circle at var(--nf-tilt-x, 50%) var(--nf-tilt-y, 50%), rgb(var(--nf-blue) / 0.10), transparent 62%)',
          }}
        />
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BENTO — asymmetric grid with hairline borders and hover spotlight
   ═══════════════════════════════════════════════════════════════ */

export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:gap-4',
        'grid-cols-1 md:grid-cols-6 auto-rows-[minmax(0,auto)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoItem({
  children,
  className,
  span = 'md:col-span-2',
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  span?: string;
  tone?: 'default' | 'brand' | 'quiet';
}) {
  const tones = {
    default: 'bg-surface',
    brand: 'bg-gradient-to-br from-brand/[0.10] via-transparent to-brand-violet/[0.07]',
    quiet: 'bg-sunken/40',
  } as const;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-line p-5 transition-[border-color,transform] duration-500 ease-forge hover:border-line-strong sm:p-6',
        tones[tone],
        span,
        className,
      )}
    >
      {/* Hairline top highlight — reads as a lit edge on dark surfaces. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CURSOR GLOW — desktop-only ambient light inside a container
   ═══════════════════════════════════════════════════════════════ */

export function CursorGlow({
  className,
  size = 520,
  color = 'rgb(var(--nf-blue) / 0.10)',
}: {
  className?: string;
  size?: number;
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const touch = useIsTouch();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || touch) return;

    const quickX = gsap.quickTo(node, 'x', { duration: 0.6, ease: 'power3.out' });
    const quickY = gsap.quickTo(node, 'y', { duration: 0.6, ease: 'power3.out' });

    const onMove = (event: PointerEvent) => {
      const parent = node.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      quickX(event.clientX - rect.left - size / 2);
      quickY(event.clientY - rect.top - size / 2);
    };

    const parent = node.parentElement ?? window;
    parent.addEventListener('pointermove', onMove as EventListener);
    return () => parent.removeEventListener('pointermove', onMove as EventListener);
  }, [reduced, touch, size]);

  if (reduced || touch) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute left-0 top-0 rounded-full blur-[80px]', className)}
      style={{ width: size, height: size, background: `radial-gradient(circle, ${color}, transparent 68%)` }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL STACK — cards that stack and settle as you scroll
   ═══════════════════════════════════════════════════════════════ */

export function ScrollStack({
  children,
  className,
  itemClassName,
}: {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('[data-stack-card]');
      cards.forEach((card, index) => {
        if (index === cards.length - 1) return;
        gsap.to(card, {
          scale: 1 - (cards.length - index) * 0.022,
          yPercent: -4,
          opacity: 0.35,
          ease: 'none',
          scrollTrigger: {
            trigger: cards[index + 1]!,
            start: 'top bottom',
            end: 'top top',
            scrub: true,
          },
        });
      });
    }, node);

    return () => ctx.revert();
  }, [reduced, children.length]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {children.map((child, index) => (
        <div
          key={index}
          data-stack-card
          className={cn(
            'sticky bg-surface',
            index === 0 ? 'top-24' : 'top-24',
            itemClassName,
          )}
          style={{ top: `calc(6rem + ${index * 14}px)`, zIndex: index + 1 }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE / PANEL REVEAL — clip-path wipe
   ═══════════════════════════════════════════════════════════════ */

export function RevealPanel({
  children,
  className,
  delay = 0,
  start = 'top 85%',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Reduced motion: soft fade instead of the clip wipe (no layout motion).
    const ctx = gsap.context(() => {
      gsap.fromTo(
        node,
        reduced ? { opacity: 0 } : { clipPath: 'inset(0% 0% 100% 0%)', opacity: 0.4 },
        reduced
          ? { opacity: 1, duration: 0.4, delay, ease: 'power2.out', scrollTrigger: { trigger: node, start, once: true } }
          : {
              clipPath: 'inset(0% 0% 0% 0%)',
              opacity: 1,
              duration: 1.1,
              delay,
              ease: 'expo.out',
              scrollTrigger: { trigger: node, start, once: true },
            },
      );
    }, node);
    return () => ctx.revert();
  }, [reduced, delay, start]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAGGER MENU — nav links and actions cascade in
   ═══════════════════════════════════════════════════════════════ */

export function StaggerMenu({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !open) return;

    if (reduced) {
      gsap.set(node.querySelectorAll('[data-stagger-item]'), { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        node.querySelectorAll('[data-stagger-item]'),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.055, ease: 'power3.out', delay: 0.05 },
      );
    }, node);

    return () => ctx.revert();
  }, [open, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function StaggerItem({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div data-stagger-item className={className} style={style}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOVER LIFT / RULE — restrained micro-interactions
   ═══════════════════════════════════════════════════════════════ */

export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'transition-[transform,border-color] duration-500 ease-forge hover:-translate-y-0.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AnimatedRule({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Reduced motion: rule simply appears (scale is technically motion;
    // a 0.3s opacity fade keeps the section rhythm without movement).
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.fromTo(
          node,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, scrollTrigger: { trigger: node, start: 'top 92%', once: true } },
        );
        return;
      }
      gsap.fromTo(
        node,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.2,
          ease: 'expo.out',
          transformOrigin: 'left center',
          scrollTrigger: { trigger: node, start: 'top 92%', once: true },
        },
      );
    }, node);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn('block h-px w-full bg-gradient-to-r from-line-strong via-line to-transparent', className)}
    />
  );
}

/** Scroll-linked numeric readout that never lies about missing data. */
export function CountUp({
  value,
  duration = 1.6,
  className,
  format,
}: {
  value: number | null;
  duration?: number;
  className?: string;
  format?: (value: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || value === null) return;

    if (reduced) {
      node.textContent = (format ?? String)(value);
      return;
    }

    const counter = { current: 0 };
    const ctx = gsap.context(() => {
      gsap.to(counter, {
        current: value,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          node.textContent = (format ?? ((v: number) => Math.round(v).toLocaleString('en-IN')))(counter.current);
        },
        scrollTrigger: { trigger: node, start: 'top 92%', once: true },
      });
    }, node);

    return () => ctx.revert();
  }, [value, duration, reduced, format]);

  return <span ref={ref} className={className} />;
}

/** Registers the shiny-text keyframe once, alongside the token layer. */
export function MotionStyles() {
  return (
    <style>{`
      @keyframes nf-shiny {
        0%, 72%, 100% { background-position: 120% 0; }
        46% { background-position: -20% 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        [style*="nf-shiny"] { animation: none !important; }
      }
    `}</style>
  );
}

export { ScrollTrigger };
