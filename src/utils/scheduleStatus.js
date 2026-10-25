import { combineDateAndTime } from './dates';

// Planned sessions whose end time has passed without being completed or marked missed.
export function getStalePlannedSessions(sessions, now = new Date()) {
  return sessions.filter(
    (session) =>
      session.status === 'planned' && combineDateAndTime(session.date, session.end) <= now
  );
}