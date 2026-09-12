import { useLocation } from 'react-router-dom';
import { CONTACT, SITE } from '@/data/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { PLACEHOLDER_CONTACT } from '@/data/site';

const LAST_UPDATED = '9 September 2026';

const PRIVACY = [
  {
    heading: 'What we collect',
    body: `We collect the information you give us directly — your name, business name, email, phone number and the details you include in an enquiry or support request. If you become a client, we also hold the operational records needed to run your system: enquiries captured by your website, project activity, invoices and support history.`,
  },
  {
    heading: 'How we use it',
    body: `To answer your enquiry, deliver and support the services you buy, keep the system secure, and meet our accounting obligations. We do not sell your information, and we do not use your business data to train third-party models.`,
  },
  {
    heading: 'AI and automated processing',
    body: `Automations process enquiry text to route it, score it and trigger the next step. Every automation is scoped to the account you are signed in to, and anything that creates, changes, sends or deletes a record is logged and visible to you. You can ask us to disable any automation at any time.`,
  },
  {
    heading: 'Processors we rely on',
    body: `Hosting, database, email and — where enabled — WhatsApp messaging and language-model providers. Each is engaged under a data processing agreement and only receives what it needs to perform its function.`,
  },
  {
    heading: 'Retention and your rights',
    body: `We keep enquiry records while there is an active or recent relationship, and invoices for the period required by law. You can ask for a copy of your data, ask us to correct it, or ask us to delete it — write to us and we will respond within 30 days.`,
  },
  {
    heading: 'Cookies',
    body: `We use one essential cookie to keep you signed in, and one preference cookie to remember your theme. We do not run advertising trackers.`,
  },
];

const TERMS = [
  {
    heading: 'Scope of work',
    body: `Each engagement is defined by a written scope agreed before work starts. Anything outside that scope is quoted separately and approved by you first.`,
  },
  {
    heading: 'Fees and billing',
    body: `Subscriptions are billed monthly in advance, and the setup fee is invoiced once before the first cycle. One-time setup and custom development are invoiced separately. Third-party costs — domain registration, WhatsApp Cloud API usage and AI usage above your plan allowance — are passed through at cost and shown as their own line items. You can change or cancel a plan at any time; changes take effect from the next billing cycle.`,
  },
  {
    heading: 'What you provide',
    body: `Timely access to content, approvals, domains and any existing accounts. Delays in providing these can move the delivery timeline, and we will always tell you before that happens.`,
  },
  {
    heading: 'Hosting, SSL and maintenance',
    body: `Hosting, SSL certificates, backups and monitoring are included while your subscription is active. If a subscription ends, we will provide a reasonable window to export your content and arrange your own hosting.`,
  },
  {
    heading: 'No guaranteed outcomes',
    body: `We build systems designed to capture and manage opportunities well. We do not guarantee a specific number of leads, a revenue figure, or a return on investment — no honest agency can.`,
  },
  {
    heading: 'Liability',
    body: `Our liability is limited to the fees paid for the services in question. We are not liable for indirect or consequential loss. Nothing here limits your rights under applicable consumer law.`,
  },
];

export default function Legal() {
  const { pathname } = useLocation();
  const isPrivacy = pathname.includes('privacy');
  const sections = isPrivacy ? PRIVACY : TERMS;

  usePageMeta({
    title: isPrivacy ? 'Privacy policy' : 'Terms of service',
    description: isPrivacy
      ? 'How NorthForge collects, uses and protects your information, and how our automations handle business data.'
      : 'NorthForge terms of service: scope, fees, billing cycle, third-party costs and responsibilities.',
    canonicalPath: pathname,
  });

  return (
    <article className="nf-shell-narrow py-16 lg:py-24">
      <span className="nf-eyebrow">{isPrivacy ? 'Privacy' : 'Terms'}</span>
      <h1 className="mt-4 text-display-sm font-semibold text-fg">
        {isPrivacy ? 'Privacy policy' : 'Terms of service'}
      </h1>
      <p className="mt-4 text-[13px] text-faint">Last updated {LAST_UPDATED}</p>

      <div className="mt-12 space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[17px] font-semibold tracking-tight text-fg">{section.heading}</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">{section.body}</p>
          </section>
        ))}

        <section className="rounded-lg border border-line bg-sunken/30 p-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-fg">Contact</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Questions about this page? Write to{' '}
            <a href={`mailto:${CONTACT.email}`} className="font-medium text-brand underline decoration-brand/30 underline-offset-2">
              {CONTACT.email}
            </a>
            .
          </p>
          {PLACEHOLDER_CONTACT ? (
            <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-faint">
              Note: this document template ships with placeholder contact details and should be reviewed by a qualified
              professional before it goes live. {SITE.name} is shown with a placeholder address until the business
              supplies its registered details.
            </p>
          ) : null}
        </section>
      </div>
    </article>
  );
}
