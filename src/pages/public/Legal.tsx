import { Link, useLocation } from 'react-router-dom';
import { CONTACT, SITE } from '@/data/site';
import { usePageMeta } from '@/hooks/usePageMeta';

/**
 * Privacy policy and terms of service (spec §14–§23, §52).
 *
 * Two rules govern the content below:
 *
 *   1. It describes the application that actually exists. Every processor
 *      named here is one this codebase really talks to — nothing is listed
 *      "just in case", and nothing claims a certification or a data-residency
 *      guarantee we have not verified (spec §16, §62).
 *   2. It does not promise outcomes the system cannot deliver — not instant
 *      deletion, not a verified Google listing, not a live WhatsApp Business
 *      API where only a click-to-chat link exists.
 *
 * When the document materially changes, bump POLICY_VERSION and LAST_UPDATED
 * so the date shown to users is never a guess (spec §52).
 */

export const POLICY_VERSION = '1.0';
export const LAST_UPDATED = '18 September 2026';

interface Section {
  heading: string;
  body: string[];
}

const PRIVACY_SUMMARY: string[] = [
  `This policy explains what ${SITE.name} collects through our website and client portal, why we collect it, who processes it on our behalf, how long we keep it, and what you can ask us to do with it.`,
  'It is written to describe what our systems actually do. Where a capability is optional or not switched on for this deployment, we say so rather than describing it as if it were active.',
];

const PRIVACY_SECTIONS: Section[] = [
  {
    heading: 'Information we collect',
    body: [
      'Information you give us. When you send an enquiry or create an account: your name, business name, email address, phone or WhatsApp number, business type, the plan you are interested in, and whatever you type into the message fields.',
      'Account and authentication information. Your email address, your password (stored only as a one-way hash by our authentication provider — we never see it), when your email was confirmed, when you last signed in, and whether you have chosen to add two-factor authentication.',
      'Age confirmation. When you create an account you confirm you meet the minimum age requirement. We store only the result of that confirmation (that it was given, and when). We do not ask for or store your date of birth, and we never ask for a passport, national identity card or driving licence just to check age.',
      'Business records you create or receive. Leads and enquiries captured for your business, projects and milestones, client requests and support conversations, bookings, files you upload, website analytics belonging to your own site, and — where you use the WhatsApp inbox — the messages exchanged with your customers.',
      'Billing information. Your plan, its status, invoices issued to you, payments recorded against them, and any cancellation you request with the reason you choose to give. We do not store card or bank numbers: payments are arranged outside this system.',
      'Website usage and technical information. Which pages are visited, how you arrived, approximate location derived from your IP address, browser and device type, and error and performance information. Optional measurement cookies are used for this only with your consent.',
    ],
  },
  {
    heading: 'Why we use it',
    body: [
      'To create and secure your account, sign you in, verify your email, and protect the service against abuse.',
      'To provide the services you have engaged us for — building, hosting, maintaining and improving your website, automations and integrations.',
      'To operate the client portal: showing you your projects, leads, requests, files, invoices and analytics.',
      'To answer your enquiries and provide support, including over WhatsApp or email if that is how you contacted us.',
      'To bill you correctly, issue invoices, record payments and manage cancellation of a plan.',
      'To keep the system secure and available, including audit logs of sensitive actions such as a subscription being cancelled or an account being closed.',
      'To understand which pages of our public website are useful, so we can improve them — analytics only, and only with your consent.',
      'To meet legal, tax and accounting obligations.',
      'We do not sell your information. We do not use your business data, your customer conversations or your uploaded files to train third-party AI models.',
    ],
  },
  {
    heading: "Where your information goes",
    body: [
      'We use a small number of infrastructure providers. Each receives only what it needs to perform its function, and each is listed below with the specific information involved. If a provider is not switched on for this deployment, it does no processing — the Google Analytics entry, for example, only applies once a measurement ID is configured and you have consented.',
      'We do not claim a specific data-residency region for any provider unless it has been verified for the project. If your organisation requires a particular region or a signed data-processing agreement, contact us and we will confirm the current position in writing rather than guess.',
    ],
  },
  {
    heading: 'Retention',
    body: [
      'Account and business records: kept while your account is active and for a reasonable period afterwards so we can answer questions about the work.',
      'Invoices, payment records and cancellation records: kept for as long as tax and accounting law requires, even after an account is closed. These are retained as financial records and are not deleted on request.',
      'Leads, messages and support conversations belonging to your business: deleted with your account, unless a specific record is needed to resolve a dispute or is required by law.',
      'Backups: our infrastructure provider takes periodic backups. When something is deleted from the live system it can persist in a backup until that backup expires and is rotated out. We therefore do not claim that deletion is instantaneous everywhere — the live system removes it immediately, and backups clear on their own schedule.',
      'When you close your account we delete what is eligible for deletion, and record that the deletion happened so the action can be accounted for.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'Authentication is handled by a dedicated provider; passwords are hashed and never stored in readable form.',
      'Every record is protected by database-level access rules, so a signed-in client can only reach their own business data. These rules are enforced by the database, not by the browser, so they hold even if the interface is tampered with.',
      'Administrative access is restricted to named operator accounts, requires a verified second factor for sensitive actions, and is logged.',
      'Traffic to and from the site is encrypted in transit.',
      'Two-factor authentication using an authenticator app is available to every account, and we recommend it.',
      'No system is perfectly secure. We describe controls that are actually in place rather than making absolute guarantees, and we keep the detail of our internal configuration private so it cannot be used to find a way around it.',
    ],
  },
  {
    heading: 'Cookies and similar technologies',
    body: [
      'Strictly necessary storage. A browser session is used to keep you signed in, and a local preference is used to remember whether you prefer the light or dark theme and, once you have chosen, your analytics consent. These are required for the service you asked for and cannot be switched off while you use it.',
      'Optional analytics. If a Google Analytics 4 measurement ID is configured, analytics is loaded only after you choose “Allow analytics”. With no choice, or after “Essential only”, no analytics script is requested at all. You can change this at any time in the portal under Settings → Privacy & data.',
      'No advertising. We do not run advertising pixels, we do not sell data to advertisers, and we do not enable Google signals or ad-personalisation features in our analytics configuration.',
      'Search Console. Google Search Console is a search-performance and technical monitoring tool for the website owner. It is not a visitor tracking script and is not loaded for visitors.',
    ],
  },
  {
    heading: 'Your choices and rights',
    body: [
      'Depending on where you live, you may have the right to ask for a copy of your information, to have inaccurate information corrected, to have information deleted, to withdraw consent you previously gave, and to object to certain processing. We will not treat you differently for asking.',
      'You can exercise several of these yourself, without contacting us:',
      '• Download my data — Settings → Privacy & data produces a JSON copy of what your account is entitled to read.',
      '• Marketing opt-out — Settings → Notifications lets you switch off announcements and marketing. This is separate from cancelling a plan and separate from closing your account.',
      '• Cancel plan — the subscription page stops future renewal while keeping your account and history.',
      '• Close account — Settings → Danger zone closes the account and starts the deletion process described under Retention above.',
      'For anything else, write to us at the address below and we will respond within 30 days. We may need to verify that you are the account holder before acting.',
      'If you have a concern we have not resolved, you may have the right to complain to your local data protection authority.',
    ],
  },
  {
    heading: 'Age requirement',
    body: [
      'Our services are provided to businesses and are intended for adults. We ask you to confirm you are 18 or older when you create an account, and record only that you confirmed it and when.',
      'If we learn that an account belongs to someone below that age, we will close the account and delete the associated data. If you believe a minor has created an account, please contact us.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'When we change how we handle information we update this page and change the version and the date shown at the top. Continued use of the service after a material change means you have had the opportunity to read the updated policy.',
    ],
  },
  {
    heading: 'Automation and AI',
    body: [
      'Where an automation is configured for your account, it processes your own enquiry and business data to route, score and follow up on it. Automations are scoped to the account they belong to, and anything that creates, changes, sends or deletes a record is logged.',
      'Where an AI feature is enabled, it operates on the data needed for that task. We do not send your data to a provider that trains its models on it without telling you, and you may ask us to disable an automation at any time.',
    ],
  },
];

/** The provider table is data, so the copy and the table cannot drift apart. */
const PROCESSORS: { provider: string; purpose: string; information: string }[] = [
  {
    provider: 'Supabase',
    purpose: 'Authentication, database and file storage',
    information: 'Account, business and application data; uploaded files',
  },
  {
    provider: 'Vercel',
    purpose: 'Application hosting and deployment',
    information: 'Technical request information such as IP address and user agent',
  },
  {
    provider: 'Google Fonts',
    purpose: 'Serving the website typefaces',
    information: 'IP address and user agent, sent when your browser fetches the font files',
  },
  {
    provider: 'Google Analytics 4',
    purpose: 'Public website analytics — only when configured, and only with your consent',
    information: 'Page views and interaction events on the public website',
  },
  {
    provider: 'Google Search Console',
    purpose: 'Search performance and technical indexing checks for the site owner',
    information: 'Search and indexing information about the website, not visitor tracking',
  },
  {
    provider: 'Meta / WhatsApp',
    purpose: 'WhatsApp communication. A click-to-chat link opens a conversation in your own WhatsApp application',
    information: 'The message you choose to send us and your WhatsApp number, handled by WhatsApp under its own terms',
  },
  {
    provider: 'api.qrserver.com',
    purpose: 'Rendering the QR image used during two-factor authentication setup',
    information: 'The one-time enrolment string for your authenticator, used only to draw the QR image. You may instead enter the key manually to avoid this request',
  },
];

const TERMS: Section[] = [
  {
    heading: 'Scope of work',
    body: [
      'Each engagement is defined by a written scope agreed before work starts. Anything outside that scope is quoted separately and approved by you first.',
      'Work is scheduled against the agreed timeline. Access, content and approvals that arrive late move the timeline with them, and we will tell you when that happens rather than leaving you to notice.',
    ],
  },
  {
    heading: 'Fees, billing and cancellation',
    body: [
      'Subscriptions are billed monthly in advance. A one-time setup fee, where your plan includes one, is invoiced once before the first cycle, and any custom development is invoiced separately.',
      'Third-party costs — domain registration, WhatsApp Cloud API usage and AI usage above your plan allowance — are passed through at cost and shown as their own line items.',
      'You can request a plan change at any time from the client portal. Changes are applied from the next billing cycle and confirmed with you first. You can also cancel your plan yourself from the portal: cancellation stops the next renewal, your access continues to the end of the period you have already paid for, and the effective date is shown on screen before and after you confirm.',
      'Cancelling a plan does not close your account and does not cancel an invoice that has already been issued. An unpaid invoice remains payable; a paid invoice remains a financial record. Closing your account is a separate action described in the privacy policy.',
      'Invoices are payable within the terms stated on the invoice. If a subscription payment fails or remains outstanding, the subscription may be marked past due and the associated service may be suspended after we contact you about it.',
    ],
  },
  {
    heading: 'What you provide',
    body: [
      'Timely access to content, approvals, domains and any existing accounts needed for the work. You confirm that you have the right to use the content, trademarks and data you give us.',
      'You are responsible for the accuracy of the information on your website and for the legality of how you contact your own customers through any channel we set up for you — including WhatsApp. Your customers’ data belongs to you; we process it on your instruction.',
    ],
  },
  {
    heading: 'Hosting, SSL and maintenance',
    body: [
      'Hosting, SSL certificates, backups and monitoring are included while your subscription is active. If a subscription ends, we will provide a reasonable window to export your content and arrange your own hosting, and we will tell you what will stop working and when.',
    ],
  },
  {
    heading: 'No guaranteed outcomes',
    body: [
      'We build systems designed to capture and manage opportunities well. We do not guarantee a specific number of leads, a revenue figure, or a return on investment — no honest agency can, and any figure you see elsewhere should be treated with suspicion.',
    ],
  },
  {
    heading: 'Availability and changes',
    body: [
      'We aim to keep the service available and to give notice of planned maintenance. Third-party providers can have outages we do not control; where an outage affects you we will say what happened rather than describing it as routine.',
      'We may improve or change features. Where a change materially reduces what you are paying for, we will tell you before it takes effect and you may cancel without penalty.',
    ],
  },
  {
    heading: 'Liability',
    body: [
      'To the extent permitted by law, our liability is limited to the fees paid for the services in question. We are not liable for indirect or consequential loss, including lost profit or lost data where you have not kept your own copy of content we have advised you to keep.',
      'Nothing in these terms limits your rights under applicable consumer law, or limits liability that cannot lawfully be limited.',
    ],
  },
  {
    heading: 'Governing terms',
    body: [
      `These terms are governed by the laws of India, and the courts at ${CONTACT.city} have jurisdiction, unless a mandatory consumer protection rule in your place of residence gives you a different right.`,
      'If any provision is found unenforceable, the rest continues to apply.',
    ],
  },
];

export default function Legal() {
  const { pathname } = useLocation();
  const isPrivacy = pathname.includes('privacy');
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS;

  usePageMeta({
    title: isPrivacy ? 'Privacy policy' : 'Terms of service',
    description: isPrivacy
      ? 'What NorthForge collects, why, which providers process it, how long we keep it and the choices you have over your data.'
      : 'NorthForge terms of service: scope of work, fees and billing, plan cancellation, availability and liability.',
    canonicalPath: pathname,
  });

  return (
    <article className="nf-shell-narrow py-16 lg:py-24">
      <span className="nf-eyebrow">{isPrivacy ? 'Privacy' : 'Terms'}</span>
      <h1 className="mt-4 text-display-sm font-semibold text-fg">
        {isPrivacy ? 'Privacy policy' : 'Terms of service'}
      </h1>
      <p className="mt-4 text-[13px] text-faint">
        Version {POLICY_VERSION} · Last updated {LAST_UPDATED}
      </p>

      <div className="mt-12 space-y-10">
        {isPrivacy ? (
          <section className="rounded-lg border border-line bg-sunken/30 p-6">
            {PRIVACY_SUMMARY.map((paragraph) => (
              <p key={paragraph} className="text-[14px] leading-relaxed text-muted first:mt-0 [&:not(:first-child)]:mt-3">
                {paragraph}
              </p>
            ))}
          </section>
        ) : null}

        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[17px] font-semibold tracking-tight text-fg">{section.heading}</h2>
            <div className="mt-3 space-y-3">
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="text-[14px] leading-relaxed text-muted">
                  {paragraph}
                </p>
              ))}
            </div>

            {section.heading === 'Where your information goes' ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <caption className="sr-only">
                    Providers used by NorthForge, their purpose, and the information involved
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="py-2 pr-4 font-semibold text-fg">
                        Provider
                      </th>
                      <th scope="col" className="py-2 pr-4 font-semibold text-fg">
                        Purpose
                      </th>
                      <th scope="col" className="py-2 font-semibold text-fg">
                        Information involved
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROCESSORS.map((row) => (
                      <tr key={row.provider} className="border-b border-line/70 align-top">
                        <th scope="row" className="py-2.5 pr-4 font-medium text-fg">
                          {row.provider}
                        </th>
                        <td className="py-2.5 pr-4 text-muted">{row.purpose}</td>
                        <td className="py-2.5 text-muted">{row.information}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ))}

        <section className="rounded-lg border border-line bg-sunken/30 p-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-fg">Contact</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Questions about this page, or a request about your information? Write to{' '}
            <a
              href={`mailto:${CONTACT.email}`}
              className="font-medium text-brand underline decoration-brand/30 underline-offset-2"
            >
              {CONTACT.email}
            </a>{' '}
            or message us on WhatsApp at {CONTACT.whatsappDisplay}. {SITE.legalName} operates from{' '}
            {CONTACT.city}, {CONTACT.state}, {CONTACT.country}.
          </p>
          <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-faint">
            You can manage your own data from the portal at any time — download a copy, change your marketing
            preference, cancel a plan or close your account.{' '}
            <Link to="/portal/settings" className="text-brand hover:underline">
              Open account settings
            </Link>
            . This page describes our actual practices and is not a substitute for legal advice; if you need a
            contract for a specific compliance regime, contact us.
          </p>
        </section>
      </div>
    </article>
  );
}
