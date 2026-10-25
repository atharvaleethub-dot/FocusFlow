import { PRIORITY_META } from '../data/schema';
import { formatLocalDateTime, parseLocalDateTime } from './dates';
import { getTaskRemainingMinutes, getTaskStudiedMinutes } from './stats';

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
  { value: 'overdue', label: 'Overdue' },
];

export const SORT_OPTIONS = [
  { value: 'deadline', label: 'Deadline (soonest)' },
  { value: 'priority', label: 'Priority (highest)' },
  { value: 'remaining', label: 'Remaining time' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: 'created', label: 'Recently added' },
];

export const DEFAULT_FILTERS = {
  search: '',
  status: 'active',
  subject: 'all',
  priority: 'all',
  sort: 'deadline',
};

const HOUR_MS = 3600000;
const DUE_SOON_HOURS = 48;

export function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function getSubjects(tasks) {
  const seen = new Map();
  tasks.forEach((task) => {
    const key = task.subject.toLowerCase();
    if (!seen.has(key)) seen.set(key, task.subject);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function isOverdue(task, now = new Date()) {
  return !task.completed && task.deadline < formatLocalDateTime(now);
}

export function getStatusCounts(tasks, now = new Date()) {
  return {
    all: tasks.length,
    active: tasks.filter((task) => !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
    overdue: tasks.filter((task) => isOverdue(task, now)).length,
  };
}

function formatSpan(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return pluralize(Math.floor(hours / 24), 'day');
}

// state: completed | overdue | soon | upcoming | unknown
export function getDeadlineInfo(task, now = new Date()) {
  if (task.completed) return { state: 'completed', label: null, relative: '', tone: 'neutral' };

  const deadline = parseLocalDateTime(task.deadline);
  if (!deadline) return { state: 'unknown', label: null, relative: '', tone: 'neutral' };

  const diff = deadline - now;
  const span = formatSpan(Math.abs(diff));
  if (diff < 0) {
    return { state: 'overdue', label: 'Overdue', relative: `${span} overdue`, tone: 'danger' };
  }
  if (diff <= DUE_SOON_HOURS * HOUR_MS) {
    return { state: 'soon', label: 'Due soon', relative: `in ${span}`, tone: 'warning' };
  }
  return { state: 'upcoming', label: null, relative: `in ${span}`, tone: 'neutral' };
}

export function getTaskProgress(task, sessions) {
  const studied = getTaskStudiedMinutes(task.id, sessions);
  const remaining = getTaskRemainingMinutes(task, sessions);
  const percent = task.completed
    ? 100
    : Math.min(100, Math.round((studied / task.estimatedMinutes) * 100));
  const plannedSessions = sessions.filter(
    (session) => session.taskId === task.id && session.status === 'planned'
  ).length;
  return { studied, remaining, percent, plannedSessions };
}

export function filterAndSortTasks(tasks, sessions, filters, now = new Date()) {
  const query = filters.search.trim().toLowerCase();
  const subject = filters.subject.toLowerCase();

  const filtered = tasks.filter((task) => {
    if (filters.status === 'active' && task.completed) return false;
    if (filters.status === 'completed' && !task.completed) return false;
    if (filters.status === 'overdue' && !isOverdue(task, now)) return false;
    if (filters.subject !== 'all' && task.subject.toLowerCase() !== subject) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (query) {
      const haystack = `${task.title} ${task.subject} ${task.notes}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const remaining = new Map(
    filtered.map((task) => [task.id, getTaskRemainingMinutes(task, sessions)])
  );
  const byDeadline = (a, b) => a.deadline.localeCompare(b.deadline);

  const comparators = {
    deadline: byDeadline,
    priority: (a, b) =>
      PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || byDeadline(a, b),
    remaining: (a, b) => remaining.get(b.id) - remaining.get(a.id) || byDeadline(a, b),
    title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  };
  const compare = comparators[filters.sort] || comparators.deadline;

  // Completed tasks always sink to the bottom; ties fall back to id for a stable order.
  return filtered.sort(
    (a, b) => Number(a.completed) - Number(b.completed) || compare(a, b) || a.id.localeCompare(b.id)
  );
}