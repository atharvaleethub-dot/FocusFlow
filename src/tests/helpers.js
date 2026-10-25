import {
  createCommitment,
  createSession,
  createTask,
  defaultAvailability,
} from '../data/schema';
import { addDays, startOfDay, toDateKey } from '../utils/dates';

// Fixed "now": Monday 12 Oct 2026, 08:00 local time.
export const NOW = new Date(2026, 9, 12, 8, 0);

export const dayKey = (offset) => toDateKey(addDays(startOfDay(NOW), offset));
export const deadlineAt = (offset, time = '23:59') => `${dayKey(offset)}T${time}`;

export function makeTask(overrides = {}) {
  const id = overrides.id ?? 'task-1';
  return createTask({
    id,
    title: id,
    subject: 'Test',
    estimatedMinutes: 60,
    priority: 'medium',
    deadline: deadlineAt(3),
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  });
}

export function makeSession(overrides = {}) {
  return createSession({
    id: 'session-1',
    taskId: 'task-1',
    date: dayKey(0),
    start: '16:00',
    end: '17:00',
    source: 'auto',
    ...overrides,
  });
}

export function makeCommitment(overrides = {}) {
  return createCommitment({
    id: 'commitment-1',
    title: 'Class',
    category: 'class',
    repeat: 'weekly',
    days: ['mon'],
    start: '09:00',
    end: '10:00',
    ...overrides,
  });
}

// Only the listed weekdays are enabled; `spec` values override the 16:00-21:00 / 180 min defaults.
export function availabilityWithDays(spec, extra = {}) {
  const base = defaultAvailability();
  const days = {};
  Object.keys(base.days).forEach((key) => {
    days[key] = { ...base.days[key], enabled: false };
  });
  Object.entries(spec).forEach(([key, value]) => {
    days[key] = { enabled: true, start: '16:00', end: '21:00', maxMinutes: 180, ...value };
  });
  return { ...base, ...extra, days };
}

export function makeState(overrides = {}) {
  return {
    tasks: [],
    sessions: [],
    commitments: [],
    availability: defaultAvailability(),
    now: NOW,
    ...overrides,
  };
}

export function makeIdGenerator(prefix = 'new') {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}