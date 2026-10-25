import { describe, expect, it } from 'vitest';
import { moveSessionInState, setSessionLockedInState } from '../services/sessionMoveActions';
import {
  buildMoveCandidate,
  computeMoveStart,
  nudgeCandidate,
  validateSessionMove,
} from '../utils/sessionMove';
import { NOW, dayKey, deadlineAt, makeCommitment, makeSession, makeState, makeTask } from './helpers';

const state = makeState({
  tasks: [makeTask({ id: 'task-1', deadline: deadlineAt(5) })],
  sessions: [
    makeSession({ id: 's1', date: dayKey(1), start: '16:00', end: '17:00' }),
    makeSession({ id: 's2', date: dayKey(1), start: '18:00', end: '19:00' }),
  ],
  commitments: [makeCommitment({ id: 'c', days: ['wed'], start: '16:00', end: '17:00' })],
});
const s1 = state.sessions[0];
const candidate = (date, start, end) => ({ taskId: 'task-1', date, start, end });
const hasError = (result, text) => result.errors.some((message) => message.includes(text));

describe('computeMoveStart', () => {
  it('snaps to 15 minutes while keeping the grabbed point under the pointer', () => {
    expect(computeMoveStart({ pointerMinutes: 607, grabOffsetMinutes: 7, durationMinutes: 60 })).toBe(
      600
    );
    expect(computeMoveStart({ pointerMinutes: 612, grabOffsetMinutes: 0, durationMinutes: 60 })).toBe(
      615
    );
  });

  it('clamps the block inside the day', () => {
    expect(computeMoveStart({ pointerMinutes: 5, grabOffsetMinutes: 30, durationMinutes: 60 })).toBe(0);
    expect(
      computeMoveStart({ pointerMinutes: 1430, grabOffsetMinutes: 0, durationMinutes: 60 })
    ).toBe(1379);
  });
});

describe('candidate builders', () => {
  it('keeps the duration when building a candidate', () => {
    expect(buildMoveCandidate(s1, dayKey(3), 600)).toEqual({
      taskId: 'task-1',
      date: dayKey(3),
      start: '10:00',
      end: '11:00',
    });
  });

  it('nudges by minutes and days and clamps to the day', () => {
    expect(nudgeCandidate(s1, { minutes: 15 })).toMatchObject({ start: '16:15', end: '17:15' });
    expect(nudgeCandidate(s1, { days: 1 })).toMatchObject({
      date: dayKey(2),
      start: '16:00',
      end: '17:00',
    });
    expect(nudgeCandidate(s1, { minutes: -5000 })).toMatchObject({ start: '00:00', end: '01:00' });
    expect(nudgeCandidate(s1, { minutes: 5000 })).toMatchObject({ start: '22:59', end: '23:59' });
  });
});

describe('validateSessionMove', () => {
  it('accepts a clean move without warnings', () => {
    const result = validateSessionMove(state, s1, candidate(dayKey(3), '16:00', '17:00'), NOW);
    expect(result.isValid).toBe(true);
    expect(result.isNoop).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('treats an unchanged position as a no-op', () => {
    const result = validateSessionMove(state, s1, candidate(dayKey(1), '16:00', '17:00'), NOW);
    expect(result.isValid).toBe(true);
    expect(result.isNoop).toBe(true);
  });

  it('prevents overlapping another session', () => {
    const result = validateSessionMove(state, s1, candidate(dayKey(1), '17:30', '18:30'), NOW);
    expect(result.isValid).toBe(false);
    expect(hasError(result, 'another study session')).toBe(true);
  });

  it('prevents overlapping a fixed commitment', () => {
    const result = validateSessionMove(state, s1, candidate(dayKey(2), '16:30', '17:30'), NOW);
    expect(hasError(result, 'fixed commitment')).toBe(true);
  });

  it('prevents moving after the deadline or into the past', () => {
    expect(
      hasError(validateSessionMove(state, s1, candidate(dayKey(6), '16:00', '17:00'), NOW), 'deadline')
    ).toBe(true);
    expect(
      hasError(validateSessionMove(state, s1, candidate(dayKey(0), '07:00', '08:00'), NOW), 'future')
    ).toBe(true);
  });

  it('only warns about leaving the study window', () => {
    const result = validateSessionMove(state, s1, candidate(dayKey(3), '07:00', '08:00'), NOW);
    expect(result.isValid).toBe(true);
    expect(result.warnings.some((message) => message.includes('Outside'))).toBe(true);
  });

  it('refuses locked and non-planned sessions', () => {
    const locked = validateSessionMove(
      state,
      { ...s1, locked: true },
      candidate(dayKey(3), '16:00', '17:00'),
      NOW
    );
    expect(locked.isValid).toBe(false);
    expect(hasError(locked, 'locked')).toBe(true);

    const completed = validateSessionMove(
      state,
      { ...s1, status: 'completed' },
      candidate(dayKey(3), '16:00', '17:00'),
      NOW
    );
    expect(hasError(completed, 'Only planned')).toBe(true);
  });
});

describe('moveSessionInState', () => {
  it('applies a valid move and marks the session as manual', () => {
    const result = moveSessionInState(state, 's1', candidate(dayKey(3), '16:00', '17:00'), NOW);
    expect(result.session.date).toBe(dayKey(3));
    expect(result.session.source).toBe('manual');
    expect(result.session.rescheduledCount).toBe(1);
    expect(result.state.sessions.find((s) => s.id === 's2')).toBe(state.sessions[1]);
    expect(state.sessions[0].date).toBe(dayKey(1));
  });

  it('rejects an invalid move and leaves the state untouched', () => {
    const result = moveSessionInState(state, 's1', candidate(dayKey(1), '17:30', '18:30'), NOW);
    expect(result.session).toBeNull();
    expect(result.state).toBe(state);
    expect(result.validation.isValid).toBe(false);
  });

  it('reports an unknown session', () => {
    const result = moveSessionInState(state, 'missing', candidate(dayKey(3), '16:00', '17:00'), NOW);
    expect(result.session).toBeNull();
    expect(result.state).toBe(state);
  });
});

describe('setSessionLockedInState', () => {
  it('locks and unlocks planned sessions', () => {
    const locked = setSessionLockedInState(state, 's1', true);
    expect(locked.session.locked).toBe(true);
    expect(locked.state.sessions.find((s) => s.id === 's2')).toBe(state.sessions[1]);

    const unlocked = setSessionLockedInState(locked.state, 's1', false);
    expect(unlocked.session.locked).toBe(false);
  });

  it('returns the same state when nothing changes', () => {
    const locked = setSessionLockedInState(state, 's1', true).state;
    expect(setSessionLockedInState(locked, 's1', true).state).toBe(locked);
  });

  it('never changes completed sessions', () => {
    const withDone = makeState({
      tasks: state.tasks,
      sessions: [makeSession({ id: 'done', status: 'completed', actualMinutes: 30 })],
    });
    const result = setSessionLockedInState(withDone, 'done', true);
    expect(result.session).toBeNull();
    expect(result.state).toBe(withDone);
  });
});