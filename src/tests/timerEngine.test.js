import { describe, expect, it } from 'vitest';
import {
  createTimer,
  finishRun,
  formatClock,
  getElapsedMs,
  getPhaseDurationMs,
  getRemainingMs,
  isExpired,
  pauseTimer,
  resetToIdle,
  resumeTimer,
  sanitizeTimer,
  setTimerTask,
  startRun,
} from '../services/timerEngine';

const MIN = 60000;
const T0 = 1_000_000;

const started = (overrides = {}) =>
  startRun(createTimer({ taskId: 't1' }), {
    phase: 'focus',
    durationMs: 25 * MIN,
    nowMs: T0,
    runId: 'run-1',
    taskId: 't1',
    ...overrides,
  });

describe('starting', () => {
  it('starts a run with an end timestamp', () => {
    const timer = started();
    expect(timer.status).toBe('running');
    expect(timer.endsAt).toBe(T0 + 25 * MIN);
    expect(timer.startedAtMs).toBe(T0);
    expect(getRemainingMs(timer, T0)).toBe(25 * MIN);
    expect(getRemainingMs(timer, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(getElapsedMs(timer, T0 + 10 * MIN)).toBe(10 * MIN);
  });

  it('ignores a second start while a run is active', () => {
    const timer = started();
    expect(
      startRun(timer, { phase: 'focus', durationMs: MIN, nowMs: T0 + 5, runId: 'run-2', taskId: 't2' })
    ).toBe(timer);
  });

  it('keeps the cycle count for short breaks and resets it for long breaks', () => {
    const base = createTimer({ taskId: 't1', cycleCount: 3 });
    const short = startRun(base, { phase: 'shortBreak', durationMs: 5 * MIN, nowMs: T0, runId: 'a' });
    const long = startRun(base, { phase: 'longBreak', durationMs: 15 * MIN, nowMs: T0, runId: 'b' });
    expect(short.cycleCount).toBe(3);
    expect(long.cycleCount).toBe(0);
    expect(short.taskId).toBe('t1');
  });

  it('reports the idle duration while idle', () => {
    expect(getRemainingMs(createTimer(), T0, 25 * MIN)).toBe(25 * MIN);
    expect(getElapsedMs(createTimer(), T0)).toBe(0);
  });
});

describe('pausing and resuming', () => {
  it('freezes the remaining time while paused', () => {
    const paused = pauseTimer(started(), T0 + 10 * MIN);
    expect(paused.status).toBe('paused');
    expect(paused.endsAt).toBeNull();
    expect(getRemainingMs(paused, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(getRemainingMs(paused, T0 + 60 * MIN)).toBe(15 * MIN);
  });

  it('continues from the remaining time when resumed', () => {
    const paused = pauseTimer(started(), T0 + 10 * MIN);
    const resumed = resumeTimer(paused, T0 + 30 * MIN);
    expect(resumed.status).toBe('running');
    expect(resumed.endsAt).toBe(T0 + 45 * MIN);
    expect(getRemainingMs(resumed, T0 + 35 * MIN)).toBe(10 * MIN);
    expect(getElapsedMs(resumed, T0 + 35 * MIN)).toBe(15 * MIN);
  });

  it('treats repeated calls as no-ops', () => {
    const running = started();
    const paused = pauseTimer(running, T0 + MIN);
    expect(pauseTimer(paused, T0 + 2 * MIN)).toBe(paused);
    expect(resumeTimer(running, T0 + MIN)).toBe(running);
    expect(finishRun(createTimer(), T0)).toEqual(createTimer());
  });
});

describe('expiry and finishing', () => {
  it('detects expiry exactly at the end timestamp', () => {
    const timer = started();
    expect(isExpired(timer, T0 + 25 * MIN - 1)).toBe(false);
    expect(isExpired(timer, T0 + 25 * MIN)).toBe(true);
    expect(isExpired(pauseTimer(timer, T0 + MIN), T0 + 99 * MIN)).toBe(false);
  });

  it('finishes early with the elapsed time preserved', () => {
    const outcome = { taskId: 't1', studiedMinutes: 10, recorded: true };
    const finished = finishRun(started(), T0 + 10 * MIN, outcome);
    expect(finished.status).toBe('finished');
    expect(finished.remainingMs).toBe(15 * MIN);
    expect(getElapsedMs(finished, T0 + 99 * MIN)).toBe(10 * MIN);
    expect(finished.outcome).toBe(outcome);
    expect(finished.cycleCount).toBe(1);
  });

  it('counts a naturally expired run as fully elapsed', () => {
    const finished = finishRun(started(), T0 + 25 * MIN + 5000, { recorded: true });
    expect(finished.remainingMs).toBe(0);
    expect(getElapsedMs(finished, T0 + 99 * MIN)).toBe(25 * MIN);
  });

  it('only counts recorded focus runs in the cycle', () => {
    expect(finishRun(started(), T0 + MIN, { recorded: false }).cycleCount).toBe(0);
    const breakRun = startRun(createTimer(), {
      phase: 'shortBreak',
      durationMs: 5 * MIN,
      nowMs: T0,
      runId: 'b',
    });
    expect(finishRun(breakRun, T0 + 5 * MIN, null).cycleCount).toBe(0);
  });
});

describe('reset and task selection', () => {
  it('resets to idle but keeps the task and cycle count', () => {
    const timer = started();
    const reset = resetToIdle({ ...timer, cycleCount: 2 });
    expect(reset.status).toBe('idle');
    expect(reset.phase).toBe('focus');
    expect(reset.taskId).toBe('t1');
    expect(reset.cycleCount).toBe(2);
    expect(reset.endsAt).toBeNull();
    expect(reset.outcome).toBeNull();
  });

  it('does not change the task while a run is active', () => {
    const running = started();
    expect(setTimerTask(running, 't2')).toBe(running);
    expect(setTimerTask(createTimer(), 't2').taskId).toBe('t2');
  });
});

describe('formatting and durations', () => {
  it('formats the clock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(61000)).toBe('01:01');
    expect(formatClock(59001)).toBe('01:00');
    expect(formatClock(3661000)).toBe('1:01:01');
  });

  it('maps phases to configured minutes', () => {
    const focus = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 };
    expect(getPhaseDurationMs('focus', focus)).toBe(25 * MIN);
    expect(getPhaseDurationMs('shortBreak', focus)).toBe(5 * MIN);
    expect(getPhaseDurationMs('longBreak', focus)).toBe(15 * MIN);
  });
});

describe('sanitizeTimer', () => {
  it('round-trips valid timers through JSON', () => {
    const running = started();
    expect(sanitizeTimer(JSON.parse(JSON.stringify(running)))).toEqual(running);
    const paused = pauseTimer(running, T0 + MIN);
    expect(sanitizeTimer(JSON.parse(JSON.stringify(paused)))).toEqual(paused);
    const finished = finishRun(running, T0 + 2 * MIN, {
      taskId: 't1',
      studiedMinutes: 2,
      recorded: true,
      reason: null,
      sessionId: 'timer-run-1',
      linked: false,
      reachedEstimate: false,
    });
    expect(sanitizeTimer(JSON.parse(JSON.stringify(finished)))).toEqual(finished);
  });

  it('rejects malformed or inconsistent data', () => {
    expect(sanitizeTimer(null)).toBeNull();
    expect(sanitizeTimer('nope')).toBeNull();
    expect(sanitizeTimer({ ...createTimer(), phase: 'sprint' })).toBeNull();
    expect(sanitizeTimer({ ...createTimer(), status: 'running' })).toBeNull();
    expect(sanitizeTimer({ ...createTimer(), status: 'paused', durationMs: 1000 })).toBeNull();
    expect(sanitizeTimer({ ...createTimer(), cycleCount: -1 })).toBeNull();
    expect(sanitizeTimer({ ...createTimer(), outcome: { studiedMinutes: 'x' } })).toBeNull();
  });
});