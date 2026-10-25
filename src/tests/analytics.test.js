import { describe, expect, it } from 'vitest';
import {
  getCompletionStats,
  getDailyActivity,
  getSessionCounts,
  getSubjectProgress,
  getTotalStudiedMinutes,
  getWeeklyActivity,
} from '../utils/analytics';
import { NOW, dayKey, makeSession, makeTask } from './helpers';

const sessions = [
  makeSession({
    id: 'c1',
    status: 'completed',
    actualMinutes: 30,
    date: dayKey(-1),
    start: '10:00',
    end: '11:00',
  }),
  makeSession({
    id: 'c2',
    status: 'completed',
    actualMinutes: null,
    date: dayKey(-2),
    start: '10:00',
    end: '10:45',
  }),
  makeSession({ id: 'm1', status: 'missed', date: dayKey(-3), start: '10:00', end: '11:00' }),
  makeSession({ id: 'p1', date: dayKey(2) }),
  makeSession({ id: 'p2', date: dayKey(-1), start: '08:00', end: '09:00' }),
  makeSession({ id: 'r1', date: dayKey(3), rescheduledCount: 2 }),
];

describe('study time', () => {
  it('sums recorded minutes, using the full length when none were recorded', () => {
    expect(getTotalStudiedMinutes(sessions)).toBe(75);
  });

  it('counts partial minutes recorded on missed sessions', () => {
    const partial = makeSession({ id: 'x', status: 'missed', actualMinutes: 10 });
    expect(getTotalStudiedMinutes([partial])).toBe(10);
  });
});

describe('getSessionCounts', () => {
  it('separates completed, upcoming, missed, and rescheduled sessions', () => {
    const counts = getSessionCounts(sessions, NOW);
    expect(counts.completed).toBe(2);
    expect(counts.upcoming).toBe(2);
    // The planned session that already ended counts as missed.
    expect(counts.missed).toBe(2);
    expect(counts.rescheduled).toBe(1);
    expect(counts.missedMinutes).toBe(120);
    expect(counts.completionRate).toBe(0.5);
    expect(counts.total).toBe(6);
  });

  it('has no completion rate before any session has finished', () => {
    const counts = getSessionCounts([makeSession({ date: dayKey(2) })], NOW);
    expect(counts.completionRate).toBeNull();
  });
});

describe('activity over time', () => {
  it('returns the last N days ending today', () => {
    const days = getDailyActivity(sessions, NOW, 3);
    expect(days.map((day) => day.dateKey)).toEqual([dayKey(-2), dayKey(-1), dayKey(0)]);
    expect(days[0]).toMatchObject({ plannedMinutes: 45, completedMinutes: 45, isToday: false });
    expect(days[1]).toMatchObject({ plannedMinutes: 120, completedMinutes: 30 });
    expect(days[2]).toMatchObject({ plannedMinutes: 0, completedMinutes: 0, isToday: true });
  });

  it('returns the last N weeks ending with the current week', () => {
    const weeks = getWeeklyActivity(sessions, NOW, 1, 2);
    expect(weeks.map((week) => week.weekStartKey)).toEqual(['2026-10-05', '2026-10-12']);
    expect(weeks[0]).toMatchObject({ plannedMinutes: 165, completedMinutes: 75, isCurrent: false });
    expect(weeks[1]).toMatchObject({ plannedMinutes: 120, completedMinutes: 0, isCurrent: true });
  });
});

describe('getCompletionStats', () => {
  it('computes the completion rate', () => {
    const stats = getCompletionStats([
      makeTask({ id: 'a', completed: true }),
      makeTask({ id: 'b' }),
      makeTask({ id: 'c' }),
    ]);
    expect(stats).toMatchObject({ total: 3, completed: 1, remaining: 2 });
    expect(stats.rate).toBeCloseTo(1 / 3);
  });

  it('has no rate without tasks', () => {
    expect(getCompletionStats([]).rate).toBeNull();
  });
});

describe('getSubjectProgress', () => {
  it('groups subjects case-insensitively and counts completed tasks as done', () => {
    const tasks = [
      makeTask({ id: 'a', subject: 'Math', estimatedMinutes: 100 }),
      makeTask({ id: 'b', subject: 'math', estimatedMinutes: 100, completed: true }),
      makeTask({ id: 'c', subject: 'Physics', estimatedMinutes: 50 }),
    ];
    const done = [
      makeSession({ id: 's-a', taskId: 'a', status: 'completed', actualMinutes: 50, date: dayKey(-1) }),
      makeSession({ id: 's-b', taskId: 'b', status: 'completed', actualMinutes: 70, date: dayKey(-2) }),
      makeSession({ id: 's-c', taskId: 'c', status: 'completed', actualMinutes: 60, date: dayKey(-1) }),
    ];
    const result = getSubjectProgress(tasks, done);

    expect(result.map((group) => group.subject)).toEqual(['Math', 'Physics']);
    expect(result[0]).toMatchObject({
      targetMinutes: 200,
      doneMinutes: 150,
      studiedMinutes: 120,
      taskCount: 2,
      completedCount: 1,
      percent: 75,
    });
    expect(result[1]).toMatchObject({ targetMinutes: 50, doneMinutes: 50, percent: 100 });
  });
});