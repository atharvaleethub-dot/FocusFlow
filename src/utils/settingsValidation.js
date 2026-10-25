import { COMMITMENT_CATEGORIES, LIMITS } from '../data/schema';
import {
  WEEKDAY_ORDER,
  formatDuration,
  formatTimeRange,
  isValidDateKey,
  isValidTime,
  timeToMinutes,
} from './dates';
import { findOverlappingCommitments } from './schedulingHelpers';

export function availabilityToDraft(availability) {
  const days = {};
  WEEKDAY_ORDER.forEach((key) => {
    const day = availability.days[key];
    days[key] = {
      enabled: day.enabled,
      start: day.start,
      end: day.end,
      maxMinutes: String(day.maxMinutes),
    };
  });
  return {
    days,
    preferredSessionMinutes: String(availability.preferredSessionMinutes),
    minBreakMinutes: String(availability.minBreakMinutes),
  };
}

function parseWholeNumber(value) {
  const text = String(value).trim();
  if (text === '') return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
}

// Disabled days are not validated; their saved values are kept unchanged.
export function validateAvailabilityDraft(draft, saved) {
  const errors = {};
  const days = {};

  WEEKDAY_ORDER.forEach((key) => {
    const day = draft.days[key];
    if (!day.enabled) {
      days[key] = { ...saved.days[key], enabled: false };
      return;
    }

    const startOk = isValidTime(day.start);
    const endOk = isValidTime(day.end);
    if (!startOk) errors[`${key}.start`] = 'Choose a start time.';
    if (!endOk) errors[`${key}.end`] = 'Choose an end time.';

    let windowMinutes = null;
    if (startOk && endOk) {
      windowMinutes = timeToMinutes(day.end) - timeToMinutes(day.start);
      if (windowMinutes < 15) errors[`${key}.end`] = 'End must be at least 15 minutes after start.';
    }

    const maxMinutes = parseWholeNumber(day.maxMinutes);
    if (maxMinutes === null || maxMinutes < 15 || maxMinutes > 1440) {
      errors[`${key}.maxMinutes`] = 'Enter 15 to 1440 minutes.';
    } else if (windowMinutes !== null && windowMinutes >= 15 && maxMinutes > windowMinutes) {
      errors[`${key}.maxMinutes`] = `Cannot exceed the window (${formatDuration(windowMinutes)}).`;
    }

    days[key] = { enabled: true, start: day.start, end: day.end, maxMinutes };
  });

  const preferred = parseWholeNumber(draft.preferredSessionMinutes);
  if (preferred === null || preferred < 15 || preferred > 240) {
    errors.preferredSessionMinutes = 'Enter 15 to 240 minutes.';
  }
  const minBreak = parseWholeNumber(draft.minBreakMinutes);
  if (minBreak === null || minBreak < 0 || minBreak > 120) {
    errors.minBreakMinutes = 'Enter 0 to 120 minutes.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    availability: isValid
      ? { days, preferredSessionMinutes: preferred, minBreakMinutes: minBreak }
      : null,
  };
}

export function validateCommitmentInput(values, { commitments, editingId = null }) {
  const errors = {};
  const title = String(values.title ?? '').trim();

  if (!title) {
    errors.title = 'Enter a name, for example "Chemistry lecture".';
  } else if (title.length > LIMITS.titleMax) {
    errors.title = `Keep the name under ${LIMITS.titleMax} characters.`;
  }

  if (!COMMITMENT_CATEGORIES.includes(values.category)) {
    errors.category = 'Choose a category.';
  }

  const repeat = values.repeat === 'once' ? 'once' : 'weekly';
  let days = [];
  let date = null;
  if (repeat === 'weekly') {
    days = WEEKDAY_ORDER.filter((key) => values.days.includes(key));
    if (days.length === 0) errors.days = 'Select at least one weekday.';
  } else if (isValidDateKey(values.date)) {
    date = values.date;
  } else {
    errors.date = 'Choose a valid date.';
  }

  if (!isValidTime(values.start)) errors.start = 'Choose a start time.';
  if (!isValidTime(values.end)) errors.end = 'Choose an end time.';
  if (
    !errors.start &&
    !errors.end &&
    timeToMinutes(values.end) <= timeToMinutes(values.start)
  ) {
    errors.end = 'End must be after the start time.';
  }

  if (Object.keys(errors).length === 0) {
    const overlapping = findOverlappingCommitments(
      commitments,
      { repeat, days, date, start: values.start, end: values.end },
      editingId
    );
    if (overlapping.length > 0) {
      errors.overlap = `Overlaps "${overlapping[0].title}" (${formatTimeRange(
        overlapping[0].start,
        overlapping[0].end
      )}). Fixed commitments cannot overlap.`;
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    values: isValid
      ? {
          title,
          category: values.category,
          repeat,
          days,
          date,
          start: values.start,
          end: values.end,
        }
      : null,
  };
}