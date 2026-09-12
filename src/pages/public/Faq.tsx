import { FaqSection } from '@/components/marketing/FaqSection';
import { FinalCta } from '@/components/marketing/Sections';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function Faq() {
  usePageMeta({
    title: 'Frequently asked questions',
    description:
      'Answers about NorthForge websites, hosting, SSL, domains, WhatsApp, AI, automation, the client portal, timelines, changes and plan upgrades.',
    canonicalPath: '/faq',
  });

  return (
    <>
      <section className="border-b border-line py-16 lg:py-24">
        <div className="nf-shell max-w-3xl">
          <span className="nf-eyebrow">FAQ</span>
          <h1 className="mt-4 text-display-sm font-semibold text-fg">Questions, answered properly.</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted">
            If something here is unclear, message us on WhatsApp or send an enquiry — you will get a real answer from the
            people who build the system.
          </p>
        </div>
      </section>

      <FaqSection />
      <FinalCta
        eyebrow="Still curious"
        title="Ask us directly."
        description="Tell us what your business does and where it loses time. We will reply with specifics, not a brochure."
      />
    </>
  );
}
