import { describe, expect, it } from 'vitest';
import {
  addDays,
  combineDateAndTime,
  formatDuration,
  formatLocalDateTime,
  getWeekdayKey,
  isValidTime,
  minutesToTime,
  parseDateKey,
  parseLocalDateTime,
  startOfWeek,
  timeToMinutes,
  toDateKey,
} from '../utils/dates';

describe('date keys', () => {
  it('formats local dates without shifting through UTC', () => {
    expect(toDateKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('rejects impossible dates', () => {
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('not-a-date')).toBeNull();
  });

  it('parses valid dates as local midnight', () => {
    const date = parseDateKey('2026-10-12');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(12);
    expect(date.getHours()).toBe(0);
  });

  it('returns weekday keys', () => {
    expect(getWeekdayKey('2026-10-12')).toBe('mon');
    expect(getWeekdayKey('2026-10-18')).toBe('sun');
  });
});

describe('times', () => {
  it('converts between HH:MM and minutes', () => {
    expect(timeToMinutes('16:30')).toBe(990);
    expect(timeToMinutes('24:00')).toBeNull();
    expect(minutesToTime(990)).toBe('16:30');
    expect(minutesToTime(2000)).toBe('23:59');
  });

  it('validates time strings', () => {
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
  });

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(120)).toBe('2h');
  });
});

describe('weeks and day arithmetic', () => {
  it('finds the start of the week for Monday and Sunday starts', () => {
    const wednesday = new Date(2026, 9, 14, 15, 0);
    expect(toDateKey(startOfWeek(wednesday, 1))).toBe('2026-10-12');
    expect(toDateKey(startOfWeek(wednesday, 0))).toBe('2026-10-11');
    expect(toDateKey(startOfWeek(new Date(2026, 9, 18), 1))).toBe('2026-10-12');
  });

  it('adds days across month boundaries', () => {
    expect(toDateKey(addDays(new Date(2026, 9, 31), 1))).toBe('2026-11-01');
  });
});

describe('local date-times', () => {
  it('parses and formats round trip', () => {
    const date = parseLocalDateTime('2026-10-12T09:05');
    expect(date.getHours()).toBe(9);
    expect(date.getMinutes()).toBe(5);
    expect(formatLocalDateTime(date)).toBe('2026-10-12T09:05');
  });

  it('rejects invalid date-times', () => {
    expect(parseLocalDateTime('2026-10-12T24:00')).toBeNull();
    expect(parseLocalDateTime('2026-02-30T10:00')).toBeNull();
    expect(parseLocalDateTime('2026-10-12 10:00')).toBeNull();
  });

  it('combines a date key and a time', () => {
    const date = combineDateAndTime('2026-10-12', '16:30');
    expect(date.getDate()).toBe(12);
    expect(date.getHours()).toBe(16);
    expect(date.getMinutes()).toBe(30);
    expect(combineDateAndTime('2026-10-12', '99:99')).toBeNull();
  });
});