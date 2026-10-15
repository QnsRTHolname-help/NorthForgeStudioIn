import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { gsap } from 'gsap';
import { LinkButton, Button } from '@/components/ui/Button';
import { Magnetic } from '@/components/motion';
import { SplitText, CountUp } from '@/components/motion/primitives';
import { GrowthSystem, GrowthChain } from './GrowthSystem';
import { Hero3D } from './Hero3D';
import { whatsappLink } from '@/data/site';
import { useReducedMotion } from '@/hooks';
import { trackEvent } from '@/lib/analytics';
import { DURATION, DISTANCE, EASE, STAGGER } from '@/components/motion/constants';

const PROOF = [
  { value: 4, suffix: ' weeks', label: 'Typical time to go live' },
  { value: 24, suffix: '/7', label: 'Enquiries answered' },
  { value: 0, suffix: ' tools', label: 'To update by hand' },
];

/**
 * Public hero — editorial and typography-led.
 *
 * Left: the statement, set large enough to be the design. Right: Apple-grade
 * studio system panel with frosted glass finish and live connected operating flow.
 *
 * Bottom: 3 frosted glass KPI proof cards with tabular number counting.
 */
export function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = root.current;
    if (!node || reduced) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: EASE.entrance } });

      // Eyebrow first — the small signal that anchors the statement.
      timeline
        .fromTo(
          '[data-hero-eyebrow]',
          { opacity: 0, y: DISTANCE.micro },
          { opacity: 1, y: 0, duration: DURATION.ui },
          0.05,
        )
        // Statement + subcopy together — the headline is the design.
        .fromTo(
          '[data-hero-copy]',
          { y: DISTANCE.ui },
          { y: 0, duration: DURATION.slow },
          0.1,
        )
        // System panel — the most expensive element, so it arrives last and
        // carries the longest, most expressive ease.
        .fromTo(
          '[data-hero-system]',
          { opacity: 0, y: DISTANCE.section },
          { opacity: 1, y: 0, duration: DURATION.panel, ease: EASE.expressive },
          0.55,
        )
        // Actions stagger in right after the panel starts its rise.
        .fromTo(
          '[data-hero-actions] > *',
          { opacity: 0, y: DISTANCE.ui },
          { opacity: 1, y: 0, duration: DURATION.ui, stagger: STAGGER.standard },
          0.95,
        )
        // KPI cards — last, so the eye lands on them as the resolution.
        .fromTo(
          '[data-hero-meta] > *',
          { opacity: 0, y: DISTANCE.ui },
          { opacity: 1, y: 0, duration: DURATION.ui, stagger: STAGGER.proof },
          1.25,
        );

      // Scroll-linked depth: the system panel and its ambient glow drift
      // slightly as the user scrolls out of the hero, giving the panel a
      // sense of physical space rather than a flat sticker.
      const panel = node.querySelector<HTMLElement>('[data-hero-system]');
      const glow = node.querySelector<HTMLElement>('[data-hero-glow]');
      if (panel || glow) {
        gsap.to([panel, glow].filter(Boolean), {
          y: 28,
          ease: EASE.scrub,
          scrollTrigger: {
            trigger: node,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }
    }, node);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={root} className="relative overflow-hidden border-b border-line">
      {/* Quiet architectural grid — present only as a texture, never a crate. */}
      <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      {/* Soft light behind the system panel — depth without decoration. */}
      <div
        data-hero-glow
        className="pointer-events-none absolute right-0 top-24 h-[520px] w-[620px] translate-x-1/4 rounded-full opacity-[0.10] blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgb(var(--nf-blue)), transparent 70%)' }}
        aria-hidden
      />

      <div className="nf-shell relative pb-16 pt-24 sm:pt-28 lg:pb-24 lg:pt-32">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          {/* ── Statement ─────────────────────────────────────── */}
          <div>
            <div data-hero-eyebrow className="flex items-center gap-2">
              <span className="nf-glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-brand shadow-2xs">
                <span className="relative flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                </span>
                WEB · AUTOMATION · AI · GROWTH
              </span>
            </div>

            {/* Type scaled to its COLUMN, not the viewport. */}
            <h1
              data-hero-copy
              className="mt-8 max-w-2xl text-[clamp(2.15rem,4.4vw,4.25rem)] font-semibold leading-[1.04] sm:leading-[1.0] tracking-[-0.035em] text-fg [text-wrap:balance]"
            >
              <SplitText
                text={'WE BUILD DIGITAL SYSTEMS\nTHAT MOVE YOUR BUSINESS FORWARD.'}
                by="line"
                stagger={0.09}
                trigger="mount"
                fade={false}
              />
            </h1>

            <p data-hero-copy className="mt-7 max-w-xl text-[16px] leading-relaxed text-muted">
              NorthForge designs premium websites and connects them to AI, lead capture, WhatsApp,
              automation and analytics — turning your digital presence into a system that helps your
              business grow.
            </p>

            {/* Action CTA Row with magnetic hover physics and refined Apple glass styling */}
            <div data-hero-actions className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic>
                <LinkButton
                  to="/contact"
                  size="lg"
                  arrow
                  className="nf-glass-glow shadow-md transition-all duration-200"
                  onClick={() => trackEvent('get_started_click', { location: 'hero' })}
                >
                  Start a project
                </LinkButton>
              </Magnetic>

              <Magnetic>
                <LinkButton
                  to="/how-it-works"
                  variant="secondary"
                  size="lg"
                  className="border-white/60 bg-white/70 shadow-xs backdrop-blur-md hover:border-brand/40 hover:bg-white hover:text-fg transition-all duration-200"
                  iconLeft={<ArrowRight className="h-4 w-4 rotate-90" />}
                >
                  See how it works
                </LinkButton>
              </Magnetic>

              <Magnetic>
                <Button
                  variant="ghost"
                  size="lg"
                  iconLeft={<MessageCircle className="h-4 w-4 text-success" />}
                  className="border border-white/60 bg-white/50 text-fg shadow-2xs backdrop-blur-md hover:border-brand/30 hover:bg-white hover:text-fg transition-all duration-200"
                  onClick={() => {
                    trackEvent('whatsapp_click', { context: 'general', location: 'hero' });
                    window.open(whatsappLink('Hi NorthForge — I would like to know more.'), '_blank', 'noopener');
                  }}
                >
                  Talk on WhatsApp
                </Button>
              </Magnetic>
            </div>
          </div>

          {/* ── System panel ───────────────────────────────────── */}
          <div data-hero-system className="relative">
            {/* 3D Visual Layer - Behind the system panel */}
            <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden="true">
              <Hero3D className="w-full h-full" />
            </div>

            {/* Apple-grade frosted glass console with connected operating flow */}
            <div
              className="nf-glass-card relative overflow-hidden rounded-2xl border border-white/65 bg-white/80 p-6 shadow-panel backdrop-blur-2xl transition-all duration-300 sm:p-7"
              style={{
                boxShadow:
                  '0 28px 72px -16px rgb(60 48 32 / 0.14), 0 4px 16px -4px rgb(60 48 32 / 0.05), inset 0 1px 0 rgb(255 255 255 / 0.95)',
              }}
            >
              {/* Subtle top rim highlight */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" aria-hidden />

              <div className="mb-5 flex items-center justify-between border-b border-line/60 pb-3">
                <span className="nf-eyebrow">Enquiry → customer, automated</span>
                <span className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-success">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  Running
                </span>
              </div>

              <div className="hidden sm:block">
                <GrowthSystem />
              </div>
              <div className="sm:hidden">
                <GrowthChain />
              </div>

              <p className="mt-5 border-t border-line/60 pt-4 text-[13px] leading-relaxed text-muted">
                Every step is connected. Nothing depends on someone remembering to check a spreadsheet.
              </p>
            </div>
          </div>
        </div>

        {/* ── Executive Frosted Glass KPI Proof Cards ─────────── */}
        <dl
          data-hero-meta
          className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6"
        >
          {PROOF.map((item) => (
            <div
              key={item.label}
              className="nf-glass-card nf-glass-interactive group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-2xs backdrop-blur-md transition-all duration-300 sm:p-6"
              style={{
                boxShadow:
                  '0 12px 32px -8px rgb(60 48 32 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.95)',
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" aria-hidden />
              <dd className="nf-num text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                <CountUp value={item.value} format={(value) => `${Math.round(value)}${item.suffix}`} />
              </dd>
              <dt className="mt-3 border-t border-line/50 pt-2.5 text-2xs uppercase tracking-eyebrow text-faint">
                {item.label}
              </dt>
            </div>
          ))}
        </dl>

        {/* Scroll cue: tactile frosted glass pill */}
        <Link
          to="/#services"
          className="nf-focus nf-glass-pill mt-12 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 text-[13px] text-muted shadow-2xs backdrop-blur-md transition-all hover:border-brand/40 hover:bg-white hover:text-fg"
          style={{ boxShadow: '0 2px 8px -2px rgb(60 48 32 / 0.06), inset 0 1px 0 rgb(255 255 255 / 0.85)' }}
        >
          See what we build
          <ArrowRight className="h-3.5 w-3.5 rotate-90 text-brand" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
