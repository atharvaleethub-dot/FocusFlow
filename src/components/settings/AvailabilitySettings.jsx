import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import useSchedulingSettings from '../../hooks/useSchedulingSettings';
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../../utils/dates';
import { isWithinAvailability } from '../../utils/schedulingHelpers';
import { pluralize } from '../../utils/taskHelpers';
import {
  availabilityToDraft,
  validateAvailabilityDraft,
} from '../../utils/settingsValidation';
import Button from '../common/Button';
import { Card, CardHeader } from '../common/Card';
import Checkbox from '../common/Checkbox';
import Input from '../common/Input';

export default function AvailabilitySettings() {
  const { availability, sessions, saveAvailability } = useSchedulingSettings();
  const toast = useToast();

  const [draft, setDraft] = useState(() => availabilityToDraft(availability));
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(availabilityToDraft(availability));

  useEffect(() => {
    if (attempt === 0) return;
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  const updateDay = (key, patch) => {
    setDraft((previous) => ({
      ...previous,
      days: { ...previous.days, [key]: { ...previous.days[key], ...patch } },
    }));
    setErrors((previous) => ({
      ...previous,
      [`${key}.start`]: undefined,
      [`${key}.end`]: undefined,
      [`${key}.maxMinutes`]: undefined,
    }));
  };

  const updateGlobal = (name) => (event) => {
    const { value } = event.target;
    setDraft((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = validateAvailabilityDraft(draft, availability);
    if (!result.isValid) {
      setErrors(result.errors);
      setAttempt((count) => count + 1);
      return;
    }

    saveAvailability(result.availability);
    const outside = sessions.filter(
      (session) =>
        session.status === 'planned' && !isWithinAvailability(session, result.availability)
    ).length;
    if (outside > 0) {
      toast.warning(
        'Availability saved',
        `${pluralize(outside, 'planned session')} now ${
          outside === 1 ? 'falls' : 'fall'
        } outside your study windows. Review them on the calendar.`
      );
    } else {
      toast.success('Availability saved', 'Your study windows were updated.');
    }
  };

  return (
    <Card>
      <CardHeader
        title="Study availability"
        description="When you can study each weekday. Automatic scheduling only plans sessions inside these windows."
      />

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-3">
        {WEEKDAY_ORDER.map((key) => {
          const day = draft.days[key];
          return (
            <fieldset
              key={key}
              className="grid min-w-0 grid-cols-2 items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-[9rem_repeat(3,minmax(0,1fr))]"
            >
              <legend className="sr-only">{WEEKDAY_LABELS[key]} availability</legend>
              <div className="col-span-2 flex items-center sm:col-span-1 sm:h-10">
                <Checkbox
                  label={WEEKDAY_LABELS[key]}
                  checked={day.enabled}
                  onChange={(event) => updateDay(key, { enabled: event.target.checked })}
                />
              </div>
              <Input
                label="Start"
                type="time"
                value={day.start}
                disabled={!day.enabled}
                onChange={(event) => updateDay(key, { start: event.target.value })}
                error={errors[`${key}.start`]}
              />
              <Input
                label="End"
                type="time"
                value={day.end}
                disabled={!day.enabled}
                onChange={(event) => updateDay(key, { end: event.target.value })}
                error={errors[`${key}.end`]}
              />
              <Input
                className="col-span-2 sm:col-span-1"
                label="Daily limit (min)"
                type="number"
                inputMode="numeric"
                min={15}
                max={1440}
                step={15}
                value={day.maxMinutes}
                disabled={!day.enabled}
                onChange={(event) => updateDay(key, { maxMinutes: event.target.value })}
                error={errors[`${key}.maxMinutes`]}
              />
            </fieldset>
          );
        })}

        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <Input
            label="Preferred session length (min)"
            type="number"
            inputMode="numeric"
            min={15}
            max={240}
            step={5}
            value={draft.preferredSessionMinutes}
            onChange={updateGlobal('preferredSessionMinutes')}
            error={errors.preferredSessionMinutes}
            hint="Long tasks are split into sessions of about this length."
          />
          <Input
            label="Minimum break between sessions (min)"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            step={5}
            value={draft.minBreakMinutes}
            onChange={updateGlobal('minBreakMinutes')}
            error={errors.minBreakMinutes}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={!dirty}>
            Save availability
          </Button>
          <Button
            variant="secondary"
            disabled={!dirty}
            onClick={() => {
              setDraft(availabilityToDraft(availability));
              setErrors({});
            }}
          >
            Discard changes
          </Button>
        </div>
      </form>
    </Card>
  );
}