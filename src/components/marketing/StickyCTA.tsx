import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { LinkButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useIsTouch } from '@/hooks';
import { whatsappLink } from '@/data/site';

/**
 * Persistent bottom bar that appears once the visitor has scrolled past the
 * hero and is clearly in "should I enquire?" territory.
 *
 * It is not a popup — it waits for intent, then stays. The label names the
 * thing the page has been promising, and the WhatsApp route is the lower-
 * friction option for someone who is still deciding.
 *
 * On touch devices it renders inline (no fixed positioning, which fights
 * the browser's address bar) and is hidden until the visitor scrolls.
 */
export function StickyCTA() {
  const touch = useIsTouch();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > window.innerHeight * 0.5);
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const visible = scrolled;

  // Touch: a wide in-flow bar that sits below the fold naturally.
  if (touch) {
    return (
      <div
        data-sticky-cta
        className={cn(
          'nf-glass-card nf-glass-elevated nf-gpu sticky bottom-0 z-50 flex items-center justify-between gap-4 rounded-t-2xl border border-white/60 px-5 py-3.5 shadow-lg backdrop-blur-2xl sm:px-6',
          !visible && 'hidden',
        )}
        aria-hidden={!visible}
      >
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">
            Start with the plan that fits today.
          </p>
          <p className="truncate text-2xs text-faint">No obligation. Reply within one business day.</p>
        </div>
        <LinkButton to="/contact" size="sm" arrow className="shrink-0">
          Enquire
        </LinkButton>
      </div>
    );
  }

  // Desktop: a floating pill, centred, lifted off the viewport floor.
  // Rendered only once the visitor is past the hero — it is not a popup.
  if (!visible) return null;

  return (
    <div
      data-sticky-cta
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 nf-gpu pointer-events-none"
      aria-hidden={false}
    >
      <div className="nf-glass-card nf-glass-elevated pointer-events-auto flex items-center gap-3 rounded-full border border-white/60 px-5 py-2.5 shadow-lg backdrop-blur-2xl">
        <div className="hidden sm:flex sm:flex-col">
          <span className="text-[13px] font-semibold leading-none text-fg">
            Still deciding?
          </span>
          <span className="mt-0.5 text-2xs text-faint">Get a free automation review.</span>
        </div>
        <LinkButton to="/contact" size="sm" arrow className="nf-glass-glow">
          Start a project
        </LinkButton>
        <a
          href={whatsappLink('Hi NorthForge — I would like to know more.')}
          target="_blank"
          rel="noopener noreferrer"
          className="nf-glass-interactive hidden h-9 items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3.5 text-[13px] font-medium text-fg shadow-2xs backdrop-blur-md transition-all hover:border-brand/40 hover:bg-white sm:inline-flex"
        >
          <MessageCircle className="h-3.5 w-3.5 text-success" aria-hidden />
          WhatsApp
        </a>
      </div>
    </div>
  );
}