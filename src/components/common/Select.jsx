import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import cn from '../../utils/cn';
import Field, { controlBad, controlBase, controlOk } from './Field';

export default function Select({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
  ...props
}) {
  const autoId = useId();
  const selectId = id || autoId;

  return (
    <Field id={selectId} label={label} hint={hint} error={error} required={required} className={className}>
      {({ describedBy, invalid }) => (
        <div className="relative">
          <select
            id={selectId}
            aria-required={required || undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              controlBase,
              'h-11 appearance-none pr-9 sm:h-10',
              invalid ? controlBad : controlOk
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      )}
    </Field>
  );
}