import { addDays, minutesToTime, parseDateKey, timeToMinutes, toDateKey } from './dates';
import { validateSessionPlacement } from './schedulingHelpers';

export const MOVE_STEP_MINUTES = 15;

// Converts the pointer position (minutes from midnight) into a snapped start time,
// keeping the grabbed point of the block under the pointer and the whole block inside the day.
export function computeMoveStart({
  pointerMinutes,
  grabOffsetMinutes,
  durationMinutes,
  step = MOVE_STEP_MINUTES,
}) {
  const snapped = Math.round((pointerMinutes - grabOffsetMinutes) / step) * step;
  const maxStart = 24 * 60 - 1 - durationMinutes;
  return Math.max(0, Math.min(snapped, maxStart));
}

export function buildMoveCandidate(session, dateKey, startMinutes) {
  const duration = timeToMinutes(session.end) - timeToMinutes(session.start);
  return {
    taskId: session.taskId,
    date: dateKey,
    start: minutesToTime(startMinutes),
    end: minutesToTime(startMinutes + duration),
  };
}

// Used by the keyboard alternative: shift by minutes and/or days, clamped to the day.
export function nudgeCandidate(session, { minutes = 0, days = 0 }) {
  const duration = timeToMinutes(session.end) - timeToMinutes(session.start);
  const maxStart = 24 * 60 - 1 - duration;
  const start = Math.max(0, Math.min(timeToMinutes(session.start) + minutes, maxStart));
  const date = days === 0 ? session.date : toDateKey(addDays(parseDateKey(session.date), days));
  return buildMoveCandidate(session, date, start);
}

// Same rules as manual editing, plus: only planned, unlocked sessions can move.
export function validateSessionMove(state, session, candidate, now = new Date()) {
  const blocked = (message) => ({
    isValid: false,
    isNoop: false,
    errors: [message],
    warnings: [],
  });

  if (session.status !== 'planned') return blocked('Only planned sessions can be moved.');
  if (session.locked) return blocked('This session is locked. Unlock it before moving it.');

  if (
    candidate.date === session.date &&
    candidate.start === session.start &&
    candidate.end === session.end
  ) {
    return { isValid: true, isNoop: true, errors: [], warnings: [] };
  }

  return {
    ...validateSessionPlacement(state, candidate, { now, existingSession: session }),
    isNoop: false,
  };
}