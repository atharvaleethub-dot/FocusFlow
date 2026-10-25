import { findScheduleViolations, generateSchedule } from '../services/scheduler';
import { combineDateAndTime, formatDeadline, formatDuration } from './dates';
import { getStalePlannedSessions } from './scheduleStatus';
import { getSessionMinutes, getTaskRemainingMinutes } from './stats';
import { getDeadlineInfo, pluralize } from './taskHelpers';

const SEVERITY_RANK = { danger: 0, warning: 1, info: 2 };

function listTitles(titles, limit = 3) {
  const shown = titles
    .slice(0, limit)
    .map((title) => `"${title}"`)
    .join(', ');
  return titles.length > limit ? `${shown} and ${titles.length - limit} more` : shown;
}

const alert = (fields) => ({ href: null, action: null, ...fields });

// Pure. Returns warnings sorted by severity. Types:
// overdue, due-soon, insufficient-capacity, unscheduled, conflict, invalid-session, stale
export function getScheduleAlerts({ tasks, sessions, commitments, availability, now = new Date() }) {
  const alerts = [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const titleOf = (taskId) => (taskById.get(taskId) ? taskById.get(taskId).title : 'Deleted task');
  const futurePlanned = sessions.filter(
    (session) => session.status === 'planned' && combineDateAndTime(session.date, session.end) > now
  );

  // Overdue and approaching deadlines.
  tasks
    .filter((task) => !task.completed)
    .forEach((task) => {
      const info = getDeadlineInfo(task, now);
      const remaining = getTaskRemainingMinutes(task, sessions);
      const scheduled = futurePlanned
        .filter((session) => session.taskId === task.id)
        .reduce((sum, session) => sum + getSessionMinutes(session), 0);

      if (info.state === 'overdue') {
        alerts.push(
          alert({
            id: `overdue-${task.id}`,
            severity: 'danger',
            type: 'overdue',
            title: `"${task.title}" is overdue`,
            message: `Due ${formatDeadline(task.deadline, now)} (${info.relative}). ${
              remaining > 0
                ? `${formatDuration(remaining)} of study time still remains.`
                : 'No study time remains, so you can mark it completed.'
            }`,
            href: '#/tasks',
          })
        );
      } else if (info.state === 'soon') {
        alerts.push(
          alert({
            id: `due-soon-${task.id}`,
            severity: 'warning',
            type: 'due-soon',
            title: `"${task.title}" is due soon`,
            message: `Due ${formatDeadline(task.deadline, now)} (${info.relative}). ${
              remaining > 0
                ? `${formatDuration(remaining)} remaining, ${formatDuration(scheduled)} scheduled.`
                : 'No study time remains.'
            }`,
            href: '#/tasks',
          })
        );
      }
    });

  // Capacity and scheduling gaps come from a dry run of the scheduling engine (nothing is saved).
  const plan = generateSchedule(
    { tasks, sessions, commitments, availability, now },
    { idGenerator: () => 'preview' }
  );

  const cannotFit = new Set();
  plan.unscheduled.forEach((item) => {
    const codes = item.reasons.map((reason) => reason.code);
    if (codes.includes('deadline-passed')) return; // already reported as overdue
    cannotFit.add(item.taskId);
    const capacity = codes.includes('insufficient-capacity') || codes.includes('no-availability');
    alerts.push(
      alert({
        id: `cannot-fit-${item.taskId}`,
        severity: capacity ? 'danger' : 'warning',
        type: capacity ? 'insufficient-capacity' : 'unscheduled',
        title: capacity
          ? `Not enough time for "${item.title}"`
          : `"${item.title}" cannot be fully scheduled`,
        message: `${formatDuration(item.shortfallMinutes)} cannot be scheduled before the deadline. ${item.reasons[0].message}`,
        href: capacity ? '#/settings' : '#/calendar',
      })
    );
  });

  const pending = new Map();
  plan.added.forEach((session) => {
    if (cannotFit.has(session.taskId)) return;
    pending.set(session.taskId, (pending.get(session.taskId) ?? 0) + getSessionMinutes(session));
  });
  if (pending.size > 0) {
    const minutes = [...pending.values()].reduce((sum, value) => sum + value, 0);
    alerts.push(
      alert({
        id: 'unscheduled-pending',
        severity: 'info',
        type: 'unscheduled',
        title: `${pluralize(pending.size, 'task')} ${
          pending.size === 1 ? 'has' : 'have'
        } time that is not scheduled yet`,
        message: `${formatDuration(minutes)} still needs calendar time (${listTitles(
          [...pending.keys()].map(titleOf)
        )}). Generate a schedule to plan it.`,
        action: 'generate',
      })
    );
  }

  // Conflicts and invalid sessions among upcoming planned sessions.
  const violations = findScheduleViolations({
    tasks,
    sessions: futurePlanned,
    commitments,
    availability,
  });
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const idsFor = (code) => [
    ...new Set(violations.filter((v) => v.code === code).flatMap((v) => v.sessionIds)),
  ];
  const describeIds = (ids) =>
    listTitles(ids.map((id) => titleOf(sessionById.get(id) ? sessionById.get(id).taskId : null)));
  const plural = (count) => (count === 1 ? 'overlaps' : 'overlap');

  const commitmentIds = idsFor('commitment-overlap');
  if (commitmentIds.length > 0) {
    alerts.push(
      alert({
        id: 'conflict-commitment',
        severity: 'warning',
        type: 'conflict',
        title: `${pluralize(commitmentIds.length, 'session')} ${plural(commitmentIds.length)} a fixed commitment`,
        message: `${describeIds(commitmentIds)}. Move ${
          commitmentIds.length === 1 ? 'it' : 'them'
        } to free time on the calendar.`,
        href: '#/calendar',
      })
    );
  }

  const overlapIds = idsFor('session-overlap');
  if (overlapIds.length > 0) {
    alerts.push(
      alert({
        id: 'conflict-sessions',
        severity: 'warning',
        type: 'conflict',
        title: `${pluralize(overlapIds.length, 'session')} overlap each other`,
        message: `${describeIds(overlapIds)}. Move one of them on the calendar.`,
        href: '#/calendar',
      })
    );
  }

  const lateIds = idsFor('after-deadline');
  if (lateIds.length > 0) {
    alerts.push(
      alert({
        id: 'invalid-after-deadline',
        severity: 'danger',
        type: 'invalid-session',
        title: `${pluralize(lateIds.length, 'session')} end${
          lateIds.length === 1 ? 's' : ''
        } after the task deadline`,
        message: `${describeIds(lateIds)}. Move ${
          lateIds.length === 1 ? 'it' : 'them'
        } earlier or extend the deadline.`,
        href: '#/calendar',
      })
    );
  }

  const outsideIds = idsFor('outside-availability');
  if (outsideIds.length > 0) {
    alerts.push(
      alert({
        id: 'invalid-outside-availability',
        severity: 'warning',
        type: 'invalid-session',
        title: `${pluralize(outsideIds.length, 'automatic session')} ${
          outsideIds.length === 1 ? 'is' : 'are'
        } outside your study availability`,
        message: `${describeIds(outsideIds)}. Generating a schedule replans them.`,
        action: 'generate',
      })
    );
  }

  const limitIds = idsFor('daily-limit');
  if (limitIds.length > 0) {
    alerts.push(
      alert({
        id: 'invalid-daily-limit',
        severity: 'warning',
        type: 'invalid-session',
        title: 'A day is planned above your daily study limit',
        message: `${describeIds(limitIds)}. Move some of that time to another day.`,
        href: '#/calendar',
      })
    );
  }

  const stale = getStalePlannedSessions(sessions, now);
  if (stale.length > 0) {
    alerts.push(
      alert({
        id: 'stale-sessions',
        severity: 'warning',
        type: 'stale',
        title: `${pluralize(stale.length, 'planned session')} ended without being completed`,
        message: 'Mark them completed if you studied, or reschedule the unfinished time.',
        action: 'reschedule',
      })
    );
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}