import { Lock } from 'lucide-react';
import { formatDateLabel, formatTimeRange } from '../../utils/dates';
import Badge from '../common/Badge';

const STATUS = {
  planned: { label: 'Planned', tone: 'brand' },
  completed: { label: 'Done', tone: 'success' },
  missed: { label: 'Missed', tone: 'danger' },
};

export default function SessionList({ sessions, tasksById, showDate = false }) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {sessions.map((session) => {
        const task = tasksById[session.taskId];
        const status = STATUS[session.status];
        return (
          <li
            key={session.id}
            className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{task ? task.title : 'Deleted task'}</span>
                {session.locked && (
                  <>
                    <Lock size={12} aria-hidden="true" className="shrink-0 text-slate-400" />
                    <span className="sr-only">Locked</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {showDate ? `${formatDateLabel(session.date)}, ` : ''}
                {formatTimeRange(session.start, session.end)}
                {task ? ` · ${task.subject}` : ''}
              </p>
            </div>
            <Badge tone={status.tone} className="shrink-0">
              {status.label}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}