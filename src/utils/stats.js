import {
  combineDateAndTime,
  formatLocalDateTime,
  timeToMinutes,
  toDateKey,
} from './dates';

export const compareSessions = (a, b) =>
  a.date.localeCompare(b.date) || a.start.localeCompare(b.start);

export function getSessionMinutes(session) {
  return timeToMinutes(session.end) - timeToMinutes(session.start);
}

// Time actually studied: recorded minutes, or the full length of a completed session.
export function getStudiedMinutes(session) {
  if (session.actualMinutes !== null && session.actualMinutes !== undefined) {
    return session.actualMinutes;
  }
  return session.status === 'completed' ? getSessionMinutes(session) : 0;
}

export function getTaskStudiedMinutes(taskId, sessions) {
  return sessions
    .filter((session) => session.taskId === taskId)
    .reduce((sum, session) => sum + getStudiedMinutes(session), 0);
}

export function getTaskRemainingMinutes(task, sessions) {
  if (task.completed) return 0;
  return Math.max(0, task.estimatedMinutes - getTaskStudiedMinutes(task.id, sessions));
}

export function getWeeklyTotals(sessions, weekDateKeys) {
  const keys = new Set(weekDateKeys);
  return sessions
    .filter((session) => keys.has(session.date))
    .reduce(
      (totals, session) => {
        if (session.status !== 'missed') {
          totals.plannedMinutes += getSessionMinutes(session);
          totals.sessionCount += 1;
        }
        totals.completedMinutes += getStudiedMinutes(session);
        return totals;
      },
      { plannedMinutes: 0, completedMinutes: 0, sessionCount: 0 }
    );
}

export function getDailyTotals(sessions, weekDateKeys) {
  return weekDateKeys.map((dateKey) => {
    const daySessions = sessions.filter((session) => session.date === dateKey);
    return {
      dateKey,
      plannedMinutes: daySessions
        .filter((session) => session.status !== 'missed')
        .reduce((sum, session) => sum + getSessionMinutes(session), 0),
      completedMinutes: daySessions.reduce((sum, session) => sum + getStudiedMinutes(session), 0),
    };
  });
}

export function getTaskCounts(tasks) {
  const completed = tasks.filter((task) => task.completed).length;
  return { completed, remaining: tasks.length - completed, total: tasks.length };
}

export function sortByDeadline(tasks) {
  // Deadlines are 'YYYY-MM-DDTHH:mm', so string order equals time order.
  return [...tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));
}

export function getOverdueTasks(tasks, now = new Date()) {
  const nowKey = formatLocalDateTime(now);
  return sortByDeadline(tasks.filter((task) => !task.completed && task.deadline < nowKey));
}

export function getUpcomingDeadlines(tasks, now = new Date(), limit = 5) {
  const nowKey = formatLocalDateTime(now);
  return sortByDeadline(tasks.filter((task) => !task.completed && task.deadline >= nowKey)).slice(
    0,
    limit
  );
}

// Incomplete, not overdue, with work remaining but no planned session.
export function getUnscheduledTasks(tasks, sessions, now = new Date()) {
  const nowKey = formatLocalDateTime(now);
  const scheduledTaskIds = new Set(
    sessions.filter((session) => session.status === 'planned').map((session) => session.taskId)
  );
  return sortByDeadline(
    tasks.filter(
      (task) =>
        !task.completed &&
        task.deadline >= nowKey &&
        !scheduledTaskIds.has(task.id) &&
        getTaskRemainingMinutes(task, sessions) > 0
    )
  );
}

export function getTodaySessions(sessions, now = new Date()) {
  const todayKey = toDateKey(now);
  return sessions.filter((session) => session.date === todayKey).sort(compareSessions);
}

export function getUpcomingSessions(sessions, now = new Date(), limit = 5) {
  return sessions
    .filter(
      (session) =>
        session.status === 'planned' && combineDateAndTime(session.date, session.end) > now
    )
    .sort(compareSessions)
    .slice(0, limit);
}