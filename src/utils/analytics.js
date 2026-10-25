import {
  addDays,
  combineDateAndTime,
  getWeekDateKeys,
  startOfDay,
  startOfWeek,
  toDateKey,
} from './dates';
import {
  getDailyTotals,
  getSessionMinutes,
  getStudiedMinutes,
  getTaskStudiedMinutes,
  getWeeklyTotals,
} from './stats';

export function getTotalStudiedMinutes(sessions) {
  return sessions.reduce((sum, session) => sum + getStudiedMinutes(session), 0);
}

// A planned session whose end has passed counts as missed: it ended without being completed.
export function getSessionCounts(sessions, now = new Date()) {
  let completed = 0;
  let upcoming = 0;
  let missed = 0;
  let rescheduled = 0;
  let missedMinutes = 0;

  sessions.forEach((session) => {
    if (session.rescheduledCount > 0) rescheduled += 1;

    if (session.status === 'completed') {
      completed += 1;
    } else if (session.status === 'planned' && combineDateAndTime(session.date, session.end) > now) {
      upcoming += 1;
    } else {
      missed += 1;
      missedMinutes += getSessionMinutes(session);
    }
  });

  const finished = completed + missed;
  return {
    completed,
    upcoming,
    missed,
    rescheduled,
    missedMinutes,
    total: sessions.length,
    completionRate: finished > 0 ? completed / finished : null,
  };
}

// The last `days` days, ending today, oldest first.
export function getDailyActivity(sessions, now, days) {
  const today = startOfDay(now);
  const todayKey = toDateKey(now);
  const keys = Array.from({ length: days }, (_, index) =>
    toDateKey(addDays(today, index - (days - 1)))
  );
  return getDailyTotals(sessions, keys).map((day) => ({ ...day, isToday: day.dateKey === todayKey }));
}

// The last `weeks` weeks, ending with the current week, oldest first.
export function getWeeklyActivity(sessions, now, weekStartsOn, weeks) {
  const thisWeek = startOfWeek(now, weekStartsOn);
  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(thisWeek, (index - (weeks - 1)) * 7);
    const totals = getWeeklyTotals(sessions, getWeekDateKeys(start));
    return {
      weekStartKey: toDateKey(start),
      plannedMinutes: totals.plannedMinutes,
      completedMinutes: totals.completedMinutes,
      isCurrent: index === weeks - 1,
    };
  });
}

export function getCompletionStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  return { total, completed, remaining: total - completed, rate: total > 0 ? completed / total : null };
}

// Groups tasks by subject (case-insensitive). Completed tasks count as fully done.
// Time recorded on deleted tasks is part of the total study time but not of any subject.
export function getSubjectProgress(tasks, sessions) {
  const groups = new Map();

  tasks.forEach((task) => {
    const key = task.subject.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        subject: task.subject,
        targetMinutes: 0,
        doneMinutes: 0,
        studiedMinutes: 0,
        taskCount: 0,
        completedCount: 0,
      });
    }
    const group = groups.get(key);
    const studied = getTaskStudiedMinutes(task.id, sessions);
    group.targetMinutes += task.estimatedMinutes;
    group.doneMinutes += task.completed
      ? task.estimatedMinutes
      : Math.min(studied, task.estimatedMinutes);
    group.studiedMinutes += studied;
    group.taskCount += 1;
    if (task.completed) group.completedCount += 1;
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      percent:
        group.targetMinutes > 0 ? Math.round((group.doneMinutes / group.targetMinutes) * 100) : 0,
    }))
    .sort((a, b) => b.studiedMinutes - a.studiedMinutes || a.subject.localeCompare(b.subject));
}