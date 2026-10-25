import { useState } from 'react';
import cn from '../../utils/cn';
import {
  formatTimeLabel,
  formatTimeRange,
  minutesToTime,
  parseDateKey,
  timeToMinutes,
} from '../../utils/dates';
import { getCommitmentsForDate, getVisibleRange } from '../../utils/schedulingHelpers';
import { buildMoveCandidate, computeMoveStart, validateSessionMove } from '../../utils/sessionMove';
import SessionBlock from './SessionBlock';
import { COMMITMENT_STRIPES } from './sessionStyles';

const HOUR_HEIGHT = 56;
const TIME_COLUMN = 56;
const MIN_DAY_WIDTH = 104;

export default function WeekCalendar({
  weekKeys,
  todayKey,
  now,
  sessions,
  commitments,
  availability,
  tasksById,
  conflictIds,
  state,
  canDrag,
  onSelectSession,
  onCreateAt,
  onMoveSession,
  onMoveByKey,
}) {
  const [drag, setDrag] = useState(null); // { sessionId, grabOffset, duration }
  const [target, setTarget] = useState(null); // { dateKey, startMinutes, candidate, validation }

  const pxPerMinute = HOUR_HEIGHT / 60;
  const weekSessions = sessions.filter((session) => weekKeys.includes(session.date));
  const weekCommitments = weekKeys.flatMap((dateKey) => getCommitmentsForDate(commitments, dateKey));
  const range = getVisibleRange([...weekSessions, ...weekCommitments], availability);
  const totalHeight = (range.endMin - range.startMin) * pxPerMinute;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const draggedSession = drag ? sessions.find((session) => session.id === drag.sessionId) : null;

  const hours = [];
  for (let minute = range.startMin; minute < range.endMin; minute += 60) hours.push(minute);

  const gridStyle = {
    gridTemplateColumns: `${TIME_COLUMN}px repeat(7, minmax(${MIN_DAY_WIDTH}px, 1fr))`,
  };

  const geometry = (item) => {
    const top = (timeToMinutes(item.start) - range.startMin) * pxPerMinute;
    const height = Math.max(22, (timeToMinutes(item.end) - timeToMinutes(item.start)) * pxPerMinute - 2);
    return { top: `${top + 1}px`, height: `${height}px`, heightPx: height };
  };

  const handleColumnClick = (event, dateKey) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const minutes = range.startMin + Math.floor(offset / pxPerMinute / 15) * 15;
    onCreateAt(dateKey, Math.max(0, Math.min(minutes, 24 * 60 - 15)));
  };

  const clearDrag = () => {
    setDrag(null);
    setTarget(null);
  };

  const handleDragStart = (event, session) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', session.id);
    setDrag({
      sessionId: session.id,
      grabOffset: (event.clientY - rect.top) / pxPerMinute,
      duration: timeToMinutes(session.end) - timeToMinutes(session.start),
    });
  };

  const handleDragOver = (event, dateKey) => {
    if (!drag || !draggedSession) return;
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerMinutes = range.startMin + (event.clientY - rect.top) / pxPerMinute;
    const startMinutes = computeMoveStart({
      pointerMinutes,
      grabOffsetMinutes: drag.grabOffset,
      durationMinutes: drag.duration,
    });

    if (target && target.dateKey === dateKey && target.startMinutes === startMinutes) {
      event.dataTransfer.dropEffect = target.validation.isValid ? 'move' : 'none';
      return;
    }

    const candidate = buildMoveCandidate(draggedSession, dateKey, startMinutes);
    const validation = validateSessionMove(state, draggedSession, candidate, now);
    setTarget({ dateKey, startMinutes, candidate, validation });
    event.dataTransfer.dropEffect = validation.isValid ? 'move' : 'none';
  };

  const handleDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setTarget(null);
  };

  const handleDrop = (event, dateKey) => {
    event.preventDefault();
    if (draggedSession && target && target.dateKey === dateKey) {
      onMoveSession(draggedSession, target.candidate);
    }
    clearDrag();
  };

  let statusText = canDrag
    ? 'Drag a planned session to move it. Locked sessions stay in place.'
    : 'Tap a session for details, then choose Edit to change its day or time.';
  let statusTone = 'text-slate-500 dark:text-slate-400';
  if (target) {
    const { validation, candidate } = target;
    if (!validation.isValid) {
      statusText = validation.errors[0];
      statusTone = 'font-medium text-rose-600 dark:text-rose-400';
    } else if (validation.isNoop) {
      statusText = 'Drop here to keep the session where it is.';
    } else if (validation.warnings.length > 0) {
      statusText = validation.warnings[0];
      statusTone = 'font-medium text-amber-700 dark:text-amber-400';
    } else {
      statusText = `Drop to move to ${formatTimeRange(candidate.start, candidate.end)}.`;
      statusTone = 'font-medium text-emerald-700 dark:text-emerald-400';
    }
  }

  return (
    <div>
      <p
        className={cn(
          'h-8 truncate border-b border-slate-200 px-3 text-xs leading-8 dark:border-slate-800',
          statusTone
        )}
      >
        {statusText}
      </p>

      <div
        role="region"
        aria-label="Weekly calendar"
        tabIndex={0}
        className="max-h-[70vh] overflow-auto"
      >
        <div style={{ minWidth: TIME_COLUMN + MIN_DAY_WIDTH * 7 }}>
          <div
            className="sticky top-0 z-30 grid border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            style={gridStyle}
          >
            <div />
            {weekKeys.map((dateKey) => {
              const date = parseDateKey(dateKey);
              const isToday = dateKey === todayKey;
              return (
                <div
                  key={dateKey}
                  className="border-l border-slate-200 py-2 text-center dark:border-slate-800"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {date.toLocaleDateString(undefined, { weekday: 'short' })}
                  </p>
                  <p
                    className={cn(
                      'mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                      isToday ? 'bg-brand-600 text-white' : 'text-slate-900 dark:text-slate-100'
                    )}
                    aria-label={isToday ? `${date.getDate()}, today` : undefined}
                  >
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid" style={gridStyle}>
            <div className="relative" style={{ height: totalHeight }}>
              {hours.map((minute, index) => (
                <span
                  key={minute}
                  className={cn(
                    'absolute right-2 text-[10px] text-slate-400',
                    index > 0 && '-translate-y-1/2'
                  )}
                  style={{ top: (minute - range.startMin) * pxPerMinute }}
                >
                  {formatTimeLabel(minutesToTime(minute))}
                </span>
              ))}
            </div>

            {weekKeys.map((dateKey) => {
              const date = parseDateKey(dateKey);
              const day =
                availability.days[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()]];
              const daySessions = weekSessions.filter((session) => session.date === dateKey);
              const dayCommitments = getCommitmentsForDate(commitments, dateKey);
              const windowStart = day.enabled ? timeToMinutes(day.start) : null;
              const windowEnd = day.enabled ? timeToMinutes(day.end) : null;
              const ghost = target && target.dateKey === dateKey ? target : null;

              let ghostTone = '';
              let ghostTop = 0;
              let ghostHeight = 0;
              if (ghost && drag) {
                const { validation } = ghost;
                if (!validation.isValid) {
                  ghostTone = 'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200';
                } else if (validation.isNoop) {
                  ghostTone = 'border-slate-400 bg-slate-400/10 text-slate-700 dark:text-slate-200';
                } else if (validation.warnings.length > 0) {
                  ghostTone = 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200';
                } else {
                  ghostTone =
                    'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200';
                }
                ghostTop = (ghost.startMinutes - range.startMin) * pxPerMinute;
                ghostHeight = Math.max(
                  0,
                  Math.min(drag.duration * pxPerMinute, totalHeight - ghostTop)
                );
              }

              return (
                <div
                  key={dateKey}
                  role="group"
                  aria-label={date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  onClick={(event) => handleColumnClick(event, dateKey)}
                  onDragOver={(event) => handleDragOver(event, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(event) => handleDrop(event, dateKey)}
                  className="relative cursor-cell border-l border-slate-200 dark:border-slate-800"
                  style={{ height: totalHeight }}
                >
                  {day.enabled ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 bg-brand-50/70 dark:bg-brand-500/5"
                      style={{
                        top: Math.max(0, (windowStart - range.startMin) * pxPerMinute),
                        height:
                          (Math.min(windowEnd, range.endMin) -
                            Math.max(windowStart, range.startMin)) *
                          pxPerMinute,
                      }}
                    />
                  ) : (
                    <div className="pointer-events-none absolute inset-0 bg-slate-100/70 dark:bg-slate-800/40" />
                  )}

                  {hours.map((minute) => (
                    <div
                      key={minute}
                      className="pointer-events-none absolute inset-x-0 border-t border-slate-200/70 dark:border-slate-800"
                      style={{ top: (minute - range.startMin) * pxPerMinute }}
                    />
                  ))}

                  {dayCommitments.map((commitment) => {
                    const { top, height, heightPx } = geometry(commitment);
                    return (
                      <div
                        key={commitment.id}
                        className="pointer-events-none absolute inset-x-0 z-0 overflow-hidden border-y border-slate-300 bg-slate-200/60 px-1.5 py-0.5 text-[10px] leading-tight text-slate-700 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-200"
                        style={{ top, height, backgroundImage: COMMITMENT_STRIPES }}
                      >
                        <p className="truncate font-semibold">{commitment.title}</p>
                        {heightPx >= 40 && (
                          <p className="truncate opacity-80">
                            {formatTimeRange(commitment.start, commitment.end)}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {daySessions.map((session) => {
                    const { top, height, heightPx } = geometry(session);
                    const task = tasksById[session.taskId];
                    const movable = session.status === 'planned' && !session.locked;
                    return (
                      <SessionBlock
                        key={session.id}
                        session={session}
                        title={task ? task.title : 'Deleted task'}
                        style={{ top, height }}
                        compact={heightPx < 40}
                        conflict={conflictIds.has(session.id)}
                        draggable={canDrag && movable}
                        dragging={Boolean(drag) && drag.sessionId === session.id}
                        onSelect={onSelectSession}
                        onDragStart={handleDragStart}
                        onDragEnd={clearDrag}
                        onMoveByKey={movable ? onMoveByKey : undefined}
                      />
                    );
                  })}

                  {ghost && drag && (
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-x-1 z-30 overflow-hidden rounded-lg border-2 border-dashed px-1.5 py-1 text-[10px] leading-tight',
                        ghostTone
                      )}
                      style={{ top: ghostTop, height: ghostHeight }}
                    >
                      <p className="truncate font-semibold">
                        {formatTimeRange(ghost.candidate.start, ghost.candidate.end)}
                      </p>
                    </div>
                  )}

                  {dateKey === todayKey && nowMin >= range.startMin && nowMin <= range.endMin && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-rose-500"
                      style={{ top: (nowMin - range.startMin) * pxPerMinute }}
                    >
                      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}