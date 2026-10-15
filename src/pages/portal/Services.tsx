import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Panel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Select, Input } from '@/components/ui/Form';
import { LinkButton } from '@/components/ui/Button';
import { PortalHeader } from '@/components/portal/PortalHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { titleForPath } from '@/app/config/titles';
import { SERVICES, SERVICE_GROUPS, PLANS } from '@shared/catalog';
import { formatMoney, formatMoneyPrecise } from '@/lib/format';

type ServiceGroup = (typeof SERVICE_GROUPS)[number]['key'];

/**
 * Client-facing service catalog.
 *
 * Mirrors the admin read-only view but styled for the portal. Reads
 * exclusively from the shared catalog — no backend call, no hardcoded prices.
 * Every line item on every invoice comes from here.
 */
export default function Services() {
  usePageMeta({ title: titleForPath('/portal/services') ?? 'Our services' });

  const [group, setGroup] = useState<ServiceGroup | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SERVICES.filter((service) => {
      const matchesGroup = group === 'all' || service.group === group;
      const matchesQuery =
        !needle ||
        service.name.toLowerCase().includes(needle) ||
        service.description.toLowerCase().includes(needle);
      return matchesGroup && matchesQuery;
    });
  }, [group, query]);

  const visibleGroups = useMemo(() => {
    return SERVICE_GROUPS.filter((g) => {
      if (group !== 'all' && g.key !== group) return false;
      return filtered.some((s) => s.group === g.key);
    });
  }, [group, filtered]);

  return (
    <div className="space-y-6">
      <PortalHeader
        title="Our services"
        description="Everything NorthForge builds, automates and runs for you. Prices are from the shared catalog — the same numbers your invoices use."
      />

      <Panel
        title="Service catalogue"
        description={`Showing ${filtered.length} of ${SERVICES.length} services across automation, AI, CRM, build, and support.`}
      >
        {/* Responsive search & category filter toolbar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" aria-hidden />
            <Input
              placeholder="Search services by name or description…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full pl-9"
              aria-label="Search services"
            />
          </div>
          <div className="w-full sm:w-[200px] shrink-0">
            <Select
              value={group}
              onChange={(event) => setGroup(event.target.value as ServiceGroup | 'all')}
              options={[
                { value: 'all', label: 'All categories' },
                ...SERVICE_GROUPS.map((g) => ({ value: g.key, label: g.label })),
              ]}
              className="w-full"
              aria-label="Filter by category"
            />
          </div>
        </div>

        {/* Grouped Services List */}
        <div className="space-y-8">
          {visibleGroups.map((g) => {
            const groupServices = filtered.filter((s) => s.group === g.key);
            return (
              <section key={g.key} className="space-y-3" aria-labelledby={`category-${g.key}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Badge tone={groupTone(g.key)} className="text-xs font-semibold tracking-wider">
                      {g.label}
                    </Badge>
                    <span className="text-xs text-muted hidden sm:inline">{g.blurb}</span>
                  </div>
                  <span className="text-xs font-medium text-faint">
                    {groupServices.length} {groupServices.length === 1 ? 'service' : 'services'}
                  </span>
                </div>

                <ul className="space-y-3">
                  {groupServices.map((service) => (
                    <li
                      key={service.id}
                      className="rounded-lg border border-line bg-surface p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors hover:border-line-strong"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="font-medium text-fg text-[14px]">{service.name}</p>
                          <Badge tone={groupTone(service.group)} className="text-2xs uppercase">
                            {service.group}
                          </Badge>
                          <Badge
                            tone={service.unit === 'included' ? 'success' : service.unit === 'quoted' ? 'warning' : 'info'}
                            className="text-2xs"
                          >
                            {unitLabel(service.unit)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted line-clamp-2">
                          {service.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/60">
                        <div className="text-left sm:text-right">
                          <span className="text-xs text-faint sm:hidden block">Price</span>
                          {service.priceFrom === null && service.unit === 'included' ? (
                            <span className="text-[14px] font-semibold text-success">Included</span>
                          ) : service.priceFrom !== null ? (
                            <span className="nf-num text-[14px] font-semibold text-fg">
                              {service.unit === 'monthly'
                                ? `${formatMoney(service.priceFrom)}/mo`
                                : formatMoneyPrecise(service.priceFrom)}
                            </span>
                          ) : (
                            <span className="text-[14px] font-semibold text-muted">On quote</span>
                          )}
                        </div>
                        <LinkButton
                          to={`/portal/requests?new=1&action=activation&title=${encodeURIComponent('Activation: ' + service.name)}&description=${encodeURIComponent('Requesting activation for service: ' + service.name + ' (' + service.description + ').')}&type=${service.group === 'automation' ? 'automation' : service.group === 'build' ? 'website_change' : 'general'}`}
                          variant="secondary"
                          size="sm"
                        >
                          Request
                        </LinkButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-fg">No services match your filters</p>
              <p className="mt-1 text-xs text-muted">Try adjusting your search terms or selecting "All categories".</p>
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="Pricing plans"
        description="Monthly management cycles. The setup fee is a one-time build charge on your first invoice."
        className="space-y-4"
      >
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {PLANS.filter((p) => p.amount !== null).map((plan) => (
            <div key={plan.id} className="rounded-xl border border-line bg-surface p-5 flex flex-col">
              <div className="mb-3">
                <p className="text-sm font-semibold text-fg">{plan.name}</p>
                <p className="mt-0.5 text-xs text-muted">{plan.tagline}</p>
              </div>
              <div className="flex-1 space-y-3 text-[13px] text-muted">
                {plan.features.map((item) => (
                  <p key={item} className="flex gap-2"><span aria-hidden>✓</span>{item}</p>
                ))}
              </div>
              <div className="border-t border-line pt-4 mt-auto">
                <p className="text-xs text-faint">Monthly</p>
                <p className="nf-num text-[22px] font-semibold text-fg">{formatMoney(plan.amount!)}</p>
                {plan.setupAmount !== null && (
                  <p className="mt-1 text-xs text-muted">
                    Setup fee: <span className="text-fg">{formatMoney(plan.setupAmount)}</span>
                  </p>
                )}
                <div className="mt-4">
                  <LinkButton
                    to={`/portal/subscription?plan=${plan.slug}`}
                    size="sm"
                    fullWidth
                  >
                    Select {plan.name}
                  </LinkButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function groupTone(group: ServiceGroup): 'success' | 'warning' | 'info' | 'neutral' {
  switch (group) {
    case 'automation':
      return 'success';
    case 'ai':
      return 'warning';
    case 'crm':
      return 'info';
    case 'build':
      return 'neutral';
    case 'support':
      return 'success';
    default:
      return 'neutral';
  }
}

function unitLabel(unit: string): string {
  switch (unit) {
    case 'included':
      return 'Included';
    case 'monthly':
      return '/month';
    case 'quoted':
      return 'On quote';
    case 'one_time':
      return 'One-time';
    default:
      return unit;
  }
}