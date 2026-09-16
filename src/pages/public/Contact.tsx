import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Input, Textarea, Select, Field, FormError } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/Card';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useMutation } from '@/hooks/useAsync';
import { useToast } from '@/app/providers/ToastProvider';
import { contactService } from '@/services';
import { CONTACT, emailLink, whatsappLink } from '@/data/site';
import { PLANS, planAmountLabel, planSetupLabel } from '@shared/catalog';

const BUSINESS_TYPES = [
  'Healthcare & clinic',
  'Retail & eCommerce',
  'Real estate & construction',
  'Hospitality & food',
  'Education & training',
  'Professional services',
  'Logistics & transport',
  'Manufacturing',
  'Other',
];

const ENQUIRY_VOLUMES = ['Under 10', '10 – 50', '50 – 150', '150 – 500', 'More than 500'];

interface FormState {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  businessType: string;
  plan: string;
  currentTools: string;
  slowestProcess: string;
  monthlyEnquiries: string;
  message: string;
  website: string; // honeypot
}

const EMPTY: FormState = {
  name: '',
  businessName: '',
  email: '',
  phone: '',
  businessType: '',
  plan: '',
  currentTools: '',
  slowestProcess: '',
  monthlyEnquiries: '',
  message: '',
  website: '',
};

/** Client-side validation for instant feedback; the API validates again. */
function validate(values: FormState) {
  const errors: Record<string, string> = {};
  if (values.name.trim().length < 2) errors.name = 'Enter your name.';
  if (values.businessName.trim().length < 2) errors.businessName = 'Enter your business name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.phone.replace(/\D/g, '').length < 8) errors.phone = 'Enter a reachable phone or WhatsApp number.';
  if (!values.businessType) errors.businessType = 'Select a business type.';
  return errors;
}

export default function Contact() {
  usePageMeta({
    title: 'Contact — automation audit',
    description:
      'Tell NorthForge about your business and we will point out where automation, AI and a better website would save you the most time.',
    canonicalPath: '/contact',
  });

  const [searchParams] = useSearchParams();
  const selectedPlan = PLANS.find((plan) => plan.slug === searchParams.get('plan')) ?? null;
  const [values, setValues] = useState<FormState>(() =>
    // Arriving from /pricing?plan=<slug> pre-fills the plan selector, so a
    // choice made on the pricing page is never lost in the form.
    selectedPlan ? { ...EMPTY, plan: selectedPlan.name } : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const toast = useToast();

  const mutation = useMutation(
    async (payload: FormState) => {
      const result = await contactService.submit({
        name: payload.name,
        businessName: payload.businessName,
        email: payload.email,
        phone: payload.phone,
        businessType: payload.businessType,
        plan: payload.plan || undefined,
        currentTools: payload.currentTools,
        slowestProcess: payload.slowestProcess,
        monthlyEnquiries: payload.monthlyEnquiries,
        message: payload.message,
        website: payload.website,
      });
      return result;
    },
    {
      onSuccess: (result) => {
        setSubmitted(true);
        setReference(result.reference);
        setValues(EMPTY);
        toast.success('Enquiry sent', 'We will reply within one business day.');
      },
    },
  );

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await mutation.mutate(values);
    } catch (error) {
      // Field-level errors from the server take priority when present.
      const fields = (error as { fields?: Record<string, string> }).fields;
      if (fields) setErrors(fields);
    }
  };

  if (submitted) {
    return (
      <section className="nf-shell py-24">
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <h1 className="text-headline font-semibold text-fg">Enquiry received.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Thanks — your details are with the NorthForge team. We read every enquiry personally and reply within one
            business day with specific opportunities for your business.
          </p>
          {reference ? (
            <p className="mt-3 font-mono text-2xs uppercase tracking-wider text-faint">Reference {reference}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              variant="secondary"
              iconLeft={<MessageCircle className="h-4 w-4" />}
              onClick={() => window.open(whatsappLink(`Hi NorthForge — my enquiry reference is ${reference}.`), '_blank', 'noopener')}
            >
              Continue on WhatsApp
            </Button>
            <Button variant="ghost" onClick={() => { setSubmitted(false); setReference(null); }}>
              Send another enquiry
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-line py-16 lg:py-24">
        <div className="nf-shell">
          <SectionHeader
            eyebrow="Contact"
            title={selectedPlan ? `Let's get you on ${selectedPlan.name}.` : 'Find out where your business is losing time.'}
            description={
              selectedPlan
                ? `${selectedPlan.outcome} Answer a few questions about your business and we will confirm the fit, timeline and setup fee for the ${selectedPlan.name} plan.`
                : 'Answer a few questions about how your business handles enquiries today. We come back with the specific automation opportunities we would build for you.'
            }
          />
        </div>
      </section>

      <section className="nf-shell py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:gap-16">
          {/* Form */}
          <Card padded={false} className="p-6 sm:p-8">
            {selectedPlan ? (
              <div className="mb-6 rounded-lg border border-brand/40 bg-brand/[0.06] p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-semibold tracking-tight text-fg">
                    You chose the {selectedPlan.name} plan
                  </p>
                  <p className="nf-num text-[13px] font-medium text-brand">
                    {planAmountLabel(selectedPlan)}
                    {!selectedPlan.amount ? null : <span className="text-muted">/ month</span>}
                    {' · '}
                    {planSetupLabel(selectedPlan)}
                  </p>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">{selectedPlan.outcome}</p>
                <ul className="mt-4 grid gap-2 border-t border-brand/20 pt-4 sm:grid-cols-2">
                  {selectedPlan.features.slice(0, 8).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px] text-fg">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                      <span className="leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pricing"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
                >
                  See full pricing details
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            ) : null}
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Your name" required value={values.name} onChange={set('name')} error={errors.name} autoComplete="name" />
                <Input
                  label="Business name"
                  required
                  value={values.businessName}
                  onChange={set('businessName')}
                  error={errors.businessName}
                  autoComplete="organization"
                />
                <Input
                  label="Email"
                  type="email"
                  required
                  value={values.email}
                  onChange={set('email')}
                  error={errors.email}
                  autoComplete="email"
                />
                <Input
                  label="WhatsApp / phone"
                  required
                  value={values.phone}
                  onChange={set('phone')}
                  error={errors.phone}
                  hint="We reply fastest on WhatsApp."
                  autoComplete="tel"
                />
                <Select
                  label="Business type"
                  required
                  placeholder="Select…"
                  value={values.businessType}
                  onChange={set('businessType')}
                  error={errors.businessType}
                  options={BUSINESS_TYPES.map((type) => ({ value: type, label: type }))}
                />
                <Select
                  label="Plan you're interested in"
                  placeholder="Not sure yet…"
                  value={values.plan}
                  onChange={set('plan')}
                  options={[
                    ...PLANS.map((plan) => ({
                      value: plan.name,
                      label: `${plan.name} — ${plan.amount !== null ? `${planAmountLabel(plan)}/mo` : 'custom quote'}`,
                    })),
                    { value: '', label: 'Not sure yet' },
                  ]}
                />
                <Select
                  label="Approximate monthly enquiries"
                  placeholder="Select…"
                  value={values.monthlyEnquiries}
                  onChange={set('monthlyEnquiries')}
                  options={ENQUIRY_VOLUMES.map((volume) => ({ value: volume, label: volume }))}
                />
              </div>

              <Input
                label="Tools you use today"
                value={values.currentTools}
                onChange={set('currentTools')}
                hint="Website, WhatsApp, spreadsheets, CRM, accounting — anything."
                placeholder="e.g. WhatsApp Business, Excel, Gmail"
              />

              <Textarea
                label="What process takes the most time?"
                value={values.slowestProcess}
                onChange={set('slowestProcess')}
                hint="The honest answer is the most useful one."
                rows={3}
                placeholder="e.g. copying enquiry details into a register and chasing people who never reply"
              />

              <Textarea
                label="Anything else?"
                value={values.message}
                onChange={set('message')}
                rows={3}
                placeholder="Goals, deadlines, current website, anything we should know."
              />

              {/* Honeypot: hidden from people, irresistible to bots. */}
              <div className="hidden" aria-hidden>
                <Field label="Website">
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.website}
                    onChange={set('website')}
                  />
                </Field>
              </div>

              <FormError message={mutation.error} />

              <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
                <Button type="submit" size="lg" loading={mutation.pending} arrow>
                  Find my automation opportunities
                </Button>
                <p className="text-xs text-faint">We reply within one business day. No sales sequence.</p>
              </div>
            </form>
          </Card>

          {/* Contact details */}
          <aside className="space-y-4">
            <Card>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg">Reach us directly</h2>
              <ul className="mt-4 space-y-3.5">
                <li>
                  <a
                    href={whatsappLink('Hi NorthForge — I would like to know more.')}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-3 text-[13px] text-muted transition-colors hover:text-fg"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {CONTACT.whatsappDisplay}
                  </a>
                </li>
                <li>
                  <a href={emailLink('Enquiry from the NorthForge website')} className="flex items-center gap-3 text-[13px] text-muted transition-colors hover:text-fg">
                    <Mail className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {CONTACT.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 text-[13px] text-muted transition-colors hover:text-fg">
                    <Phone className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {CONTACT.phone}
                  </a>
                </li>
                <li className="flex items-center gap-3 text-[13px] text-muted">
                  <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  {CONTACT.addressLine1}, {CONTACT.addressLine2}
                </li>
                <li className="flex items-center gap-3 text-[13px] text-muted">
                  <Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  {CONTACT.hours}
                </li>
              </ul>
            </Card>

            <Card>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-fg">What happens next</h2>
              <ol className="mt-4 space-y-3">
                {[
                  'We read your answers and look at your current setup.',
                  'We reply with the two or three automations that would save you the most time.',
                  'If it makes sense, we scope the build and give you a written timeline and price.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-3 text-[13px] leading-relaxed text-muted">
                    <span className="nf-num shrink-0 text-xs font-medium text-brand">{String(index + 1).padStart(2, '0')}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Card>
          </aside>
        </div>
      </section>
    </>
  );
}
