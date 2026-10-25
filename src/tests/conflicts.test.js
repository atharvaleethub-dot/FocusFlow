import { describe, expect, it } from 'vitest';
import {
  findCommitmentConflicts,
  findOverlappingCommitments,
  findSessionConflicts,
  intervalsOverlap,
  validateSessionPlacement,
} from '../utils/schedulingHelpers';
import {
  NOW,
  dayKey,
  deadlineAt,
  makeCommitment,
  makeSession,
  makeState,
  makeTask,
} from './helpers';

describe('intervalsOverlap', () => {
  it('treats touching ranges as non-overlapping', () => {
    expect(intervalsOverlap(600, 660, 660, 720)).toBe(false);
    expect(intervalsOverlap(600, 661, 660, 720)).toBe(true);
  });
});

describe('findSessionConflicts', () => {
  const sessions = [
    makeSession({ id: 'a', start: '10:00', end: '11:00' }),
    makeSession({ id: 'b', start: '12:00', end: '13:00', status: 'missed' }),
  ];

  it('finds overlapping sessions on the same date', () => {
    const result = findSessionConflicts(sessions, { date: dayKey(0), start: '10:30', end: '11:30' });
    expect(result.map((s) => s.id)).toEqual(['a']);
  });

  it('ignores missed sessions, other dates, and the ignored id', () => {
    expect(
      findSessionConflicts(sessions, { date: dayKey(0), start: '12:30', end: '13:30' })
    ).toEqual([]);
    expect(
      findSessionConflicts(sessions, { date: dayKey(1), start: '10:00', end: '11:00' })
    ).toEqual([]);
    expect(
      findSessionConflicts(sessions, { date: dayKey(0), start: '10:00', end: '11:00' }, 'a')
    ).toEqual([]);
  });
});

describe('commitment conflicts', () => {
  it('matches weekly commitments by weekday', () => {
    const commitments = [makeCommitment({ days: ['mon'], start: '09:00', end: '10:00' })];
    expect(
      findCommitmentConflicts(commitments, { date: dayKey(0), start: '09:30', end: '10:30' })
    ).toHaveLength(1);
    expect(
      findCommitmentConflicts(commitments, { date: dayKey(1), start: '09:30', end: '10:30' })
    ).toHaveLength(0);
    expect(
      findCommitmentConflicts(commitments, { date: dayKey(0), start: '10:00', end: '11:00' })
    ).toHaveLength(0);
  });

  it('matches one-time commitments by date only', () => {
    const commitments = [
      makeCommitment({ repeat: 'once', days: [], date: dayKey(2), start: '09:00', end: '10:00' }),
    ];
    expect(
      findCommitmentConflicts(commitments, { date: dayKey(2), start: '09:00', end: '09:30' })
    ).toHaveLength(1);
    expect(
      findCommitmentConflicts(commitments, { date: dayKey(9), start: '09:00', end: '09:30' })
    ).toHaveLength(0);
  });

  it('detects overlapping commitments across weekly and one-time rules', () => {
    const commitments = [
      makeCommitment({ id: 'weekly', days: ['mon', 'wed'], start: '10:00', end: '12:00' }),
    ];
    const wednesday = { repeat: 'once', days: [], date: dayKey(2), start: '11:00', end: '13:00' };
    const tuesday = { repeat: 'once', days: [], date: dayKey(1), start: '11:00', end: '13:00' };
    expect(findOverlappingCommitments(commitments, wednesday)).toHaveLength(1);
    expect(findOverlappingCommitments(commitments, tuesday)).toHaveLength(0);
    expect(findOverlappingCommitments(commitments, wednesday, 'weekly')).toHaveLength(0);
  });
});

describe('validateSessionPlacement', () => {
  const state = makeState({
    tasks: [makeTask({ id: 'task-1', deadline: deadlineAt(3) })],
    commitments: [makeCommitment({ id: 'c', days: ['tue'], start: '16:00', end: '17:00' })],
    sessions: [makeSession({ id: 's1', date: dayKey(2), start: '16:00', end: '17:00' })],
  });
  const place = (candidate, options = {}) =>
    validateSessionPlacement(
      state,
      { taskId: 'task-1', ...candidate },
      { now: NOW, ...options }
    );
  const hasError = (result, text) => result.errors.some((message) => message.includes(text));

  it('accepts a valid session without warnings', () => {
    const result = place({ date: dayKey(0), start: '18:00', end: '19:00' });
    expect(result.isValid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('rejects sessions that end in the past', () => {
    expect(hasError(place({ date: dayKey(-1), start: '16:00', end: '17:00' }), 'future')).toBe(true);
  });

  it('allows an existing past session to keep its own time', () => {
    const existing = makeSession({ id: 'old', date: dayKey(-1), start: '16:00', end: '17:00' });
    const result = place(
      { date: dayKey(-1), start: '16:00', end: '17:00' },
      { existingSession: existing }
    );
    expect(result.isValid).toBe(true);
  });

  it('rejects sessions after the task deadline', () => {
    expect(
      hasError(place({ date: dayKey(4), start: '16:00', end: '17:00' }), 'deadline')
    ).toBe(true);
  });

  it('rejects overlaps with sessions and commitments', () => {
    expect(
      hasError(place({ date: dayKey(2), start: '16:30', end: '17:30' }), 'another study session')
    ).toBe(true);
    expect(
      hasError(place({ date: dayKey(1), start: '16:30', end: '17:30' }), 'fixed commitment')
    ).toBe(true);
  });

  it('rejects invalid times and completed tasks', () => {
    expect(
      hasError(place({ date: dayKey(0), start: '18:00', end: '17:00' }), 'after the start')
    ).toBe(true);

    const completedState = makeState({ tasks: [makeTask({ id: 'task-1', completed: true })] });
    const result = validateSessionPlacement(
      completedState,
      { taskId: 'task-1', date: dayKey(0), start: '18:00', end: '19:00' },
      { now: NOW }
    );
    expect(result.errors.some((message) => message.includes('already completed'))).toBe(true);
  });

  it('only warns when outside the study window', () => {
    const result = place({ date: dayKey(1), start: '07:00', end: '08:00' });
    expect(result.isValid).toBe(true);
    expect(result.warnings.some((message) => message.includes('Outside'))).toBe(true);
  });
});