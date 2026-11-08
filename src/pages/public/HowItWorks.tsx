import { ProcessTimeline } from '@/components/marketing/ProcessTimeline';
import { AutomationShowcase } from '@/components/marketing/AutomationShowcase';
import { FinalCta, NextSteps, ProofStrip } from '@/components/marketing/Sections';
import { SectionHeader } from '@/components/ui/Card';
import { Reveal, AtmosphericGlow, SectionDivider } from '@/components/motion';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function HowItWorks() {
  usePageMeta({
    title: 'How it works — from discovery to continuous growth',
    description:
      'The NorthForge process: discover, design, build, connect, launch and grow. Six clear stages from first conversation to a system that keeps improving.',
    canonicalPath: '/how-it-works',
  });

  return (
    <>
      <section className="relative border-b border-line py-16 lg:py-24 overflow-hidden">
        <AtmosphericGlow color="blue" position="top-center" />
        <div className="nf-shell relative">
          <Reveal>
            <SectionHeader
              eyebrow="How it works"
              title="A clear process, with nothing hidden in the middle."
              description="You always know which stage the work is in, what is happening next, and what we need from you. Clients see the same stages inside their portal."
            />
          </Reveal>
        </div>
      </section>

      <ProofStrip />
      <SectionDivider />
      <ProcessTimeline />
      <SectionDivider />
      <AutomationShowcase />
      <SectionDivider />

      <section className="nf-shell relative py-16 lg:py-24">
        <Reveal>
          <SectionHeader
            eyebrow="Where to next"
            title="See the detail behind each area."
            description="Dive into the services, the pricing, or the questions everyone asks first."
          />
          <div className="mt-10">
            <NextSteps
              items={[
                {
                  label: 'Services',
                  to: '/#services',
                  description: 'The five capability groups and what each one includes.',
                },
                {
                  label: 'Pricing',
                  to: '/pricing',
                  description: 'Three plans — one-time setup plus monthly — and custom work.',
                },
                {
                  label: 'FAQ',
                  to: '/faq',
                  description: 'Timelines, domains, hosting, WhatsApp, AI and changes.',
                },
              ]}
            />
          </div>
        </Reveal>
      </section>

      <FinalCta />
    </>
  );
}
