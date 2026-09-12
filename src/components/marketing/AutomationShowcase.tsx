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
    if (!node || reduced) return;

    const ctx = gsap.context(() => {
      // The spine grows as the section scrolls through the viewport.
      gsap.fromTo(
        '[data-spine]',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          transformOrigin: 'top center',
          scrollTrigger: { trigger: node, start: 'top 65%', end: 'bottom 75%', scrub: 0.4 },
        },
      );

      // One packet of data travels the spine as the section scrolls, and the
      // clock above it counts the elapsed window the copy describes.
      gsap.fromTo(
        '[data-packet]',
        { y: 0 },
        {
          y: () => {
            const list = node.querySelector('ol');
            return list ? list.offsetHeight - 8 : 0;
          },
          ease: 'none',
          scrollTrigger: {
            trigger: node,
            start: 'top 65%',
            end: 'bottom 75%',
            scrub: 0.4,
            onUpdate: (self) => {
              const clock = node.querySelector('[data-elapsed]');
              if (clock) clock.textContent = formatElapsed(self.progress);
            },
          },
        },
      );

      gsap.utils.toArray<HTMLElement>('[data-flow-step]').forEach((step) => {
        gsap.fromTo(
          step,
          { opacity: 0.28, x: -6 },
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            ease: 'power2.out',
            scrollTrigger: { trigger: step, start: 'top 82%', end: 'top 62%', scrub: true },
          },
        );
      });
    }, node);

    return () => ctx.revert();
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

          <span
            aria-hidden
            className="absolute inset-y-0 left-[7px] w-px bg-gradient-to-b from-brand/60 via-brand/25 to-line sm:left-[9px]"
          />
          <span data-spine aria-hidden className="absolute inset-y-0 left-[7px] w-px origin-top bg-brand sm:left-[9px]" style={{ transform: 'scaleY(0)' }} />
          <span
            data-packet
            aria-hidden
            className="absolute left-[7px] top-0 h-2 w-2 -translate-x-[3.5px] rounded-full bg-brand shadow-[0_0_14px_2px_rgb(var(--nf-blue)/0.55)] sm:left-[9px]"
            style={{ marginTop: '3.25rem' }}
          />

          <ol className="space-y-3">
            {AUTOMATION_FLOW.map((step, index) => (
              <li key={step} data-flow-step className="relative">
                <span
                  aria-hidden
                  className="absolute -left-8 top-4 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-line-strong bg-canvas sm:-left-10"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
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
