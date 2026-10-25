import { useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import {
  addCommitmentToState,
  deleteCommitmentFromState,
  saveAvailabilityInState,
  updateCommitmentInState,
} from '../services/settingsActions';
import useStateAction from './useStateAction';

export default function useSchedulingSettings() {
  const { availability, commitments, sessions } = useAppData();
  const run = useStateAction();

  const saveAvailability = useCallback(
    (next) => run((s) => saveAvailabilityInState(s, next)),
    [run]
  );
  const addCommitment = useCallback((values) => run((s) => addCommitmentToState(s, values)), [run]);
  const updateCommitment = useCallback(
    (id, values) => run((s) => updateCommitmentInState(s, id, values)),
    [run]
  );
  const deleteCommitment = useCallback((id) => run((s) => deleteCommitmentFromState(s, id)), [run]);

  return useMemo(
    () => ({
      availability,
      commitments,
      sessions,
      saveAvailability,
      addCommitment,
      updateCommitment,
      deleteCommitment,
    }),
    [
      availability,
      commitments,
      sessions,
      saveAvailability,
      addCommitment,
      updateCommitment,
      deleteCommitment,
    ]
  );
}