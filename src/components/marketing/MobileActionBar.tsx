import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { CONTACT, whatsappLink } from '@/data/site';

/**
 * Mobile action bar (public site only).
 *
 * On a phone the marketing header collapses to a hamburger, which leaves a
 * visitor with no visible way to reach the studio. For this audience that is
 * the whole point of the visit — many of them are not going to hunt through a
 * menu — so the three actions that matter sit permanently within thumb reach:
 *
 *   WhatsApp (how most enquiries actually arrive) · Call · Get a quote.
 *
 * Safe-area padding keeps it clear of the iPhone home indicator, and it is
 * hidden from `lg` up, where the header already carries these actions.
 */
export function MobileActionBar() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[55] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="region"
      aria-label="Quick contact"
    >
      <div className="border-t border-line bg-[rgb(var(--nf-canvas)/0.94)] px-3 py-2.5 backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-2">
          <a
            href={whatsappLink('Hi NorthForge — I would like to know more.')}
            target="_blank"
            rel="noreferrer noopener"
            className="nf-focus inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-brand text-[12px] font-medium text-white transition-colors hover:bg-brand-deep"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>

          <a
            href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}
            className="nf-focus inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-surface/70 text-[12px] font-medium text-fg transition-colors hover:border-line-strong"
          >
            <Phone className="h-4 w-4 text-brand" aria-hidden />
            Call
          </a>

          <Link
            to="/contact"
            className="nf-focus inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-surface/70 text-[12px] font-medium text-fg transition-colors hover:border-line-strong"
          >
            Get a quote
            <ArrowRight className="h-3.5 w-3.5 text-brand" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
