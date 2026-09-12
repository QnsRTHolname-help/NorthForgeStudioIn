import { ServicesGrid } from '@/components/marketing/ServicesGrid';
import { FinalCta } from '@/components/marketing/Sections';
import { SectionHeader } from '@/components/ui/Card';
import { FaqSection } from '@/components/marketing/FaqSection';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Services() {
  usePageMeta({
    title: 'Services — websites, lead capture, AI and automation',
    description:
      'NorthForge services: AI WhatsApp automation, business process automation, AI customer support, CRM development, lead pipelines, follow-up sequences, client portals, internal dashboards, e-commerce systems, AI voice receptionist and ongoing support.',
    canonicalPath: '/services',
  });

  return (
    <>
      <section className="border-b border-line py-16 lg:py-24">
        <div className="nf-shell">
          <SectionHeader
            eyebrow="Services"
            title="What NorthForge builds and runs for you."
            description="Five capability groups that work as one system. Every item below is maintained by us — you do not have to integrate or babysit any of it."
          />
        </div>
      </section>

      <div className="nf-shell py-16 lg:py-24">
        <ServicesGrid />
      </div>

      <FaqSection limit={8} />
      <FinalCta
        title="Not sure which of these you need?"
        description="Tell us what is taking the most time in your business and we will tell you which parts of the system solve it — and which ones you can skip."
      />
    </>
  );
}
