import { AlertTriangle, Check, Lock, Plus, X } from 'lucide-react';
import cn from '../../utils/cn';
import {
  formatDuration,
  formatTimeRange,
  getWeekdayKey,
  parseDateKey,
} from '../../utils/dates';
import {
  COMMITMENT_CATEGORY_LABELS,
  getCommitmentsForDate,
} from '../../utils/schedulingHelpers';
import Badge from '../common/Badge';
import { Card } from '../common/Card';
import IconButton from '../common/IconButton';
import { SESSION_STYLES } from './sessionStyles';

export default function AgendaView({
  weekKeys,
  todayKey,
  sessions,
  commitments,
  availability,
  tasksById,
  conflictIds,
  onSelectSession,
  onAddSession,
}) {
  return (
    <div className="space-y-3">
      {weekKeys.map((dateKey) => {
        const date = parseDateKey(dateKey);
        const isToday = dateKey === todayKey;
        const day = availability.days[getWeekdayKey(dateKey)];
        const dayLabel = date.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        });

        const items = [
          ...sessions
            .filter((session) => session.date === dateKey)
            .map((session) => ({ kind: 'session', start: session.start, data: session })),
          ...getCommitmentsForDate(commitments, dateKey).map((commitment) => ({
            kind: 'commitment',
            start: commitment.start,
            data: commitment,
          })),
        ].sort((a, b) => a.start.localeCompare(b.start));

        return (
          <Card key={dateKey} padding="p-4" className={cn(isToday && 'ring-2 ring-brand-500/40')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {dayLabel}
                  {isToday && <Badge tone="brand">Today</Badge>}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {day.enabled
                    ? `Study window ${formatTimeRange(day.start, day.end)}, up to ${formatDuration(
                        day.maxMinutes
                      )}`
                    : 'Day off for studying'}
                </p>
              </div>
              <IconButton
                icon={Plus}
                label={`Add a session on ${dayLabel}`}
                onClick={() => onAddSession(dateKey)}
              />
            </div>

            {items.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Nothing planned.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {items.map((item) => {
                  if (item.kind === 'commitment') {
                    const commitment = item.data;
                    return (
                      <li
                        key={commitment.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{commitment.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {formatTimeRange(commitment.start, commitment.end)} · Fixed commitment
                          </p>
                        </div>
                        <Badge>{COMMITMENT_CATEGORY_LABELS[commitment.category]}</Badge>
                      </li>
                    );
                  }

                  const session = item.data;
                  const task = tasksById[session.taskId];
                  const styles = SESSION_STYLES[session.status];
                  const conflict = conflictIds.has(session.id);
                  const title = task ? task.title : 'Deleted task';
                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                        className={cn(
                          'flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:shadow-md',
                          styles.block,
                          conflict && 'ring-2 ring-rose-500'
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            <span className="truncate">{title}</span>
                            {session.locked && <Lock size={12} aria-label="Locked" className="shrink-0" />}
                            {conflict && (
                              <AlertTriangle
                                size={12}
                                aria-label="Conflicts with a fixed commitment"
                                className="shrink-0"
                              />
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs opacity-80">
                            {formatTimeRange(session.start, session.end)}
                            {task ? ` · ${task.subject}` : ''}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium">
                          {session.status === 'completed' && <Check size={14} aria-hidden="true" />}
                          {session.status === 'missed' && <X size={14} aria-hidden="true" />}
                          {styles.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}