import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * NorthForge monogram (spec §137).
 *
 * One mark, three densities: the `NF` glyph alone reads at 20px, the full
 * lockup carries the wordmark. Built as inline SVG so it inherits theme
 * colours and never flashes in on load.
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  // The gradient needs an id, and the same page renders several marks (navbar,
  // footer, drawers). A hard-coded id meant duplicate DOM ids and one mark
  // borrowing another's gradient — `useId` makes each instance self-contained.
  const gradientId = `nf-mark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="NorthForge"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--nf-blue))" />
          <stop offset="100%" stopColor="rgb(var(--nf-violet))" />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill="rgb(var(--nf-surface))" stroke={`url(#${gradientId})`} strokeWidth="1.5" />
      <path
        d="M11.5 28.5V11.5L20 21.5V11.5H22V28.5H20L11.5 18.5V28.5Z"
        fill="rgb(var(--nf-fg))"
      />
      <path d="M26 28.5V11.5H30.5V16H28.2V13.7H28.1V28.5Z" fill={`url(#${gradientId})`} />
      <path d="M26 19.6H30.4V21.9H26Z" fill={`url(#${gradientId})`} />
    </svg>
  );
}

export function Logo({
  className,
  markSize = 28,
  showWordmark = true,
  compactOnMobile = false,
}: {
  className?: string;
  markSize?: number;
  showWordmark?: boolean;
  compactOnMobile?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={markSize} />
      {showWordmark ? (
        <span
          className={cn(
            'select-none text-[15px] font-semibold tracking-[-0.02em] text-fg',
            compactOnMobile && 'hidden sm:inline',
          )}
        >
          NORTH<span className="text-brand">FORGE</span>
        </span>
      ) : null}
    </span>
  );
}

/** Small uppercase discipline line used under the wordmark in the footer. */
export function LogoTagline({ className }: { className?: string }) {
  return (
    <span className={cn('font-mono text-2xs uppercase tracking-eyebrow text-faint', className)}>
      Web · Automation · AI · Growth
    </span>
  );
}
