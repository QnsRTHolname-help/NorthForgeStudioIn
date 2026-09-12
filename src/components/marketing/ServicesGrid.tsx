import { SERVICES, SERVICE_GROUPS } from '@shared/catalog';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { SectionHeader } from '@/components/ui/Card';
import { SpotlightCard } from '@/components/motion';
import { Bento, BentoItem, TiltCard } from '@/components/motion/primitives';
import { useReducedMotion } from '@/hooks';
import { LinkButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const GROUP_ICONS: Record<string, string> = {
  automation: 'M12 3 3 8v8l9 5 9-5V8l-9-5Z',
  crm: 'M4 18V8m5 10V5m5 13v-7m5 7V9',
  ai: 'M12 4v4m0 8v4M4 12h4m8 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8',
  build: 'M4 12a8 8 0 0 1 8-8m8 8a8 8 0 0 1-8 8M20 6v4h-4M4 18v-4h4',
  support: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z',
};

/**
 * Services (spec §20).
 * Grouped by capability with quiet hover reveals — the icon shifts, the
 * card lifts a hair, and the detail line fades in. No bouncing.
 */
export function ServicesGrid({ compact = false }: { compact?: boolean }) {
  const groups = SERVICE_GROUPS.filter((group) => SERVICES.some((s) => s.group === group.key));

  return (
    <div className={cn('space-y-14', compact && 'space-y-10')}>
      {groups.map((group, groupIndex) => {
        const services = SERVICES.filter((service) => service.group === group.key && service.active);
        if (!services.length) return null;

        return (
          <Reveal key={group.key} start={`top ${86 - groupIndex}%`}>
            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-line bg-surface">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                      <path d={GROUP_ICONS[group.key] ?? GROUP_ICONS.web} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h3 className="text-[15px] font-semibold tracking-[0.02em] text-fg">{group.label}</h3>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{group.blurb}</p>
              </div>

              <Stagger className="grid gap-3 sm:grid-cols-2" stagger={0.05}>
                {services.map((service) => (
                  <StaggerItem key={service.id}>
                    <SpotlightCard className="h-full">
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-[14px] font-medium text-fg">{service.name}</h4>
                          <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-2xs uppercase tracking-wide text-faint">
                            {service.unit === 'quoted' ? 'Quoted' : service.unit === 'included' ? 'Included' : 'Monthly'}
                          </span>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-muted">{service.description}</p>
                      </div>
                    </SpotlightCard>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </Reveal>
        );
      })}

      <div className="flex justify-center border-t border-line pt-10">
        <LinkButton to="/contact" variant="secondary" arrow>
          Discuss what you need
        </LinkButton>
      </div>
    </div>
  );
}


/**
 * Bento services (spec §12, §76).
 *
 * The homepage version of the service catalogue — one asymmetric grid where
 * the foundation (web) earns the large tile and the connected capabilities
 * sit around it. Every item is read from the central catalog, so a service
 * added there appears here without touching this file.
 */
function GroupIcon({ groupKey }: { groupKey: GroupKey }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d={GROUP_ICONS[groupKey] ?? GROUP_ICONS.automation!} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ServiceLines({ groupKey }: { groupKey: GroupKey }) {
  const services = SERVICES.filter((service) => service.group === groupKey && service.active);
  return (
    <ul className="mt-5 space-y-1.5">
      {services.slice(0, 6).map((service) => (
        <li key={service.id} className="flex items-center gap-2.5 text-[13px] text-muted">
          <span className="h-1 w-1 shrink-0 rounded-full bg-brand/70" aria-hidden />
          {service.name}
        </li>
      ))}
    </ul>
  );
}

type GroupKey = (typeof SERVICE_GROUPS)[number]['key'];

const BENTO_LAYOUT: { key: GroupKey; span: string; tone: 'default' | 'brand' | 'quiet' }[] = [
  { key: 'automation', span: 'md:col-span-3 lg:row-span-2', tone: 'brand' },
  { key: 'ai', span: 'md:col-span-3', tone: 'default' },
  { key: 'crm', span: 'md:col-span-2', tone: 'default' },
  { key: 'build', span: 'md:col-span-2', tone: 'default' },
  { key: 'support', span: 'md:col-span-2', tone: 'quiet' },
];

export function BentoServices() {
  const byKey = new Map(SERVICE_GROUPS.map((group) => [group.key, group]));

  return (
    <Bento>
      {BENTO_LAYOUT.map((entry, index) => {
        const group = byKey.get(entry.key);
        if (!group) return null;
        const featured = index === 0;

        return (
          <BentoItem
            key={entry.key}
            span={entry.span}
            tone={entry.tone}
            className={featured ? 'flex flex-col justify-between md:p-8' : ''}
          >
            <Reveal start={`top ${90 - index}%`}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface/70">
                  <GroupIcon groupKey={group.key} />
                </span>
                <h3 className="text-[15px] font-semibold tracking-tight text-fg">{group.label}</h3>
              </div>
              <p className={cn('mt-4 text-[13px] leading-relaxed text-muted', featured && 'max-w-md')}>
                {group.blurb}
              </p>
              <ServiceLines groupKey={group.key} />

              {featured ? (
                <div className="mt-8">
                  <TiltCard max={5} glare={false}>
                    <div className="overflow-hidden rounded-lg border border-line bg-surface/80">
                      {/* A quiet, honest browser frame — no fabricated content. */}
                      <div className="flex items-center gap-1.5 border-b border-line bg-sunken/60 px-3 py-2">
                        <span className="h-2 w-2 rounded-full bg-line-strong" aria-hidden />
                        <span className="h-2 w-2 rounded-full bg-line-strong" aria-hidden />
                        <span className="h-2 w-2 rounded-full bg-line-strong" aria-hidden />
                        <span className="ml-2 flex-1 truncate rounded-full bg-surface px-2.5 py-0.5 font-mono text-2xs text-faint">
                          yourbusiness.com
                        </span>
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="h-2.5 w-1/3 rounded-full bg-line-strong/70" aria-hidden />
                        <div className="h-8 w-3/4 rounded bg-gradient-to-r from-brand/20 to-transparent" aria-hidden />
                        <div className="h-2 w-1/2 rounded-full bg-line" aria-hidden />
                        <div className="flex items-center gap-2 pt-2">
                          <span className="flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-2xs font-medium text-success">
                            <span className="h-1 w-1 rounded-full bg-success" aria-hidden />
                            Live
                          </span>
                          <span className="text-2xs text-faint">SSL · Hosting · Analytics</span>
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                </div>
              ) : null}
            </Reveal>
          </BentoItem>
        );
      })}
    </Bento>
  );
}


/**
 * Numbered service rows.
 *
 * The reference pattern from the best agency sites: a large index, a short
 * title, one honest sentence, and the detail revealed on hover rather than
 * dumped on the page. Rows stay open on touch devices and for keyboard
 * users, where there is no hover to reveal anything.
 */
export function ServiceRows() {
  const reduced = useReducedMotion();

  return (
    <div className="border-t border-line">
      {SERVICE_GROUPS.map((group, index) => {
        const services = SERVICES.filter((service) => service.group === group.key && service.active);
        if (!services.length) return null;

        return (
          <div
            key={group.key}
            className="group relative border-b border-line"
          >
            {/* Accent rule that grows across the row on hover. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-px h-px origin-left scale-x-0 bg-gradient-to-r from-brand via-brand-violet to-transparent transition-transform duration-700 ease-forge group-hover:scale-x-100"
            />

            <div className="grid gap-4 py-8 transition-colors duration-500 sm:grid-cols-[auto_minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-start sm:gap-10 sm:py-10 lg:py-12">
              <div className="flex items-center gap-4 sm:block">
                <span className="nf-num text-[13px] font-medium tracking-eyebrow text-brand">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="text-[clamp(1.6rem,3.6vw,2.6rem)] font-semibold leading-none tracking-[-0.03em] text-fg transition-colors duration-500 group-hover:text-brand sm:mt-4">
                  {group.label}
                </h3>
              </div>

              <p className="max-w-md text-[14px] leading-relaxed text-muted sm:pt-2">{group.blurb}</p>

              {/* Detail: revealed on hover/focus, always shown without hover. */}
              <ul className="flex flex-wrap gap-2 sm:pt-2">
                {services.map((service) => (
                  <li key={service.id}>
                    <span
                      title={service.description}
                      className="inline-flex items-center rounded-full border border-line bg-surface/60 px-3 py-1.5 text-[13px] text-muted transition-all duration-500 ease-forge group-hover:border-line-strong group-hover:text-fg"
                    >
                      {service.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {reduced ? null : (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-brand/[0.05] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ServicesSection() {
  return (
    <section id="services" className="nf-shell scroll-mt-28 py-20 lg:py-28">
      <SectionHeader
        eyebrow="Services"
        title="Everything the system needs. Nothing it doesn't."
        description="Five capability groups that work together. Take the whole system, or start with the foundation and add as you grow."
      />
      <div className="mt-14">
        <ServicesGrid />
      </div>
    </section>
  );
}
