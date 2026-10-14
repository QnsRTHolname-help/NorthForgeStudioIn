import { useState } from 'react';
import { Check, Flame, Gift, Minus, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  PLANS,
  PLAN_SCOPE_ROWS,
  THIRD_PARTY_COSTS,
  BILLING_FACTS,
  PSYCHOLOGICAL_PRICING,
  getQuarterlySavings,
  planAmountLabel,
  planSetupLabel,
} from '@shared/catalog';
import { cn } from '@/lib/cn';
import { LinkButton } from '@/components/ui/Button';
import { Magnetic } from '@/components/motion';
import { SplitText, TiltCard } from '@/components/motion/primitives';
import { Reveal } from '@/components/motion';
import { SectionHeader } from '@/components/ui/Card';

/**
 * Pricing (spec §14, R6) — every figure comes from the shared catalog.
 *
 * Implements psychological pricing hooks:
 * - First-time welcome discount: ₹5,000 off setup fee (Code: FOUNDER5K)
 * - Monthly scarcity: Only 3 onboarding spots left this month
 * - Weekly velocity: 48-Hour rapid workflow deployment
 * - Retention incentives: 15% quarterly savings + 1 extra seat free
 */
export function PricingTable({ showHeading = true, showDetail = true }: { showHeading?: boolean; showDetail?: boolean }) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly'>('monthly');
  const priced = PLANS.filter((plan) => plan.amount !== null);

  return (
    <section id="pricing" className={cn(showHeading ? 'nf-shell scroll-mt-28 py-20 lg:py-28' : 'scroll-mt-28')}>
      {showHeading ? (
        <SectionHeader
          eyebrow="Pricing"
          title="A one-time setup fee. Then a monthly subscription."
          description="The setup fee covers discovery, mapping, configuration, integration, testing and handover. The monthly fee keeps it monitored, maintained, supported and improving."
        />
      ) : null}

      {/* Psychological scarcity & velocity banners */}
      <div className={cn('flex flex-wrap items-center justify-center gap-3', showHeading ? 'mt-10' : 'mt-4')}>
        <div className="nf-glass-pill inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/[0.08] px-3.5 py-1 text-xs font-medium text-fg shadow-2xs">
          <Flame className="h-3.5 w-3.5 text-warning shrink-0" aria-hidden />
          <span>Only {PSYCHOLOGICAL_PRICING.monthlyCohortSpotsRemaining} onboarding spots left this month</span>
        </div>
        <div className="nf-glass-pill inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/[0.08] px-3.5 py-1 text-xs font-medium text-fg shadow-2xs">
          <Gift className="h-3.5 w-3.5 text-brand shrink-0" aria-hidden />
          <span>Founder Beta Pass: Save ₹5,000 on Setup with code <strong className="font-semibold text-brand">{PSYCHOLOGICAL_PRICING.founderPromoCode}</strong></span>
        </div>
        <div className="nf-glass-pill inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/[0.08] px-3.5 py-1 text-xs font-medium text-fg shadow-2xs">
          <Zap className="h-3.5 w-3.5 text-success shrink-0" aria-hidden />
          <span>{PSYCHOLOGICAL_PRICING.rapidDeploymentHours}-Hour Rapid Workflow Deployment</span>
        </div>
      </div>

      {/* Billing cycle toggle with retention hook */}
      <div className="mt-8 flex flex-col items-center justify-center gap-2">
        <div className="nf-glass-card inline-flex rounded-xl border border-white/60 p-1 shadow-2xs backdrop-blur-md">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-200',
              billingCycle === 'monthly'
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-fg',
            )}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('quarterly')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-200',
              billingCycle === 'quarterly'
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted hover:text-fg',
            )}
          >
            <span>Quarterly Commitment</span>
            <span className="rounded-full bg-success/20 px-1.5 py-0.2 text-2xs font-bold text-success">
              Save 15%
            </span>
          </button>
        </div>
        {billingCycle === 'quarterly' ? (
          <p className="text-2xs font-medium text-success animate-fade-in">
            ✓ 15% upfront discount + 1 extra team seat included free on all plans
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const recommended = plan.recommended;
          const custom = plan.amount === null;
          const savings = getQuarterlySavings(plan);

          return (
            <Reveal key={plan.id} className="h-full">
              <TiltCard max={recommended ? 5 : 3} className="h-full">
                <div
                  className={cn(
                    'nf-glass-card nf-glass-interactive group relative flex h-full flex-col rounded-2xl p-6 transition-all duration-500 ease-forge hover:-translate-y-1 shadow-2xs',
                    recommended
                      ? 'nf-glass-elevated border-brand/60 ring-1 ring-brand/30 shadow-[0_28px_70px_-32px_rgb(var(--nf-blue)/0.55)] lg:-translate-y-2 lg:hover:-translate-y-3'
                      : 'border-white/60 hover:border-white/90',
                  )}
                >
                  {/* Featured illumination glow for Convert plan */}
                  {recommended ? (
                    <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-brand/15 blur-2xl" aria-hidden />
                  ) : null}

                  {recommended ? (
                    <span className="nf-glass-pill absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-0.5 text-2xs font-semibold uppercase tracking-wider text-white shadow-sm ring-2 ring-white/80">
                      Most chosen
                    </span>
                  ) : null}

                  <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-fg">{plan.name}</h3>
                  <p className="mt-2 text-[13px] font-medium text-brand">{plan.outcome}</p>

                  <div className="mt-6">
                    <div className="flex items-baseline gap-1.5">
                      <span className="nf-num text-[32px] font-semibold leading-none tracking-tight text-fg">
                        {!custom && billingCycle === 'quarterly' && savings
                          ? `₹${Math.round(savings.quarterlyTotal / 3 / 100).toLocaleString('en-IN')}`
                          : planAmountLabel(plan)}
                      </span>
                      {!custom ? (
                        <span className="text-[13px] text-faint">
                          {billingCycle === 'quarterly' ? '/ mo (billed quarterly)' : '/ month'}
                        </span>
                      ) : null}
                    </div>

                    {!custom && billingCycle === 'quarterly' && savings ? (
                      <p className="mt-1 text-2xs font-medium text-success">
                        Save ₹{(savings.savings / 100).toLocaleString('en-IN')} / quarter + free seat
                      </p>
                    ) : null}

                    <div className="mt-2.5 flex items-center justify-between text-[13px] text-muted">
                      <span className="nf-num">{planSetupLabel(plan)}</span>
                      {!custom ? (
                        <span className="rounded bg-brand/10 px-1.5 py-0.5 text-2xs font-semibold text-brand">
                          -₹5,000 w/ code
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-5 text-[13px] leading-relaxed text-muted">{plan.description}</p>

                  <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-5">
                    {plan.features.slice(0, 7).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[13px] text-fg">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                        <span className="leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7">
                    <LinkButton
                      to={`/contact?plan=${plan.slug}`}
                      fullWidth
                      variant={recommended ? 'primary' : 'secondary'}
                      className={recommended ? 'nf-glass-glow shadow-md' : ''}
                    >
                      {custom ? 'Request a quote' : `Choose ${plan.name.toLowerCase()}`}
                    </LinkButton>
                    <Link
                      to="/pricing#scope"
                      className="nf-focus mt-2.5 block text-center text-xs text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
                    >
                      See full pricing details
                    </Link>
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          );
        })}
      </div>

      {/* Scope comparison — the honest limits, side by side. */}
      {showDetail ? (
        <div id="scope" className="mt-16 scroll-mt-28">
        <h3 className="text-headline font-semibold text-fg">
          <SplitText text="What each plan includes." stagger={0.04} />
        </h3>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">Plan scope comparison</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-[38%] py-3 pr-4 text-2xs font-medium uppercase tracking-eyebrow text-faint">
                  Scope
                </th>
                {priced.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={cn(
                      'py-3 pr-4 text-[13px] font-semibold',
                      plan.recommended ? 'text-brand' : 'text-fg',
                    )}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_SCOPE_ROWS.map((row) => (
                <tr key={row} className="border-b border-line/60">
                  <th scope="row" className="py-3 pr-4 text-[13px] font-normal text-muted">
                    {row}
                  </th>
                  {priced.map((plan) => (
                    <td
                      key={plan.id}
                      className={cn(
                        'py-3 pr-4 text-[13px]',
                        plan.scope[row] === '—' ? 'text-faint' : 'text-fg',
                      )}
                    >
                      {plan.scope[row] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Workflow limits are confirmed after discovery and can be revised as infrastructure and third-party costs
          change. We do not promise unlimited automation.
        </p>
      </div>
      ) : null}

      {/* Honest billing notes (spec §123, §124) */}
      {showDetail ? (
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-sunken/30 p-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-fg">How billing works</h3>
          <ul className="mt-4 space-y-2.5">
            {BILLING_FACTS.map((fact) => (
              <li key={fact} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-line bg-sunken/30 p-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-fg">
            Separate third-party costs
          </h3>
          <ul className="mt-4 space-y-2.5">
            {THIRD_PARTY_COSTS.map((cost) => (
              <li key={cost.label} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                <span>
                  <span className="text-fg">{cost.label}</span> — {cost.note}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      ) : null}

      {/* Psychological retention incentives */}
      {showDetail ? (
        <div className="nf-glass-card mt-8 rounded-2xl border border-brand/20 bg-brand/[0.04] p-6 backdrop-blur-md shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="nf-glass-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-brand shadow-2xs">
                Retention & Growth Incentives
              </span>
              <h4 className="mt-2 text-base font-semibold text-fg">Long-term alignment without lock-in contracts</h4>
              <p className="mt-1 text-xs text-muted">
                Choose quarterly or annual commitments for compounding savings and dedicated engineering support.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="nf-glass-card rounded-xl border border-white/60 p-3 text-center shadow-2xs">
                <span className="text-2xs font-bold text-success uppercase">Quarterly Upfront</span>
                <p className="text-xs font-semibold text-fg mt-0.5">15% Savings</p>
                <span className="text-3xs text-muted">+1 free employee seat</span>
              </div>
              <div className="nf-glass-card rounded-xl border border-white/60 p-3 text-center shadow-2xs">
                <span className="text-2xs font-bold text-brand uppercase">Annual Commit</span>
                <p className="text-xs font-semibold text-fg mt-0.5">2 Months Free</p>
                <span className="text-3xs text-muted">Priority WhatsApp builder</span>
              </div>
              <div className="nf-glass-card rounded-xl border border-white/60 p-3 text-center shadow-2xs">
                <span className="text-2xs font-bold text-fg uppercase">Risk-Free Handover</span>
                <p className="text-xs font-semibold text-fg mt-0.5">Full Data Export</p>
                <span className="text-3xs text-muted">Source code handover anytime</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-12 flex flex-col items-center gap-4 border-t border-line pt-12 text-center">
        <p className="max-w-xl text-[15px] leading-relaxed text-muted">
          Not sure what to automate first? Send us your details and we will tell you honestly where the time and the
          enquiries are going — including if you do not need us yet.
        </p>
        <Magnetic>
          <LinkButton to="/contact" size="lg" arrow>
            Get a free automation review
          </LinkButton>
        </Magnetic>
        {!showDetail ? (
          <Link
            to="/pricing#scope"
            className="nf-focus text-[13px] text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
          >
            See full pricing details — what each plan includes
          </Link>
        ) : null}
      </div>
    </section>
  );
}
