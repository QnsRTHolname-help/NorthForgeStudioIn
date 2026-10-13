/** The erasure window we commit to. Stated once so it reads the same everywhere. */
export const ERASURE_WINDOW = '6 business days';

/** Prominent standard account deletion disclosure statement. */
export const STANDARD_DELETION_NOTICE = `Standard account deletion completes in ${ERASURE_WINDOW}.`;

/* What genuinely goes, and what genuinely stays. These are not the same list,
   and a confirmation screen that implies otherwise is the bug worth avoiding. */
export const ERASED_ITEMS = [
  'Your login, profile and phone number',
  'Your business workspace and everything hanging off it',
  'Leads, proposals, projects, milestones and tasks',
  'Requests, support tickets and their messages',
  'Bookings, uploaded files and website analytics records',
];

export const KEPT_ITEMS = [
  'Invoices and payments already issued or received, as financial records',
  'A short audit record that the account was closed and when',
  'Backup copies, until they cycle out on their own schedule',
];