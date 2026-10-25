import { useCallback } from 'react';
import { useAppData } from '../context/AppDataContext';

// Runs a pure action ((state) => ({ state, ...info })) against the freshest state
// and returns its info.
export default function useStateAction() {
  const { updateState } = useAppData();

  return useCallback(
    (action) => {
      let result;
      updateState((previous) => {
        result = action(previous);
        return result.state;
      });
      return result;
    },
    [updateState]
  );
}