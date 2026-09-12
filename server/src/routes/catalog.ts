import { Router } from 'express';
import { PLANS, SERVICES, SERVICE_GROUPS, CURRENCY, BILLING_INTERVAL_DAYS, THIRD_PARTY_COSTS, BILLING_FACTS } from '@shared/catalog';
import { asyncHandler, ok } from '../lib/http';

const router = Router();

/**
 * Public catalog. The browser never hard-codes a price — every surface
 * (marketing, portal, admin, invoices) renders from this response
 * (spec §105).
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    return ok(res, {
      currency: CURRENCY,
      intervalDays: BILLING_INTERVAL_DAYS,
      plans: PLANS,
      services: SERVICES,
      serviceGroups: SERVICE_GROUPS,
      thirdPartyCosts: THIRD_PARTY_COSTS,
      billingFacts: BILLING_FACTS,
    });
  }),
);

export default router;
