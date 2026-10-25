// Pure timer state machine. All functions take the current time explicitly, so they are
// deterministic and testable. The running countdown is derived from an end timestamp
// (endsAt), never from a ticking counter, so it stays correct in background tabs and
// after a page refresh. Nothing here is non-serializable.

export const PHASES = ['focus', 'shortBreak', 'longBreak'];
export const STATUSES = ['idle', 'running', 'paused', 'finished'];
export const PHASE_LABELS = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' };

// A timer that ended longer ago than this when the app is reopened is discarded, not recorded.
export const RESTORE_GRACE_MS = 2 * 60 * 1000;

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNumberOrNull = (value) => value === null || isNumber(value);
const isStringOrNull = (value) => value === null || typeof value === 'string';

export function createTimer(overrides = {}) {
  return {
    runId: null,
    phase: 'focus',
    status: 'idle',
    taskId: null,
    durationMs: null,
    remainingMs: null,
    endsAt: null,
    startedAtMs: null,
    cycleCount: 0,
    outcome: null,
    ...overrides,
  };
}

export function getPhaseDurationMs(phase, focus) {
  const minutes = {
    focus: focus.focusMinutes,
    shortBreak: focus.shortBreakMinutes,
    longBreak: focus.longBreakMinutes,
  }[phase];
  return minutes * 60000;
}

export function getRemainingMs(timer, nowMs, idleDurationMs = 0) {
  switch (timer.status) {
    case 'running':
      return Math.max(0, timer.endsAt - nowMs);
    case 'paused':
    case 'finished':
      return timer.remainingMs ?? 0;
    default:
      return idleDurationMs;
  }
}

export function getElapsedMs(timer, nowMs) {
  if (timer.status === 'idle' || timer.durationMs === null) return 0;
  return Math.max(0, timer.durationMs - getRemainingMs(timer, nowMs));
}

export function isExpired(timer, nowMs) {
  return timer.status === 'running' && timer.endsAt <= nowMs;
}

// Begins a fresh run. Ignored while a run is already active (repeated clicks are harmless).
export function startRun(timer, { phase, durationMs, nowMs, runId, taskId }) {
  if (timer.status === 'running' || timer.status === 'paused') return timer;
  return {
    ...timer,
    runId,
    phase,
    status: 'running',
    taskId: phase === 'focus' ? taskId : timer.taskId,
    durationMs,
    remainingMs: null,
    endsAt: nowMs + durationMs,
    startedAtMs: nowMs,
    cycleCount: phase === 'longBreak' ? 0 : timer.cycleCount,
    outcome: null,
  };
}

export function pauseTimer(timer, nowMs) {
  if (timer.status !== 'running') return timer;
  return { ...timer, status: 'paused', remainingMs: Math.max(0, timer.endsAt - nowMs), endsAt: null };
}

export function resumeTimer(timer, nowMs) {
  if (timer.status !== 'paused') return timer;
  return { ...timer, status: 'running', endsAt: nowMs + timer.remainingMs, remainingMs: null };
}

// Ends the active run. A recorded focus run increases the cycle count (for long-break timing).
export function finishRun(timer, nowMs, outcome = null) {
  if (timer.status !== 'running' && timer.status !== 'paused') return timer;
  return {
    ...timer,
    status: 'finished',
    remainingMs: getRemainingMs(timer, nowMs),
    endsAt: null,
    outcome,
    cycleCount:
      timer.phase === 'focus' && outcome && outcome.recorded
        ? timer.cycleCount + 1
        : timer.cycleCount,
  };
}

// Back to a ready state. Keeps the selected task and the cycle count.
export function resetToIdle(timer) {
  return {
    ...timer,
    runId: null,
    phase: 'focus',
    status: 'idle',
    durationMs: null,
    remainingMs: null,
    endsAt: null,
    startedAtMs: null,
    outcome: null,
  };
}

export function setTimerTask(timer, taskId) {
  if (timer.status === 'running' || timer.status === 'paused') return timer;
  return { ...timer, taskId };
}

export function formatClock(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function sanitizeOutcome(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  if (!isStringOrNull(raw.taskId) || !isStringOrNull(raw.reason) || !isStringOrNull(raw.sessionId)) {
    return undefined;
  }
  if (!Number.isInteger(raw.studiedMinutes) || raw.studiedMinutes < 0) return undefined;
  return {
    taskId: raw.taskId,
    studiedMinutes: raw.studiedMinutes,
    recorded: raw.recorded === true,
    reason: raw.reason,
    sessionId: raw.sessionId,
    linked: raw.linked === true,
    reachedEstimate: raw.reachedEstimate === true,
  };
}

// Validates saved timer data. Returns null when it is malformed or inconsistent.
export function sanitizeTimer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!PHASES.includes(raw.phase) || !STATUSES.includes(raw.status)) return null;
  if (!isStringOrNull(raw.taskId) || !isStringOrNull(raw.runId)) return null;
  if (
    !isNumberOrNull(raw.durationMs) ||
    !isNumberOrNull(raw.remainingMs) ||
    !isNumberOrNull(raw.endsAt) ||
    !isNumberOrNull(raw.startedAtMs)
  ) {
    return null;
  }
  if (!Number.isInteger(raw.cycleCount) || raw.cycleCount < 0) return null;

  const outcome = sanitizeOutcome(raw.outcome);
  if (outcome === undefined) return null;

  const timer = createTimer({
    runId: raw.runId,
    phase: raw.phase,
    status: raw.status,
    taskId: raw.taskId,
    durationMs: raw.durationMs,
    remainingMs: raw.remainingMs,
    endsAt: raw.endsAt,
    startedAtMs: raw.startedAtMs,
    cycleCount: raw.cycleCount,
    outcome,
  });

  if (timer.status === 'running') {
    if (
      timer.endsAt === null ||
      timer.durationMs === null ||
      timer.startedAtMs === null ||
      timer.runId === null
    ) {
      return null;
    }
  }
  if (timer.status === 'paused') {
    if (
      timer.remainingMs === null ||
      timer.durationMs === null ||
      timer.startedAtMs === null ||
      timer.runId === null
    ) {
      return null;
    }
  }
  if (timer.status === 'finished' && (timer.remainingMs === null || timer.durationMs === null)) {
    return null;
  }
  return timer;
}