import { useEffect, useRef, useState } from 'react';
import { LIMITS, PRIORITIES, PRIORITY_META } from '../../data/schema';
import { addDays, formatDuration, toDateKey } from '../../utils/dates';
import { validateTaskInput } from '../../utils/taskValidation';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Select from '../common/Select';
import Textarea from '../common/Textarea';

function toFormValues(task) {
  if (!task) {
    return {
      title: '',
      subject: '',
      notes: '',
      estimatedMinutes: '60',
      deadlineDate: toDateKey(addDays(new Date(), 1)),
      deadlineTime: '18:00',
      priority: 'medium',
    };
  }
  const [deadlineDate, deadlineTime] = task.deadline.split('T');
  return {
    title: task.title,
    subject: task.subject,
    notes: task.notes,
    estimatedMinutes: String(task.estimatedMinutes),
    deadlineDate,
    deadlineTime,
    priority: task.priority,
  };
}

export default function TaskFormModal({ task, subjects, onSubmit, onClose }) {
  const isEdit = Boolean(task);
  const [values, setValues] = useState(() => toFormValues(task));
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

  const setField = (name) => (event) => {
    const { value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      if (!previous[name] && !name.startsWith('deadline')) return previous;
      const next = { ...previous, [name]: undefined };
      if (name.startsWith('deadline')) {
        next.deadlineDate = undefined;
        next.deadlineTime = undefined;
      }
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitted.current) return;

    const result = validateTaskInput(values, { now: new Date(), existingTask: task });
    if (!result.isValid) {
      setErrors(result.errors);
      setAttempt((count) => count + 1);
      return;
    }
    submitted.current = true;
    onSubmit(result.values);
  };

  const minutes = Number(values.estimatedMinutes);
  const durationHint =
    values.estimatedMinutes.trim() !== '' && Number.isInteger(minutes) && minutes > 0
      ? `That is ${formatDuration(minutes)}.`
      : 'Total study time needed, in whole minutes.';

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit task' : 'New task'}
      description="Set a deadline and estimate so FocusFlow can plan your study time."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-form">
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form
        id="task-form"
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 gap-4 sm:grid-cols-6"
      >
        <Input
          className="sm:col-span-6"
          label="Title"
          required
          maxLength={LIMITS.titleMax}
          placeholder="e.g. Calculus problem set 5"
          value={values.title}
          onChange={setField('title')}
          error={errors.title}
        />

        <Input
          className="sm:col-span-3"
          label="Subject"
          required
          list="task-subject-options"
          maxLength={LIMITS.subjectMax}
          placeholder="e.g. Mathematics"
          value={values.subject}
          onChange={setField('subject')}
          error={errors.subject}
        />
        <datalist id="task-subject-options">
          {subjects.map((subject) => (
            <option key={subject} value={subject} />
          ))}
        </datalist>

        <Select
          className="sm:col-span-3"
          label="Priority"
          required
          value={values.priority}
          onChange={setField('priority')}
          error={errors.priority}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_META[priority].label}
            </option>
          ))}
        </Select>

        <Input
          className="sm:col-span-2"
          label="Estimated minutes"
          required
          type="number"
          inputMode="numeric"
          min={LIMITS.minEstimate}
          max={LIMITS.maxEstimate}
          step={5}
          value={values.estimatedMinutes}
          onChange={setField('estimatedMinutes')}
          error={errors.estimatedMinutes}
          hint={durationHint}
        />

        <Input
          className="sm:col-span-2"
          label="Deadline date"
          required
          type="date"
          value={values.deadlineDate}
          onChange={setField('deadlineDate')}
          error={errors.deadlineDate}
        />

        <Input
          className="sm:col-span-2"
          label="Deadline time"
          required
          type="time"
          value={values.deadlineTime}
          onChange={setField('deadlineTime')}
          error={errors.deadlineTime}
        />

        <Textarea
          className="sm:col-span-6"
          label="Notes (optional)"
          maxLength={LIMITS.notesMax}
          rows={3}
          placeholder="Anything that helps you study, such as chapters or links."
          value={values.notes}
          onChange={setField('notes')}
          error={errors.notes}
        />
      </form>
    </Modal>
  );
}