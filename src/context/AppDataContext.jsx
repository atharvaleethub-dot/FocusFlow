/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createDemoData } from '../data/demoData';
import { createBaseState } from '../data/schema';
import { downloadBackup, loadState, saveState } from '../services/storage';
import { useToast } from './ToastContext';

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const toast = useToast();
  const [initial] = useState(loadState);
  const [state, setState] = useState(initial.state);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const stateRef = useRef(initial.state);
  const storageAvailable = useRef(initial.status !== 'unavailable');
  const saveErrorShown = useRef(false);
  const startupHandled = useRef(false);

  // One-time startup work: persist first-launch/repaired data and tell the user what happened.
  useEffect(() => {
    if (startupHandled.current) return;
    startupHandled.current = true;

    if (initial.status !== 'ok' && initial.status !== 'unavailable') {
      const result = saveState(initial.state);
      if (!result.ok) toast.error('Could not save your data', result.error);
    }

    switch (initial.status) {
      case 'first-launch':
        toast.info(
          'Welcome to FocusFlow',
          'Demo data was loaded so you can explore. You can reload it any time from Settings.'
        );
        break;
      case 'recovered':
        toast.error(
          'Saved data could not be read',
          `${initial.issues[0]} Demo data was loaded and the unreadable data was kept as a recovery copy.`
        );
        break;
      case 'repaired':
        toast.warning(
          'Some saved items were repaired',
          `${initial.issues.length} invalid item(s) were removed. The original was kept as a recovery copy.`
        );
        break;
      case 'unavailable':
        toast.warning(
          'Browser storage is unavailable',
          'FocusFlow still works, but changes will not be kept after you close this tab.'
        );
        break;
      default:
        break;
    }
  }, [initial, toast]);

  // Every change goes through here: update state, then persist synchronously.
  const updateState = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(stateRef.current) : updater;
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);

      if (!storageAvailable.current) return;
      const result = saveState(next);
      if (result.ok) {
        saveErrorShown.current = false;
        setLastSavedAt(new Date().toISOString());
      } else if (!saveErrorShown.current) {
        saveErrorShown.current = true;
        toast.error('Could not save your changes', result.error);
      }
    },
    [toast]
  );

  const replaceAll = useCallback((next) => updateState(next), [updateState]);
  const resetToDemo = useCallback(() => updateState(createDemoData()), [updateState]);
  const clearAll = useCallback(() => updateState(createBaseState()), [updateState]);
  const exportBackup = useCallback(() => downloadBackup(stateRef.current), []);

  const value = useMemo(
    () => ({
      ...state,
      state,
      lastSavedAt,
      updateState,
      replaceAll,
      resetToDemo,
      clearAll,
      exportBackup,
    }),
    [state, lastSavedAt, updateState, replaceAll, resetToDemo, clearAll, exportBackup]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}