import { describe, expect, it } from 'vitest';
import { mergeIntervals, subtractIntervals, totalMinutes } from '../utils/intervals';

describe('mergeIntervals', () => {
  it('merges overlapping and touching intervals', () => {
    expect(
      mergeIntervals([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
        { start: 10, end: 20 },
      ])
    ).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
  });

  it('ignores empty and inverted intervals', () => {
    expect(
      mergeIntervals([
        { start: 5, end: 5 },
        { start: 9, end: 3 },
      ])
    ).toEqual([]);
  });
});

describe('subtractIntervals', () => {
  it('returns the gaps around busy intervals', () => {
    expect(
      subtractIntervals({ start: 0, end: 100 }, [
        { start: 10, end: 20 },
        { start: 15, end: 30 },
        { start: 90, end: 120 },
      ])
    ).toEqual([
      { start: 0, end: 10 },
      { start: 30, end: 90 },
    ]);
  });

  it('ignores busy intervals outside the window', () => {
    expect(subtractIntervals({ start: 50, end: 100 }, [{ start: 0, end: 40 }])).toEqual([
      { start: 50, end: 100 },
    ]);
  });

  it('returns nothing when the window is fully busy', () => {
    expect(subtractIntervals({ start: 10, end: 20 }, [{ start: 0, end: 30 }])).toEqual([]);
  });

  it('sums minutes', () => {
    expect(
      totalMinutes([
        { start: 0, end: 10 },
        { start: 30, end: 90 },
      ])
    ).toBe(70);
  });
});