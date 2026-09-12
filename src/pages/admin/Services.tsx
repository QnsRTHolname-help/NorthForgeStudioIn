import { useState } from 'react';
import { Panel, KpiCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AdminHeader, ListToolbar } from '@/components/admin/AdminHeader';
import { SERVICES, SERVICE_GROUPS, BILLING_INTERVAL_DAYS } from '@shared/catalog';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatMoney, titleCase } from '@/lib/format';

const UNITS = ['one_time', 'monthly', 'included', 'quoted'];

/**
 * Service catalog (spec §105).
 *
 * Read-only by design: it is the single source of pricing truth, shared with
 * the public site and the proposal screens, so it is edited in code rather
 * than in a UI that could drift out of sync.
 */
export default function Services() {
  usePageMeta({ title: 'Service catalog', noIndex: true });
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');

  const items = SERVICES.filter((service) => {
    const matchesQuery =
      !query ||
      service.name.toLowerCase().includes(query.toLowerCase()) ||
      service.description.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!group || service.group === group);
  });

  const priced = SERVICES.filter((service) => service.priceFrom !== null);

  return (
    <div>
      <AdminHeader
        title="Service catalog"
        description="The one place every price in NorthForge comes from."
        crumbs={[{ label: 'Service catalog' }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <KpiCard label="Services" value={SERVICES.length} />
        <KpiCard label="Groups" value={SERVICE_GROUPS.length} />
        <KpiCard label="Priced items" value={priced.length} />
        <KpiCard label="Billing cycle" value={`${BILLING_INTERVAL_DAYS} days`} />
      </div>

      <ListToolbar
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Search services…"
        filters={[
          {
            label: 'Group',
            value: group,
            onChange: setGroup,
            options: [
              { value: '', label: 'All groups' },
              ...SERVICE_GROUPS.map((item) => ({ value: item.key, label: item.label })),
            ],
          },
        ]}
      />

      <Panel bodyClassName="p-0">
        <ul className="divide-y divide-line">
          {items.map((service) => (
            <li key={service.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">{service.name}</span>
                <span className="block line-clamp-1 text-2xs text-muted">{service.description}</span>
              </span>
              <Badge tone="neutral">{titleCase(service.group)}</Badge>
              <Badge tone={service.unit === 'included' ? 'success' : service.unit === 'quoted' ? 'warning' : 'info'}>
                {UNITS.includes(service.unit) ? titleCase(service.unit) : service.unit}
              </Badge>
              <span className="nf-num w-24 shrink-0 text-right text-[13px] font-semibold text-fg">
                {service.unit === 'quoted' ? 'Quoted' : service.priceFrom === null ? 'Included' : formatMoney(service.priceFrom)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-6" title="Why this is read-only">
        <p className="text-[13px] leading-relaxed text-muted">
          Pricing lives in the shared catalog that the public website, the client portal, proposals and invoice
          generation all read from. Changing a number changes it everywhere at once — which is exactly why it is edited in
          source control rather than through a form.
        </p>
      </Panel>
    </div>
  );
}
