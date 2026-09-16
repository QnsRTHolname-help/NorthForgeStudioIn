import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '@/components/motion';
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
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: track,
          start: 'top 72%',
          end: 'bottom 55%',
          scrub: 0.6, // gentle smoothing; still locked to scroll
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const clock = node.querySelector('[data-elapsed]');
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
      cleanupResize = () => window.removeEventListener('resize', onResize);
    }, node);

    return () => {
      cleanupResize?.();
      ctx.revert();
    };
  }, [reduced]);

  return (
    <section className="nf-shell py-20 lg:py-28">
      <SectionHeader
        eyebrow="Automation"
        title="What happens in the four minutes after someone enquires."
        description="No one is online. No one is copying details between apps. The system handles the sequence and only asks a human when it genuinely needs one."
      />

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
              className="absolute left-[7px] w-px origin-top bg-brand"
              style={{ transform: 'scaleY(0)' }}
            />
            <span
              data-packet
              aria-hidden
              className="absolute left-[3.5px] top-[19.5px] h-2 w-2 rounded-full bg-brand shadow-[0_0_14px_2px_rgb(var(--nf-blue)/0.55)]"
            />

            <ol className="space-y-3">
              {AUTOMATION_FLOW.map((step, index) => (
                <li key={step} data-flow-step className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-8 top-4 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-line-strong bg-canvas sm:-left-10"
                  >
                    <span data-step-dot className="h-1.5 w-1.5 rounded-full bg-brand" />
                  </span>
                  <div className="flex items-center gap-4 rounded border border-line bg-surface px-4 py-3 transition-colors duration-300 hover:border-line-strong">
                    <span className="nf-num shrink-0 font-mono text-2xs text-faint">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[13px] font-medium text-fg">{step}</span>
                    {index === 2 || index === 3 ? (
                      <span className="ml-auto shrink-0 rounded border border-brand-violet/30 bg-brand-violet/10 px-1.5 py-0.5 text-2xs uppercase tracking-wide text-brand-violet">
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
          <SystemMonitor />
        </div>
      </div>
    </section>
  );
}

/** NorthForge system monitor (spec §120). */
export function SystemMonitor({ className }: { className?: string }) {
  const [events, setEvents] = useState<string[]>(['NEW ENQUIRY']);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    if (reduced) return;
    let index = 1;
    const timer = window.setInterval(() => {
      setEvents((prev) => {
        const next = [...prev, MONITOR_EVENTS[index % MONITOR_EVENTS.length]!];
        index += 1;
        return next.slice(-5);
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, [reduced]);

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <StatusIndicator status="active" tone="success" pulse />
          <span className="text-[13px] font-semibold text-fg">NorthForge System</span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-success">Active</span>
      </header>

      <dl className="grid grid-cols-3 divide-x divide-line border-b border-line">
        {MONITOR_METRICS.slice(0, 3).map((metric) => (
          <div key={metric.label} className="px-4 py-3.5">
            <dt className="text-2xs uppercase tracking-wider text-faint">{metric.label}</dt>
            <dd className="nf-num mt-1.5 text-lg font-semibold text-fg">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-b border-line px-5 py-4">
        <p className="nf-eyebrow mb-3">Live activity</p>
        <ul className="space-y-2" aria-live="polite">
          {events.map((event, index) => (
            <li
              key={`${event}-${index}`}
              className="flex items-center gap-2.5 font-mono text-2xs uppercase tracking-wider text-muted"
              style={{ opacity: 0.35 + (index / Math.max(1, events.length - 1)) * 0.65 }}
            >
              <span className="h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden />
              {event}
            </li>
          ))}
        </ul>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line">
        {MONITOR_METRICS.slice(3).map((metric) => (
          <div key={metric.label} className="px-4 py-3.5">
            <dt className="text-2xs uppercase tracking-wider text-faint">{metric.label}</dt>
            <dd className="nf-num mt-1.5 text-lg font-semibold text-fg">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <footer className="flex items-center justify-between gap-3 bg-sunken/40 px-5 py-3">
        <DemoBadge />
        <span className="text-2xs text-faint">Illustrative sample · not client data</span>
      </footer>
    </div>
  );
}
