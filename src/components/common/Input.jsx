import { useId } from 'react';
import cn from '../../utils/cn';
import Field, { controlBad, controlBase, controlOk } from './Field';

export default function Input({ id, label, hint, error, required = false, className, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <Field id={inputId} label={label} hint={hint} error={error} required={required} className={className}>
      {({ describedBy, invalid }) => (
        <input
          id={inputId}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlBase, 'h-11 sm:h-10', invalid ? controlBad : controlOk)}
          {...props}
        />
      )}
    </Field>
  );
}