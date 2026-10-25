import { HISTORY_LIMIT, createHistoryEntry } from '../data/schema';
import { compareSessions } from '../utils/stats';

// Consecutive moves of the same session inside this window merge into one history entry.
export const COALESCE_WINDOW_MS = 60 * 1000;

// Time actually studied: completed sessions and anything with recorded minutes.
const isStudyRecord = (session) =>
  session.status === 'completed' || (session.actualMinutes ?? 0) > 0;

// Saves a snapshot of the sessions as they are NOW, so call it with the state BEFORE the change.
export function pushHistory(state, { action, label, coalesce = false }, now = new Date()) {
  const history = state.history ?? [];
  const latest = history[0];

  if (
    coalesce &&
    latest &&
    latest.action === action &&
    now.getTime() - Date.parse(latest.createdAt) < COALESCE_WINDOW_MS
  ) {
    // Keep the earlier snapshot, so one undo returns to before the first move.
    return {
      ...state,
      history: [{ ...latest, label, createdAt: now.toISOString() }, ...history.slice(1)],
    };
  }

  const entry = {
    ...createHistoryEntry({ action, label, snapshot: { tasks: [], sessions: state.sessions } }),
    createdAt: now.toISOString(),
  };
  return { ...state, history: [entry, ...history].slice(0, HISTORY_LIMIT) };
}

// Wraps the result of a pure action ({ state, ...info }) with a history entry.
// Nothing is recorded when the action changed nothing.
export function withHistory(previous, info, result, now = new Date()) {
  if (result.state === previous) return result;
  const recorded = pushHistory(previous, info, now);
  return { ...result, state: { ...result.state, history: recorded.history } };
}

// Study records survive an undo (the current version wins). Other sessions come back
// from the snapshot, except those whose task was deleted or completed since.
export function restoreSessions(snapshotSessions, currentSessions, tasks) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const restored = [];
  const kept = new Set();

  currentSessions.forEach((session) => {
    if (isStudyRecord(session)) {
      restored.push(session);
      kept.add(session.id);
    }
  });

  snapshotSessions.forEach((session) => {
    if (kept.has(session.id)) return;
    if (isStudyRecord(session)) {
      restored.push(session);
      return;
    }
    const task = taskById.get(session.taskId);
    if (!task || task.completed) return;
    restored.push(session);
  });

  return restored.sort(compareSessions);
}

// Undoes the most recent entry. It pops the entry and records nothing new, so there is no recursion.
export function undoLastHistory(state) {
  const history = state.history ?? [];
  if (history.length === 0) return { state, undone: null };

  const [entry, ...rest] = history;
  return {
    state: {
      ...state,
      sessions: restoreSessions(entry.snapshot.sessions, state.sessions, state.tasks),
      history: rest,
    },
    undone: entry,
  };
}