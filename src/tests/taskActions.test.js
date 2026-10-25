import { describe, expect, it } from 'vitest';
import {
  deleteTaskFromState,
  setTaskCompletedInState,
  updateTaskInState,
} from '../services/taskActions';
import { dayKey, deadlineAt, makeSession, makeState, makeTask } from './helpers';

const baseValues = (task) => ({
  title: task.title,
  subject: task.subject,
  notes: task.notes,
  estimatedMinutes: task.estimatedMinutes,
  deadline: task.deadline,
  priority: task.priority,
});

describe('completing a task', () => {
  const state = makeState({
    tasks: [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })],
    sessions: [
      makeSession({ id: 'planned', date: dayKey(1) }),
      makeSession({
        id: 'done',
        date: dayKey(-1),
        status: 'completed',
        actualMinutes: 45,
        completedAt: '2026-10-11T17:00:00.000Z',
      }),
      makeSession({ id: 'missed', date: dayKey(-2), status: 'missed' }),
      makeSession({ id: 'other', taskId: 'task-2', date: dayKey(1), start: '18:00', end: '19:00' }),
    ],
  });

  it('removes planned sessions but keeps completed and missed records', () => {
    const result = setTaskCompletedInState(state, 'task-1', true, new Date(2026, 9, 12, 9, 0));
    expect(result.task.completed).toBe(true);
    expect(result.removedSessions).toBe(1);
    expect(result.state.sessions.map((s) => s.id).sort()).toEqual(['done', 'missed', 'other']);
    expect(result.state.sessions.find((s) => s.id === 'done').actualMinutes).toBe(45);
  });

  it('does not restore sessions when a task is reopened', () => {
    const completed = setTaskCompletedInState(state, 'task-1', true).state;
    const reopened = setTaskCompletedInState(completed, 'task-1', false);
    expect(reopened.task.completed).toBe(false);
    expect(reopened.task.completedAt).toBeNull();
    expect(reopened.state.sessions.find((s) => s.id === 'planned')).toBeUndefined();
  });
});

describe('deleting a task', () => {
  it('keeps completed sessions as study history', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'task-1' })],
      sessions: [
        makeSession({ id: 'planned', date: dayKey(1) }),
        makeSession({ id: 'missed', date: dayKey(-2), status: 'missed' }),
        makeSession({ id: 'done', date: dayKey(-1), status: 'completed', actualMinutes: 30 }),
      ],
    });
    const result = deleteTaskFromState(state, 'task-1');
    expect(result.state.tasks).toEqual([]);
    expect(result.state.sessions.map((s) => s.id)).toEqual(['done']);
    expect(result.keptRecords).toBe(1);
    expect(result.removedSessions).toBe(2);
  });
});

describe('editing a task deadline', () => {
  it('removes unlocked planned sessions after the new deadline and keeps locked ones', () => {
    const task = makeTask({ id: 'task-1', deadline: deadlineAt(5) });
    const state = makeState({
      tasks: [task],
      sessions: [
        makeSession({ id: 'early', date: dayKey(0), start: '16:00', end: '17:00' }),
        makeSession({ id: 'late', date: dayKey(2), start: '16:00', end: '17:00' }),
        makeSession({ id: 'late-locked', date: dayKey(2), start: '18:00', end: '19:00', locked: true }),
      ],
    });
    const result = updateTaskInState(state, 'task-1', {
      ...baseValues(task),
      deadline: deadlineAt(1, '12:00'),
    });
    expect(result.removedSessions).toBe(1);
    expect(result.lockedAfterDeadline).toBe(1);
    expect(result.state.sessions.map((s) => s.id).sort()).toEqual(['early', 'late-locked']);
  });
});