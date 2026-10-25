import { useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { undoLastHistory } from '../services/history';
import useStateAction from './useStateAction';

export default function useHistory() {
  const { history } = useAppData();
  const run = useStateAction();

  // Returns { undone } where undone is the reversed entry (or null when there was nothing to undo).
  const undo = useCallback(() => run((state) => undoLastHistory(state)), [run]);

  return useMemo(
    () => ({ history, latest: history[0] ?? null, canUndo: history.length > 0, undo }),
    [history, undo]
  );
}