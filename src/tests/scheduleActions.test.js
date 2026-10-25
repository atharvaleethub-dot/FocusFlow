import { describe, expect, it } from 'vitest';
import { applySchedulePlan, hasPlanChanges } from '../services/scheduleActions';
import { generateSchedule } from '../services/scheduler';
import { getStalePlannedSessions } from '../utils/scheduleStatus';
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

const basisOf = (state) => ({
  tasks: state.tasks,
  sessions: state.sessions,
  commitments: state.commitments,
  availability: state.availability,
});

const plan = (state, options = {}) =>
  generateSchedule(state, { idGenerator: makeIdGenerator(), ...options });

describe('applySchedulePlan', () => {
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
  const stale = makeSession({
    id: 'stale',
    taskId: 'x',
    date: dayKey(0),
    start: '06:00',
    end: '07:00',
  });
  const state = {
    ...makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 120 })],
      sessions: [completed, stale],
    }),
    settings: { weekStartsOn: 1 },
    history: [],
  };

  it('replaces the sessions with the plan and leaves everything else alone', () => {
    const proposed = plan(state);
    const outcome = applySchedulePlan(state, proposed, basisOf(state));

    expect(outcome.applied).toBe(true);
    expect(outcome.state.sessions).toBe(proposed.sessions);
    expect(outcome.state.tasks).toBe(state.tasks);
    expect(outcome.state.settings).toBe(state.settings);
    expect(outcome.state.sessions.find((s) => s.id === 'done')).toEqual(completed);
    expect(outcome.state.sessions.find((s) => s.id === 'stale').status).toBe('missed');
  });

  it('refuses to apply a plan when the data changed after the preview', () => {
    const proposed = plan(state);
    const changed = { ...state, sessions: [...state.sessions] };
    const outcome = applySchedulePlan(changed, proposed, basisOf(state));

    expect(outcome.applied).toBe(false);
    expect(outcome.state).toBe(changed);
  });
});

describe('hasPlanChanges', () => {
  it('is false when the schedule is already up to date', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 60 })],
      sessions: [makeSession({ id: 'keep', taskId: 'x', date: dayKey(1) })],
    });
    expect(hasPlanChanges(plan(state))).toBe(false);
  });

  it('is true when sessions would be added', () => {
    const state = makeState({ tasks: [makeTask({ id: 'x', estimatedMinutes: 60 })] });
    expect(hasPlanChanges(plan(state))).toBe(true);
  });
});

describe('getStalePlannedSessions', () => {
  it('returns only planned sessions that have already ended', () => {
    const sessions = [
      makeSession({ id: 'past-planned', date: dayKey(-1) }),
      makeSession({ id: 'future-planned', date: dayKey(1) }),
      makeSession({ id: 'past-done', date: dayKey(-1), status: 'completed' }),
      makeSession({ id: 'past-missed', date: dayKey(-1), status: 'missed' }),
    ];
    expect(getStalePlannedSessions(sessions, NOW).map((s) => s.id)).toEqual(['past-planned']);
  });
});

describe('plan, apply, plan again', () => {
  it('is idempotent: applying a plan and planning again changes nothing', () => {
    const state = makeState({
      tasks: [
        makeTask({ id: 'a', estimatedMinutes: 120, priority: 'urgent', deadline: deadlineAt(1) }),
        makeTask({ id: 'b', estimatedMinutes: 180, priority: 'high', deadline: deadlineAt(2) }),
        makeTask({ id: 'c', estimatedMinutes: 90, priority: 'medium', deadline: deadlineAt(3) }),
        makeTask({ id: 'z', estimatedMinutes: 6000, priority: 'medium', deadline: deadlineAt(1) }),
      ],
      commitments: [
        makeCommitment({
          id: 'college',
          days: ['mon', 'tue', 'wed', 'thu', 'fri'],
          start: '08:30',
          end: '15:00',
        }),
        makeCommitment({
          id: 'dinner',
          days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
          start: '19:30',
          end: '20:15',
        }),
      ],
    });

    const first = plan(state);
    expect(first.added.length).toBeGreaterThan(0);
    expect(first.summary.success).toBe(false);

    const second = plan({ ...state, sessions: first.sessions });
    expect(second.added).toEqual([]);
    expect(second.removed).toEqual([]);
    expect(second.newlyMissed).toEqual([]);
    expect(second.summary.unscheduledCount).toBe(first.summary.unscheduledCount);
  });
});