import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded font-medium tracking-tight transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-forge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-45';

const VARIANTS: Record<Variant, string> = {
  // Brand blue with a violet sheen — used sparingly, one per view.
  primary:
    'bg-brand text-white shadow-[0_1px_0_0_rgb(255_255_255/0.18)_inset,0_8px_24px_-12px_rgb(var(--nf-blue)/0.8)] hover:bg-[rgb(var(--nf-blue)/0.88)] hover:shadow-[0_1px_0_0_rgb(255_255_255/0.22)_inset,0_12px_28px_-12px_rgb(var(--nf-blue)/0.9)] active:translate-y-px',
  secondary: 'border border-line-strong bg-elevated text-fg hover:border-brand/40 hover:bg-surface',
  outline: 'border border-line bg-transparent text-fg hover:border-fg/30 hover:bg-surface',
  ghost: 'bg-transparent text-muted hover:bg-sunken hover:text-fg',
  subtle: 'bg-sunken text-fg hover:bg-elevated',
  danger: 'bg-danger text-white hover:bg-[rgb(var(--nf-danger)/0.88)] active:translate-y-px',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Animated trailing arrow for calls to action. */
  arrow?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
  className?: string;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, CommonProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, iconLeft, iconRight, arrow, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      // `arrow` animates on group-hover, so the button has to be the group.
      // Without it the arrow's hover transition was dead code.
      className={cn(BASE, VARIANTS[variant], SIZES[size], arrow && 'group', fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : iconLeft}
      {children ? <span className="truncate">{children}</span> : null}
      {arrow ? (
        <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-forge group-hover:translate-x-0.5" aria-hidden />
      ) : (
        iconRight
      )}
    </button>
  );
});

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  arrow,
  iconLeft,
  fullWidth,
  className,
  children,
  external,
  onClick,
  ...props
}: Omit<CommonProps, 'loading' | 'iconRight'> & {
  to: string;
  external?: boolean;
  /**
   * Fired on activation. Used for analytics on navigation links — a link
   * that leaves the page cannot be measured afterwards.
   */
  onClick?: () => void;
}) {
  // `fullWidth` has to be destructured even though it only feeds a class:
  // left inside `...props` it was spread onto <Link>, reached the DOM as an
  // unknown attribute (React logged it on every page that used it), and the
  // two call sites asking for a full-width CTA silently never got one.
  // `loading`/`iconRight` are omitted above because a navigation link has no
  // busy state to show — putting a spinner inside one would leak the prop the
  // same way.
  const classes = cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    arrow && 'group',
    fullWidth && 'w-full',
    className,
  );

  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" onClick={onClick} className={classes}>
        {iconLeft}
        <span>{children}</span>
        {arrow ? (
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 ease-forge group-hover:translate-x-0.5"
            aria-hidden
          />
        ) : null}
      </a>
    );
  }

  return (
    <Link to={to} className={classes} onClick={onClick} {...props}>
      {iconLeft}
      <span>{children}</span>
      {arrow ? (
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 ease-forge group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        BASE,
        VARIANTS[variant],
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        'px-0',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
