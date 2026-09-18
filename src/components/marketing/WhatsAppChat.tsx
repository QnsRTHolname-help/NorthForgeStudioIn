import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { CONTACT, whatsappLink } from '@/data/site';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';

/**
 * Floating WhatsApp launcher (spec §42–§46).
 *
 * What this is: a click-to-chat handoff. The conversation happens in the
 * visitor's OWN WhatsApp application talking directly to the NorthForge
 * business number — the website is never in the middle of it and nothing is
 * stored here. There is no server-side WhatsApp Business API integration
 * behind this button, and the interface does not pretend otherwise.
 *
 * What this is not: a live chat widget that silently receives messages. If
 * a real WhatsApp Cloud API integration is configured for the admin inbox
 * (supabase/functions/whatsapp-*), that is a separate, operator-only surface.
 *
 * Placement: bottom-right from `lg` up. On phones the persistent mobile
 * action bar already carries a full-width WhatsApp action within thumb
 * reach, so a second floating control there would cover content and
 * duplicate the same link.
 */

interface Context {
  key: string;
  label: string;
  /** Prefilled message — kept short and free of personal information. */
  message: string;
}

const CONTEXTS: Context[] = [
  { key: 'website', label: 'Website', message: 'Hi NorthForge, I need help with my website.' },
  { key: 'automation', label: 'Automation', message: 'Hi NorthForge, I would like to automate a process in my business.' },
  { key: 'ai', label: 'AI', message: 'Hi NorthForge, I am interested in your AI solutions.' },
  { key: 'pricing', label: 'Pricing', message: 'Hi NorthForge, I would like to know more about your pricing.' },
  { key: 'general', label: 'Something else', message: 'Hi NorthForge, I would like to learn more about your services.' },
];

export function WhatsAppChat() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<Context>(CONTEXTS[0]);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Escape closes the panel; clicking anywhere outside it does too.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !launcherRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const choose = (next: Context) => {
    setContext(next);
    // Which topic a visitor picks is useful; who they are is not sent.
    trackEvent('whatsapp_context_selected', { context: next.key });
  };

  const start = () => {
    trackEvent('whatsapp_click', { context: context.key, location: 'floating_launcher' });
    window.open(whatsappLink(context.message), '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] hidden lg:block">
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Chat with NorthForge on WhatsApp"
          className="mb-3 w-[300px] rounded-lg border border-line bg-surface p-4 shadow-panel"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold tracking-tight text-fg">NorthForge</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Hi! How can we help your business?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat options"
              className="nf-focus -mr-1 -mt-1 rounded p-1 text-faint transition-colors hover:text-fg"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {CONTEXTS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => choose(item)}
                aria-pressed={context.key === item.key}
                className={cn(
                  'nf-focus rounded-full border px-2.5 py-1 text-xs transition-colors',
                  context.key === item.key
                    ? 'border-brand bg-brand/[0.08] text-brand'
                    : 'border-line text-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="mt-3 rounded border border-line bg-sunken/40 p-2.5 text-xs leading-relaxed text-muted">
            “{context.message}”
          </p>

          <button
            type="button"
            onClick={start}
            className="nf-focus mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-deep"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Start WhatsApp chat
          </button>

          <p className="mt-2 text-center text-2xs leading-relaxed text-faint">
            Opens WhatsApp with {CONTACT.whatsappDisplay}. Sent from your own WhatsApp account.
          </p>
        </div>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) trackEvent('whatsapp_click', { context: 'launcher_opened', location: 'floating_launcher' });
        }}
        aria-expanded={open}
        aria-label={open ? 'Close WhatsApp chat options' : 'Chat with NorthForge on WhatsApp'}
        className="nf-focus group relative ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-panel transition-transform duration-200 hover:scale-105 hover:bg-brand-deep"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        {/* Tooltip on hover/focus — the label, not a marketing line. */}
        <span
          role="tooltip"
          className="pointer-events-none absolute right-[calc(100%+10px)] whitespace-nowrap rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg opacity-0 shadow-panel transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          Chat on WhatsApp
        </span>
      </button>
    </div>
  );
}
