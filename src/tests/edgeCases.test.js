import { describe, expect, it } from 'vitest';
import { defaultAvailability } from '../data/schema';
import { hasPlanChanges } from '../services/scheduleActions';
import { generateSchedule } from '../services/scheduler';
import { getScheduleAlerts } from '../utils/alerts';
import {
  availabilityToDraft,
  validateAvailabilityDraft,
  validateCommitmentInput,
} from '../utils/settingsValidation';
import { validateTaskInput } from '../utils/taskValidation';
import {
  NOW,
  availabilityWithDays,
  dayKey,
  deadlineAt,
  makeCommitment,
  makeIdGenerator,
  makeState,
  makeTask,
} from './helpers';

const plan = (state) => generateSchedule(state, { idGenerator: makeIdGenerator() });

describe('empty data', () => {
  it('plans nothing and warns about nothing', () => {
    const state = makeState();
    const result = plan(state);
    expect(result.summary.success).toBe(true);
    expect(hasPlanChanges(result)).toBe(false);
    expect(result.sessions).toEqual([]);
    expect(
      getScheduleAlerts({
        tasks: [],
        sessions: [],
        commitments: [],
        availability: state.availability,
        now: NOW,
      })
    ).toEqual([]);
  });
});

describe('missing availability', () => {
  it('reports it clearly when no study day is enabled', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 60, deadline: deadlineAt(3) })],
      availability: availabilityWithDays({}),
    });
    const result = plan(state);
    expect(result.added).toEqual([]);
    expect(result.unscheduled[0].reasons[0].code).toBe('no-availability');

    const alerts = getScheduleAlerts({
      tasks: state.tasks,
      sessions: [],
      commitments: [],
      availability: state.availability,
      now: NOW,
    });
    const capacity = alerts.find((item) => item.type === 'insufficient-capacity');
    expect(capacity.severity).toBe('danger');
    expect(capacity.message).toContain('No study days are enabled');
  });
});

describe('insufficient time', () => {
  it('reports no capacity when a commitment fills the whole study window', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 60, deadline: deadlineAt(0) })],
      availability: availabilityWithDays({ mon: {} }),
      commitments: [makeCommitment({ days: ['mon'], start: '16:00', end: '21:00' })],
    });
    const result = plan(state);
    expect(result.added).toEqual([]);
    expect(result.unscheduled[0].reasons[0].code).toBe('insufficient-capacity');
    expect(result.summary.success).toBe(false);
  });

  it('explains deadlines beyond the planning window', () => {
    const state = makeState({
      tasks: [makeTask({ id: 'a', estimatedMinutes: 6000, deadline: deadlineAt(90) })],
      availability: availabilityWithDays({
        mon: { start: '16:00', end: '17:00', maxMinutes: 60 },
      }),
    });
    const codes = plan(state).unscheduled[0].reasons.map((reason) => reason.code);
    expect(codes).toContain('insufficient-capacity');
    expect(codes).toContain('beyond-horizon');
  });
});

describe('conflicting commitments', () => {
  const existing = [makeCommitment({ id: 'a', days: ['mon'], start: '10:00', end: '12:00' })];
  const values = {
    title: 'Other',
    category: 'class',
    repeat: 'weekly',
    days: ['mon'],
    date: dayKey(0),
    start: '11:00',
    end: '13:00',
  };

  it('blocks overlapping commitments', () => {
    const result = validateCommitmentInput(values, { commitments: existing });
    expect(result.isValid).toBe(false);
    expect(result.errors.overlap).toBeDefined();
  });

  it('allows touching times and different weekdays', () => {
    expect(
      validateCommitmentInput({ ...values, start: '12:00', end: '13:00' }, { commitments: existing })
        .isValid
    ).toBe(true);
    expect(
      validateCommitmentInput({ ...values, days: ['tue'] }, { commitments: existing }).isValid
    ).toBe(true);
  });

  it('lets a commitment be edited without conflicting with itself', () => {
    expect(
      validateCommitmentInput(
        { ...values, start: '10:30', end: '11:30' },
        { commitments: existing, editingId: 'a' }
      ).isValid
    ).toBe(true);
  });
});

describe('availability validation', () => {
  const saved = defaultAvailability();

  it('rejects an end before the start and a limit above the window', () => {
    const draft = availabilityToDraft(saved);
    draft.days.mon.end = '15:00';
    draft.days.tue.maxMinutes = '9999';
    const result = validateAvailabilityDraft(draft, saved);
    expect(result.isValid).toBe(false);
    expect(result.errors['mon.end']).toBeDefined();
    expect(result.errors['tue.maxMinutes']).toBeDefined();
  });

  it('ignores the fields of disabled days and keeps their saved values', () => {
    const draft = availabilityToDraft(saved);
    draft.days.wed = { enabled: false, start: '', end: '', maxMinutes: '' };
    const result = validateAvailabilityDraft(draft, saved);
    expect(result.isValid).toBe(true);
    expect(result.availability.days.wed).toEqual({ ...saved.days.wed, enabled: false });
  });

  it('rejects invalid break and session lengths', () => {
    const draft = availabilityToDraft(saved);
    draft.preferredSessionMinutes = '5';
    draft.minBreakMinutes = '-1';
    const result = validateAvailabilityDraft(draft, saved);
    expect(result.errors.preferredSessionMinutes).toBeDefined();
    expect(result.errors.minBreakMinutes).toBeDefined();
  });
});

describe('task form validation', () => {
  const values = {
    title: 'Revise',
    subject: 'Math',
    notes: '',
    estimatedMinutes: '60',
    deadlineDate: dayKey(2),
    deadlineTime: '10:00',
    priority: 'medium',
  };

  it('accepts a valid task and converts the duration to a number', () => {
    const result = validateTaskInput(values, { now: NOW });
    expect(result.isValid).toBe(true);
    expect(result.values.estimatedMinutes).toBe(60);
    expect(result.values.deadline).toBe(`${dayKey(2)}T10:00`);
  });

  it('rejects an empty title and invalid durations', () => {
    expect(validateTaskInput({ ...values, title: '   ' }, { now: NOW }).errors.title).toBeDefined();
    ['0', 'abc', '10000', '12.5', ''].forEach((estimatedMinutes) => {
      expect(
        validateTaskInput({ ...values, estimatedMinutes }, { now: NOW }).errors.estimatedMinutes
      ).toBeDefined();
    });
  });

  it('rejects past deadlines for new tasks but lets overdue tasks keep their deadline', () => {
    const past = { ...values, deadlineDate: dayKey(-1), deadlineTime: '10:00' };
    expect(validateTaskInput(past, { now: NOW }).errors.deadlineDate).toContain('future');

    const existingTask = makeTask({ deadline: `${dayKey(-1)}T10:00` });
    expect(validateTaskInput(past, { now: NOW, existingTask }).isValid).toBe(true);
  });

  it('rejects impossible dates and times', () => {
    expect(
      validateTaskInput({ ...values, deadlineDate: '2026-02-31' }, { now: NOW }).errors.deadlineDate
    ).toBeDefined();
    expect(
      validateTaskInput({ ...values, deadlineTime: '' }, { now: NOW }).errors.deadlineTime
    ).toBeDefined();
  });
});