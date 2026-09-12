import type { CatalogResponse } from '@/services';
import { BILLING_FACTS, BILLING_INTERVAL_DAYS, CURRENCY, PLANS, SERVICE_GROUPS, SERVICES, THIRD_PARTY_COSTS } from '@shared/catalog';

/**
 * Catalog assembly. `@shared/catalog` is the single source of truth for
 * every price (spec §71); this file only shapes it into the response the
 * UI expects.
 */
export const CATALOG: CatalogResponse = {
  currency: CURRENCY,
  intervalDays: BILLING_INTERVAL_DAYS,
  plans: PLANS,
  services: SERVICES,
  serviceGroups: [...SERVICE_GROUPS],
  thirdPartyCosts: [...THIRD_PARTY_COSTS],
  billingFacts: [...BILLING_FACTS],
};
