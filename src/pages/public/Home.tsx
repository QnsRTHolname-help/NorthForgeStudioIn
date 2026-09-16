import { useEffect } from 'react';
import { Hero } from '@/components/marketing/Hero';
import {
  ProofStrip,
  IntroStatement,
  ProblemSection,
  PromiseSection,
  WhyNorthForge,
  FinalCta,
} from '@/components/marketing/Sections';
import { ServiceRows } from '@/components/marketing/ServicesGrid';
import { ProcessTimeline } from '@/components/marketing/ProcessTimeline';
import { AutomationShowcase } from '@/components/marketing/AutomationShowcase';
import { CrmShowcase } from '@/components/marketing/CrmShowcase';
import { PricingTable } from '@/components/marketing/PricingTable';
import { FaqSection } from '@/components/marketing/FaqSection';
import { SectionHeader } from '@/components/ui/Card';
import { usePageMeta } from '@/hooks/usePageMeta';
import { organizationSchema } from '@/data/site';
import { SITE } from '@/data/site';

export default function Home() {
  usePageMeta({
    title: SITE.tagline,
    description: SITE.description,
    canonicalPath: '/',
  });

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(organizationSchema());
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <>
      <Hero />
      <ProofStrip />
      <IntroStatement />
      <ProblemSection />
      <PromiseSection />

      <section id="services" className="nf-shell scroll-mt-28 py-20 lg:py-28">
        <SectionHeader
          eyebrow="Services"
          title="What we build."
          description="Premium websites, then the systems behind them — lead capture, AI, WhatsApp, automation and analytics, working as one."
        />
        <div className="mt-14">
          <ServiceRows />
        </div>
      </section>

      <ProcessTimeline />
      <AutomationShowcase />
      <CrmShowcase />
      <WhyNorthForge />
      <PricingTable showDetail={false} />
      <FaqSection limit={6} />
      <FinalCta />
    </>
  );
}
