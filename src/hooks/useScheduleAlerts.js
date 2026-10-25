import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { getScheduleAlerts } from '../utils/alerts';
import useNow from './useNow';

// Recomputed when the data changes and once per minute (deadlines move closer with time).
export default function useScheduleAlerts() {
  const { tasks, sessions, commitments, availability } = useAppData();
  const now = useNow();

  return useMemo(
    () => getScheduleAlerts({ tasks, sessions, commitments, availability, now }),
    [tasks, sessions, commitments, availability, now]
  );
}