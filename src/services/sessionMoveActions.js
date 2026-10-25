import { validateSessionMove } from '../utils/sessionMove';

// Pure state transformations. A move is validated again here, so an invalid
// destination can never be saved even if the UI let it through.

export function moveSessionInState(state, sessionId, candidate, now = new Date()) {
  const existing = state.sessions.find((item) => item.id === sessionId);
  if (!existing) {
    return {
      state,
      session: null,
      validation: {
        isValid: false,
        isNoop: false,
        errors: ['This session no longer exists.'],
        warnings: [],
      },
    };
  }

  const validation = validateSessionMove(state, existing, candidate, now);
  if (!validation.isValid || validation.isNoop) return { state, session: null, validation };

  // A session the user placed by hand is treated as manual, so automatic replanning leaves it alone.
  const session = {
    ...existing,
    date: candidate.date,
    start: candidate.start,
    end: candidate.end,
    source: 'manual',
    rescheduledCount: existing.rescheduledCount + 1,
  };

  return {
    state: {
      ...state,
      sessions: state.sessions.map((item) => (item.id === sessionId ? session : item)),
    },
    session,
    validation,
  };
}

export function setSessionLockedInState(state, sessionId, locked) {
  const existing = state.sessions.find((item) => item.id === sessionId);
  if (!existing || existing.status !== 'planned') return { state, session: null };
  if (existing.locked === locked) return { state, session: existing };

  const session = { ...existing, locked };
  return {
    state: {
      ...state,
      sessions: state.sessions.map((item) => (item.id === sessionId ? session : item)),
    },
    session,
  };
}