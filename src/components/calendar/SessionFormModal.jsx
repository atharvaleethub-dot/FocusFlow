import { useRef, useState } from 'react';
import {
  formatDeadline,
  formatDuration,
  timeToMinutes,
} from '../../utils/dates';
import { validateSessionPlacement } from '../../utils/schedulingHelpers';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Select from '../common/Select';

export default function SessionFormModal({ session, defaults, state, now, onSubmit, onClose }) {
  const isEdit = Boolean(session);
  const submitted = useRef(false);

  const activeTasks = state.tasks
    .filter((task) => !task.completed)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const [values, setValues] = useState(() =>
    session
      ? { taskId: session.taskId, date: session.date, start: session.start, end: session.end }
      : {
          taskId: defaults.taskId ?? (activeTasks[0] ? activeTasks[0].id : ''),
          date: defaults.date,
          start: defaults.start,
          end: defaults.end,
        }
  );

  const setField = (name) => (event) => {
    const { value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  const result = validateSessionPlacement(state, values, { now, existingSession: session });

  const startMin = timeToMinutes(values.start);
  const endMin = timeToMinutes(values.end);
  const duration = startMin !== null && endMin !== null && endMin > startMin ? endMin - startMin : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitted.current || !result.isValid) return;
    submitted.current = true;
    onSubmit(values);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit study session' : 'Add study session'}
      description="Sessions cannot overlap each other or your fixed commitments."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="session-form"
            disabled={!result.isValid || activeTasks.length === 0}
          >
            {isEdit ? 'Save changes' : 'Add session'}
          </Button>
        </>
      }
    >
      {activeTasks.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          You need an active task before you can plan a session. Create one on the Tasks page.
        </p>
      ) : (
        <form
          id="session-form"
          onSubmit={handleSubmit}
          noValidate
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <Select
            className="sm:col-span-3"
            label="Task"
            required
            value={values.taskId}
            onChange={setField('taskId')}
          >
            {activeTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} (due {formatDeadline(task.deadline, now)})
              </option>
            ))}
          </Select>

          <Input
            label="Date"
            required
            type="date"
            value={values.date}
            onChange={setField('date')}
          />
          <Input
            label="Start"
            required
            type="time"
            step={300}
            value={values.start}
            onChange={setField('start')}
          />
          <Input
            label="End"
            required
            type="time"
            step={300}
            value={values.end}
            onChange={setField('end')}
            hint={duration ? `Length: ${formatDuration(duration)}` : undefined}
          />

          <div aria-live="polite" className="space-y-2 sm:col-span-3">
            {result.errors.length > 0 && (
              <ul className="list-disc space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3 pl-7 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {result.errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
            {result.warnings.length > 0 && (
              <ul className="list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 pl-7 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {result.warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}