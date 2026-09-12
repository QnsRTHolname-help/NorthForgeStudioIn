/**
 * Marketing content, separated from presentation.
 * Copy lives here so it can be edited without touching layout.
 */

export const PROOF_ITEMS = [
  'Premium business websites',
  'AI lead qualification',
  'WhatsApp automation',
  'Enquiry → CRM in seconds',
  'Automated follow-ups',
  'Booking & appointment reminders',
  'Analytics you can act on',
  'Custom domains & hosting',
  'Live in weeks, not months',
];
export const PROBLEMS = [
  {
    title: 'MISSED ENQUIRIES',
    body: 'Potential customers reach out while nobody is available. By morning they have already booked with someone else.',
  },
  {
    title: 'SLOW FOLLOW-UP',
    body: 'Leads go cold before anyone responds. Speed decides who wins the customer, and your reply waits on memory.',
  },
  {
    title: 'MANUAL WORK',
    body: 'Your team enters the same information into the website, WhatsApp, CRM and spreadsheet — over and over.',
  },
  {
    title: 'DISCONNECTED SYSTEMS',
    body: 'Website, WhatsApp, CRM and calendar operate separately. Your staff become the integration nobody designed.',
  },
  {
    title: 'NO VISIBILITY',
    body: 'You cannot see what is happening with your leads — where the enquiries come from, or which ones convert.',
  },
  {
    title: 'LOST OPPORTUNITIES',
    body: 'Good enquiries disappear because nobody follows up. The revenue was never missing — it was never captured.',
  },
];
export const PRINCIPLES = [
  {
    key: 'find',
    number: '01',
    title: 'FIND',
    body: 'We find repetitive work and lost opportunities — the enquiries that go cold, the tasks your team types by hand.',
  },
  {
    key: 'connect',
    number: '02',
    title: 'CONNECT',
    body: 'We connect your website, leads, CRM, WhatsApp and tools, so data flows between them instead of through your staff.',
  },
  {
    key: 'automate',
    number: '03',
    title: 'AUTOMATE',
    body: 'We let AI and workflows handle the repetitive actions — responding, qualifying, recording, following up.',
  },
  {
    key: 'grow',
    number: '04',
    title: 'GROW',
    body: 'We use analytics and better systems to move the business forward — measured on outcomes, not activity.',
  },
];
export const PROCESS_STEPS = [
  {
    number: '01',
    title: 'DISCOVER',
    body: 'We map how your business handles an enquiry today — every handoff, delay and spreadsheet — and find where the time and the money leak.',
    detail: ['Process and journey mapping', 'Existing tool audit', 'Opportunity shortlist'],
  },
  {
    number: '02',
    title: 'DESIGN',
    body: 'We design both the website and the workflow: what the customer experiences, what the system does automatically, and where a human steps in.',
    detail: ['Site & brand direction', 'Workflow blueprint', 'Message and tone design'],
  },
  {
    number: '03',
    title: 'BUILD',
    body: 'We build the premium website and configure the systems — integrations, automated replies and the CRM pipeline behind it.',
    detail: ['Website build', 'Integrations', 'CRM pipeline'],
  },
  {
    number: '04',
    title: 'CONNECT',
    body: 'We connect the website to WhatsApp, AI, CRM, booking and analytics so every enquiry moves through one system without being handled by hand.',
    detail: ['WhatsApp automation', 'AI qualification', 'Booking & reminders'],
  },
  {
    number: '05',
    title: 'LAUNCH',
    body: 'We test every path, go live, then hand over a portal where you can see enquiries, workflows, bookings and reports.',
    detail: ['End-to-end testing', 'Go-live', 'Team handover'],
  },
  {
    number: '06',
    title: 'GROW',
    body: 'We monitor every run, fix failures before you notice them, and improve the system monthly based on what the data shows.',
    detail: ['Monitoring', 'Monthly optimisation', 'New workflows'],
  },
];
export const AUTOMATION_FLOW = [
  'Enquiry arrives',
  'Lead captured',
  'AI reads the message',
  'AI qualifies the lead',
  'CRM updated',
  'Owner notified',
  'WhatsApp response',
  'Automated follow-up',
  'Appointment booked',
  'Analytics updated',
];
export const WHY_POINTS = [
  {
    title: 'NOT JUST A WEBSITE.',
    emphasis: 'A website connected to your business.',
    body: 'Designed premium, then wired to lead capture, WhatsApp, AI and analytics so it works long after launch.',
  },
  {
    title: 'NOT JUST LEADS.',
    emphasis: 'A system that captures and manages them.',
    body: 'Every enquiry captured, scored, owned and followed up — visible in one pipeline with a next action.',
  },
  {
    title: 'NOT JUST AI.',
    emphasis: 'AI connected to useful actions.',
    body: 'It qualifies, records, books and escalates — then hands the conversation to a human with full context.',
  },
  {
    title: 'NOT JUST AUTOMATION.',
    emphasis: 'Automation designed around your business.',
    body: 'Built on the tools you already use and measured on the outcome, not the activity.',
  },
];
export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    question: 'What exactly will you automate in my business?',
    answer:
      'We start with the journey from enquiry to paying customer and look for work that is repetitive, slow, error-prone or dependent on one person. Typical first automations: instant enquiry acknowledgement, AI qualification, lead capture into a CRM or database, owner notification, follow-up sequences, appointment booking and reminders, and monthly reporting. Everything is agreed with you before it is built.',
  },
  {
    question: 'Do I need a new website?',
    answer:
      'No. In most cases we connect the automation to the website you already have. Website work is an optional add-on, and we only recommend rebuilding when the existing site is genuinely the thing holding the automation back.',
  },
  {
    question: 'Can this work with my existing website, WhatsApp, CRM or spreadsheet?',
    answer:
      'Yes — that is the default approach. We work with your existing website, WhatsApp Business, CRM, Google Sheets, calendar and email wherever a reliable integration exists. If something cannot be connected cleanly, we say so during discovery rather than after you have paid.',
  },
  {
    question: 'What happens after a customer sends an enquiry?',
    answer:
      'The enquiry is captured from whichever channel it arrived on, the AI reads and qualifies it, the lead is saved to your CRM or database with source and score, the right person is notified, and the follow-up or booking workflow starts automatically. You can watch every step in your portal.',
  },
  {
    question: 'Can the AI hand a conversation over to a human?',
    answer:
      'Yes, and it is designed to. The assistant handles routine questions and escalates whenever a question is high value, sensitive, unclear or explicitly asks for a person. The human receives the full conversation history, so the customer never repeats themselves.',
  },
  {
    question: 'Will the system book appointments and send reminders?',
    answer:
      'Yes on the CONVERT and AUTOPILOT plans. The system checks availability, books the appointment, sends a confirmation, and follows up with reminders before the appointment to reduce no-shows.',
  },
  {
    question: 'How do you protect my customer data and business information?',
    answer:
      'Access is granted on a minimum-permission basis, credentials are stored encrypted and only on the server, and client data is scoped so one business can never read another’s records. We never expose secrets to the browser, and we keep backups of the workflow configurations we build.',
  },
  {
    question: 'What is included in the setup fee?',
    answer:
      'The one-time setup fee covers discovery, process and workflow mapping, configuration, integrations, testing, deployment and team handover. You know the amount before work starts — LEAD ₹15,000, CONVERT ₹30,000, AUTOPILOT ₹60,000, and custom-quoted work is agreed in writing after discovery.',
  },
  {
    question: 'What is included in the monthly subscription?',
    answer:
      'The monthly fee covers monitoring of every workflow, maintenance, support, reporting, and the level of ongoing optimisation included in your plan: basic monitoring and small changes on LEAD, included optimisation on CONVERT, and continuous priority optimisation plus new workflow development within agreed scope on AUTOPILOT.',
  },
  {
    question: 'Are WhatsApp, hosting, messaging, domain or AI usage fees included?',
    answer:
      'No. Third-party costs such as WhatsApp and messaging charges, AI model usage beyond your plan allowance, domains, hosting and phone numbers are billed by those providers. We are free and open-source first, introduce paid services only when necessary, and pass those costs through at cost rather than marking them up.',
  },
  {
    question: 'How many workflows and integrations are included?',
    answer:
      'LEAD includes up to 2 active workflows and 1 integration. CONVERT includes up to 5 workflows and 3 integrations. AUTOPILOT includes 10 or more workflows and 5 or more integrations, subject to what discovery shows and what your infrastructure can reliably support. Limits can be revised as your needs and costs change.',
  },
  {
    question: 'How long does implementation take?',
    answer:
      'Most LEAD and CONVERT systems are live within two to four weeks of discovery being signed off. AUTOPILOT and custom work are scheduled individually, and you receive a written timeline before any payment.',
  },
  {
    question: 'Can the workflow be changed as my business grows?',
    answer:
      'Yes. Workflows are built to be edited. Your plan includes a defined amount of optimisation each month, and larger changes are scoped and quoted separately so there are never surprise invoices.',
  },
  {
    question: 'What support and maintenance do I receive?',
    answer:
      'Every plan includes monitoring, failure handling, maintenance and a real support channel with tracked requests. LEAD and CONVERT receive standard support; AUTOPILOT receives priority support with faster response targets.',
  },
  {
    question: 'Can I cancel the monthly subscription?',
    answer:
      'Yes. The subscription can be cancelled at any time and applies from your next billing cycle. The setup fee is one-time and non-recurring, and we hand over or export your data and configurations on request.',
  },
  {
    question: 'How will we measure whether the automation is saving time or generating more revenue?',
    answer:
      'Before build, we agree the baseline: current response times, enquiry volumes, conversion rates and hours spent on manual work. After go-live you receive a plain-language monthly report showing response times, conversions, time saved and revenue influenced, compared against that baseline.',
  },
];
