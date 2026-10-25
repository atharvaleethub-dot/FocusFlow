import { describe, expect, it } from 'vitest';
import { buildTimerSessionTimes, recordFocusSession } from '../services/focusActions';
import { NOW, dayKey, makeSession, makeState, makeTask } from './helpers';

const MIN = 60000;
const at = (hours, minutes) => new Date(2026, 9, 12, hours, minutes).getTime();

const baseState = (sessions = [], estimatedMinutes = 60) =>
  makeState({
    tasks: [
      makeTask({ id: 'task-1', estimatedMinutes }),
      makeTask({ id: 'task-2', estimatedMinutes: 60 }),
    ],
    sessions,
  });

const record = (state, overrides = {}) =>
  recordFocusSession(state, {
    taskId: 'task-1',
    startedAtMs: at(16, 0),
    studiedMs: 25 * MIN,
    runId: 'r1',
    now: NOW,
    ...overrides,
  });

describe('recordFocusSession', () => {
  it('creates a completed timer session when no planned session overlaps', () => {
    const result = record(baseState());
    expect(result.session).toMatchObject({
      id: 'timer-r1',
      taskId: 'task-1',
      date: dayKey(0),
      start: '16:00',
      end: '16:25',
      status: 'completed',
      source: 'timer',
      actualMinutes: 25,
    });
    expect(result.linked).toBe(false);
    expect(result.state.sessions).toHaveLength(1);
  });

  it('completes an overlapping planned session of the same task instead of duplicating it', () => {
    const planned = makeSession({ id: 'plan', taskId: 'task-1', date: dayKey(0), start: '16:00', end: '17:00' });
    const result = record(baseState([planned]), { startedAtMs: at(16, 5) });

    expect(result.linked).toBe(true);
    expect(result.state.sessions).toHaveLength(1);
    expect(result.session).toMatchObject({
      id: 'plan',
      status: 'completed',
      actualMinutes: 25,
      source: 'auto',
    });
  });

  it('does not link planned sessions of another task or a different time', () => {
    const otherTask = makeSession({ id: 'other', taskId: 'task-2', date: dayKey(0), start: '16:00', end: '17:00' });
    const later = makeSession({ id: 'later', taskId: 'task-1', date: dayKey(0), start: '18:00', end: '19:00' });
    const result = record(baseState([otherTask, later]));

    expect(result.linked).toBe(false);
    expect(result.state.sessions).toHaveLength(3);
    expect(result.state.sessions.find((s) => s.id === 'other').status).toBe('planned');
    expect(result.state.sessions.find((s) => s.id === 'later').status).toBe('planned');
  });

  it('does not create a second record for the same run', () => {
    const first = record(baseState());
    const second = record(first.state);
    expect(second.session).toBeNull();
    expect(second.reason).toBe('duplicate');
    expect(second.state.sessions).toHaveLength(1);
  });

  it('records nothing for very short sessions or deleted tasks', () => {
    const state = baseState();
    const short = record(state, { studiedMs: 20_000 });
    expect(short.reason).toBe('too-short');
    expect(short.state).toBe(state);

    const missing = record(state, { taskId: 'gone' });
    expect(missing.reason).toBe('task-missing');
    expect(missing.state).toBe(state);
  });

  it('rounds studied time to the nearest minute', () => {
    expect(record(baseState(), { studiedMs: 89_000 }).session.actualMinutes).toBe(1);
    expect(record(baseState(), { studiedMs: 90_000 }).session.actualMinutes).toBe(2);
  });

  it('keeps long sessions inside the day while recording the real minutes', () => {
    const result = record(baseState(), { startedAtMs: at(23, 50), studiedMs: 30 * MIN });
    expect(result.session.start).toBe('23:50');
    expect(result.session.end).toBe('23:59');
    expect(result.session.actualMinutes).toBe(30);
  });

  it('reports when the task estimate has been reached', () => {
    expect(record(baseState([], 25)).reachedEstimate).toBe(true);
    expect(record(baseState([], 60)).reachedEstimate).toBe(false);

    const earlier = makeSession({
      id: 'earlier',
      taskId: 'task-1',
      date: dayKey(-1),
      status: 'completed',
      actualMinutes: 40,
    });
    expect(record(baseState([earlier], 60)).reachedEstimate).toBe(true);
  });

  it('never modifies existing completed sessions', () => {
    const completed = makeSession({
      id: 'done',
      taskId: 'task-1',
      date: dayKey(-1),
      status: 'completed',
      actualMinutes: 30,
    });
    const result = record(baseState([completed]));
    expect(result.state.sessions.find((s) => s.id === 'done')).toBe(completed);
  });
});

describe('buildTimerSessionTimes', () => {
  it('stays within the day', () => {
    expect(buildTimerSessionTimes(600, 25)).toEqual({ start: '10:00', end: '10:25' });
    expect(buildTimerSessionTimes(1430, 30)).toEqual({ start: '23:50', end: '23:59' });
    expect(buildTimerSessionTimes(1439, 5)).toEqual({ start: '23:58', end: '23:59' });
  });
});