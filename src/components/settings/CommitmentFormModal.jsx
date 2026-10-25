import { useEffect, useRef, useState } from 'react';
import { COMMITMENT_CATEGORIES } from '../../data/schema';
import { WEEKDAY_ORDER, WEEKDAY_SHORT, toDateKey } from '../../utils/dates';
import { COMMITMENT_CATEGORY_LABELS } from '../../utils/schedulingHelpers';
import { validateCommitmentInput } from '../../utils/settingsValidation';
import cn from '../../utils/cn';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Select from '../common/Select';

function toFormValues(commitment) {
  if (!commitment) {
    return {
      title: '',
      category: 'class',
      repeat: 'weekly',
      days: ['mon'],
      date: toDateKey(new Date()),
      start: '09:00',
      end: '10:00',
    };
  }
  return {
    title: commitment.title,
    category: commitment.category,
    repeat: commitment.repeat,
    days: [...commitment.days],
    date: commitment.date ?? toDateKey(new Date()),
    start: commitment.start,
    end: commitment.end,
  };
}

export default function CommitmentFormModal({ commitment, commitments, onSubmit, onClose }) {
  const isEdit = Boolean(commitment);
  const [values, setValues] = useState(() => toFormValues(commitment));
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef(null);
  const submitted = useRef(false);

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);

  useEffect(() => {
    if (attempt === 0) return;
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  const clearErrors = (...names) =>
    setErrors((previous) => {
      const next = { ...previous, overlap: undefined };
      names.forEach((name) => {
        next[name] = undefined;
      });
      return next;
    });

  const setField = (name) => (event) => {
    const { value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    clearErrors(name, name === 'start' ? 'end' : null);
  };

  const toggleDay = (key) => {
    setValues((previous) => ({
      ...previous,
      days: previous.days.includes(key)
        ? previous.days.filter((day) => day !== key)
        : [...previous.days, key],
    }));
    clearErrors('days');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitted.current) return;

    const result = validateCommitmentInput(values, {
      commitments,
      editingId: commitment ? commitment.id : null,
    });
    if (!result.isValid) {
      setErrors(result.errors);
      setAttempt((count) => count + 1);
      return;
    }
    submitted.current = true;
    onSubmit(result.values);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit fixed commitment' : 'Add fixed commitment'}
      description="Fixed commitments are protected time. Automatic scheduling never moves or removes them."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="commitment-form">
            {isEdit ? 'Save changes' : 'Add commitment'}
          </Button>
        </>
      }
    >
      <form
        id="commitment-form"
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-6"
      >
        <Input
          className="sm:col-span-6"
          label="Name"
          required
          placeholder="e.g. Chemistry lecture"
          value={values.title}
          onChange={setField('title')}
          error={errors.title}
        />

        <Select
          className="sm:col-span-3"
          label="Category"
          value={values.category}
          onChange={setField('category')}
          error={errors.category}
        >
          {COMMITMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {COMMITMENT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>

        <Select
          className="sm:col-span-3"
          label="Repeats"
          value={values.repeat}
          onChange={setField('repeat')}
        >
          <option value="weekly">Every week</option>
          <option value="once">One time only</option>
        </Select>

        {values.repeat === 'weekly' ? (
          <fieldset className="min-w-0 sm:col-span-6">
            <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              Repeats on
            </legend>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_ORDER.map((key) => {
                const active = values.days.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDay(key)}
                    className={cn(
                      'min-h-[44px] rounded-lg border text-xs font-medium transition-colors sm:min-h-0 sm:py-2 sm:text-sm',
                      active
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    )}
                  >
                    {WEEKDAY_SHORT[key]}
                  </button>
                );
              })}
            </div>
            {errors.days && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                {errors.days}
              </p>
            )}
          </fieldset>
        ) : (
          <Input
            className="sm:col-span-6"
            label="Date"
            required
            type="date"
            value={values.date}
            onChange={setField('date')}
            error={errors.date}
          />
        )}

        <Input
          className="sm:col-span-3"
          label="Start"
          required
          type="time"
          value={values.start}
          onChange={setField('start')}
          error={errors.start}
        />
        <Input
          className="sm:col-span-3"
          label="End"
          required
          type="time"
          value={values.end}
          onChange={setField('end')}
          error={errors.end}
        />

        {errors.overlap && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 sm:col-span-6"
          >
            {errors.overlap}
          </p>
        )}
      </form>
    </Modal>
  );
}