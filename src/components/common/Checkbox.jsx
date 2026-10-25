import { useId } from 'react';
import cn from '../../utils/cn';

export default function Checkbox({ id, label, className, ...props }) {
  const autoId = useId();
  const checkboxId = id || autoId;

  return (
    <div className={cn('flex min-h-[44px] items-center gap-3 sm:min-h-0', className)}>
      <input
        id={checkboxId}
        type="checkbox"
        className="h-5 w-5 shrink-0 cursor-pointer rounded accent-brand-600 disabled:cursor-not-allowed"
        {...props}
      />
      <label
        htmlFor={checkboxId}
        className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {label}
      </label>
    </div>
  );
}