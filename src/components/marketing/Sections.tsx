import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Marquee, Reveal, Stagger, StaggerItem, FadeUp } from '@/components/motion';
import { Magnetic } from '@/components/motion';
import { SplitText, AnimatedRule } from '@/components/motion/primitives';
import { LinkButton, Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Card';
import { PROOF_ITEMS, PROBLEMS, PRINCIPLES, WHY_POINTS } from '@/data/content';
import { whatsappLink } from '@/data/site';

/* ═══════════════════════════════════════════════════════════════
   PROOF STRIP (spec §17)
   ═══════════════════════════════════════════════════════════════ */

export function ProofStrip() {
  return (
    <section id="value" className="scroll-mt-24 border-b border-line bg-sunken/30 py-5" aria-label="What is included">
      <Marquee speed={52}>
        {PROOF_ITEMS.map((item) => (
          <span key={item} className="flex items-center gap-3 text-[13px] text-muted">
            <span className="h-1 w-1 rounded-full bg-brand" aria-hidden />
            {item}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROBLEM (spec §18)
   ═══════════════════════════════════════════════════════════════ */

export function ProblemSection() {
  return (
    <section className="nf-shell py-20 lg:py-28">
      <SectionHeader
        eyebrow="The real problem"
        title="Most websites look finished. Very few of them do anything."
        description="A website that only displays information creates work instead of removing it. These are the gaps NorthForge closes."
      />

      <Stagger className="mt-14 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map((problem) => (
          <StaggerItem key={problem.title} className="bg-surface">
            <div className="group h-full p-6 transition-colors duration-300 hover:bg-elevated">
              <div className="flex items-start gap-3">
                <span className="mt-1.5 h-px w-6 shrink-0 bg-brand transition-[width] duration-300 ease-forge group-hover:w-10" aria-hidden />
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-fg">{problem.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{problem.body}</p>
                </div>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROMISE (spec §19)
   ═══════════════════════════════════════════════════════════════ */

export function PromiseSection() {
  return (
    <section className="relative overflow-hidden border-y border-line bg-sunken/20 py-20 lg:py-28">
      <div className="nf-dot-bg pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="nf-shell relative">
        <SectionHeader
          eyebrow="The NorthForge promise"
          title="Four things we do with every business we work with."
          description="Not a methodology slide. The actual sequence of work that turns a website into a system."
        />

        <ol className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((principle, index) => (
            <FadeUp key={principle.key} delay={index * 0.08} as="li">
              <div className="group relative h-full border-t border-line pt-6">
                <span className="nf-num text-2xs font-medium tracking-eyebrow text-brand">{principle.number}</span>
                <h3 className="mt-4 text-[clamp(1.6rem,2.6vw,2.1rem)] font-semibold leading-none tracking-[-0.03em] text-fg">
                  {principle.title}
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{principle.body}</p>
                <span
                  className="absolute -top-px left-0 h-px w-0 bg-brand transition-[width] duration-500 ease-forge group-hover:w-full"
                  aria-hidden
                />
              </div>
            </FadeUp>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WHY NORTHFORGE (spec §25)
   ═══════════════════════════════════════════════════════════════ */

export function WhyNorthForge() {
  return (
    <section className="nf-shell py-20 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <span className="nf-eyebrow text-brand">Why NorthForge</span>
            <h2 className="mt-6 text-display-sm font-semibold text-fg">
              <SplitText text="We are not selling pages." />
              <span className="mt-1 block text-muted">
                <SplitText text="We build the system" delay={0.1} />
              </span>
              <span className="mt-1 block">
                <SplitText text="behind them." delay={0.2} />
              </span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              Anyone can buy software. The value is in what happens after a customer shows interest — and
              whether that interest is captured, answered, followed up and measured without anyone chasing it.
            </p>
            <AnimatedRule className="mt-8" />
          </Reveal>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {WHY_POINTS.map((point) => (
            <Reveal key={point.title}>
              <div className="group grid gap-2 py-8 transition-colors duration-300 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-8">
                <div>
                  <p className="text-[13px] text-faint">{point.title}</p>
                  <p className="mt-2 text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-tight tracking-[-0.02em] text-fg transition-colors duration-300 group-hover:text-brand">
                    {point.emphasis}
                  </p>
                </div>
                <p className="self-center text-[13px] leading-relaxed text-muted">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FINAL CTA (spec §28)
   ═══════════════════════════════════════════════════════════════ */

export function FinalCta({
  eyebrow = 'Next step',
  title = 'Your business should not be losing enquiries to a slow reply.',
  description = 'Tell us where the work piles up and we will point out exactly what to automate first — including if the honest answer is that you do not need us yet.',
  marquee = "LET'S TALK",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  marquee?: string;
}) {
  return (
    <section className="relative overflow-hidden border-t border-line py-20 lg:py-28">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-[120px]"
        style={{ background: 'radial-gradient(ellipse, rgb(var(--nf-blue)), transparent 70%)' }}
        aria-hidden
      />

      {/* Slow marquee band — the only decorative motion in the section. */}
      <div className="relative mb-14 flex select-none overflow-hidden border-y border-line py-4" aria-hidden>
        <Marquee speed={60}>
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              className="flex items-center gap-6 px-6 text-[clamp(1.5rem,4vw,2.75rem)] font-semibold tracking-[-0.03em] text-fg/70"
            >
              {marquee}
              <span className="text-brand">·</span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="nf-shell relative text-center">
        <Reveal>
          <span className="nf-eyebrow">{eyebrow}</span>
          <h2 className="mx-auto mt-6 max-w-3xl text-display-sm font-semibold text-fg">
            <SplitText text={title} stagger={0.045} />
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted">{description}</p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <LinkButton to="/contact" size="lg" arrow>
                Get a free automation review
              </LinkButton>
            </Magnetic>
            <Button
              variant="secondary"
              size="lg"
              iconLeft={<MessageCircle className="h-4 w-4" />}
              onClick={() => window.open(whatsappLink('Hi NorthForge — I would like to know more.'), '_blank', 'noopener')}
            >
              Talk on WhatsApp
            </Button>
          </div>

          <p className="mt-8 text-xs text-faint">No obligation. We reply within one business day.</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Shared internal link row used at the end of pages ─────────── */

export function NextSteps({ items }: { items: { label: string; to: string; description: string }[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="group bg-surface p-6 transition-colors duration-300 hover:bg-elevated"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold tracking-tight text-fg">{item.label}</h3>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-faint transition-transform duration-300 ease-forge group-hover:translate-x-1 group-hover:text-brand"
              aria-hidden
            />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}

export function SectionShell({
  children,
  className,
  tone = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'sunken' | 'bordered';
}) {
  return (
    <section
      className={cn(
        'py-20 lg:py-28',
        tone === 'sunken' && 'border-y border-line bg-sunken/20',
        tone === 'bordered' && 'border-b border-line',
        className,
      )}
    >
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INTRO / VALUE STATEMENT (spec §12) — typography-led.
   Huge type, generous space, one idea: the website is the front door,
   the system behind it is what makes it work.
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PIECES = [
  'Website',
  'Lead capture',
  'CRM',
  'WhatsApp',
  'AI',
  'Automation',
  'Bookings',
  'Analytics',
];

export function IntroStatement() {
  return (
    <section className="nf-shell py-24 lg:py-36">
      <Reveal>
        <span className="nf-eyebrow">The system, not the page</span>
        <p className="mt-10 text-display-lg font-semibold tracking-[-0.03em] text-fg">
          A website is the front door.
        </p>
        <p className="mt-4 text-display-lg font-semibold tracking-[-0.03em] text-muted">
          The system behind it is what makes it work.
        </p>
        <p className="mt-10 max-w-2xl text-[15px] leading-relaxed text-muted">
          NorthForge connects the pieces businesses normally manage separately — so a customer journey
          stops depending on anyone remembering to check a spreadsheet.
        </p>

        <div className="mt-16 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {SYSTEM_PIECES.map((piece, index) => (
            <div key={piece} className="bg-surface px-6 py-6">
              <span className="nf-num text-2xs font-medium tracking-eyebrow text-faint">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="mt-2 text-[15px] font-semibold tracking-tight text-fg">{piece}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

