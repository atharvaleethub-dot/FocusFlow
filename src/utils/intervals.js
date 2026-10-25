// Intervals are { start, end } in minutes from midnight, end exclusive.

export function mergeIntervals(intervals) {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .map((interval) => ({ start: interval.start, end: interval.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push(interval);
    }
  });
  return merged;
}

// Returns the parts of `window` that are not covered by any `busy` interval.
export function subtractIntervals(window, busy) {
  const free = [];
  let cursor = window.start;

  mergeIntervals(busy).forEach((block) => {
    if (block.end <= cursor || block.start >= window.end) return;
    if (block.start > cursor) {
      free.push({ start: cursor, end: Math.min(block.start, window.end) });
    }
    cursor = Math.max(cursor, block.end);
  });

  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free;
}

export function totalMinutes(intervals) {
  return intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
}