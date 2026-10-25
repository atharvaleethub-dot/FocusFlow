import cn from '../../utils/cn';

export const controlBase =
  'w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';
export const controlOk =
  'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600';
export const controlBad = 'border-rose-500 dark:border-rose-500';

export default function Field({ id, label, hint, error, required = false, className, children }) {
  const showHint = Boolean(hint) && !error;
  const hintId = showHint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({ describedBy, invalid: Boolean(error) })}
      {showHint && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}