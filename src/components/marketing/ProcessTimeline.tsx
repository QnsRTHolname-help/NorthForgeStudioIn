import { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger, Reveal, SplitText, AtmosphericGlow } from '@/components/motion';
import { PROCESS_STEPS } from '@/data/content';
import { cn } from '@/lib/cn';
import { useReducedMotion } from '@/hooks';
import { SCRUB } from '@/components/motion/constants';

const STAGE_GLYPHS = [
  // Stage 1: Discovery & Audit
  <svg key="1" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="9" strokeDasharray="3 3" className="origin-center transition-transform duration-700 group-hover:rotate-45" />
    <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>,
  // Stage 2: Architecture & Foundation
  <svg key="2" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" strokeDasharray="2 2" />
  </svg>,
  // Stage 3: Production & Integration
  <svg key="3" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand transition-transform duration-500 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 12h16M14 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 6h6M4 18h6" strokeLinecap="round" strokeDasharray="2 2" />
  </svg>,
  // Stage 4: Hardening & Testing
  <svg key="4" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  // Stage 5: Live Launch
  <svg key="5" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand transition-transform duration-500 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
  </svg>,
  // Stage 6: Continuous Improvement
  <svg key="6" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-success transition-transform duration-700 group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.67-.79" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
];

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

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: SCRUB,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        tl.to(
          track,
          {
            x: () => -distance(),
            ease: 'none',
          },
          0,
        );

        // A progress rule under the pinned track fills as the storyboard
        // scrolls across — a single, quiet signal of where you are in the
        // sequence without adding another moving element.
        const rule = section.querySelector<HTMLElement>('[data-process-line]');
        if (rule) {
          tl.fromTo(
            rule,
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: 'none',
              transformOrigin: 'left center',
            },
            0,
          );
        }

        // Cards brighten and gently scale as they cross the center of the viewport
        gsap.utils.toArray<HTMLElement>('[data-step]').forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0.35, scale: 0.95 },
            {
              opacity: 1,
              scale: 1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                containerAnimation: tl,
                start: 'left 75%',
                end: 'left 45%',
                scrub: true,
              },
            },
          );
        });

        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
        };
      });

      mm.add('(max-width: 1023px), (prefers-reduced-motion: reduce)', () => {
        gsap.utils.toArray<HTMLElement>('[data-step]').forEach((card, idx) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 18 },
            {
              opacity: 1,
              y: 0,
              duration: 0.65,
              delay: idx * 0.04,
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
    if (document.readyState === 'complete') {
      refresh();
    } else {
      window.addEventListener('load', refresh);
    }
    return () => {
      window.removeEventListener('load', refresh);
      ctx.revert();
    };
  }, [reduced]);

  return (
    <section id="process" className="relative scroll-mt-28 border-y border-line bg-sunken/20 overflow-hidden" aria-labelledby="process-heading">
      <AtmosphericGlow color="blue" position="top-right" />
      <div className="nf-shell py-16 lg:py-20 relative">
        <Reveal className="max-w-2xl">
          <span className="nf-eyebrow">How it works</span>
          <h2 id="process-heading" className="mt-4 text-display-sm font-semibold text-fg">
            <SplitText text="Six steps from first call to a system that keeps improving." by="word" stagger={0.035} blur />
          </h2>
        </Reveal>
      </div>

      <div ref={sectionRef} className={cn('relative overflow-hidden', !reduced && 'lg:h-screen')}>
        {!reduced ? (
          <div className="pointer-events-none absolute bottom-4 left-1/2 hidden w-[60%] max-w-2xl -translate-x-1/2 lg:block">
            <span
              data-process-line
              aria-hidden
              className="block h-[2px] w-full origin-left rounded-full bg-gradient-to-r from-brand/20 via-brand to-brand-violet shadow-[0_0_8px_rgba(var(--nf-blue)/0.4)]"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        ) : null}
        <div
          ref={trackRef}
          className={cn(
            'nf-scroll-x nf-gpu will-change-transform flex gap-5 px-5 pb-6 sm:px-8',
            reduced
              ? 'lg:grid lg:grid-cols-3 lg:gap-6 lg:px-12 lg:pb-12'
              : 'lg:h-screen lg:items-center lg:gap-7 lg:px-12 lg:pb-0 lg:overflow-visible',
          )}
        >
          {PROCESS_STEPS.map((step, index) => {
            const isLast = index === PROCESS_STEPS.length - 1;

            return (
              <article
                key={step.number}
                data-step
                className={cn(
                  'nf-glass-card nf-glass-interactive nf-gpu will-change-[transform,opacity] group relative flex min-h-[300px] w-[300px] shrink-0 flex-col justify-between rounded-2xl border border-white/60 bg-white/80 p-6 shadow-2xs backdrop-blur-sm transition-[box-shadow,border-color,background-color] duration-300 hover:shadow-md',
                  'sm:w-[340px] lg:h-[62vh] lg:max-h-[460px] lg:w-[380px] lg:p-8',
                )}
                style={{
                  boxShadow: '0 12px 32px -8px rgb(60 48 32 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.95)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/70 bg-white/80 shadow-2xs transition-all duration-300 group-hover:border-brand/40 group-hover:bg-white group-hover:shadow-xs">
                        {STAGE_GLYPHS[index % STAGE_GLYPHS.length]}
                      </span>
                      <span className="nf-num font-mono text-sm font-semibold text-brand">{step.number}</span>
                    </div>
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
