import { Check, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  PLANS,
  PLAN_SCOPE_ROWS,
  THIRD_PARTY_COSTS,
  BILLING_FACTS,
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
 * Pricing (spec §14) — every figure comes from the shared catalog.
 *
 * The commercial model is stated twice on purpose: a one-time setup fee and a
 * monthly subscription. Nothing is buried, and third-party costs are listed
 * separately rather than folded into the headline price.
 */
export function PricingTable({ showHeading = true }: { showHeading?: boolean }) {
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

      <div className={cn('grid gap-4 lg:grid-cols-4', showHeading && 'mt-14')}>
        {PLANS.map((plan) => {
          const recommended = plan.recommended;
          const custom = plan.amount === null;

          return (
            <Reveal key={plan.id} className="h-full">
              <TiltCard max={recommended ? 5 : 3} className="h-full">
                <div
                  className={cn(
                    'group relative flex h-full flex-col rounded-lg border bg-surface p-6 transition-[border-color,box-shadow,transform] duration-500 ease-forge hover:-translate-y-1',
                    recommended
                      ? 'border-brand/50 shadow-[0_28px_70px_-36px_rgb(var(--nf-blue)/0.6)] lg:-translate-y-2 lg:hover:-translate-y-3'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  {recommended ? (
                    <span className="absolute -top-2.5 left-6 rounded-full border border-brand/40 bg-brand px-2 py-0.5 text-2xs font-medium uppercase tracking-wider text-white">
                      Most chosen
                    </span>
                  ) : null}

                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-fg">{plan.name}</h3>
                  <p className="mt-2 text-[13px] font-medium text-brand">{plan.outcome}</p>

                  <div className="mt-6">
                    <div className="flex items-baseline gap-1.5">
                      <span className="nf-num text-[32px] font-semibold leading-none tracking-tight text-fg">
                        {planAmountLabel(plan)}
                      </span>
                      {!custom ? <span className="text-[13px] text-faint">/ month</span> : null}
                    </div>
                    <p className="nf-num mt-2 text-[13px] text-muted">{planSetupLabel(plan)}</p>
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
                    >
                      {custom ? 'Request a quote' : `Choose ${plan.name.toLowerCase()}`}
                    </LinkButton>
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          );
        })}
      </div>

      {/* Scope comparison — the honest limits, side by side. */}
      <div className="mt-16">
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

      {/* Honest billing notes (spec §123, §124) */}
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
        <Link
          to="/pricing"
          className="text-[13px] text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg"
        >
          See full pricing detail
        </Link>
      </div>
    </section>
  );
}
