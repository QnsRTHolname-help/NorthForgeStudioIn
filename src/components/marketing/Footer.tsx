import { Link } from 'react-router-dom';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Logo, LogoTagline } from '@/components/brand/Logo';
import { CONTACT, FOOTER_NAV, emailLink, whatsappLink } from '@/data/site';
import { PLACEHOLDER_CONTACT } from '@/data/site';

/** Public footer (spec §29). */
export function Footer() {
  return (
    <footer className="border-t border-line bg-sunken/40">
      <div className="nf-shell py-14 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <LogoTagline className="mt-3 block" />
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-muted">
              NorthForge builds websites connected to lead capture, WhatsApp, AI, automation and analytics — one system
              that keeps working after launch.
            </p>
          </div>

          {FOOTER_NAV.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="nf-eyebrow">{group.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-[13px] text-muted transition-colors hover:text-fg">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="nf-eyebrow">Get in touch</h2>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href={whatsappLink('Hi NorthForge — I would like to know more.')}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2.5 text-[13px] text-muted transition-colors hover:text-fg"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                  {CONTACT.whatsappDisplay}
                </a>
              </li>
              <li>
                <a href={emailLink()} className="flex items-center gap-2.5 text-[13px] text-muted transition-colors hover:text-fg">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                  {CONTACT.email}
                </a>
              </li>
              <li>
                <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 text-[13px] text-muted transition-colors hover:text-fg">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                  {CONTACT.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-[13px] text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                {CONTACT.addressLine1}, {CONTACT.addressLine2}
              </li>
            </ul>
            {PLACEHOLDER_CONTACT ? (
              <p className="mt-4 text-2xs leading-relaxed text-faint">
                Placeholder contact details — replace them in <code className="font-mono">src/data/site.ts</code>.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-faint">© {new Date().getFullYear()} NorthForge. All rights reserved.</p>
          <p className="font-mono text-2xs uppercase tracking-eyebrow text-faint">
            Built in Mangaluru · Karnataka · India
          </p>
        </div>
      </div>
    </footer>
  );
}
