import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
  combineDateAndTime,
  formatDeadline,
  formatDuration,
  formatTimeRange,
  getWeekdayKey,
  isValidDateKey,
  minutesToTime,
  parseDateKey,
  parseLocalDateTime,
  timeToMinutes,
  toDateKey,
} from './dates';
import { getSessionMinutes } from './stats';

export const MIN_SESSION_MINUTES = 5;
export const MAX_SESSION_MINUTES = 480;

export const COMMITMENT_CATEGORY_LABELS = {
  class: 'Class',
  work: 'Work',
  meal: 'Meal',
  travel: 'Travel',
  other: 'Other',
};

// Two time ranges overlap only if they share time; touching ranges (10:00-11:00, 11:00-12:00) do not.
export const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export function commitmentOccursOn(commitment, dateKey) {
  if (commitment.repeat === 'once') return commitment.date === dateKey;
  return commitment.days.includes(getWeekdayKey(dateKey));
}

export function getCommitmentsForDate(commitments, dateKey) {
  return commitments
    .filter((commitment) => commitmentOccursOn(commitment, dateKey))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Missed sessions no longer occupy time.
export function findSessionConflicts(sessions, candidate, ignoreId = null) {
  const start = timeToMinutes(candidate.start);
  const end = timeToMinutes(candidate.end);
  return sessions.filter(
    (session) =>
      session.id !== ignoreId &&
      session.date === candidate.date &&
      session.status !== 'missed' &&
      intervalsOverlap(start, end, timeToMinutes(session.start), timeToMinutes(session.end))
  );
}

export function findCommitmentConflicts(commitments, candidate) {
  const start = timeToMinutes(candidate.start);
  const end = timeToMinutes(candidate.end);
  return getCommitmentsForDate(commitments, candidate.date).filter((commitment) =>
    intervalsOverlap(start, end, timeToMinutes(commitment.start), timeToMinutes(commitment.end))
  );
}

function commitmentsShareDay(a, b) {
  if (a.repeat === 'once' && b.repeat === 'once') return a.date === b.date;
  if (a.repeat === 'once') return b.days.includes(getWeekdayKey(a.date));
  if (b.repeat === 'once') return a.days.includes(getWeekdayKey(b.date));
  return a.days.some((day) => b.days.includes(day));
}

export function findOverlappingCommitments(commitments, candidate, ignoreId = null) {
  const start = timeToMinutes(candidate.start);
  const end = timeToMinutes(candidate.end);
  return commitments.filter(
    (commitment) =>
      commitment.id !== ignoreId &&
      commitmentsShareDay(commitment, candidate) &&
      intervalsOverlap(start, end, timeToMinutes(commitment.start), timeToMinutes(commitment.end))
  );
}

export function describeCommitmentSchedule(commitment) {
  const time = formatTimeRange(commitment.start, commitment.end);
  if (commitment.repeat === 'once') {
    const date = parseDateKey(commitment.date);
    const label = date
      ? date.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : commitment.date;
    return `${label}, ${time}`;
  }

  const { days } = commitment;
  let dayText;
  if (days.length === 7) {
    dayText = 'Every day';
  } else if (days.length === 5 && ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => days.includes(d))) {
    dayText = 'Weekdays';
  } else {
    dayText = days.map((day) => WEEKDAY_SHORT[day]).join(', ');
  }
  return `${dayText}, ${time}`;
}

export function isWithinAvailability(session, availability) {
  const day = availability.days[getWeekdayKey(session.date)];
  if (!day || !day.enabled) return false;
  return (
    timeToMinutes(session.start) >= timeToMinutes(day.start) &&
    timeToMinutes(session.end) <= timeToMinutes(day.end)
  );
}

// Visible hour range of the weekly grid, widened to fit every item and study window.
export function getVisibleRange(items, availability) {
  const starts = items.map((item) => timeToMinutes(item.start));
  const ends = items.map((item) => timeToMinutes(item.end));
  WEEKDAY_ORDER.forEach((key) => {
    const day = availability.days[key];
    if (day.enabled) {
      starts.push(timeToMinutes(day.start));
      ends.push(timeToMinutes(day.end));
    }
  });

  let startMin = starts.length > 0 ? Math.min(...starts) : 8 * 60;
  let endMin = ends.length > 0 ? Math.max(...ends) : 20 * 60;
  startMin = Math.max(0, Math.floor(startMin / 60) * 60);
  endMin = Math.min(24 * 60, Math.ceil(endMin / 60) * 60);
  if (endMin - startMin < 6 * 60) {
    endMin = Math.min(24 * 60, startMin + 6 * 60);
    startMin = Math.max(0, endMin - 6 * 60);
  }
  return { startMin, endMin };
}

export function getDefaultSessionTimes(dateKey, now, availability) {
  const day = availability.days[getWeekdayKey(dateKey)];
  let startMin = day && day.enabled ? timeToMinutes(day.start) : 16 * 60;
  if (dateKey === toDateKey(now)) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const next = Math.ceil((nowMin + 15) / 15) * 15;
    if (next > startMin) startMin = next;
  }
  startMin = Math.min(startMin, 22 * 60 + 30);
  const endMin = Math.min(startMin + availability.preferredSessionMinutes, 23 * 60 + 59);
  return { start: minutesToTime(startMin), end: minutesToTime(endMin) };
}

// Errors block saving. Warnings are shown but allowed.
export function validateSessionPlacement(
  state,
  candidate,
  { now = new Date(), existingSession = null } = {}
) {
  const errors = [];
  const warnings = [];
  const { tasks, sessions, commitments, availability } = state;
  const finish = () => ({ isValid: errors.length === 0, errors, warnings });

  const task = tasks.find((item) => item.id === candidate.taskId);
  if (!candidate.taskId) errors.push('Choose a task for this session.');
  else if (!task) errors.push('The selected task no longer exists.');
  else if (task.completed) errors.push('This task is already completed.');

  const dateOk = isValidDateKey(candidate.date);
  const startMin = timeToMinutes(candidate.start);
  const endMin = timeToMinutes(candidate.end);
  if (!dateOk) errors.push('Choose a valid date.');
  if (startMin === null) errors.push('Choose a valid start time.');
  if (endMin === null) errors.push('Choose a valid end time.');
  if (!dateOk || startMin === null || endMin === null) return finish();

  if (endMin <= startMin) {
    errors.push('The end time must be after the start time.');
    return finish();
  }

  const duration = endMin - startMin;
  if (duration < MIN_SESSION_MINUTES) {
    errors.push(`Sessions must be at least ${MIN_SESSION_MINUTES} minutes long.`);
  }
  if (duration > MAX_SESSION_MINUTES) {
    errors.push(`Sessions can be at most ${formatDuration(MAX_SESSION_MINUTES)} long.`);
  }

  const sessionEnd = combineDateAndTime(candidate.date, candidate.end);
  const deadline = task ? parseLocalDateTime(task.deadline) : null;
  if (deadline && sessionEnd > deadline) {
    errors.push(`This session ends after the task's deadline (${formatDeadline(task.deadline, now)}).`);
  }

  const unchanged =
    Boolean(existingSession) &&
    existingSession.date === candidate.date &&
    existingSession.start === candidate.start &&
    existingSession.end === candidate.end;
  if (sessionEnd <= now && !unchanged) {
    errors.push('Sessions must end in the future.');
  }

  const ignoreId = existingSession ? existingSession.id : null;
  const taskTitles = new Map(tasks.map((item) => [item.id, item.title]));

  findSessionConflicts(sessions, candidate, ignoreId).forEach((other) => {
    errors.push(
      `Overlaps another study session: ${taskTitles.get(other.taskId) ?? 'Deleted task'}, ${formatTimeRange(
        other.start,
        other.end
      )}.`
    );
  });
  findCommitmentConflicts(commitments, candidate).forEach((commitment) => {
    errors.push(
      `Overlaps your fixed commitment "${commitment.title}" (${formatTimeRange(
        commitment.start,
        commitment.end
      )}).`
    );
  });

  const weekdayKey = getWeekdayKey(candidate.date);
  const day = availability.days[weekdayKey];
  if (day) {
    if (!day.enabled) {
      warnings.push(`${WEEKDAY_LABELS[weekdayKey]} is switched off in your study availability.`);
    } else if (startMin < timeToMinutes(day.start) || endMin > timeToMinutes(day.end)) {
      warnings.push(
        `Outside your ${WEEKDAY_LABELS[weekdayKey]} study window (${formatTimeRange(
          day.start,
          day.end
        )}).`
      );
    }
  }

  const others = sessions.filter(
    (session) =>
      session.id !== ignoreId && session.date === candidate.date && session.status !== 'missed'
  );
  const dayTotal = others.reduce((sum, session) => sum + getSessionMinutes(session), 0) + duration;
  if (day && day.enabled && dayTotal > day.maxMinutes) {
    warnings.push(
      `This brings ${WEEKDAY_LABELS[weekdayKey]} to ${formatDuration(dayTotal)}, above your ${formatDuration(
        day.maxMinutes
      )} daily limit.`
    );
  }

  const minBreak = availability.minBreakMinutes;
  const tooClose = others.some((other) => {
    const otherStart = timeToMinutes(other.start);
    const otherEnd = timeToMinutes(other.end);
    if (intervalsOverlap(startMin, endMin, otherStart, otherEnd)) return false;
    const gap = startMin >= otherEnd ? startMin - otherEnd : otherStart - endMin;
    return gap < minBreak;
  });
  if (tooClose && minBreak > 0) {
    warnings.push(`Less than ${minBreak} minutes of break next to another session.`);
  }

  return finish();
}