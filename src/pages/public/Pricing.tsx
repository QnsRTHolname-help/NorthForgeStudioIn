import { useEffect } from 'react';
import { PricingTable } from '@/components/marketing/PricingTable';
import { FinalCta, NextSteps } from '@/components/marketing/Sections';
import { SectionHeader } from '@/components/ui/Card';
import { FaqSection } from '@/components/marketing/FaqSection';
import { usePageMeta } from '@/hooks/usePageMeta';
import { trackEvent } from '@/lib/analytics';

export default function Pricing() {
  usePageMeta({
    title: 'Pricing — setup fee plus monthly subscription',
    description:
      'NorthForge pricing: LEAD ₹7,500/month + ₹15,000 setup, CONVERT ₹15,000/month + ₹30,000 setup, AUTOPILOT ₹30,000/month + ₹60,000 setup, plus custom-quoted work.',
    canonicalPath: '/pricing',
  });

  // Which plan a visitor compared before enquiring is genuinely useful;
  // nothing identifying is attached to it (spec §39–§40).
  useEffect(() => {
    trackEvent('pricing_view');
  }, []);

  return (
    <>
      <section className="border-b border-line py-16 lg:py-24">
        <div className="nf-shell">
          <SectionHeader
            eyebrow="Pricing"
            title="Simple plans. No surprise line items."
            description="Hosting, SSL and a custom domain come with every plan. Third-party costs are passed through at cost and always shown separately."
          />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/[0.08] px-3 py-1 text-xs font-semibold text-fg">
              <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              Only 3 onboarding spots left this month
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/[0.08] px-3 py-1 text-xs font-semibold text-fg">
              Founder Beta Pass: Save ₹5,000 on Setup with code FOUNDER5K
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/[0.08] px-3 py-1 text-xs font-semibold text-fg">
              Quarterly Commitment: 15% discount + 1 complimentary seat
            </span>
          </div>
        </div>
      </section>

      <PricingTable showHeading={false} />

      <section className="nf-shell py-16">
        <SectionHeader eyebrow="Good to know" title="Before you choose" />
        <div className="mt-10">
          <NextSteps
            items={[
              {
                label: 'How long it takes',
                to: '/how-it-works',
                description: 'The six stages from first call to launch and growth.',
              },
              {
                label: 'Common questions',
                to: '/faq',
                description: 'Upgrades, cancellations, domains and support.',
              },
            ]}
          />
        </div>
      </section>

      <FaqSection limit={7} />
      <FinalCta
        title="Start with the plan that fits today."
        description="You can move up a tier whenever your business needs it — the change applies from your next billing cycle."
      />
    </>
  );
}
