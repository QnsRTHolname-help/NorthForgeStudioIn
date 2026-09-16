import { PricingTable } from '@/components/marketing/PricingTable';
import { FinalCta, NextSteps } from '@/components/marketing/Sections';
import { SectionHeader } from '@/components/ui/Card';
import { FaqSection } from '@/components/marketing/FaqSection';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Pricing() {
  usePageMeta({
    title: 'Pricing — setup fee plus monthly subscription',
    description:
      'NorthForge pricing: LEAD ₹7,500/month + ₹15,000 setup, CONVERT ₹15,000/month + ₹30,000 setup, AUTOPILOT ₹30,000/month + ₹60,000 setup, plus custom-quoted work.',
    canonicalPath: '/pricing',
  });

  return (
    <>
      <section className="border-b border-line py-16 lg:py-24">
        <div className="nf-shell">
          <SectionHeader
            eyebrow="Pricing"
            title="Simple plans. No surprise line items."
            description="Hosting, SSL and a custom domain come with every plan. Third-party costs are passed through at cost and always shown separately."
          />
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
