import { Loader2 } from 'lucide-react';
import cn from '../../utils/cn';

const variants = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost:
    'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
};

// Small buttons are still 40px tall on phones so they are easy to tap.
const sizes = {
  sm: 'h-10 px-3 text-sm sm:h-9',
  md: 'h-11 px-4 text-sm sm:h-10',
  lg: 'h-12 px-5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  href,
  type = 'button',
  disabled = false,
  className,
  children,
  ...props
}) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg text-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    sizes[size],
    className
  );

  const content = (
    <>
      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={16} aria-hidden="true" />
      ) : null}
      {children}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}