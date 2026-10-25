import { createTask } from '../data/schema';
import { combineDateAndTime, parseLocalDateTime } from '../utils/dates';

// Pure state transformations. Each returns { state, ...info } and never mutates its input.

export function addTaskToState(state, values, now = new Date()) {
  const task = createTask({
    title: values.title,
    subject: values.subject,
    notes: values.notes,
    estimatedMinutes: values.estimatedMinutes,
    deadline: values.deadline,
    priority: values.priority,
    createdAt: now.toISOString(),
  });
  return { state: { ...state, tasks: [...state.tasks, task] }, task };
}

export function updateTaskInState(state, taskId, values) {
  const existing = state.tasks.find((task) => task.id === taskId);
  if (!existing) {
    return { state, task: null, removedSessions: 0, lockedAfterDeadline: 0 };
  }

  const task = {
    ...existing,
    title: values.title,
    subject: values.subject,
    notes: values.notes,
    estimatedMinutes: values.estimatedMinutes,
    deadline: values.deadline,
    priority: values.priority,
  };

  // Planned work must never end after the deadline. Locked sessions are kept but reported.
  const deadline = parseLocalDateTime(task.deadline);
  let removedSessions = 0;
  let lockedAfterDeadline = 0;
  const sessions = state.sessions.filter((session) => {
    if (session.taskId !== taskId || session.status !== 'planned') return true;
    const end = combineDateAndTime(session.date, session.end);
    if (end <= deadline) return true;
    if (session.locked) {
      lockedAfterDeadline += 1;
      return true;
    }
    removedSessions += 1;
    return false;
  });

  return {
    state: {
      ...state,
      tasks: state.tasks.map((item) => (item.id === taskId ? task : item)),
      sessions,
    },
    task,
    removedSessions,
    lockedAfterDeadline,
  };
}

export function setTaskCompletedInState(state, taskId, completed, now = new Date()) {
  const existing = state.tasks.find((task) => task.id === taskId);
  if (!existing || existing.completed === completed) {
    return { state, task: existing || null, removedSessions: 0 };
  }

  const task = {
    ...existing,
    completed,
    completedAt: completed ? now.toISOString() : null,
  };

  let sessions = state.sessions;
  let removedSessions = 0;
  if (completed) {
    // Only future/planned work is removed. Completed and missed records are untouched.
    sessions = state.sessions.filter(
      (session) => !(session.taskId === taskId && session.status === 'planned')
    );
    removedSessions = state.sessions.length - sessions.length;
  }

  return {
    state: {
      ...state,
      tasks: state.tasks.map((item) => (item.id === taskId ? task : item)),
      sessions,
    },
    task,
    removedSessions,
  };
}

export function deleteTaskFromState(state, taskId) {
  const existing = state.tasks.find((task) => task.id === taskId);
  if (!existing) return { state, task: null, removedSessions: 0, keptRecords: 0 };

  const own = state.sessions.filter((session) => session.taskId === taskId);
  const keptRecords = own.filter((session) => session.status === 'completed').length;
  const removedSessions = own.length - keptRecords;

  return {
    state: {
      ...state,
      tasks: state.tasks.filter((task) => task.id !== taskId),
      // Completed sessions stay as study history.
      sessions: state.sessions.filter(
        (session) => session.taskId !== taskId || session.status === 'completed'
      ),
    },
    task: existing,
    removedSessions,
    keptRecords,
  };
}