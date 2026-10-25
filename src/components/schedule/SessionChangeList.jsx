import { formatDateLabel, formatDuration, formatTimeRange } from '../../utils/dates';
import { compareSessions, getSessionMinutes } from '../../utils/stats';

// items: [{ session, note? }]
export default function SessionChangeList({ items, tasksById, now }) {
  const sorted = [...items].sort((a, b) => compareSessions(a.session, b.session));

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {sorted.map(({ session, note }) => {
        const task = tasksById[session.taskId];
        return (
          <li key={session.id} className="py-2 first:pt-0 last:pb-0">
            <p className="break-words text-sm font-medium">{task ? task.title : 'Deleted task'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDateLabel(session.date, now)}, {formatTimeRange(session.start, session.end)} ·{' '}
              {formatDuration(getSessionMinutes(session))}
            </p>
            {note && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
          </li>
        );
      })}
    </ul>
  );
}