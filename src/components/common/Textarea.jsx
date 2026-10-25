import { useId } from 'react';
import cn from '../../utils/cn';
import Field, { controlBad, controlBase, controlOk } from './Field';

export default function Textarea({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  ...props
}) {
  const autoId = useId();
  const areaId = id || autoId;

  return (
    <Field id={areaId} label={label} hint={hint} error={error} required={required} className={className}>
      {({ describedBy, invalid }) => (
        <textarea
          id={areaId}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlBase, 'min-h-[88px] resize-y py-2', invalid ? controlBad : controlOk)}
          {...props}
        />
      )}
    </Field>
  );
}