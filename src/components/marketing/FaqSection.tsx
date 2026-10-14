import { useEffect, useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from '@/data/content';
import { SectionHeader } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

/** FAQ with structured data for search engines (spec §27, §94). */
export function FaqSection({ limit }: { limit?: number }) {
  const items = limit ? FAQS.slice(0, limit) : FAQS;
  const [openIndexes, setOpenIndexes] = useState<number[]>([0]);
  const baseId = `nf-faq-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const toggleIndex = (idx: number) => {
    setOpenIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

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

        <div className="nf-glass-card rounded-2xl border border-white/70 p-6 sm:p-8 shadow-sm backdrop-blur-xl">
          <div className="divide-y divide-line/60">
            {items.map((item, index) => {
              const isOpen = openIndexes.includes(index);
              const buttonId = `${baseId}-btn-${index}`;
              const panelId = `${baseId}-panel-${index}`;

              return (
                <div key={item.question} className="py-4 first:pt-0 last:pb-0">
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      onClick={() => toggleIndex(index)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="group flex w-full items-start justify-between gap-4 py-2 text-left transition-colors"
                    >
                      <span className={cn(
                        'text-[15px] sm:text-[16px] font-semibold transition-colors duration-200',
                        isOpen ? 'text-brand' : 'text-fg group-hover:text-brand'
                      )}>
                        {item.question}
                      </span>
                      <span className={cn(
                        'nf-glass-pill mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-all duration-300 shadow-2xs',
                        isOpen ? 'border-brand/40 bg-brand/10 text-brand' : 'group-hover:border-white/90 group-hover:text-fg'
                      )}>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform duration-300 ease-forge',
                            isOpen && 'rotate-180'
                          )}
                          aria-hidden
                        />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!isOpen}
                    className="pt-2 pb-2 pr-8 text-[14px] leading-relaxed text-muted animate-fade-in"
                  >
                    {item.answer}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
