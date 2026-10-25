import { LIMITS, PRIORITIES } from '../data/schema';
import { isValidDateKey, isValidTime, parseLocalDateTime } from './dates';

// Validates raw form values (strings) and returns normalized values when valid.
export function validateTaskInput(values, { now = new Date(), existingTask = null } = {}) {
  const errors = {};

  const title = String(values.title ?? '').trim();
  const subject = String(values.subject ?? '').trim();
  const notes = String(values.notes ?? '').trim();
  const priority = values.priority;

  if (!title) {
    errors.title = 'Enter a task title.';
  } else if (title.length > LIMITS.titleMax) {
    errors.title = `Keep the title under ${LIMITS.titleMax} characters.`;
  }

  if (!subject) {
    errors.subject = 'Enter a subject, for example Mathematics.';
  } else if (subject.length > LIMITS.subjectMax) {
    errors.subject = `Keep the subject under ${LIMITS.subjectMax} characters.`;
  }

  if (notes.length > LIMITS.notesMax) {
    errors.notes = `Keep notes under ${LIMITS.notesMax} characters.`;
  }

  const rawMinutes = String(values.estimatedMinutes ?? '').trim();
  const minutes = Number(rawMinutes);
  if (!rawMinutes) {
    errors.estimatedMinutes = 'Enter the estimated study time in minutes.';
  } else if (
    !Number.isInteger(minutes) ||
    minutes < LIMITS.minEstimate ||
    minutes > LIMITS.maxEstimate
  ) {
    errors.estimatedMinutes = `Use a whole number from ${LIMITS.minEstimate} to ${LIMITS.maxEstimate} minutes.`;
  }

  if (!PRIORITIES.includes(priority)) {
    errors.priority = 'Choose a priority.';
  }

  const date = String(values.deadlineDate ?? '');
  const time = String(values.deadlineTime ?? '');
  if (!date) {
    errors.deadlineDate = 'Choose a deadline date.';
  } else if (!isValidDateKey(date)) {
    errors.deadlineDate = 'Enter a valid date.';
  }
  if (!time) {
    errors.deadlineTime = 'Choose a deadline time.';
  } else if (!isValidTime(time)) {
    errors.deadlineTime = 'Enter a valid time.';
  }

  let deadline = null;
  if (!errors.deadlineDate && !errors.deadlineTime) {
    deadline = `${date}T${time}`;
    const parsed = parseLocalDateTime(deadline);
    // An existing overdue task may keep its old deadline while other fields are edited.
    const unchanged = Boolean(existingTask) && existingTask.deadline === deadline;
    if (!parsed) {
      errors.deadlineDate = 'Enter a valid deadline.';
    } else if (!unchanged && parsed <= now) {
      errors.deadlineDate = 'Choose a deadline in the future.';
    } else if (parsed.getFullYear() > now.getFullYear() + 5) {
      errors.deadlineDate = 'The deadline is too far away (more than 5 years).';
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    values: isValid
      ? { title, subject, notes, estimatedMinutes: minutes, deadline, priority }
      : null,
  };
}