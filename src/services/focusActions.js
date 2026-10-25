import { createSession } from '../data/schema';
import { minutesToTime, timeToMinutes, toDateKey } from '../utils/dates';
import { getTaskRemainingMinutes } from '../utils/stats';

// Builds HH:MM start/end for a timer record. The record stays inside one day:
// the end is capped at 23:59 (the real studied time is kept in actualMinutes).
export function buildTimerSessionTimes(startMinutes, studiedMinutes) {
  const start = Math.max(0, Math.min(startMinutes, 1438));
  const end = Math.min(start + studiedMinutes, 1439);
  return { start: minutesToTime(start), end: minutesToTime(end) };
}

// A planned session of the same task that overlaps the studied time is completed
// instead of creating a duplicate record.
function findLinkedSession(sessions, taskId, date, times) {
  const start = timeToMinutes(times.start);
  const end = timeToMinutes(times.end);
  let best = null;
  let bestOverlap = 0;

  sessions
    .filter(
      (session) =>
        session.taskId === taskId && session.date === date && session.status === 'planned'
    )
    .sort((a, b) => a.start.localeCompare(b.start))
    .forEach((session) => {
      const overlap =
        Math.min(end, timeToMinutes(session.end)) - Math.max(start, timeToMinutes(session.start));
      if (overlap > bestOverlap) {
        best = session;
        bestOverlap = overlap;
      }
    });

  return best;
}

// Pure. Returns { state, session, linked, studiedMinutes, reachedEstimate } on success,
// or { state, session: null, reason } when nothing was recorded. Existing completed
// sessions are never modified.
export function recordFocusSession(
  state,
  { taskId, startedAtMs, studiedMs, runId, now = new Date() }
) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return { state, session: null, reason: 'task-missing' };

  const studiedMinutes = Math.round(studiedMs / 60000);
  if (studiedMinutes < 1) return { state, session: null, reason: 'too-short' };

  const startedAt = new Date(startedAtMs);
  const date = toDateKey(startedAt);
  const times = buildTimerSessionTimes(
    startedAt.getHours() * 60 + startedAt.getMinutes(),
    studiedMinutes
  );
  const completedAt = now.toISOString();

  const linked = findLinkedSession(state.sessions, taskId, date, times);
  let session;
  let sessions;

  if (linked) {
    session = { ...linked, status: 'completed', actualMinutes: studiedMinutes, completedAt };
    sessions = state.sessions.map((item) => (item.id === linked.id ? session : item));
  } else {
    const id = `timer-${runId}`;
    if (state.sessions.some((item) => item.id === id)) {
      return { state, session: null, reason: 'duplicate' };
    }
    session = createSession({
      id,
      taskId,
      date,
      start: times.start,
      end: times.end,
      status: 'completed',
      source: 'timer',
      actualMinutes: studiedMinutes,
      completedAt,
    });
    sessions = [...state.sessions, session];
  }

  return {
    state: { ...state, sessions },
    session,
    linked: Boolean(linked),
    studiedMinutes,
    reachedEstimate: getTaskRemainingMinutes(task, sessions) <= 0,
  };
}