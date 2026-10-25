import { PRIORITY_META, createSession } from '../data/schema';
import {
  WEEKDAY_ORDER,
  addDays,
  combineDateAndTime,
  formatDeadline,
  formatDuration,
  getWeekdayKey,
  minutesToTime,
  parseLocalDateTime,
  startOfDay,
  timeToMinutes,
  toDateKey,
} from '../utils/dates';
import { createId } from '../utils/ids';
import { subtractIntervals, totalMinutes } from '../utils/intervals';
import {
  MAX_SESSION_MINUTES,
  findCommitmentConflicts,
  getCommitmentsForDate,
  intervalsOverlap,
  isWithinAvailability,
} from '../utils/schedulingHelpers';
import { getSessionMinutes, getStudiedMinutes, getTaskRemainingMinutes } from '../utils/stats';

/*
 * SCHEDULING ENGINE (pure functions, no React, no storage)
 *
 * generateSchedule({ tasks, sessions, commitments, availability, now }, options)
 *   1. Past planned sessions become "missed" (their time is replanned).
 *   2. Future planned sessions are validated; valid ones are kept, invalid ones removed.
 *      Locked sessions are always kept.
 *   3. Remaining work per task = estimate - studied time - time already covered by kept sessions.
 *   4. Tasks are processed in priority order and placed into the earliest free slots.
 *   5. Anything that does not fit is reported in `unscheduled` with reasons.
 */

export const PRIORITY_LEAD_HOURS = { urgent: 48, high: 24, medium: 0, low: -12 };

export const DEFAULT_OPTIONS = {
  horizonDays: 60,
  minSessionMinutes: 15,
  perTaskDayFactor: 2, // soft cap: preferred session length x this many minutes per task per day
  rebuild: false, // true = also replan unlocked automatic sessions
  markStaleAsMissed: true,
};

export const REMOVAL_MESSAGES = {
  'after-deadline': 'It ended after the task deadline.',
  'commitment-conflict': 'It overlapped a fixed commitment.',
  overlap: 'It overlapped another study session.',
  'outside-availability': 'It was outside your study availability.',
  'daily-limit': 'It exceeded your daily study limit.',
  'break-violation': 'It was closer than your minimum break to another session.',
  rebuild: 'It was replanned because a full rebuild was requested.',
  'task-unavailable': 'Its task is completed or no longer exists.',
};

const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const SNAP_MINUTES = 5;

const snapUp = (minutes) => Math.ceil(minutes / SNAP_MINUTES) * SNAP_MINUTES;

const byTime = (a, b) =>
  a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id);

function addTo(map, key, amount) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

// ---------- Prioritization ----------

export function getEffectiveDeadlineTime(task) {
  const deadline = parseLocalDateTime(task.deadline);
  return deadline.getTime() - (PRIORITY_LEAD_HOURS[task.priority] ?? 0) * HOUR_MS;
}

export function prioritizeTasks(tasks) {
  return [...tasks].sort(
    (a, b) =>
      getEffectiveDeadlineTime(a) - getEffectiveDeadlineTime(b) ||
      PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank ||
      a.deadline.localeCompare(b.deadline) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

// ---------- Free-slot discovery ----------

// Minutes a session counts against the daily limit.
function countedMinutes(session) {
  if (session.status === 'planned') return getSessionMinutes(session);
  if (session.status === 'completed') return getStudiedMinutes(session);
  return 0;
}

export function getDailyUsedMinutes(sessions, dateKey) {
  return sessions
    .filter((session) => session.date === dateKey)
    .reduce((sum, session) => sum + countedMinutes(session), 0);
}

// Free intervals where a new session could start and end, already padded for breaks.
export function findFreeSlots({
  dateKey,
  availability,
  commitments,
  sessions,
  earliestMinute = 0,
  latestMinute = 24 * 60,
}) {
  const day = availability.days[getWeekdayKey(dateKey)];
  if (!day || !day.enabled) return [];

  const windowStart = Math.max(timeToMinutes(day.start), earliestMinute);
  const windowEnd = Math.min(timeToMinutes(day.end), latestMinute);
  if (windowEnd <= windowStart) return [];

  const minBreak = availability.minBreakMinutes;
  const busy = [
    ...getCommitmentsForDate(commitments, dateKey).map((commitment) => ({
      start: timeToMinutes(commitment.start),
      end: timeToMinutes(commitment.end),
    })),
    ...sessions
      .filter((session) => session.date === dateKey && session.status !== 'missed')
      .map((session) => ({
        start: timeToMinutes(session.start) - minBreak,
        end: timeToMinutes(session.end) + minBreak,
      })),
  ];

  return subtractIntervals({ start: windowStart, end: windowEnd }, busy);
}

// ---------- Existing sessions ----------

function gapMinutes(a, b) {
  const aStart = timeToMinutes(a.start);
  const aEnd = timeToMinutes(a.end);
  const bStart = timeToMinutes(b.start);
  const bEnd = timeToMinutes(b.end);
  return aStart >= bEnd ? aStart - bEnd : bStart - aEnd;
}

function getHardProblem(session, task, others, commitments) {
  const end = combineDateAndTime(session.date, session.end);
  if (end > parseLocalDateTime(task.deadline)) {
    return { code: 'after-deadline', message: 'ends after its deadline' };
  }
  if (findCommitmentConflicts(commitments, session).length > 0) {
    return { code: 'commitment-conflict', message: 'overlaps a fixed commitment' };
  }
  const start = timeToMinutes(session.start);
  const endMinutes = timeToMinutes(session.end);
  const clash = others.some(
    (other) =>
      other.id !== session.id &&
      other.date === session.date &&
      other.status !== 'missed' &&
      intervalsOverlap(start, endMinutes, timeToMinutes(other.start), timeToMinutes(other.end))
  );
  if (clash) return { code: 'overlap', message: 'overlaps another study session' };
  return null;
}

// Extra checks for automatic sessions only. Manual sessions are the user's own choice.
function getAutoProblem(session, others, availability) {
  if (!isWithinAvailability(session, availability)) return 'outside-availability';

  const day = availability.days[getWeekdayKey(session.date)];
  const siblings = others.filter((other) => other.id !== session.id);
  if (getDailyUsedMinutes(siblings, session.date) + getSessionMinutes(session) > day.maxMinutes) {
    return 'daily-limit';
  }
  const tooClose = siblings.some(
    (other) =>
      other.date === session.date &&
      other.status !== 'missed' &&
      gapMinutes(session, other) < availability.minBreakMinutes
  );
  return tooClose ? 'break-violation' : null;
}

function classifyExistingSessions({ tasks, sessions, commitments, availability }, now, options) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const fixed = []; // never changed: completed, missed, and newly missed copies
  const newlyMissed = [];
  const plannedFuture = [];

  sessions.forEach((session) => {
    if (session.status !== 'planned') {
      fixed.push(session);
      return;
    }
    if (combineDateAndTime(session.date, session.end) > now) {
      plannedFuture.push(session);
      return;
    }
    if (options.markStaleAsMissed) {
      const missed = { ...session, status: 'missed', completedAt: null };
      newlyMissed.push({ before: session, after: missed });
      fixed.push(missed);
    } else {
      fixed.push(session);
    }
  });

  const kept = [];
  const removed = [];
  const warnings = [];
  const drop = (session, reason) =>
    removed.push({ session, reason, message: REMOVAL_MESSAGES[reason] });
  const occupied = () => [...fixed, ...kept];

  // Locked sessions are processed first so everything else is validated around them.
  plannedFuture
    .filter((session) => session.locked)
    .sort(byTime)
    .forEach((session) => {
      const task = taskById.get(session.taskId);
      if (!task || task.completed) {
        drop(session, 'task-unavailable');
        return;
      }
      const problem = getHardProblem(session, task, occupied(), commitments);
      if (problem) {
        warnings.push({
          code: 'locked-session-invalid',
          sessionId: session.id,
          taskId: task.id,
          message: `A locked session for "${task.title}" ${problem.message}. It was kept because it is locked.`,
        });
      }
      kept.push(session);
    });

  plannedFuture
    .filter((session) => !session.locked)
    .sort(byTime)
    .forEach((session) => {
      const task = taskById.get(session.taskId);
      if (!task || task.completed) {
        drop(session, 'task-unavailable');
        return;
      }
      if (options.rebuild && session.source === 'auto') {
        drop(session, 'rebuild');
        return;
      }
      const hard = getHardProblem(session, task, occupied(), commitments);
      if (hard) {
        drop(session, hard.code);
        return;
      }
      if (session.source === 'auto') {
        const soft = getAutoProblem(session, occupied(), availability);
        if (soft) {
          drop(session, soft);
          return;
        }
      }
      kept.push(session);
    });

  const coverage = new Map();
  kept.forEach((session) => addTo(coverage, session.taskId, getSessionMinutes(session)));

  return { fixed, kept, removed, newlyMissed, warnings, coverage };
}

// ---------- Placement ----------

function getPlanningDays({ today, horizonEnd }, task) {
  const deadline = parseLocalDateTime(task.deadline);
  const deadlineDay = startOfDay(deadline);
  const beyondHorizon = deadlineDay > horizonEnd;
  const lastDay = beyondHorizon ? horizonEnd : deadlineDay;
  const spanDays = Math.round((lastDay - today) / DAY_MS);

  const dayKeys = [];
  for (let index = 0; index <= spanDays; index += 1) {
    dayKeys.push(toDateKey(addDays(today, index)));
  }
  return {
    dayKeys,
    beyondHorizon,
    deadlineKey: toDateKey(deadline),
    deadlineMinutes: deadline.getHours() * 60 + deadline.getMinutes(),
  };
}

function getDayBounds(ctx, planning, dateKey) {
  return {
    earliest: dateKey === ctx.todayKey ? ctx.cutoff : 0,
    latest: dateKey === planning.deadlineKey ? planning.deadlineMinutes : 24 * 60,
  };
}

function planTask(ctx, task, needed, movedMinutes) {
  const { availability, commitments, options, working } = ctx;
  const planning = getPlanningDays(ctx, task);
  const preferred = availability.preferredSessionMinutes;
  const dayCap = options.perTaskDayFactor > 0 ? preferred * options.perTaskDayFactor : Infinity;

  const placed = [];
  let stillNeeded = needed;
  let moveBudget = movedMinutes;

  const runPass = (capPerDay) => {
    for (const dateKey of planning.dayKeys) {
      if (stillNeeded <= 0) return;
      const day = availability.days[getWeekdayKey(dateKey)];
      if (!day || !day.enabled) continue;
      const { earliest, latest } = getDayBounds(ctx, planning, dateKey);

      while (stillNeeded > 0) {
        const dailyLeft = day.maxMinutes - getDailyUsedMinutes(working, dateKey);
        const taskToday = working
          .filter(
            (session) =>
              session.date === dateKey &&
              session.taskId === task.id &&
              session.status === 'planned'
          )
          .reduce((sum, session) => sum + getSessionMinutes(session), 0);
        const taskCapLeft = capPerDay - taskToday;
        if (dailyLeft <= 0 || taskCapLeft <= 0) break;

        const slots = findFreeSlots({
          dateKey,
          availability,
          commitments,
          sessions: working,
          earliestMinute: earliest,
          latestMinute: latest,
        });

        let created = null;
        for (const slot of slots) {
          const start = snapUp(slot.start);
          const maxFit = Math.min(slot.end - start, dailyLeft, taskCapLeft, MAX_SESSION_MINUTES);
          let length = Math.min(stillNeeded, preferred, maxFit);
          if (length < Math.min(options.minSessionMinutes, stillNeeded)) continue;

          // Avoid leaving a tiny leftover: absorb it into this session when it fits.
          const tail = stillNeeded - length;
          if (tail > 0 && tail < options.minSessionMinutes && length + tail <= maxFit) {
            length += tail;
          }

          created = createSession({
            id: options.idGenerator(),
            taskId: task.id,
            date: dateKey,
            start: minutesToTime(start),
            end: minutesToTime(start + length),
            status: 'planned',
            source: 'auto',
            locked: false,
            rescheduledCount: moveBudget > 0 ? 1 : 0,
          });
          break;
        }

        if (!created) break;
        const length = getSessionMinutes(created);
        working.push(created);
        placed.push(created);
        stillNeeded -= length;
        moveBudget -= length;
      }
    }
  };

  runPass(dayCap);
  if (stillNeeded > 0 && Number.isFinite(dayCap)) runPass(Infinity);

  return { placed, stillNeeded, beyondHorizon: planning.beyondHorizon };
}

// ---------- Explaining what does not fit ----------

function getCapacityBeforeDeadline(ctx, task, sessions) {
  const planning = getPlanningDays(ctx, task);
  let total = 0;
  planning.dayKeys.forEach((dateKey) => {
    const day = ctx.availability.days[getWeekdayKey(dateKey)];
    if (!day || !day.enabled) return;
    const { earliest, latest } = getDayBounds(ctx, planning, dateKey);
    const free = totalMinutes(
      findFreeSlots({
        dateKey,
        availability: ctx.availability,
        commitments: ctx.commitments,
        sessions,
        earliestMinute: earliest,
        latestMinute: latest,
      })
    );
    const dailyLeft = Math.max(0, day.maxMinutes - getDailyUsedMinutes(sessions, dateKey));
    total += Math.min(free, dailyLeft);
  });
  return total;
}

function explainShortfall(ctx, task, needed, beyondHorizon, snapshot, hasEnabledDay) {
  const reasons = [];

  if (!hasEnabledDay) {
    reasons.push({
      code: 'no-availability',
      message: 'No study days are enabled in your availability settings.',
    });
  } else {
    const capacity = getCapacityBeforeDeadline(ctx, task, snapshot);
    if (capacity < needed) {
      reasons.push({
        code: 'insufficient-capacity',
        message: `Only ${formatDuration(capacity)} of free study time exists before the deadline (${formatDeadline(
          task.deadline,
          ctx.now
        )}), but ${formatDuration(
          needed
        )} still needs to be scheduled. Add availability, free up commitments, or extend the deadline.`,
      });
    } else {
      reasons.push({
        code: 'taken-by-other-tasks',
        message:
          'Free time existed before the deadline, but it was used by tasks planned first (higher priority or earlier deadline) or is split into slots too short to use.',
      });
    }
  }

  if (beyondHorizon) {
    reasons.push({
      code: 'beyond-horizon',
      message: `Only the next ${ctx.options.horizonDays} days are planned. The rest can be scheduled later.`,
    });
  }
  return reasons;
}

function buildUnscheduled(task, remaining, scheduled, shortfall, reasons) {
  return {
    taskId: task.id,
    title: task.title,
    priority: task.priority,
    deadline: task.deadline,
    remainingMinutes: remaining,
    scheduledMinutes: scheduled,
    shortfallMinutes: shortfall,
    reasons,
  };
}

// ---------- Public API ----------

export function generateSchedule(input, userOptions = {}) {
  const options = {
    ...DEFAULT_OPTIONS,
    idGenerator: () => createId('session'),
    ...userOptions,
  };
  const now = input.now ?? new Date();
  const { tasks, sessions, commitments, availability } = input;

  const classified = classifyExistingSessions(
    { tasks, sessions, commitments, availability },
    now,
    options
  );
  const working = [...classified.fixed, ...classified.kept];
  const snapshot = [...working];

  // Minutes that were displaced (missed or removed) per task; replacements are flagged as rescheduled.
  const movedMinutes = new Map();
  classified.newlyMissed.forEach(({ before }) =>
    addTo(movedMinutes, before.taskId, getSessionMinutes(before))
  );
  classified.removed.forEach(({ session, reason }) => {
    if (reason !== 'task-unavailable') addTo(movedMinutes, session.taskId, getSessionMinutes(session));
  });

  const today = startOfDay(now);
  const ctx = {
    now,
    today,
    horizonEnd: addDays(today, options.horizonDays),
    cutoff: snapUp(now.getHours() * 60 + now.getMinutes()),
    todayKey: toDateKey(now),
    availability,
    commitments,
    options,
    working,
  };
  const hasEnabledDay = WEEKDAY_ORDER.some((key) => availability.days[key].enabled);

  const added = [];
  const unscheduled = [];

  prioritizeTasks(tasks.filter((task) => !task.completed)).forEach((task) => {
    const remaining = getTaskRemainingMinutes(task, sessions);
    const covered = classified.coverage.get(task.id) ?? 0;
    const needed = remaining - covered;
    if (needed <= 0) return;

    if (parseLocalDateTime(task.deadline) <= now) {
      unscheduled.push(
        buildUnscheduled(task, remaining, covered, needed, [
          {
            code: 'deadline-passed',
            message: `The deadline (${formatDeadline(task.deadline, now)}) has already passed.`,
          },
        ])
      );
      return;
    }

    const outcome = planTask(ctx, task, needed, movedMinutes.get(task.id) ?? 0);
    added.push(...outcome.placed);

    if (outcome.stillNeeded > 0) {
      unscheduled.push(
        buildUnscheduled(
          task,
          remaining,
          covered + (needed - outcome.stillNeeded),
          outcome.stillNeeded,
          explainShortfall(ctx, task, needed, outcome.beyondHorizon, snapshot, hasEnabledDay)
        )
      );
    }
  });

  const newlyMissed = classified.newlyMissed.map(({ after }) => after);
  const affectedTaskIds = [
    ...new Set([
      ...added.map((session) => session.taskId),
      ...classified.removed.map(({ session }) => session.taskId),
      ...newlyMissed.map((session) => session.taskId),
    ]),
  ];

  return {
    sessions: [...working].sort(byTime),
    added,
    kept: classified.kept,
    removed: classified.removed,
    newlyMissed,
    unscheduled,
    warnings: classified.warnings,
    affectedTaskIds,
    summary: {
      addedCount: added.length,
      addedMinutes: added.reduce((sum, session) => sum + getSessionMinutes(session), 0),
      removedCount: classified.removed.length,
      keptCount: classified.kept.length,
      newlyMissedCount: newlyMissed.length,
      unscheduledCount: unscheduled.length,
      shortfallMinutes: unscheduled.reduce((sum, item) => sum + item.shortfallMinutes, 0),
      // Never "successful" while any task is left unscheduled.
      success: unscheduled.length === 0,
    },
  };
}

// Independent invariant checker, used by tests and later by the UI.
export function findScheduleViolations({ tasks, sessions, commitments, availability }) {
  const violations = [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const active = sessions.filter((session) => session.status !== 'missed').sort(byTime);

  active.forEach((session, index) => {
    const start = timeToMinutes(session.start);
    const end = timeToMinutes(session.end);

    for (let next = index + 1; next < active.length; next += 1) {
      const other = active[next];
      if (other.date !== session.date) break;
      if (intervalsOverlap(start, end, timeToMinutes(other.start), timeToMinutes(other.end))) {
        violations.push({ code: 'session-overlap', sessionIds: [session.id, other.id] });
      }
    }

    if (findCommitmentConflicts(commitments, session).length > 0) {
      violations.push({ code: 'commitment-overlap', sessionIds: [session.id] });
    }

    if (session.status === 'planned') {
      const task = taskById.get(session.taskId);
      if (
        task &&
        combineDateAndTime(session.date, session.end) > parseLocalDateTime(task.deadline)
      ) {
        violations.push({ code: 'after-deadline', sessionIds: [session.id] });
      }
      if (session.source === 'auto' && !isWithinAvailability(session, availability)) {
        violations.push({ code: 'outside-availability', sessionIds: [session.id] });
      }
    }
  });

  const byDate = new Map();
  active.forEach((session) => {
    if (!byDate.has(session.date)) byDate.set(session.date, []);
    byDate.get(session.date).push(session);
  });
  byDate.forEach((list, dateKey) => {
    const planned = list.filter((session) => session.status === 'planned');
    // Manual sessions may deliberately exceed the limit, so only fully automatic days are checked.
    if (planned.length === 0 || planned.some((session) => session.source !== 'auto')) return;
    const day = availability.days[getWeekdayKey(dateKey)];
    const total = list.reduce((sum, session) => sum + countedMinutes(session), 0);
    if (day && total > day.maxMinutes) {
      violations.push({ code: 'daily-limit', sessionIds: planned.map((session) => session.id) });
    }
  });

  return violations;
}