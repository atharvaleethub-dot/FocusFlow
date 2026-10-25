import { createDemoData } from '../data/demoData';
import { STORAGE_VERSION } from '../data/schema';
import { toDateKey } from '../utils/dates';
import { sanitizeState } from './validation';

export const STORAGE_KEY = 'focusflow:data';
const CORRUPT_KEY = 'focusflow:data:corrupt';
const APP_ID = 'focusflow';

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function isEnvelope(value) {
  return (
    isPlainObject(value) &&
    value.app === APP_ID &&
    Number.isInteger(value.version) &&
    isPlainObject(value.data)
  );
}

// Only serializable data is persisted (never timers or functions).
function buildEnvelope(state) {
  return {
    app: APP_ID,
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    data: {
      tasks: state.tasks,
      sessions: state.sessions,
      commitments: state.commitments,
      availability: state.availability,
      settings: state.settings,
      history: state.history,
    },
  };
}

// When STORAGE_VERSION increases, add migration steps here.
function migrateData(envelope) {
  if (envelope.version > STORAGE_VERSION) return null;
  return envelope.data;
}

function stashUnreadable(raw) {
  try {
    localStorage.setItem(CORRUPT_KEY, raw);
  } catch {
    // Nothing more we can do if storage is full or blocked.
  }
}

function recover(raw, message) {
  stashUnreadable(raw);
  return { state: createDemoData(), status: 'recovered', issues: [message] };
}

// status: 'first-launch' | 'ok' | 'repaired' | 'recovered' | 'unavailable'
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: createDemoData(), status: 'unavailable', issues: [] };
  }

  if (raw === null) return { state: createDemoData(), status: 'first-launch', issues: [] };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return recover(raw, 'Your saved data was not valid JSON.');
  }
  if (!isEnvelope(parsed)) return recover(raw, 'Your saved data had an unexpected format.');

  const data = migrateData(parsed);
  if (!data) return recover(raw, 'Your saved data was made by a newer version of FocusFlow.');

  const { state, issues } = sanitizeState(data);
  if (issues.length > 0) {
    stashUnreadable(raw);
    return { state, status: 'repaired', issues };
  }
  return { state, status: 'ok', issues: [] };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildEnvelope(state)));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error && error.name === 'QuotaExceededError'
          ? 'Browser storage is full.'
          : 'Browser storage is unavailable.',
    };
  }
}

export function getStorageInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { saved: false };
    const parsed = JSON.parse(raw);
    return {
      saved: true,
      version: parsed.version,
      savedAt: parsed.savedAt,
      sizeKb: Math.round((raw.length / 1024) * 10) / 10,
    };
  } catch {
    return { saved: false };
  }
}

export function createBackupJson(state) {
  return JSON.stringify(buildEnvelope(state), null, 2);
}

export function downloadBackup(state) {
  const blob = new Blob([createBackupJson(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `focusflow-backup-${toDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Strict: a backup is only accepted when it contains no invalid data.
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!isEnvelope(parsed)) return { ok: false, error: 'This is not a FocusFlow backup file.' };

  const data = migrateData(parsed);
  if (!data) return { ok: false, error: 'This backup was made by a newer version of FocusFlow.' };
  if (
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.sessions) ||
    !Array.isArray(data.commitments)
  ) {
    return { ok: false, error: 'The backup is missing tasks, sessions, or commitments.' };
  }

  const { state, issues } = sanitizeState(data);
  if (issues.length > 0) {
    const shown = issues.slice(0, 3).join('; ');
    const extra = issues.length > 3 ? ` (+${issues.length - 3} more)` : '';
    return { ok: false, error: `The backup contains invalid data: ${shown}${extra}.` };
  }
  return { ok: true, state };
}