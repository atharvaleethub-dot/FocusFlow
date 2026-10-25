import { sanitizeTimer } from './timerEngine';

export const TIMER_KEY = 'focusflow:timer';

// Only plain serializable timer state is stored. Intervals are never persisted.
export function loadTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (raw === null) return null;
    return sanitizeTimer(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveTimer(timer) {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    return true;
  } catch {
    return false;
  }
}