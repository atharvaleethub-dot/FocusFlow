import { describe, expect, it } from 'vitest';
import { defaultAvailability } from '../data/schema';
import {
  findFreeSlots,
  findScheduleViolations,
  generateSchedule,
  prioritizeTasks,
} from '../services/scheduler';
import { combineDateAndTime, parseLocalDateTime } from '../utils/dates';
import { getSessionMinutes } from '../utils/stats';
import {
  availabilityWithDays,
  dayKey,
  deadlineAt,
  makeCommitment,
  makeIdGenerator,
  makeSession,
  makeState,
  makeTask,
} from './helpers';

const schedule = (state, options = {}) =>
  generateSchedule(state, { idGenerator: makeIdGenerator(), ...options });

const violationsOf = (state, result) =>
  findScheduleViolations({
    tasks: state.tasks,
    sessions: result.sessions,
    commitments: state.commitments,
    availability: state.availability,
  });

const slotsOf = (result) => result.added.map((s) => [s.date, s.start, s.end]);

describe('prioritizeTasks', () => {
  it('orders by effective deadline, then priority', () => {
    const tasks = [
      makeTask({ id: 'l', priority: 'low', deadline: deadlineAt(1, '12:00') }),
      makeTask({ id: 'm', priority: 'medium', deadline: deadlineAt(1, '12:00') }),
      makeTask({ id: 'h', priority: 'high', deadline: deadlineAt(1, '12:00') }),
      makeTask({ id: 'u', priority: 'urgent', deadline: deadlineAt(2, '12:00') }),
    ];
    expect(prioritizeTasks(tasks).map((t) => t.id)).toEqual(['u', 'h', 'm', 'l']);
  });
});

describe('findFreeSlots', () => {
  it('subtracts commitments and sessions padded with the minimum break', () => {
    const slots = findFreeSlots({
      dateKey: dayKey(0),
      availability: defaultAvailability(),
      commitments: [makeCommitment({ days: ['mon'], start: '17:00', end: '18:00' })],
      sessions: [makeSession({ id: 's', start: '19:00', end: '20:00' })],
    });
    expect(slots).toEqual([
      { start: 960, end: 1020 },
      { start: 1080, end: 1125 },
      { start: 1215, end: 1260 },
    ]);
  });

  it('returns nothing on disabled days and clamps to the earliest minute', () => {
    expect(
      findFreeSlots({
        dateKey: dayKey(0),
        availability: availabilityWithDays({}),
        commitments: [],
        sessions: [],
      })
    ).toEqual([]);
    expect(
      findFreeSlots({
        dateKey: dayKey(0),
        availability: defaultAvailability(),
        commitments: [],
        sessions: [],
        earliestMinute: 1000,
      })
    ).toEqual([{ start: 1000, end: 1260 }]);
  });
});

describe('placement', () => {
  it('places a task inside the study window with a break between sessions', () => {
    const state = makeState({ tasks: [makeTask({ id: 'a', estimatedMinutes: 120 })] });
    const result = schedule(state);
    expect(slotsOf(result)).toEqual([
      [dayKey(0), '16:00', '17:00'],
      [dayKey(0), '17:15', '18:15'],
    ]);
    expect(result.unscheduled).toEqual([]);
    expect(result.summary.success).toBe(true);
  });

  it('respects fixed commitments as protected time', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', deadline: deadlineAt(0) })],
      commitments: [makeCommitment({ days: ['mon'], start: '16:00', end: '18:00' })],
    });
    expect(slotsOf(schedule(state))).toEqual([[dayKey(0), '18:00', '19:00']]);
  });

  it('never schedules after the deadline and reports what does not fit', () => {
    const task = makeTask({ id: 'a', estimatedMinutes: 120, deadline: deadlineAt(0, '17:30') });
    const state = makeState({ tasks: [task] });
    const result = schedule(state);

    expect(slotsOf(result)).toEqual([
      [dayKey(0), '16:00', '17:00'],
      [dayKey(0), '17:15', '17:30'],
    ]);
    result.added.forEach((session) => {
      expect(combineDateAndTime(session.date, session.end) <= parseLocalDateTime(task.deadline)).toBe(
        true
      );
    });
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].shortfallMinutes).toBe(45);
    expect(result.unscheduled[0].reasons[0].code).toBe('insufficient-capacity');
    expect(result.summary.success).toBe(false);
  });

  it('respects the daily study limit and reports the shortfall', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 300, deadline: deadlineAt(1) })],
      availability: availabilityWithDays({
        mon: { maxMinutes: 120 },
        tue: { maxMinutes: 120 },
      }),
    });
    const result = schedule(state);
    const perDay = {};
    result.added.forEach((s) => {
      perDay[s.date] = (perDay[s.date] ?? 0) + getSessionMinutes(s);
    });
    expect(perDay[dayKey(0)]).toBe(120);
    expect(perDay[dayKey(1)]).toBe(120);
    expect(result.unscheduled[0].shortfallMinutes).toBe(60);
    expect(result.unscheduled[0].reasons[0].code).toBe('insufficient-capacity');
  });

  it('splits long tasks and spreads them across days', () => {
    const state = makeState({ tasks: [makeTask({ id: 'a', estimatedMinutes: 150 })] });
    const result = schedule(state);
    expect(result.added.map(getSessionMinutes).sort((x, y) => x - y)).toEqual([30, 60, 60]);
    expect(new Set(result.added.map((s) => s.date)).size).toBe(2);
    expect(result.unscheduled).toEqual([]);
  });

  it('caps one task at two preferred sessions per day when other days are free', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 300, deadline: deadlineAt(4) })],
    });
    const result = schedule(state);
    const perDay = {};
    result.added.forEach((s) => {
      perDay[s.date] = (perDay[s.date] ?? 0) + getSessionMinutes(s);
    });
    Object.values(perDay).forEach((minutes) => expect(minutes).toBeLessThanOrEqual(120));
    expect(result.added.reduce((sum, s) => sum + getSessionMinutes(s), 0)).toBe(300);
  });

  it('absorbs a tiny leftover into the previous session', () => {
    const result = schedule(makeState({ tasks: [makeTask({ id: 'a', estimatedMinutes: 70 })] }));
    expect(result.added).toHaveLength(1);
    expect(getSessionMinutes(result.added[0])).toBe(70);
  });

  it('never starts a session before the current time', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a' })],
      now: new Date(2026, 9, 12, 17, 3),
    });
    expect(slotsOf(schedule(state))).toEqual([[dayKey(0), '17:05', '18:05']]);
  });
});

describe('priority and overload', () => {
  const narrow = availabilityWithDays({
    mon: { start: '16:00', end: '17:00', maxMinutes: 60 },
    tue: { start: '16:00', end: '17:00', maxMinutes: 60 },
  });

  it('plans higher-priority work first when deadlines are equal', () => {
    const state = makeState({
      availability: narrow,
      tasks: [
        makeTask({ id: 'a', priority: 'medium', deadline: deadlineAt(1) }),
        makeTask({ id: 'b', priority: 'urgent', deadline: deadlineAt(1) }),
      ],
    });
    const result = schedule(state);
    expect(result.added.find((s) => s.taskId === 'b').date).toBe(dayKey(0));
    expect(result.added.find((s) => s.taskId === 'a').date).toBe(dayKey(1));
    expect(result.unscheduled).toEqual([]);
  });

  it('leaves the lower-priority task unscheduled when only one fits', () => {
    const state = makeState({
      availability: narrow,
      tasks: [
        makeTask({ id: 'a', priority: 'medium', deadline: deadlineAt(0) }),
        makeTask({ id: 'b', priority: 'urgent', deadline: deadlineAt(0) }),
      ],
    });
    const result = schedule(state);
    expect(result.added.map((s) => s.taskId)).toEqual(['b']);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0].taskId).toBe('a');
    expect(result.unscheduled[0].reasons[0].code).toBe('taken-by-other-tasks');
    expect(result.summary.success).toBe(false);
  });
});

describe('impossible work', () => {
  it('reports a passed deadline', () => {
    const state = makeState({ tasks: [makeTask({ id: 'a', deadline: deadlineAt(-1) })] });
    const result = schedule(state);
    expect(result.added).toEqual([]);
    expect(result.unscheduled[0].reasons[0].code).toBe('deadline-passed');
  });

  it('reports missing availability', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a' })],
      availability: availabilityWithDays({}),
    });
    const result = schedule(state);
    expect(result.added).toEqual([]);
    expect(result.unscheduled[0].reasons[0].code).toBe('no-availability');
    expect(result.summary.success).toBe(false);
  });

  it('skips completed tasks', () => {
    const state = makeState({ tasks: [makeTask({ id: 'a', completed: true })] });
    expect(schedule(state).added).toEqual([]);
  });
});

describe('rescheduling', () => {
  it('replans missed time, keeps completed records untouched, and flags rescheduled sessions', () => {
    const completed = makeSession({
      id: 'done',
      taskId: 'x',
      date: dayKey(-1),
      start: '16:00',
      end: '16:30',
      status: 'completed',
      actualMinutes: 30,
      completedAt: '2026-10-11T16:30:00.000Z',
    });
    const stale = makeSession({ id: 'stale', taskId: 'x', date: dayKey(0), start: '06:00', end: '07:00' });
    const state = makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 120, deadline: deadlineAt(3) })],
      sessions: [completed, stale],
    });
    const result = schedule(state);

    expect(result.sessions.find((s) => s.id === 'done')).toEqual(completed);
    expect(result.sessions.find((s) => s.id === 'stale').status).toBe('missed');
    expect(result.summary.newlyMissedCount).toBe(1);
    expect(result.added.reduce((sum, s) => sum + getSessionMinutes(s), 0)).toBe(90);
    expect(result.added[0].rescheduledCount).toBe(1);
    expect(result.added[1].rescheduledCount).toBe(0);
    expect(violationsOf(state, result)).toEqual([]);
  });

  it('reuses valid future sessions instead of rebuilding them', () => {
    const existing = makeSession({ id: 'keep', taskId: 'x', date: dayKey(1) });
    const state = makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 60 })],
      sessions: [existing],
    });
    const result = schedule(state);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.kept.map((s) => s.id)).toEqual(['keep']);
    expect(result.summary.success).toBe(true);
  });

  it('drops invalid automatic sessions and replans them', () => {
    const bad = makeSession({ id: 'bad', taskId: 'x', date: dayKey(1), start: '16:30', end: '17:30' });
    const state = makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 60 })],
      sessions: [bad],
      commitments: [makeCommitment({ days: ['tue'], start: '16:00', end: '17:00' })],
    });
    const result = schedule(state);
    expect(result.removed[0].reason).toBe('commitment-conflict');
    expect(result.added).toHaveLength(1);
    expect(violationsOf(state, result)).toEqual([]);
  });

  it('keeps locked sessions and plans around them', () => {
    const locked = makeSession({ id: 'lock', taskId: 'x', locked: true, date: dayKey(0) });
    const state = makeState({
      tasks: [
        makeTask({ id: 'x', estimatedMinutes: 60 }),
        makeTask({ id: 'y', estimatedMinutes: 60, deadline: deadlineAt(0) }),
      ],
      sessions: [locked],
    });
    const result = schedule(state);
    expect(result.kept.map((s) => s.id)).toEqual(['lock']);
    expect(result.removed).toEqual([]);
    expect(slotsOf(result)).toEqual([[dayKey(0), '17:15', '18:15']]);
  });

  it('rebuild replans unlocked automatic sessions but never locked or completed ones', () => {
    const completed = makeSession({
      id: 'done',
      taskId: 'z',
      date: dayKey(-1),
      status: 'completed',
      actualMinutes: 60,
    });
    const locked = makeSession({ id: 'lock', taskId: 'x', locked: true, date: dayKey(0) });
    const auto = makeSession({ id: 'auto', taskId: 'z', date: dayKey(1) });
    const state = makeState({
      tasks: [
        makeTask({ id: 'x', estimatedMinutes: 60 }),
        makeTask({ id: 'z', estimatedMinutes: 120 }),
      ],
      sessions: [completed, locked, auto],
    });
    const result = schedule(state, { rebuild: true });

    expect(result.removed.map((r) => r.session.id)).toEqual(['auto']);
    expect(result.removed[0].reason).toBe('rebuild');
    expect(result.kept.map((s) => s.id)).toEqual(['lock']);
    expect(result.sessions.find((s) => s.id === 'done')).toEqual(completed);
    expect(result.added.reduce((sum, s) => sum + getSessionMinutes(s), 0)).toBe(60);
    expect(violationsOf(state, result)).toEqual([]);
  });

  it('keeps a manual session outside availability but drops an automatic one', () => {
    const manual = makeSession({
      id: 'manual',
      taskId: 'x',
      source: 'manual',
      date: dayKey(5),
      start: '07:00',
      end: '08:00',
    });
    const auto = makeSession({
      id: 'auto',
      taskId: 'x',
      source: 'auto',
      date: dayKey(5),
      start: '08:30',
      end: '09:30',
    });
    const state = makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 120, deadline: deadlineAt(10) })],
      sessions: [manual, auto],
    });
    const result = schedule(state);
    expect(result.kept.map((s) => s.id)).toEqual(['manual']);
    expect(result.removed.map((r) => [r.session.id, r.reason])).toEqual([
      ['auto', 'outside-availability'],
    ]);
    expect(result.added.reduce((sum, s) => sum + getSessionMinutes(s), 0)).toBe(60);
  });

  it('removes sessions whose task is completed', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'x', completed: true })],
      sessions: [makeSession({ id: 'orphan', taskId: 'x', date: dayKey(1) })],
    });
    const result = schedule(state);
    expect(result.removed[0].reason).toBe('task-unavailable');
    expect(result.sessions).toEqual([]);
  });
});

describe('guarantees', () => {
  const busyState = () =>
    makeState({
      tasks: [
        makeTask({ id: 'a', estimatedMinutes: 120, priority: 'urgent', deadline: deadlineAt(1) }),
        makeTask({ id: 'b', estimatedMinutes: 180, priority: 'high', deadline: deadlineAt(2) }),
        makeTask({ id: 'c', estimatedMinutes: 90, priority: 'medium', deadline: deadlineAt(3) }),
        makeTask({ id: 'd', estimatedMinutes: 240, priority: 'low', deadline: deadlineAt(5) }),
        makeTask({ id: 'e', estimatedMinutes: 60, priority: 'medium', deadline: deadlineAt(7) }),
      ],
      commitments: [
        makeCommitment({
          id: 'college',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start: '08:30',
          end: '15:00',
        }),
        makeCommitment({ id: 'gym', days: ['tue', 'thu'], start: '17:00', end: '18:00' }),
        makeCommitment({
          id: 'dinner',
          days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          start: '19:30',
          end: '20:15',
        }),
      ],
    });

  it('never produces overlaps, commitment clashes, late sessions, or out-of-window sessions', () => {
    const state = busyState();
    const result = schedule(state);
    expect(result.added.length).toBeGreaterThan(0);
    expect(violationsOf(state, result)).toEqual([]);
  });

  it('is deterministic for identical input', () => {
    const state = busyState();
    const first = generateSchedule(state, { idGenerator: makeIdGenerator() });
    const second = generateSchedule(state, { idGenerator: makeIdGenerator() });
    expect(second).toEqual(first);
  });

  it('does not change its input', () => {
    const state = busyState();
    const before = JSON.stringify(state);
    schedule(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('findScheduleViolations', () => {
  it('detects overlaps, commitment clashes, and late sessions', () => {
    const tasks = [makeTask({ id: 'task-1', deadline: deadlineAt(0, '17:00') })];
    const sessions = [
      makeSession({ id: 'a', start: '16:00', end: '17:00' }),
      makeSession({ id: 'b', start: '16:30', end: '17:30' }),
    ];
    const violations = findScheduleViolations({
      tasks,
      sessions,
      commitments: [makeCommitment({ days: ['mon'], start: '16:45', end: '17:15' })],
      availability: defaultAvailability(),
    });
    const codes = violations.map((v) => v.code);
    expect(codes).toContain('session-overlap');
    expect(codes).toContain('commitment-overlap');
    expect(codes).toContain('after-deadline');
  });
});