import { useLayoutEffect, useRef, useState } from 'react';
import { gsap, Reveal, AtmosphericGlow, TiltCard } from '@/components/motion';
import { AUTOMATION_FLOW } from '@/data/content';
import { SectionHeader } from '@/components/ui/Card';
import { DemoBadge, StatusIndicator } from '@/components/ui/Badge';
import { useReducedMotion } from '@/hooks';
import { cn } from '@/lib/cn';

const MONITOR_EVENTS = [
  'NEW ENQUIRY',
  'AI QUALIFIED',
  'CRM UPDATED',
  'TEAM NOTIFIED',
  'APPOINTMENT BOOKED',
  'FOLLOW-UP SCHEDULED',
];

const MONITOR_METRICS = [
  { label: 'Enquiries', value: 128 },
  { label: 'Qualified', value: 74 },
  { label: 'Follow-ups', value: 52 },
  { label: 'Appointments', value: 31 },
  { label: 'Workflow runs', value: 412 },
  { label: 'Human handoffs', value: 9 },
];

/** 3 min 52 s — the window the section describes, shown as a scrubbed clock. */
function formatElapsed(progress: number) {
  const total = Math.round(progress * 232);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Automation showcase (spec §22) + system monitor (spec §120).
 *
 * The flow lights up in step with scrolling. The monitor beside it is
 * clearly labelled as demo data — NorthForge never presents invented
 * numbers as a client's real performance.
 */
export function AutomationShowcase() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;

    // Reduced motion: show the finished state — the line fully drawn, no
    // travelling dot, all steps legible.
    if (reduced) {
      const spine = node.querySelector<HTMLElement>('[data-spine]');
      const packet = node.querySelector<HTMLElement>('[data-packet]');
      if (spine) spine.style.transform = 'scaleY(1)';
      if (packet) packet.style.opacity = '0';
      node.querySelectorAll<HTMLElement>('[data-flow-step]').forEach((step) => {
        step.style.opacity = '1';
        step.style.transform = 'none';
      });
      return;
    }

    let cleanupResize: (() => void) | undefined;

    const ctx = gsap.context(() => {
      const track = node.querySelector<HTMLElement>('[data-flow-track]');
      const spine = node.querySelector<HTMLElement>('[data-spine]');
      const packet = node.querySelector<HTMLElement>('[data-packet]');
      if (!track || !spine || !packet) return;

      const steps = gsap.utils.toArray<HTMLElement>('[data-flow-step]', track);

      // Geometry: the bright line and the packet travel exactly from the
      // first step's dot centre to the last one, so the dot always rides the
      // tip of the line.
      let travel = 0;
      const measure = () => {
        const last = steps[steps.length - 1];
        // First dot centre sits at 23.5px in the track; the line spans from
        // there to the last dot's centre.
        travel = last ? Math.max(0, last.offsetTop) : 0;
        spine.style.top = '23.5px';
        spine.style.height = `${travel}px`;
        return travel;
      };
      measure();

      // ONE master timeline scrubbed by one ScrollTrigger — the line, the
      // packet and every step highlight are positions on the same progress
      // value, so they can never drift apart. Each step lights up at the
      // exact moment the packet reaches its dot.
      const clock = node.querySelector<HTMLElement>('[data-elapsed]');

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: track,
          start: 'top 72%',
          end: 'bottom 55%',
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (clock) clock.textContent = formatElapsed(self.progress);
          },
        },
      });

      tl.fromTo(packet, { y: 0 }, { y: () => travel, duration: 1 }, 0);
      tl.fromTo(spine, { scaleY: 0 }, { scaleY: 1, transformOrigin: 'top center', duration: 1 }, 0);

      steps.forEach((step, index) => {
        const center = step.offsetTop + 23.5;
        const at = travel > 0 ? Math.min(1, Math.max(0, center - 23.5) / travel) : 0;
        const innerDot = step.querySelector<HTMLElement>('[data-step-dot]');
        tl.fromTo(
          step,
          { opacity: 0.3, x: -6 },
          { opacity: 1, x: 0, duration: 0.1, ease: 'power2.out' },
          Math.max(0, at - 0.05),
        );
        if (innerDot) {
          tl.fromTo(
            innerDot,
            { scale: 0.4, opacity: 0.5 },
            { scale: 1, opacity: 1, duration: 0.06, transformOrigin: 'center center' },
            at,
          );
          if (index === steps.length - 1) {
            // A soft arrival pulse on the final step.
            tl.to(innerDot, { scale: 1.8, duration: 0.06, yoyo: true, repeat: 1 }, Math.min(1, at + 0.02));
          }
        }
      });

      // Keep the geometry exact on resize (text rewraps change dot centres).
      const onResize = () => {
        measure();
        tl.scrollTrigger?.refresh();
      };
      window.addEventListener('resize', onResize);
      if (document.fonts?.ready) {
        document.fonts.ready.then(onResize).catch(() => undefined);
      }
      cleanupResize = () => window.removeEventListener('resize', onResize);
    }, node);

    return () => {
      cleanupResize?.();
      ctx.revert();
    };
  }, [reduced]);

  return (
    <section className="nf-shell relative py-20 lg:py-28 overflow-hidden">
      <AtmosphericGlow color="blue" position="top-right" />
      <Reveal>
        <SectionHeader
          eyebrow="Automation"
          title="What happens in the four minutes after someone enquires."
          description="No one is online. No one is copying details between apps. The system handles the sequence and only asks a human when it genuinely needs one."
        />
      </Reveal>

      <div ref={root} className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        {/* Flow */}
        <div className="relative pl-8 sm:pl-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <span className="nf-eyebrow">After the form is submitted</span>
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-2xs text-muted">
              +<span data-elapsed>0:00</span>
            </span>
          </div>

          {/* The track spans exactly the step list, so the line and the
              travelling packet stay locked to the step dots. */}
          <div data-flow-track className="relative">
            <span
              aria-hidden
              className="absolute bottom-[20px] left-[7px] top-[19px] w-px bg-gradient-to-b from-brand/25 via-brand/25 to-line"
            />
            <span
              data-spine
              aria-hidden
              className="absolute left-[7px] w-px origin-top bg-brand nf-gpu will-change-transform"
              style={{ transform: 'scaleY(0)' }}
            />
            <span
              data-packet
              aria-hidden
              className="absolute left-[3px] top-[19px] h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_16px_3px_rgb(var(--nf-blue)/0.65)] nf-gpu will-change-transform flex items-center justify-center"
            >
              <span className="h-1 w-1 rounded-full bg-white" />
            </span>

            <ol className="space-y-3">
              {AUTOMATION_FLOW.map((step, index) => (
                <li key={step} data-flow-step className="relative nf-gpu will-change-[transform,opacity]">
                  <span
                    aria-hidden
                    className="absolute -left-8 top-4 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-line-strong bg-canvas sm:-left-10"
                  >
                    <span data-step-dot className="inline-block h-1.5 w-1.5 rounded-full bg-brand nf-gpu will-change-transform" />
                  </span>
                  <div className="flex items-center gap-4 rounded-xl border border-white/60 bg-white/75 px-4 py-3.5 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-brand/40 hover:bg-white hover:shadow-xs">
                    <span className="nf-num shrink-0 font-mono text-2xs text-faint">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[13px] font-medium text-fg">{step}</span>
                    {index === 2 || index === 3 ? (
                      <span className="ml-auto shrink-0 rounded-full border border-brand-violet/30 bg-brand-violet/10 px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider text-brand-violet">
                        AI
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Monitor */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <TiltCard max={3}>
            <SystemMonitor />
          </TiltCard>
        </div>
      </div>
    </section>
  );
}

/** NorthForge system monitor (spec §120). */
export function SystemMonitor({ className }: { className?: string }) {
  const [events, setEvents] = useState<string[]>(['NEW ENQUIRY']);
  const reduced = useReducedMotion();
  const monitorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reduced) return;
    const node = monitorRef.current;
    if (!node) return;

    let index = 1;
    let timer: number | null = null;

    const startTimer = () => {
      if (timer !== null) return;
      timer = window.setInterval(() => {
        setEvents((prev) => {
          const next = [...prev, MONITOR_EVENTS[index % MONITOR_EVENTS.length]!];
          index += 1;
          return next.slice(-5);
        });
      }, 2600);
    };

    const stopTimer = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          startTimer();
        } else {
          stopTimer();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      stopTimer();
    };
  }, [reduced]);

  return (
    <div
      ref={monitorRef}
      className={cn(
        'overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-panel backdrop-blur-xl',
        className,
      )}
      style={{
        boxShadow:
          '0 24px 60px -16px rgb(60 48 32 / 0.12), 0 4px 16px -4px rgb(60 48 32 / 0.04), inset 0 1px 0 rgb(255 255 255 / 0.95)',
      }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line/60 bg-white/40 px-5 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <StatusIndicator status="active" tone="success" pulse />
          <span className="text-[13px] font-semibold text-fg">NorthForge System</span>
        </div>
        <div className="flex items-center gap-2">
          {!reduced && (
            <div className="flex items-center gap-0.5 h-3">
              <span className="w-0.5 h-2 bg-success/60 rounded-full animate-pulse" />
              <span className="w-0.5 h-3 bg-success rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
              <span className="w-0.5 h-1.5 bg-success/80 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
              <span className="w-0.5 h-2.5 bg-success/70 rounded-full animate-pulse" style={{ animationDelay: '0.45s' }} />
            </div>
          )}
          <span className="font-mono text-2xs uppercase tracking-wider text-success">Active</span>
        </div>
      </header>

      <dl className="grid grid-cols-3 divide-x divide-line/60 border-b border-line/60">
        {MONITOR_METRICS.slice(0, 3).map((metric) => (
          <div key={metric.label} className="px-4 py-3.5">
            <dt className="text-2xs uppercase tracking-wider text-faint">{metric.label}</dt>
            <dd className="nf-num mt-1.5 text-lg font-semibold text-fg">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-b border-line/60 px-5 py-4">
        <p className="nf-eyebrow mb-3">Live activity</p>
        <ul className="space-y-2" aria-live="polite">
          {events.map((event, index) => {
            const isLatest = index === events.length - 1;
            return (
              <li
                key={`${event}-${index}`}
                className={cn(
                  'flex items-center gap-2.5 font-mono text-2xs uppercase tracking-wider transition-all duration-300',
                  isLatest ? 'text-fg font-semibold' : 'text-muted',
                )}
                style={{ opacity: 0.35 + (index / Math.max(1, events.length - 1)) * 0.65 }}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300',
                    isLatest ? 'bg-success shadow-[0_0_8px_rgb(22,148,92)]' : 'bg-brand',
                  )}
                  aria-hidden
                />
                <span>{event}</span>
                {isLatest && !reduced && (
                  <span className="ml-auto font-mono text-3xs font-bold text-success animate-pulse">JUST NOW</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line/60">
        {MONITOR_METRICS.slice(3).map((metric) => (
          <div key={metric.label} className="px-4 py-3.5">
            <dt className="text-2xs uppercase tracking-wider text-faint">{metric.label}</dt>
            <dd className="nf-num mt-1.5 text-lg font-semibold text-fg">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="flex items-center justify-between gap-3 border-t border-line/50 bg-sunken/40 px-5 py-3">
        <DemoBadge />
        <span className="text-2xs text-faint">Illustrative sample · not client data</span>
      </footer>
    </div>
  );
}
