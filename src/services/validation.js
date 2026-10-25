import {
  COMMITMENT_CATEGORIES,
  COMMITMENT_REPEATS,
  HISTORY_LIMIT,
  LIMITS,
  PRIORITIES,
  SESSION_SOURCES,
  SESSION_STATUSES,
  createBaseState,
  defaultAvailability,
  defaultSettings,
} from '../data/schema';
import {
  WEEKDAY_ORDER,
  isValidDateKey,
  isValidLocalDateTime,
  isValidTime,
  timeToMinutes,
} from '../utils/dates';

const ok = (value) => ({ ok: true, value });
const fail = (reason) => ({ ok: false, reason });

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const isIsoTimestamp = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isIntInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const hasValidTimeRange = (start, end) =>
  isValidTime(start) && isValidTime(end) && timeToMinutes(start) < timeToMinutes(end);

export function sanitizeTask(raw) {
  if (!isPlainObject(raw)) return fail('not an object');
  if (!isNonEmptyString(raw.id)) return fail('missing id');
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return fail('missing title');
  if (title.length > LIMITS.titleMax) return fail('title is too long');
  if (!isIntInRange(raw.estimatedMinutes, LIMITS.minEstimate, LIMITS.maxEstimate)) {
    return fail('invalid estimated duration');
  }
  if (!isValidLocalDateTime(raw.deadline)) return fail('invalid deadline');
  if (!PRIORITIES.includes(raw.priority)) return fail('invalid priority');

  const completed = raw.completed === true;
  return ok({
    id: raw.id,
    title,
    subject: isNonEmptyString(raw.subject)
      ? raw.subject.trim().slice(0, LIMITS.subjectMax)
      : 'General',
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, LIMITS.notesMax) : '',
    estimatedMinutes: raw.estimatedMinutes,
    deadline: raw.deadline,
    priority: raw.priority,
    createdAt: isIsoTimestamp(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
    completed,
    completedAt: completed && isIsoTimestamp(raw.completedAt) ? raw.completedAt : null,
  });
}

export function sanitizeSession(raw) {
  if (!isPlainObject(raw)) return fail('not an object');
  if (!isNonEmptyString(raw.id)) return fail('missing id');
  if (!isNonEmptyString(raw.taskId)) return fail('missing task reference');
  if (!isValidDateKey(raw.date)) return fail('invalid date');
  if (!isValidTime(raw.start) || !isValidTime(raw.end)) return fail('invalid time');
  if (!hasValidTimeRange(raw.start, raw.end)) return fail('end must be after start');
  if (!SESSION_STATUSES.includes(raw.status)) return fail('invalid status');

  const actualMinutes =
    Number.isFinite(raw.actualMinutes) && raw.actualMinutes >= 0
      ? Math.round(raw.actualMinutes)
      : null;

  return ok({
    id: raw.id,
    taskId: raw.taskId,
    date: raw.date,
    start: raw.start,
    end: raw.end,
    status: raw.status,
    locked: raw.locked === true,
    source: SESSION_SOURCES.includes(raw.source) ? raw.source : 'manual',
    actualMinutes,
    completedAt:
      raw.status === 'completed' && isIsoTimestamp(raw.completedAt) ? raw.completedAt : null,
    rescheduledCount: isIntInRange(raw.rescheduledCount, 0, 1000) ? raw.rescheduledCount : 0,
  });
}

export function sanitizeCommitment(raw) {
  if (!isPlainObject(raw)) return fail('not an object');
  if (!isNonEmptyString(raw.id)) return fail('missing id');
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return fail('missing title');
  if (title.length > LIMITS.titleMax) return fail('title is too long');
  if (!hasValidTimeRange(raw.start, raw.end)) return fail('invalid time range');

  const repeat = COMMITMENT_REPEATS.includes(raw.repeat) ? raw.repeat : 'weekly';
  let days = [];
  let date = null;

  if (repeat === 'weekly') {
    days = Array.isArray(raw.days) ? WEEKDAY_ORDER.filter((key) => raw.days.includes(key)) : [];
    if (days.length === 0) return fail('no valid weekdays selected');
  } else {
    if (!isValidDateKey(raw.date)) return fail('invalid date');
    date = raw.date;
  }

  return ok({
    id: raw.id,
    title,
    category: COMMITMENT_CATEGORIES.includes(raw.category) ? raw.category : 'other',
    repeat,
    days,
    date,
    start: raw.start,
    end: raw.end,
  });
}

function sanitizeHistoryEntry(raw) {
  if (!isPlainObject(raw)) return fail('not an object');
  if (!isNonEmptyString(raw.id)) return fail('missing id');
  if (!isPlainObject(raw.snapshot)) return fail('missing snapshot');

  const snapshotIssues = [];
  const tasks = sanitizeList(raw.snapshot.tasks, sanitizeTask, 'snapshot task', snapshotIssues);
  const sessions = sanitizeList(
    raw.snapshot.sessions,
    sanitizeSession,
    'snapshot session',
    snapshotIssues
  );
  if (snapshotIssues.length > 0) return fail('snapshot contains invalid data');

  return ok({
    id: raw.id,
    createdAt: isIsoTimestamp(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
    action: isNonEmptyString(raw.action) ? raw.action : 'change',
    label: typeof raw.label === 'string' ? raw.label.slice(0, 200) : '',
    snapshot: { tasks, sessions },
  });
}

function sanitizeList(list, sanitizer, label, issues) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) {
    issues.push(`${label}s: expected a list`);
    return [];
  }
  const seen = new Set();
  const result = [];
  list.forEach((item, index) => {
    const outcome = sanitizer(item);
    if (!outcome.ok) {
      issues.push(`${label} ${index + 1}: ${outcome.reason}`);
      return;
    }
    if (seen.has(outcome.value.id)) {
      issues.push(`${label} ${index + 1}: duplicate id`);
      return;
    }
    seen.add(outcome.value.id);
    result.push(outcome.value);
  });
  return result;
}

export function sanitizeAvailability(raw, issues) {
  const defaults = defaultAvailability();
  if (!isPlainObject(raw)) {
    if (raw !== undefined) issues.push('availability: invalid, defaults restored');
    return defaults;
  }

  const days = {};
  WEEKDAY_ORDER.forEach((key) => {
    const fallback = defaults.days[key];
    const day = isPlainObject(raw.days) ? raw.days[key] : undefined;
    if (!isPlainObject(day)) {
      issues.push(`availability ${key}: missing, default restored`);
      days[key] = { ...fallback };
      return;
    }
    const validWindow = hasValidTimeRange(day.start, day.end);
    if (!validWindow) issues.push(`availability ${key}: invalid study window, default restored`);
    days[key] = {
      enabled: typeof day.enabled === 'boolean' ? day.enabled : fallback.enabled,
      start: validWindow ? day.start : fallback.start,
      end: validWindow ? day.end : fallback.end,
      maxMinutes: isIntInRange(day.maxMinutes, 0, 1440) ? day.maxMinutes : fallback.maxMinutes,
    };
  });

  return {
    days,
    preferredSessionMinutes: isIntInRange(raw.preferredSessionMinutes, 15, 240)
      ? raw.preferredSessionMinutes
      : defaults.preferredSessionMinutes,
    minBreakMinutes: isIntInRange(raw.minBreakMinutes, 0, 120)
      ? raw.minBreakMinutes
      : defaults.minBreakMinutes,
  };
}

export function sanitizeSettings(raw) {
  const defaults = defaultSettings();
  if (!isPlainObject(raw)) return defaults;
  const focus = isPlainObject(raw.focus) ? raw.focus : {};
  return {
    weekStartsOn:
      raw.weekStartsOn === 0 || raw.weekStartsOn === 1 ? raw.weekStartsOn : defaults.weekStartsOn,
    focus: {
      focusMinutes: isIntInRange(focus.focusMinutes, 1, 180)
        ? focus.focusMinutes
        : defaults.focus.focusMinutes,
      shortBreakMinutes: isIntInRange(focus.shortBreakMinutes, 1, 60)
        ? focus.shortBreakMinutes
        : defaults.focus.shortBreakMinutes,
      longBreakMinutes: isIntInRange(focus.longBreakMinutes, 1, 120)
        ? focus.longBreakMinutes
        : defaults.focus.longBreakMinutes,
      sessionsBeforeLongBreak: isIntInRange(focus.sessionsBeforeLongBreak, 2, 10)
        ? focus.sessionsBeforeLongBreak
        : defaults.focus.sessionsBeforeLongBreak,
    },
  };
}

// Returns a safe, normalized state plus a list of human-readable issues.
// Loading from storage uses the repaired state; importing requires zero issues.
export function sanitizeState(raw) {
  const issues = [];
  if (!isPlainObject(raw)) {
    return { state: createBaseState(), issues: ['data is not an object'] };
  }

  const tasks = sanitizeList(raw.tasks, sanitizeTask, 'task', issues);
  const taskIds = new Set(tasks.map((task) => task.id));

  const sessions = sanitizeList(raw.sessions, sanitizeSession, 'session', issues).filter(
    (session) => {
      // Completed sessions are study records and are always kept.
      if (taskIds.has(session.taskId) || session.status === 'completed') return true;
      issues.push(`session ${session.id}: references a missing task`);
      return false;
    }
  );

  const commitments = sanitizeList(raw.commitments, sanitizeCommitment, 'commitment', issues);
  const availability = sanitizeAvailability(raw.availability, issues);
  const settings = sanitizeSettings(raw.settings);
  const history = sanitizeList(raw.history, sanitizeHistoryEntry, 'history entry', issues).slice(
    0,
    HISTORY_LIMIT
  );

  return { state: { tasks, sessions, commitments, availability, settings, history }, issues };
}