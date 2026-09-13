-- ── Enquiries: plan of interest (contact form plan selector) ──
-- The public contact form lets an enquirer name the plan they are
-- interested in (prefilled when they arrive from /pricing?plan=…).
-- Nullable + no default: existing rows and old clients keep working.

alter table if exists enquiries
  add column if not exists plan text;
