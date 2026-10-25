const RANGES = {
  focusMinutes: [1, 180],
  shortBreakMinutes: [1, 60],
  longBreakMinutes: [1, 120],
  sessionsBeforeLongBreak: [2, 10],
};

export function focusSettingsToDraft(focus) {
  return Object.fromEntries(Object.keys(RANGES).map((key) => [key, String(focus[key])]));
}

export function validateFocusSettings(draft) {
  const errors = {};
  const focus = {};

  Object.entries(RANGES).forEach(([key, [min, max]]) => {
    const text = String(draft[key] ?? '').trim();
    const value = Number(text);
    if (text === '' || !Number.isInteger(value) || value < min || value > max) {
      errors[key] = `Enter a whole number from ${min} to ${max}.`;
    } else {
      focus[key] = value;
    }
  });

  const isValid = Object.keys(errors).length === 0;
  return { isValid, errors, focus: isValid ? focus : null };
}