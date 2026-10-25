import { createSession } from '../data/schema';
import { getSessionMinutes } from '../utils/stats';

// Pure state transformations. Only planned sessions can be changed;
// completed and missed sessions are permanent study records.

const findPlanned = (state, sessionId) => {
  const session = state.sessions.find((item) => item.id === sessionId);
  return session && session.status === 'planned' ? session : null;
};

const replaceSession = (state, sessionId, session) => ({
  ...state,
  sessions: state.sessions.map((item) => (item.id === sessionId ? session : item)),
});

export function addSessionToState(state, values) {
  const session = createSession({
    taskId: values.taskId,
    date: values.date,
    start: values.start,
    end: values.end,
    status: 'planned',
    source: 'manual',
  });
  return { state: { ...state, sessions: [...state.sessions, session] }, session };
}

export function updateSessionInState(state, sessionId, values) {
  const existing = findPlanned(state, sessionId);
  if (!existing) return { state, session: null };
  const session = {
    ...existing,
    taskId: values.taskId,
    date: values.date,
    start: values.start,
    end: values.end,
  };
  return { state: replaceSession(state, sessionId, session), session };
}

export function deleteSessionFromState(state, sessionId) {
  const existing = findPlanned(state, sessionId);
  if (!existing) return { state, session: null };
  return {
    state: { ...state, sessions: state.sessions.filter((item) => item.id !== sessionId) },
    session: existing,
  };
}

export function markSessionCompletedInState(state, sessionId, now = new Date()) {
  const existing = findPlanned(state, sessionId);
  if (!existing) return { state, session: null };
  const session = {
    ...existing,
    status: 'completed',
    actualMinutes: getSessionMinutes(existing),
    completedAt: now.toISOString(),
  };
  return { state: replaceSession(state, sessionId, session), session };
}

export function markSessionMissedInState(state, sessionId) {
  const existing = findPlanned(state, sessionId);
  if (!existing) return { state, session: null };
  const session = { ...existing, status: 'missed', actualMinutes: null, completedAt: null };
  return { state: replaceSession(state, sessionId, session), session };
}