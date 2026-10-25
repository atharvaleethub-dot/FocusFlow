import { createId } from '../utils/ids';

/*
 * DATA MODEL (all dates and times are LOCAL, never UTC)
 *
 * Task         { id, title, subject, notes, estimatedMinutes,
 *                deadline: 'YYYY-MM-DDTHH:mm', priority, createdAt: ISO,
 *                completed, completedAt: ISO | null }
 * Session      { id, taskId, date: 'YYYY-MM-DD', start: 'HH:MM', end: 'HH:MM',
 *                status: planned | completed | missed, locked,
 *                source: manual | auto | timer, actualMinutes: number | null,
 *                completedAt: ISO | null, rescheduledCount }
 * Commitment   { id, title, category, repeat: weekly | once,
 *                days: ['mon', ...], date: 'YYYY-MM-DD' | null, start, end }
 * Availability { days: { mon: { enabled, start, end, maxMinutes }, ... sun },
 *                preferredSessionMinutes, minBreakMinutes }
 * Settings     { weekStartsOn: 0 | 1,
 *                focus: { focusMinutes, shortBreakMinutes, longBreakMinutes,
 *                         sessionsBeforeLongBreak } }
 * HistoryEntry { id, createdAt: ISO, action, label,
 *                snapshot: { tasks, sessions } }   (newest first, max 20)
 *
 * Studied time is always derived from sessions (actualMinutes); it is never
 * stored on the task, so completed study records cannot drift out of sync.
 */

export const STORAGE_VERSION = 1;
export const HISTORY_LIMIT = 20;

export const LIMITS = {
  titleMax: 120,
  subjectMax: 60,
  notesMax: 1000,
  minEstimate: 5,
  maxEstimate: 6000,
};

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
export const PRIORITY_META = {
  low: { label: 'Low', tone: 'neutral', rank: 1 },
  medium: { label: 'Medium', tone: 'brand', rank: 2 },
  high: { label: 'High', tone: 'warning', rank: 3 },
  urgent: { label: 'Urgent', tone: 'danger', rank: 4 },
};

export const SESSION_STATUSES = ['planned', 'completed', 'missed'];
export const SESSION_SOURCES = ['manual', 'auto', 'timer'];
export const COMMITMENT_CATEGORIES = ['class', 'work', 'meal', 'travel', 'other'];
export const COMMITMENT_REPEATS = ['weekly', 'once'];

export function createTask({
  id = createId('task'),
  title,
  subject = 'General',
  notes = '',
  estimatedMinutes,
  deadline,
  priority = 'medium',
  createdAt = new Date().toISOString(),
  completed = false,
  completedAt = null,
}) {
  return {
    id,
    title,
    subject,
    notes,
    estimatedMinutes,
    deadline,
    priority,
    createdAt,
    completed,
    completedAt,
  };
}

export function createSession({
  id = createId('session'),
  taskId,
  date,
  start,
  end,
  status = 'planned',
  locked = false,
  source = 'manual',
  actualMinutes = null,
  completedAt = null,
  rescheduledCount = 0,
}) {
  return {
    id,
    taskId,
    date,
    start,
    end,
    status,
    locked,
    source,
    actualMinutes,
    completedAt,
    rescheduledCount,
  };
}

export function createCommitment({
  id = createId('commitment'),
  title,
  category = 'other',
  repeat = 'weekly',
  days = [],
  date = null,
  start,
  end,
}) {
  return { id, title, category, repeat, days, date, start, end };
}

export function createHistoryEntry({ action, label, snapshot }) {
  return {
    id: createId('history'),
    createdAt: new Date().toISOString(),
    action,
    label,
    snapshot,
  };
}

export function defaultAvailability() {
  const weekday = { enabled: true, start: '16:00', end: '21:00', maxMinutes: 180 };
  return {
    days: {
      mon: { ...weekday },
      tue: { ...weekday },
      wed: { ...weekday },
      thu: { ...weekday },
      fri: { ...weekday },
      sat: { enabled: true, start: '10:00', end: '16:00', maxMinutes: 240 },
      sun: { enabled: true, start: '10:00', end: '14:00', maxMinutes: 120 },
    },
    preferredSessionMinutes: 60,
    minBreakMinutes: 15,
  };
}

export function defaultSettings() {
  return {
    weekStartsOn: 1,
    focus: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    },
  };
}

export function createBaseState() {
  return {
    tasks: [],
    sessions: [],
    commitments: [],
    availability: defaultAvailability(),
    settings: defaultSettings(),
    history: [],
  };
}