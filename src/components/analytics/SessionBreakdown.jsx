import { CalendarClock } from 'lucide-react';
import { formatDuration } from '../../utils/dates';
import EmptyState from '../common/EmptyState';

export default function SessionBreakdown({ counts }) {
  const segments = [
    { key: 'completed', label: 'Completed', value: counts.completed, className: 'bg-emerald-500' },
    { key: 'upcoming', label: 'Planned (upcoming)', value: counts.upcoming, className: 'bg-brand-500' },
    { key: 'missed', label: 'Missed', value: counts.missed, className: 'bg-rose-500' },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return (
      <EmptyState
        compact
        icon={CalendarClock}
        title="No sessions yet"
        description="Completed, planned, and missed sessions will be compared here."
      />
    );
  }

  return (
    <div>
      <div
        role="img"
        aria-label={segments.map((segment) => `${segment.value} ${segment.label.toLowerCase()}`).join(', ')}
        className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            )
        )}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${segment.className}`} />
            <span className="text-slate-600 dark:text-slate-300">{segment.label}</span>
            <span className="ml-auto font-semibold">{segment.value}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        {counts.completionRate === null
          ? 'No finished sessions yet.'
          : `${Math.round(counts.completionRate * 100)}% of finished sessions were completed.`}{' '}
        {counts.rescheduled} rescheduled · {formatDuration(counts.missedMinutes)} of missed time.
      </p>
    </div>
  );
}