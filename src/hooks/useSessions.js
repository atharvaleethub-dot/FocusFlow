import { useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { withHistory } from '../services/history';
import {
  addSessionToState,
  deleteSessionFromState,
  markSessionCompletedInState,
  markSessionMissedInState,
  updateSessionInState,
} from '../services/sessionActions';
import { moveSessionInState, setSessionLockedInState } from '../services/sessionMoveActions';
import { formatDateLabel, formatTimeRange } from '../utils/dates';
import useStateAction from './useStateAction';

const titleOf = (state, taskId) => {
  const task = state.tasks.find((item) => item.id === taskId);
  return task ? `"${task.title}"` : 'a session';
};

export default function useSessions() {
  const { tasks, sessions, commitments, availability, settings } = useAppData();
  const run = useStateAction();

  // Manual calendar changes are recorded in the history so they can be undone.
  const addSession = useCallback(
    (values) =>
      run((s) =>
        withHistory(
          s,
          {
            action: 'add',
            label: `Added ${titleOf(s, values.taskId)} on ${formatDateLabel(values.date)}`,
          },
          addSessionToState(s, values)
        )
      ),
    [run]
  );

  const updateSession = useCallback(
    (id, values) =>
      run((s) => {
        const existing = s.sessions.find((item) => item.id === id);
        return withHistory(
          s,
          { action: 'edit', label: `Edited ${titleOf(s, existing ? existing.taskId : null)}` },
          updateSessionInState(s, id, values)
        );
      }),
    [run]
  );

  const deleteSession = useCallback(
    (id) =>
      run((s) => {
        const existing = s.sessions.find((item) => item.id === id);
        return withHistory(
          s,
          { action: 'delete', label: `Deleted ${titleOf(s, existing ? existing.taskId : null)}` },
          deleteSessionFromState(s, id)
        );
      }),
    [run]
  );

  const moveSession = useCallback(
    (id, candidate) =>
      run((s) => {
        const result = moveSessionInState(s, id, candidate);
        if (!result.session) return result;
        return withHistory(
          s,
          {
            action: `move:${id}`,
            coalesce: true,
            label: `Moved ${titleOf(s, result.session.taskId)} to ${formatDateLabel(
              result.session.date
            )}, ${formatTimeRange(result.session.start, result.session.end)}`,
          },
          result
        );
      }),
    [run]
  );

  const markCompleted = useCallback((id) => run((s) => markSessionCompletedInState(s, id)), [run]);
  const markMissed = useCallback((id) => run((s) => markSessionMissedInState(s, id)), [run]);
  const setSessionLocked = useCallback(
    (id, locked) => run((s) => setSessionLockedInState(s, id, locked)),
    [run]
  );

  return useMemo(
    () => ({
      tasks,
      sessions,
      commitments,
      availability,
      settings,
      addSession,
      updateSession,
      deleteSession,
      markCompleted,
      markMissed,
      moveSession,
      setSessionLocked,
    }),
    [
      tasks,
      sessions,
      commitments,
      availability,
      settings,
      addSession,
      updateSession,
      deleteSession,
      markCompleted,
      markMissed,
      moveSession,
      setSessionLocked,
    ]
  );
}