import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium tracking-tight backdrop-blur-xl active:scale-[0.97] transition-[background-color,border-color,color,transform,box-shadow,backdrop-filter] duration-150 ease-forge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-45';

const VARIANTS: Record<Variant, string> = {
  // Brand blue with a violet sheen — Apple liquid-glass rim light.
  primary:
    'bg-brand text-white border border-white/15 shadow-[0_1px_0_0_rgb(255_255_255/0.2)_inset,0_8px_24px_-12px_rgb(var(--nf-blue)/0.8)] hover:bg-[rgb(var(--nf-blue)/0.88)] hover:shadow-[0_1px_0_0_rgb(255_255_255/0.24)_inset,0_12px_28px_-12px_rgb(var(--nf-blue)/0.9)]',
  secondary:
    'border border-white/30 bg-white/65 backdrop-blur-xl text-fg shadow-[0_4px_16px_-8px_rgb(31_38_135/0.12),0_1px_2px_rgb(0_0_0/0.05)] hover:bg-white/80 hover:border-white/40 hover:shadow-[0_8px_24px_-12px_rgb(31_38_135/0.14)]',
  outline: 'border border-white/30 bg-white/40 backdrop-blur-xl text-fg hover:border-white/40 hover:bg-white/60',
  ghost: 'bg-transparent text-muted hover:bg-white/40 hover:backdrop-blur-xl hover:text-fg',
  subtle: 'bg-white/50 backdrop-blur-xl border border-white/20 text-fg hover:bg-white/70',
  danger: 'bg-danger text-white border border-white/15 shadow-sm hover:bg-[rgb(var(--nf-danger)/0.88)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-xl',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-[15px] rounded-xl',
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
