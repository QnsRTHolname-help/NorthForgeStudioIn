import { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger } from '@/components/motion';
import { PROCESS_STEPS } from '@/data/content';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/hooks';

/**
 * How it works (spec §21).
 *
 * Desktop: a pinned horizontal storyboard — the steps move sideways as you
 * scroll, which is the clearest way to show a sequence.
 * Mobile / reduced motion: a plain vertical timeline, no pinning.
 * The ScrollTrigger is created through gsap.matchMedia so it is torn down
 * automatically when the breakpoint or the route changes.
 */
export function ProcessTimeline() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 96);

        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        // Cards brighten as they cross the middle of the viewport.
        gsap.utils.toArray<HTMLElement>('[data-step]').forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0.35 },
            {
              opacity: 1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                containerAnimation: tween,
                start: 'left 72%',
                end: 'left 45%',
                scrub: true,
              },
            },
          );
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      mm.add('(max-width: 1023px), (prefers-reduced-motion: reduce)', () => {
        gsap.utils.toArray<HTMLElement>('[data-step]').forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 18 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: 'power3.out',
              scrollTrigger: { trigger: card, start: 'top 88%', once: true },
            },
          );
        });
      });

      return () => mm.revert();
    }, section);

    // Fonts and images can change measurements after mount.
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    return () => {
      window.removeEventListener('load', refresh);
      ctx.revert();
    };
  }, [reduced]);

  return (
    <section id="process" className="scroll-mt-28 border-y border-line bg-sunken/20" aria-labelledby="process-heading">
      <div className="nf-shell py-16 lg:py-20">
        <div className="max-w-2xl">
          <span className="nf-eyebrow">How it works</span>
          <h2 id="process-heading" className="mt-4 text-display-sm font-semibold text-fg">
            Six steps from first call to a system that keeps improving.
          </h2>
        </div>
      </div>

      <div ref={sectionRef} className="relative overflow-hidden lg:h-screen">
        <div
          ref={trackRef}
          className="nf-scroll-x flex gap-5 px-5 pb-6 sm:px-8 lg:h-screen lg:items-center lg:gap-7 lg:px-12 lg:pb-0 lg:overflow-visible"
        >
          {PROCESS_STEPS.map((step, index) => {
            const isLast = index === PROCESS_STEPS.length - 1;

            return (
              <article
                key={step.number}
                data-step
                className={cn(
                  'nf-glass-card nf-glass-interactive group relative flex min-h-[300px] w-[300px] shrink-0 flex-col justify-between rounded-2xl border border-white/60 bg-white/70 p-6 shadow-2xs backdrop-blur-md transition-all duration-300 hover:shadow-md',
                  'sm:w-[340px] lg:h-[62vh] lg:max-h-[460px] lg:w-[380px] lg:p-8',
                )}
                style={{
                  boxShadow: '0 12px 32px -8px rgb(60 48 32 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.95)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="nf-num font-mono text-sm font-semibold text-brand">{step.number}</span>
                    <span className="nf-glass-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-2xs font-semibold uppercase tracking-wider text-muted shadow-2xs">
                      <span className={cn('h-1.5 w-1.5 rounded-full', isLast ? 'bg-success animate-pulse' : 'bg-brand')} aria-hidden />
                      {isLast ? 'Ongoing' : `Stage ${index + 1}`}
                    </span>
                  </div>
                  <h3 className="mt-6 text-[clamp(1.4rem,2vw,1.75rem)] font-semibold tracking-[-0.02em] text-fg transition-colors duration-300 group-hover:text-brand">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted">{step.body}</p>
                </div>

                <ul className="mt-8 space-y-2 border-t border-line/60 pt-5">
                  {step.detail.map((detail) => (
                    <li key={detail} className="flex items-center gap-2 text-xs text-muted">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" aria-hidden />
                      <span className="font-medium text-fg/90">{detail}</span>
                    </li>
                  ))}
                </ul>

                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  aria-hidden
                />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
