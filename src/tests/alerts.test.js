import { describe, expect, it } from 'vitest';
import { generateSchedule } from '../services/scheduler';
import { getScheduleAlerts } from '../utils/alerts';
import {
  NOW,
  dayKey,
  deadlineAt,
  makeCommitment,
  makeIdGenerator,
  makeSession,
  makeState,
  makeTask,
} from './helpers';

const alertsFor = (state) =>
  getScheduleAlerts({
    tasks: state.tasks,
    sessions: state.sessions,
    commitments: state.commitments,
    availability: state.availability,
    now: NOW,
  });

const types = (alerts) => alerts.map((item) => item.type);

describe('getScheduleAlerts', () => {
  it('flags overdue tasks as dangerous', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', deadline: deadlineAt(-1, '18:00') })],
    });
    const alerts = alertsFor(state);
    expect(types(alerts)).toEqual(['overdue']);
    expect(alerts[0].severity).toBe('danger');
    expect(alerts[0].title).toContain('overdue');
  });

  it('warns about deadlines within 48 hours', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 60, deadline: deadlineAt(1, '12:00') })],
      sessions: [makeSession({ id: 's', taskId: 'a', date: dayKey(0) })],
    });
    const alerts = alertsFor(state);
    expect(types(alerts)).toEqual(['due-soon']);
    expect(alerts[0].message).toContain('scheduled');
  });

  it('reports tasks without enough free time before the deadline', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 600, deadline: deadlineAt(0, '17:30') })],
    });
    const alerts = alertsFor(state);
    expect(types(alerts)).toContain('insufficient-capacity');
    expect(alerts.find((item) => item.type === 'insufficient-capacity').severity).toBe('danger');
  });

  it('groups tasks that simply are not scheduled yet into one suggestion', () => {
    const state = makeState({
      tasks: [
        makeTask({ id: 'a', estimatedMinutes: 60, deadline: deadlineAt(5) }),
        makeTask({ id: 'b', estimatedMinutes: 60, deadline: deadlineAt(6) }),
      ],
    });
    const pending = alertsFor(state).filter((item) => item.type === 'unscheduled');
    expect(pending).toHaveLength(1);
    expect(pending[0].action).toBe('generate');
    expect(pending[0].title).toContain('2 tasks');
  });

  it('detects sessions that overlap a fixed commitment', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 60, deadline: deadlineAt(5) })],
      sessions: [makeSession({ id: 's', taskId: 'a', date: dayKey(1), start: '16:00', end: '17:00' })],
      commitments: [makeCommitment({ days: ['tue'], start: '16:30', end: '17:30' })],
    });
    expect(types(alertsFor(state))).toContain('conflict');
  });

  it('flags planned sessions that already ended', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 60, deadline: deadlineAt(5) })],
      sessions: [makeSession({ id: 's', taskId: 'a', date: dayKey(-1) })],
    });
    const stale = alertsFor(state).find((item) => item.type === 'stale');
    expect(stale.action).toBe('reschedule');
  });

  it('puts the most severe warnings first', () => {
    const state = makeState({
      tasks: [
        makeTask({ id: 'late', deadline: deadlineAt(-1, '18:00') }),
        makeTask({ id: 'far', estimatedMinutes: 60, deadline: deadlineAt(6) }),
      ],
    });
    const alerts = alertsFor(state);
    expect(alerts[0].type).toBe('overdue');
    expect(alerts[alerts.length - 1].severity).toBe('info');
  });

  it('has no warnings for a healthy schedule', () => {
    const state = makeState({
      tasks: [
        makeTask({ id: 'a', estimatedMinutes: 120, deadline: deadlineAt(5) }),
        makeTask({ id: 'b', estimatedMinutes: 90, deadline: deadlineAt(6) }),
      ],
    });
    const plan = generateSchedule(state, { idGenerator: makeIdGenerator() });
    expect(plan.summary.success).toBe(true);
    expect(alertsFor({ ...state, sessions: plan.sessions })).toEqual([]);
  });
});