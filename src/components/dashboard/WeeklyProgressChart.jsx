import cn from '../../utils/cn';
import { formatDuration, parseDateKey } from '../../utils/dates';

export default function WeeklyProgressChart({ days }) {
  const maxMinutes = Math.max(
    60,
    ...days.map((day) => Math.max(day.plannedMinutes, day.completedMinutes))
  );
  const barHeight = (minutes) =>
    minutes > 0 ? `${Math.max(4, Math.round((minutes / maxMinutes) * 100))}%` : '0%';

  return (
    <div>
      <ul className="sr-only">
        {days.map((day) => (
          <li key={day.dateKey}>
            {parseDateKey(day.dateKey).toLocaleDateString(undefined, { weekday: 'long' })}:{' '}
            {formatDuration(day.plannedMinutes)} planned, {formatDuration(day.completedMinutes)}{' '}
            completed
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {days.map((day) => {
          const label = parseDateKey(day.dateKey).toLocaleDateString(undefined, {
            weekday: 'short',
          });
          return (
            <div key={day.dateKey} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end justify-center gap-0.5 sm:gap-1">
                <div
                  className="w-2.5 rounded-t bg-brand-200 dark:bg-brand-500/30 sm:w-4"
                  style={{ height: barHeight(day.plannedMinutes) }}
                />
                <div
                  className="w-2.5 rounded-t bg-brand-600 sm:w-4"
                  style={{ height: barHeight(day.completedMinutes) }}
                />
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'text-[11px] font-medium sm:text-xs',
                    day.isToday
                      ? 'font-bold text-brand-600 dark:text-brand-300'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {label}
                </p>
                <p className="hidden text-[11px] text-slate-400 sm:block">
                  {formatDuration(day.plannedMinutes)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-200 dark:bg-brand-500/30" />
          Planned
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />
          Completed
        </span>
      </div>
    </div>
  );
}