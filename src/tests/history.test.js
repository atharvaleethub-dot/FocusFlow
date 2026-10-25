import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, defaultAvailability, defaultSettings } from '../data/schema';
import { applySchedulePlan } from '../services/scheduleActions';
import { generateSchedule } from '../services/scheduler';
import {
  COALESCE_WINDOW_MS,
  pushHistory,
  restoreSessions,
  undoLastHistory,
  withHistory,
} from '../services/history';
import { sanitizeState } from '../services/validation';
import {
  NOW,
  dayKey,
  makeIdGenerator,
  makeSession,
  makeState,
  makeTask,
} from './helpers';

const later = (ms) => new Date(NOW.getTime() + ms);

describe('pushHistory', () => {
  it('snapshots the current sessions, newest first, capped at the limit', () => {
    let current = makeState({ sessions: [makeSession({ id: 's1' })], history: [] });
    for (let index = 0; index < HISTORY_LIMIT + 5; index += 1) {
      current = pushHistory(current, { action: 'add', label: `change ${index}` }, later(index * 120000));
    }
    expect(current.history).toHaveLength(HISTORY_LIMIT);
    expect(current.history[0].label).toBe(`change ${HISTORY_LIMIT + 4}`);
    expect(current.history[0].snapshot.sessions[0].id).toBe('s1');
  });

  it('merges consecutive entries with the same action inside the window and keeps the first snapshot', () => {
    const first = pushHistory(
      makeState({ sessions: [makeSession({ id: 's1' })], history: [] }),
      { action: 'move:s1', label: 'first', coalesce: true },
      NOW
    );
    const second = pushHistory(
      { ...first, sessions: [makeSession({ id: 's1', start: '18:00', end: '19:00' })] },
      { action: 'move:s1', label: 'second', coalesce: true },
      later(30000)
    );
    expect(second.history).toHaveLength(1);
    expect(second.history[0].label).toBe('second');
    expect(second.history[0].snapshot).toBe(first.history[0].snapshot);
  });

  it('does not merge after the window or for a different action', () => {
    const first = pushHistory(
      makeState({ sessions: [], history: [] }),
      { action: 'move:s1', label: 'first', coalesce: true },
      NOW
    );
    const afterWindow = pushHistory(
      first,
      { action: 'move:s1', label: 'late', coalesce: true },
      later(COALESCE_WINDOW_MS + 1000)
    );
    const otherAction = pushHistory(
      first,
      { action: 'move:s2', label: 'other', coalesce: true },
      later(1000)
    );
    expect(afterWindow.history).toHaveLength(2);
    expect(otherAction.history).toHaveLength(2);
  });
});

describe('withHistory', () => {
  const state = makeState({ sessions: [makeSession({ id: 's1' })] });

  it('records nothing when the action changed nothing', () => {
    const unchanged = { state, session: null };
    expect(withHistory(state, { action: 'edit', label: 'x' }, unchanged)).toBe(unchanged);
  });

  it('records a snapshot of the previous sessions and keeps the action info', () => {
    const changed = { state: { ...state, sessions: [] }, session: 'info' };
    const result = withHistory(state, { action: 'delete', label: 'Deleted' }, changed, NOW);
    expect(result.session).toBe('info');
    expect(result.state.sessions).toEqual([]);
    expect(result.state.history).toHaveLength(1);
    expect(result.state.history[0].snapshot.sessions).toBe(state.sessions);
  });
});

describe('undoLastHistory', () => {
  const original = makeState({
    tasks: [makeTask({ id: 'task-1' })],
    sessions: [makeSession({ id: 's1', date: dayKey(1) })],
    history: [],
  });
  const changed = withHistory(
    original,
    { action: 'edit', label: 'Edited' },
    { state: { ...original, sessions: [makeSession({ id: 's2', date: dayKey(2) })] } },
    NOW
  ).state;

  it('does nothing without history', () => {
    const result = undoLastHistory(original);
    expect(result.undone).toBeNull();
    expect(result.state).toBe(original);
  });

  it('restores the earlier sessions, pops the entry, and records nothing new', () => {
    const result = undoLastHistory(changed);
    expect(result.state.sessions.map((s) => s.id)).toEqual(['s1']);
    expect(result.state.history).toEqual([]);
    expect(result.undone.label).toBe('Edited');
  });

  it('keeps study records created after the snapshot', () => {
    const record = makeSession({
      id: 'timer-1',
      date: dayKey(0),
      start: '10:00',
      end: '10:30',
      status: 'completed',
      actualMinutes: 30,
      source: 'timer',
    });
    const result = undoLastHistory({ ...changed, sessions: [...changed.sessions, record] });
    expect(result.state.sessions.map((s) => s.id).sort()).toEqual(['s1', 'timer-1']);
  });

  it('keeps the completed version of a session that was completed after the snapshot', () => {
    const planned = makeSession({ id: 'p1', date: dayKey(0) });
    const base = makeState({ tasks: [makeTask({ id: 'task-1' })], sessions: [planned], history: [] });
    const afterChange = withHistory(
      base,
      { action: 'delete', label: 'x' },
      { state: { ...base, sessions: [] } },
      NOW
    ).state;
    const completed = { ...planned, status: 'completed', actualMinutes: 40 };

    const result = undoLastHistory({ ...afterChange, sessions: [completed] });
    expect(result.state.sessions).toHaveLength(1);
    expect(result.state.sessions[0]).toBe(completed);
  });

  it('does not bring back sessions whose task was deleted or completed', () => {
    const snapshot = [
      makeSession({ id: 'a', taskId: 'task-1', date: dayKey(1) }),
      makeSession({ id: 'b', taskId: 'task-2', date: dayKey(2) }),
      makeSession({ id: 'c', taskId: 'task-3', date: dayKey(3) }),
    ];
    const tasks = [makeTask({ id: 'task-1' }), makeTask({ id: 'task-3', completed: true })];
    expect(restoreSessions(snapshot, [], tasks).map((s) => s.id)).toEqual(['a']);
  });

  it('keeps sessions that have recorded minutes even if they were missed', () => {
    const partial = makeSession({ id: 'p', status: 'missed', actualMinutes: 10 });
    const restored = restoreSessions([], [partial], [makeTask({ id: 'task-1' })]);
    expect(restored).toEqual([partial]);
  });
});

describe('applying a plan, then undoing it', () => {
  const completed = makeSession({
    id: 'done',
    taskId: 'x',
    date: dayKey(-1),
    start: '16:00',
    end: '16:30',
    status: 'completed',
    actualMinutes: 30,
  });
  const stale = makeSession({ id: 'stale', taskId: 'x', date: dayKey(0), start: '06:00', end: '07:00' });
  const state = {
    ...makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 120 })],
      sessions: [completed, stale],
      history: [],
    }),
    settings: defaultSettings(),
  };
  const plan = generateSchedule(state, { idGenerator: makeIdGenerator() });
  const basis = {
    tasks: state.tasks,
    sessions: state.sessions,
    commitments: state.commitments,
    availability: state.availability,
  };

  it('records the change and restores everything on undo without touching completed work', () => {
    const applied = applySchedulePlan(state, plan, basis, { mode: 'reschedule' });
    expect(applied.applied).toBe(true);
    expect(applied.state.history).toHaveLength(1);
    expect(applied.state.history[0].label).toContain('Rescheduled');
    expect(applied.state.sessions.find((s) => s.id === 'stale').status).toBe('missed');

    const { state: undone } = undoLastHistory(applied.state);
    expect(undone.sessions.map((s) => s.id).sort()).toEqual(['done', 'stale']);
    expect(undone.sessions.find((s) => s.id === 'stale').status).toBe('planned');
    expect(undone.sessions.find((s) => s.id === 'done')).toBe(completed);
    expect(undone.history).toEqual([]);
  });

  it('records nothing when the plan changes nothing', () => {
    const quiet = makeState({
      tasks: [makeTask({ id: 'x', estimatedMinutes: 60 })],
      sessions: [makeSession({ id: 'keep', taskId: 'x', date: dayKey(1) })],
      history: [],
    });
    const quietPlan = generateSchedule(quiet, { idGenerator: makeIdGenerator() });
    const quietBasis = {
      tasks: quiet.tasks,
      sessions: quiet.sessions,
      commitments: quiet.commitments,
      availability: quiet.availability,
    };
    const result = applySchedulePlan(quiet, quietPlan, quietBasis);
    expect(result.state).toBe(quiet);
  });

  it('keeps history valid and storable', () => {
    const applied = applySchedulePlan(state, plan, basis, { mode: 'generate' });
    const storable = {
      tasks: applied.state.tasks,
      sessions: applied.state.sessions,
      commitments: [],
      availability: defaultAvailability(),
      settings: defaultSettings(),
      history: applied.state.history,
    };
    const { issues, state: reloaded } = sanitizeState(JSON.parse(JSON.stringify(storable)));
    expect(issues).toEqual([]);
    expect(reloaded.history).toHaveLength(1);
  });
});