import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoData } from '../data/demoData';
import { STORAGE_VERSION } from '../data/schema';
import {
  STORAGE_KEY,
  createBackupJson,
  loadState,
  parseBackup,
  saveState,
} from '../services/storage';
import { createTimer, startRun } from '../services/timerEngine';
import { TIMER_KEY, loadTimer, saveTimer } from '../services/timerStorage';
import { NOW } from './helpers';

const CORRUPT_KEY = 'focusflow:data:corrupt';

class MemoryStorage {
  constructor() {
    this.items = new Map();
  }

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    this.items.set(key, String(value));
  }

  removeItem(key) {
    this.items.delete(key);
  }
}

let storage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadState', () => {
  it('loads demo data on first launch', () => {
    const result = loadState();
    expect(result.status).toBe('first-launch');
    expect(result.state.tasks.length).toBeGreaterThan(0);
  });

  it('round-trips saved data without changes or issues', () => {
    const demo = createDemoData(NOW);
    expect(saveState(demo).ok).toBe(true);

    const result = loadState();
    expect(result.status).toBe('ok');
    expect(result.issues).toEqual([]);
    expect(result.state.tasks.map((t) => t.title)).toEqual(demo.tasks.map((t) => t.title));
    expect(result.state.sessions).toHaveLength(demo.sessions.length);
    expect(result.state.commitments).toHaveLength(demo.commitments.length);
  });

  it('recovers from malformed JSON and keeps a copy of the unreadable text', () => {
    storage.setItem(STORAGE_KEY, '{broken');
    const result = loadState();
    expect(result.status).toBe('recovered');
    expect(result.issues[0]).toContain('valid JSON');
    expect(result.state.tasks.length).toBeGreaterThan(0);
    expect(storage.getItem(CORRUPT_KEY)).toBe('{broken');
  });

  it('recovers from data with the wrong shape', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }));
    expect(loadState().status).toBe('recovered');
  });

  it('refuses data from a newer version', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: 'focusflow', version: STORAGE_VERSION + 1, data: {} })
    );
    const result = loadState();
    expect(result.status).toBe('recovered');
    expect(result.issues[0]).toContain('newer');
  });

  it('repairs data with a few invalid items and keeps a recovery copy', () => {
    const demo = createDemoData(NOW);
    saveState(demo);
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    parsed.data.tasks.push({ id: 'broken' });
    storage.setItem(STORAGE_KEY, JSON.stringify(parsed));

    const result = loadState();
    expect(result.status).toBe('repaired');
    expect(result.state.tasks).toHaveLength(demo.tasks.length);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(storage.getItem(CORRUPT_KEY)).not.toBeNull();
  });

  it('keeps working when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(loadState().status).toBe('unavailable');
    expect(saveState(createDemoData(NOW)).ok).toBe(false);
  });
});

describe('parseBackup', () => {
  const demo = createDemoData(NOW);

  it('accepts a backup exported by the app', () => {
    const result = parseBackup(createBackupJson(demo));
    expect(result.ok).toBe(true);
    expect(result.state.tasks).toHaveLength(demo.tasks.length);
  });

  it('rejects text that is not JSON or not a FocusFlow backup', () => {
    expect(parseBackup('nope').ok).toBe(false);
    const other = parseBackup(JSON.stringify({ app: 'something-else', version: 1, data: {} }));
    expect(other.ok).toBe(false);
    expect(other.error).toContain('not a FocusFlow backup');
  });

  it('rejects backups with missing collections', () => {
    const envelope = JSON.parse(createBackupJson(demo));
    delete envelope.data.tasks;
    const result = parseBackup(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('missing');
  });

  it('rejects backups containing invalid data instead of importing part of it', () => {
    const envelope = JSON.parse(createBackupJson(demo));
    envelope.data.tasks[0].priority = 'super';
    const result = parseBackup(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('invalid data');
  });
});

describe('timer storage', () => {
  it('ignores missing, malformed, and invalid saved timers', () => {
    expect(loadTimer()).toBeNull();
    storage.setItem(TIMER_KEY, '{bad');
    expect(loadTimer()).toBeNull();
    storage.setItem(TIMER_KEY, JSON.stringify({ phase: 'focus' }));
    expect(loadTimer()).toBeNull();
  });

  it('round-trips a running timer', () => {
    const running = startRun(createTimer({ taskId: 't' }), {
      phase: 'focus',
      durationMs: 60000,
      nowMs: 1000,
      runId: 'run-1',
      taskId: 't',
    });
    expect(saveTimer(running)).toBe(true);
    expect(loadTimer()).toEqual(running);
  });
});