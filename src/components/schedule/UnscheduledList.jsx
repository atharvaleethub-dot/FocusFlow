import { PRIORITY_META } from '../../data/schema';
import { formatDeadline, formatDuration } from '../../utils/dates';
import Badge from '../common/Badge';

export default function UnscheduledList({ items, now }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const priority = PRIORITY_META[item.priority];
        return (
          <li
            key={item.taskId}
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words text-sm font-semibold">{item.title}</p>
              <Badge tone={priority.tone} className="shrink-0">
                {priority.label}
              </Badge>
            </div>
            <p className="mt-1 text-xs opacity-80">
              Scheduled {formatDuration(item.scheduledMinutes)} of{' '}
              {formatDuration(item.remainingMinutes)} remaining · short by{' '}
              {formatDuration(item.shortfallMinutes)} · due {formatDeadline(item.deadline, now)}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {item.reasons.map((reason) => (
                <li key={reason.code}>{reason.message}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}