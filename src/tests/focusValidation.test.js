import { describe, expect, it } from 'vitest';
import { focusSettingsToDraft, validateFocusSettings } from '../utils/focusValidation';

const valid = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

describe('validateFocusSettings', () => {
  it('accepts valid values and converts them to numbers', () => {
    const result = validateFocusSettings(focusSettingsToDraft(valid));
    expect(result.isValid).toBe(true);
    expect(result.focus).toEqual(valid);
  });

  it('rejects out-of-range, fractional, and empty values', () => {
    const result = validateFocusSettings({
      focusMinutes: '0',
      shortBreakMinutes: '61',
      longBreakMinutes: '2.5',
      sessionsBeforeLongBreak: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.focus).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual([
      'focusMinutes',
      'longBreakMinutes',
      'sessionsBeforeLongBreak',
      'shortBreakMinutes',
    ]);
  });

  it('accepts the boundary values', () => {
    const result = validateFocusSettings({
      focusMinutes: '180',
      shortBreakMinutes: '1',
      longBreakMinutes: '120',
      sessionsBeforeLongBreak: '2',
    });
    expect(result.isValid).toBe(true);
  });
});