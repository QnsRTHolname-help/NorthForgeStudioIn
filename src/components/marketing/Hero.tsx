import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { gsap } from 'gsap';
import { LinkButton, Button } from '@/components/ui/Button';
import { Magnetic } from '@/components/motion';
import { SplitText, CountUp } from '@/components/motion/primitives';
import { GrowthSystem, GrowthChain } from './GrowthSystem';
import { whatsappLink } from '@/data/site';
import { useReducedMotion } from '@/hooks';
import { trackEvent } from '@/lib/analytics';

const PROOF = [
  { value: 4, suffix: ' weeks', label: 'Typical time to go live' },
  { value: 24, suffix: '/7', label: 'Enquiries answered' },
  { value: 0, suffix: ' tools', label: 'To update by hand' },
];

/**
 * Public hero — editorial and typography-led.
 *
 * Left: the statement, set large enough to be the design. Right: the
 * NorthForge system, drawn as a believable operating flow rather than a
 * decorative network. No stock imagery, no gradient wash — cream canvas,
 * ink type, and the NorthForge blue used only as a signal.
 *
 * Motion is one controlled timeline (eyebrow → headline → copy → actions →
 * system → metrics) and collapses to a plain reveal under
 * prefers-reduced-motion.
 */
export function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const node = root.current;
    if (!node || reduced) return;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

      timeline
        .fromTo('[data-hero-eyebrow]', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.1)
        .fromTo('[data-hero-copy]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 0.7)
        .fromTo('[data-hero-actions] > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.82)
        .fromTo('[data-hero-system]', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, 0.75)
        .fromTo('[data-hero-meta]', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.25);
    }, node);

    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={root} className="relative overflow-hidden border-b border-line">
      {/* Quiet architectural grid — present only as a texture, never a crate. */}
      <div className="nf-grid-bg pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      {/* Soft light behind the system panel — depth without decoration. */}
      <div
        className="pointer-events-none absolute right-0 top-24 h-[520px] w-[620px] translate-x-1/4 rounded-full opacity-[0.10] blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgb(var(--nf-blue)), transparent 70%)' }}
        aria-hidden
      />

      <div className="nf-shell relative pb-16 pt-24 sm:pt-28 lg:pb-24 lg:pt-32">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16">
          {/* ── Statement ─────────────────────────────────────── */}
          <div>
            <div data-hero-eyebrow className="flex items-center gap-2">
              <span className="nf-eyebrow">WEB · AUTOMATION · AI · GROWTH</span>
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
            </div>

            {/* Type scaled to its COLUMN, not the viewport.
                `text-hero` (up to 7.25rem) is sized for a full-bleed statement;
                inside a two-column hero it forced "WE BUILD DIGITAL SYSTEMS"
                into a ragged word-per-line stack and pushed the hero to almost
                two screens — the CTA fell below the fold. Same words, same
                editorial weight, fitted to the space it actually has. */}
            <h1
              data-hero-copy
              className="mt-8 text-[clamp(2.35rem,4.7vw,4.35rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-fg"
              style={{ maxWidth: '20ch' }}
            >
              <SplitText
                text={'WE BUILD DIGITAL SYSTEMS\nTHAT MOVE YOUR BUSINESS FORWARD.'}
                by="line"
                stagger={0.09}
                trigger="mount"
              />
            </h1>

            <p data-hero-copy className="mt-7 max-w-xl text-[16px] leading-relaxed text-muted">
              NorthForge designs premium websites and connects them to AI, lead capture, WhatsApp,
              automation and analytics — turning your digital presence into a system that helps your
              business grow.
            </p>

            <div data-hero-actions className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic>
                <LinkButton
                  to="/contact"
                  size="lg"
                  arrow
                  onClick={() => trackEvent('get_started_click', { location: 'hero' })}
                >
                  Start a project
                </LinkButton>
              </Magnetic>
              <Magnetic>
                <LinkButton to="/how-it-works" variant="secondary" size="lg" iconLeft={<ArrowRight className="h-4 w-4 rotate-90" />}>
                  See how it works
                </LinkButton>
              </Magnetic>
              <Button
                variant="ghost"
                size="lg"
                iconLeft={<MessageCircle className="h-4 w-4" />}
                onClick={() => {
                  trackEvent('whatsapp_click', { context: 'general', location: 'hero' });
                  window.open(whatsappLink('Hi NorthForge — I would like to know more.'), '_blank', 'noopener');
                }}
              >
                Talk on WhatsApp
              </Button>
            </div>
          </div>

          {/* ── System panel ───────────────────────────────────── */}
          <div data-hero-system className="relative">
            <div className="relative overflow-hidden rounded-lg border border-line bg-surface/70 p-5 shadow-lift backdrop-blur-md sm:p-7">
              <div className="mb-5 flex items-center justify-between">
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

              <p className="mt-5 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
                Every step is connected. Nothing depends on someone remembering to check a spreadsheet.
              </p>
            </div>
          </div>
        </div>

        <dl
          data-hero-meta
          className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-line pt-8 sm:gap-10"
        >
          {PROOF.map((item) => (
            <div key={item.label} className="sm:border-l sm:border-line sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
              <dd className="nf-num text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                <CountUp value={item.value} format={(value) => `${Math.round(value)}${item.suffix}`} />
              </dd>
              <dt className="mt-2 text-2xs uppercase tracking-eyebrow text-faint">{item.label}</dt>
            </div>
          ))}
        </dl>

        {/* Scroll cue: the same prompt, given a real tap target (was a 20px
            tall text link) and a downward motion hint. */}
        <Link
          to="/#services"
          className="nf-focus mt-12 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface/60 px-4 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          See what we build
          <ArrowRight className="h-3.5 w-3.5 rotate-90 text-brand" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
