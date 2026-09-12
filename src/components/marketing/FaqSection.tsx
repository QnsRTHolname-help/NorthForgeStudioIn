import { useEffect } from 'react';
import { FAQS } from '@/data/content';
import { Accordion } from '@/components/ui/Tabs';
import { SectionHeader } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';

/** FAQ with structured data for search engines (spec §27, §94). */
export function FaqSection({ limit }: { limit?: number }) {
  const items = limit ? FAQS.slice(0, limit) : FAQS;

  useEffect(() => {
    const existing = document.getElementById('nf-faq-schema');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = 'nf-faq-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    });
    document.head.appendChild(script);

    return () => {
      document.getElementById('nf-faq-schema')?.remove();
    };
  }, [items]);

  return (
    <section id="faq" className="nf-shell scroll-mt-28 py-20 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeader
            eyebrow="FAQ"
            title="Straight answers."
            description="The questions we get asked before almost every project."
          />
          <div className="mt-8">
            <LinkButton to="/contact" variant="secondary" arrow>
              Ask something else
            </LinkButton>
          </div>
        </div>

        <Accordion items={items.map((item) => ({ id: item.question, question: item.question, answer: item.answer }))} />
      </div>
    </section>
  );
}
