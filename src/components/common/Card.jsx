import cn from '../../utils/cn';

export function Card({
  as: Component = 'section',
  padding = 'p-4 sm:p-6',
  hover = false,
  className,
  children,
  ...props
}) {
  return (
    <Component
      className={cn(
        'min-w-0 rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900',
        hover && 'transition-shadow hover:shadow-md',
        padding,
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default Card;